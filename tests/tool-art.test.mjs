// A arte das FERRAMENTAS — a nossa, não a clássica.
//
// Um teste por regra, valendo para as três ferramentas: grade, silhueta,
// transparência, papéis dos símbolos, paletas, materiais, determinismo e o
// `null` de segurança. As regras da família (cabo comum, acento,
// contorno tingido) ficam em `art-style.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PICARETA_GRADE,
    MACHADO_GRADE,
    PA_GRADE,
    PICARETA_PALETAS,
    MACHADO_PALETAS,
    PA_PALETAS,
    ACENTO,
    pickaxeGradeFor,
    pickaxePaletteFor,
    createPickaxeSpritePixels,
    axeGradeFor,
    axePaletteFor,
    createAxeSpritePixels,
    shovelGradeFor,
    shovelPaletteFor,
    createShovelSpritePixels,
} from '../world-tool-textures.js';
import { silhueta, cheios, pecaUnica, simbolosDe, lum, hex } from './tool-art.mjs';

const MATERIAIS = ['wood', 'stone', 'copper', 'iron', 'gold', 'diamond'];
const SIMBOLOS = ['.', 'O', '1', '2', '3', '4', '5', 'a', 'b', 'c', 'd', 'g', 's'];

const FERRAMENTAS = [
    {
        nome: 'picareta',
        grade: PICARETA_GRADE,
        paletas: PICARETA_PALETAS,
        gradeFor: pickaxeGradeFor,
        paletteFor: pickaxePaletteFor,
        criar: createPickaxeSpritePixels,
        silhuetaEsperada: [0, 0, 6, 10, 8, 4, 6, 6, 6, 6, 6, 4, 3, 3, 2, 0],
        totalEsperado: 70,
    },
    {
        nome: 'machado',
        grade: MACHADO_GRADE,
        paletas: MACHADO_PALETAS,
        gradeFor: axeGradeFor,
        paletteFor: axePaletteFor,
        criar: createAxeSpritePixels,
        silhuetaEsperada: [0, 3, 4, 5, 7, 7, 7, 6, 6, 3, 3, 3, 3, 3, 2, 0],
        totalEsperado: 62,
    },
    {
        nome: 'pá',
        grade: PA_GRADE,
        paletas: PA_PALETAS,
        gradeFor: shovelGradeFor,
        paletteFor: shovelPaletteFor,
        criar: createShovelSpritePixels,
        silhuetaEsperada: [0, 6, 9, 9, 9, 6, 4, 4, 4, 3, 3, 3, 3, 3, 3, 0],
        totalEsperado: 69,
    },
];

test('as três grades são 16×16 e só usam os símbolos da casa', () => {
    for (const f of FERRAMENTAS) {
        assert.equal(f.grade.length, 16, `${f.nome}: 16 linhas`);
        for (const linha of f.grade) {
            assert.equal(linha.length, 16, `${f.nome}: linha com 16 colunas — "${linha}"`);
            for (const c of linha) assert.ok(SIMBOLOS.includes(c), `${f.nome}: símbolo desconhecido "${c}"`);
        }
    }
});

test('a silhueta é a nossa, linha a linha, e cada ferramenta é uma peça só', () => {
    for (const f of FERRAMENTAS) {
        assert.deepEqual(silhueta(f.grade), f.silhuetaEsperada, `${f.nome}: perfil das linhas`);
        assert.equal(cheios(f.grade), f.totalEsperado, `${f.nome}: ${f.totalEsperado} px`);
        assert.equal(pecaUnica(f.grade), f.totalEsperado, `${f.nome}: tudo ligado numa peça só`);
    }
});

test('a arte é 1 px por célula, com fundo transparente', () => {
    for (const f of FERRAMENTAS) {
        for (const mat of MATERIAIS) {
            const px = f.criar(mat);
            assert.equal(px.length, 16, `${f.nome}/${mat}: 16 linhas`);
            for (let y = 0; y < 16; y++) {
                assert.equal(px[y].length, 16, `${f.nome}/${mat}: linha ${y} com 16 px`);
                for (let x = 0; x < 16; x++) {
                    const simbolo = f.grade[y][x];
                    if (simbolo === '.') assert.equal(px[y][x], null, `${f.nome}/${mat}: (${x},${y}) deveria ser vazio`);
                    else assert.ok(px[y][x], `${f.nome}/${mat}: (${x},${y}) é ferramenta e ficou vazio`);
                }
            }
        }
    }
});

test('cada símbolo tem o seu tom, e o acento é sempre o da casa', () => {
    for (const f of FERRAMENTAS) {
        for (const mat of MATERIAIS) {
            const px = f.criar(mat);
            const paleta = f.paletteFor(mat);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const s = f.grade[y][x];
                if (s === '.') continue;
                if (s === '5') {
                    assert.deepEqual(px[y][x], [...ACENTO], `${f.nome}/${mat}: (${x},${y}) é acento`);
                    continue;
                }
                if ('1234'.includes(s)) {
                    assert.deepEqual(px[y][x], [...paleta[s]], `${f.nome}/${mat}: (${x},${y}) tom "${s}"`);
                }
            }
        }
    }
});

test('as paletas vão do escuro ao claro e o contorno é o mais escuro', () => {
    for (const f of FERRAMENTAS) {
        const claras = new Set();
        for (const mat of MATERIAIS) {
            const p = f.paletteFor(mat);
            assert.deepEqual(Object.keys(p).sort(), ['1', '2', '3', '4', 'O'], `${f.nome}/${mat}: contorno + 4 tons`);
            for (let n = 1; n < 4; n++) {
                assert.ok(lum(p[String(n)]) < lum(p[String(n + 1)]),
                    `${f.nome}/${mat}: tom ${n} mais escuro que ${n + 1}`);
            }
            assert.ok(lum(p.O) < lum(p['1']), `${f.nome}/${mat}: o contorno é o mais escuro`);
            claras.add(hex(p['4']));
        }
        assert.equal(claras.size, MATERIAIS.length, `${f.nome}: cada material tem o seu tom mais claro`);
    }
});

test('os seis materiais se distinguem e nenhum par sai igual', () => {
    for (const f of FERRAMENTAS) {
        const cabeca = Object.fromEntries(MATERIAIS.map((mat) => [mat, (() => {
            const px = f.criar(mat);
            const canais = [[], [], []];
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                if (!'O12345'.includes(f.grade[y][x])) continue;
                for (let i = 0; i < 3; i++) canais[i].push(px[y][x][i]);
            }
            return canais.map((a) => a.reduce((s, v) => s + v, 0) / a.length);
        })()]));
        assert.ok(cabeca.wood[0] - cabeca.wood[2] > 40, `${f.nome}: madeira é marrom`);
        assert.ok(Math.abs(cabeca.stone[0] - cabeca.stone[2]) < 20, `${f.nome}: pedra é cinza`);
        assert.ok(cabeca.copper[0] - cabeca.copper[2] > 45, `${f.nome}: cobre é quente`);
        assert.ok(Math.abs(cabeca.iron[0] - cabeca.iron[2]) < 25, `${f.nome}: ferro é neutro`);
        assert.ok(cabeca.gold[0] - cabeca.gold[2] > 80 && cabeca.gold[1] - cabeca.gold[2] > 55, `${f.nome}: ouro é amarelo`);
        assert.ok(cabeca.diamond[2] - cabeca.diamond[0] > 50, `${f.nome}: diamante é ciano`);
        for (let i = 0; i < MATERIAIS.length; i++) for (let j = i + 1; j < MATERIAIS.length; j++) {
            assert.notDeepEqual(f.criar(MATERIAIS[i]), f.criar(MATERIAIS[j]),
                `${f.nome}: ${MATERIAIS[i]} e ${MATERIAIS[j]} não podem ser iguais`);
        }
    }
});

test('a arte é determinística e não compartilha sprite entre chamadas', () => {
    for (const f of FERRAMENTAS) {
        for (const mat of MATERIAIS) {
            assert.deepEqual(f.criar(mat), f.criar(mat), `${f.nome}/${mat}: duas chamadas dão a mesma arte`);
            for (const linha of f.criar(mat)) for (const c of linha) {
                if (!c) continue;
                assert.equal(c.length, 3, `${f.nome}/${mat}: cor é [r,g,b]`);
                for (const canal of c) assert.ok(canal >= 0 && canal <= 255, `${f.nome}/${mat}: canal ${canal}`);
            }
            assert.equal(f.gradeFor(mat), f.grade, `${f.nome}/${mat}: a grade é a mesma`);
        }
        const a = f.criar('iron');
        const antes = JSON.stringify(a);
        a[1][8] = [1, 2, 3];
        assert.equal(JSON.stringify(f.criar('iron')), antes, `${f.nome}: a arte não é compartilhada`);
    }
});

test('material fora da arte devolve null, para quem chama cair no desenho antigo', () => {
    for (const f of FERRAMENTAS) {
        assert.equal(f.criar('tin'), null, `${f.nome}: sprite`);
        assert.equal(f.gradeFor('tin'), null, `${f.nome}: grade`);
        assert.equal(f.paletteFor('tin'), null, `${f.nome}: paleta`);
        for (const mat of MATERIAIS) assert.ok(f.gradeFor(mat), `${f.nome}: ${mat} tem arte`);
    }
});

test('picareta e machado são base fiel com ajustes: sem couro, com o acento no topo', () => {
    // As duas ficaram na versão "cor + forma": cabo liso, sem faixa de couro.
    const SEM_COURO = ['1', '2', '3', '4', '5', 'O', 'a', 'b', 'c', 'd'];
    assert.deepEqual(simbolosDe(PICARETA_GRADE), SEM_COURO, 'picareta sem couro');
    assert.deepEqual(simbolosDe(MACHADO_GRADE), SEM_COURO, 'machado sem couro');
    // A pá ainda tem a faixa do #122: a rodada dela não chegou.
    assert.ok(simbolosDe(PA_GRADE).includes('g'), 'pá ainda tem couro');
    assert.ok(simbolosDe(PA_GRADE).includes('s'), 'pá ainda tem costura');
    // O acento é um só, no topo da cabeça, e sempre no tom mais claro de lá.
    const acentos = (grade) => {
        const p = [];
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (grade[y][x] === '5') p.push([x, y]);
        return p;
    };
    assert.deepEqual(acentos(PICARETA_GRADE), [[6, 3]], 'picareta: acento em (6,3)');
    assert.deepEqual(acentos(MACHADO_GRADE), [[8, 2]], 'machado: acento em (8,2)');
});
