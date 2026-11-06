// O ITEM de machado: a arte transcrita do desenho clássico.
//
// Mesma receita da picareta: um desenho só (16×16) para todos os materiais, e uma
// paleta por material. A diferença é que a cabeça do machado tem **cinco** tons
// (`1`…`5`), um a mais que a da picareta.
//
// A grade e as paletas foram conferidas contra os sprites originais: cada
// material sai **pixel a pixel** igual.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MACHADO_GRADE,
    CABO_PALETA,
    MACHADO_PALETAS,
    axeGradeFor,
    axePaletteFor,
    createAxeSpritePixels,
    createPickaxeSpritePixels,
} from '../world-tool-textures.js';

const dentro = (x, y) => (MACHADO_GRADE[y]?.[x] ?? '.') !== '.';
const sprite = (mat) => createAxeSpritePixels(mat);
const cor = (mat, x, y) => sprite(mat)[y][x];
const chave = (c) => c.join(',');

const MATERIAIS = ['wood', 'stone', 'copper', 'iron', 'gold', 'diamond'];
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

test('a grade do machado é 16×16, só com os símbolos do desenho', () => {
    assert.equal(MACHADO_GRADE.length, 16, '16 linhas');
    for (const linha of MACHADO_GRADE) {
        assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
        assert.match(linha, /^[.O1-5a-d]+$/, 'só ".", "O", "1"–"5" e "a"–"d"');
    }
});

test('a silhueta é a do machado clássico: 60 px, gume em cima e cabo na diagonal', () => {
    assert.deepEqual(MACHADO_GRADE.map((l) => [...l].filter((c) => c !== '.').length),
        [0, 2, 4, 5, 7, 7, 7, 6, 5, 3, 3, 3, 3, 3, 2, 0],
        'cabeça encorpada em cima à esquerda e cabo descendo à esquerda');

    const cheios = MACHADO_GRADE.join('').split('').filter((c) => c !== '.').length;
    assert.equal(cheios, 60, 'o machado ocupa 60 px');

    const vistos = new Set(['9,1']);
    const pilha = [[9, 1]];
    let tamanho = 0;
    while (pilha.length) {
        const [x, y] = pilha.pop();
        tamanho++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!dentro(nx, ny) || vistos.has(`${nx},${ny}`)) continue;
            vistos.add(`${nx},${ny}`);
            pilha.push([nx, ny]);
        }
    }
    assert.equal(tamanho, 60, 'o machado é uma peça só');
});

test('a arte é 1 px por célula, com fundo transparente', () => {
    for (const mat of MATERIAIS) {
        const px = sprite(mat);
        assert.equal(px.length, 16, `${mat}: 16 linhas`);
        for (let y = 0; y < 16; y++) {
            assert.equal(px[y].length, 16, `${mat}: linha ${y} com 16 px`);
            for (let x = 0; x < 16; x++) {
                if (dentro(x, y)) assert.ok(px[y][x], `${mat}: (${x},${y}) é ferramenta e ficou vazio`);
                else assert.equal(px[y][x], null, `${mat}: (${x},${y}) está fora do machado`);
            }
        }
    }
});

test('cada símbolo tem um tom, e os cinco tons de cabeça aparecem', () => {
    const simbolos = new Set(MACHADO_GRADE.join('').split('').filter((c) => c !== '.'));
    assert.deepEqual([...simbolos].sort(), ['1', '2', '3', '4', '5', 'O', 'a', 'b', 'c', 'd']);

    for (const mat of MATERIAIS) {
        const paleta = { ...CABO_PALETA, ...axePaletteFor(mat) };
        for (const s of simbolos) assert.ok(paleta[s], `${mat}: falta o tom de "${s}"`);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const s = MACHADO_GRADE[y][x];
            if (s === '.') continue;
            assert.equal(chave(cor(mat, x, y)), chave(paleta[s]), `${mat}: (${x},${y}) deveria usar "${s}"`);
        }
    }
});

test('a cabeça é o gume de cima e o cabo é a diagonal; o reflexo fica no gume', () => {
    // O topo do machado é a cabeça. O cabo só aparece atrás dela na altura do
    // encaixe (linhas 4 e 5), onde o desenho clássico mostra a madeira.
    for (let y = 1; y <= 3; y++) {
        assert.ok([...MACHADO_GRADE[y]].every((c) => c === '.' || '12345O'.includes(c)),
            `linha ${y} é só cabeça/contorno`);
    }
    for (let y = 4; y <= 5; y++) {
        const cabeca = [...MACHADO_GRADE[y]].filter((c) => '12345'.includes(c)).length;
        const cabo = [...MACHADO_GRADE[y]].filter((c) => 'abcd'.includes(c)).length;
        assert.ok(cabeca >= 4, `linha ${y} tem cabeça (${cabeca} px)`);
        assert.ok(cabo <= 2, `e só um fio de cabo atrás do encaixe (${cabo} px)`);
    }
    // Lá embaixo só tem cabo.
    for (const [x, y] of [[2, 13], [3, 12], [4, 11]]) {
        assert.ok('abcd'.includes(MACHADO_GRADE[y][x]), `cabo em (${x},${y})`);
    }
    // O reflexo (tom 5) fica no fio do gume, na parte de cima.
    const reflexos = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (MACHADO_GRADE[y][x] === '5') reflexos.push([x, y]);
    }
    assert.deepEqual(reflexos, [[9, 2], [10, 2], [8, 3], [7, 4], [7, 5]], 'cinco pixels de reflexo, no gume');
});

test('cada material tem a sua paleta, com os tons crescendo do escuro ao claro', () => {
    const vistas = new Set();
    for (const mat of MATERIAIS) {
        const paleta = axePaletteFor(mat);
        assert.ok(paleta, `${mat} tem paleta`);
        for (let n = 1; n < 5; n++) {
            assert.ok(lum(paleta[String(n)]) < lum(paleta[String(n + 1)]),
                `${mat}: tom ${n} mais escuro que ${n + 1}`);
        }
        assert.ok(lum(paleta.O) < lum(paleta['1']), `${mat}: o contorno é o mais escuro`);
        vistas.add(chave(paleta['5']));
    }
    assert.equal(vistas.size, MATERIAIS.length, 'nenhum material repete a cor mais clara de outro');
});

test('os materiais se distinguem pela cor da cabeça', () => {
    const cabeca = (mat) => {
        const px = sprite(mat);
        const caixa = [[], [], []];
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            if (!'O12345'.includes(MACHADO_GRADE[y][x])) continue;
            for (let i = 0; i < 3; i++) caixa[i].push(px[y][x][i]);
        }
        return caixa.map((a) => a.reduce((s, v) => s + v, 0) / a.length);
    };
    const m = Object.fromEntries(MATERIAIS.map((mat) => [mat, cabeca(mat)]));
    assert.ok(m.wood[0] - m.wood[2] > 30, 'madeira é marrom');
    assert.ok(Math.abs(m.stone[0] - m.stone[2]) < 4, 'pedra é cinza');
    assert.ok(m.copper[0] - m.copper[2] > 50, 'cobre é quente');
    assert.ok(Math.abs(m.iron[0] - m.iron[2]) < 4 && m.iron[0] > 90, 'ferro é claro e neutro');
    assert.ok(m.gold[1] - m.gold[2] > 70, 'ouro é amarelo');
    assert.ok(m.diamond[2] - m.diamond[0] > 60, 'diamante é ciano');

    for (let i = 0; i < MATERIAIS.length; i++) for (let j = i + 1; j < MATERIAIS.length; j++) {
        assert.notDeepEqual(sprite(MATERIAIS[i]), sprite(MATERIAIS[j]),
            `${MATERIAIS[i]} e ${MATERIAIS[j]} não podem ser iguais`);
    }
});

test('machado e picareta são desenhos diferentes, do mesmo material', () => {
    for (const mat of MATERIAIS) {
        assert.notDeepEqual(axeGradeFor(mat), null, `${mat} tem machado`);
        const picareta = createPickaxeSpritePixels(mat);
        assert.notDeepEqual(sprite(mat), picareta, `${mat}: machado ≠ picareta`);
        const cheios = (px) => px.flat().filter(Boolean).length;
        assert.equal(cheios(sprite(mat)), 60, 'o machado é mais compacto que a picareta');
        assert.equal(cheios(picareta), 68, 'e a picareta continua com 68 px');
    }
    // E as paletas do machado têm cinco tons de cabeça (a picareta tem quatro).
    assert.deepEqual(Object.keys(MACHADO_PALETAS.iron).sort(), ['1', '2', '3', '4', '5', 'O']);
    assert.equal(Object.keys(MACHADO_PALETAS.iron).filter((k) => /^[1-5]$/.test(k)).length, 5);
});

test('material fora da arte devolve null, para quem chama cair no desenho antigo', () => {
    assert.equal(createAxeSpritePixels('tin'), null);
    assert.equal(axeGradeFor('tin'), null);
    assert.equal(axePaletteFor('tin'), null);
    for (const mat of MATERIAIS) assert.ok(axeGradeFor(mat), `${mat} tem arte`);
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    for (const mat of MATERIAIS) {
        assert.deepEqual(createAxeSpritePixels(mat), sprite(mat), `${mat}: duas chamadas dão a mesma arte`);
        for (const linha of sprite(mat)) for (const c of linha) {
            if (!c) continue;
            assert.equal(c.length, 3, 'cor é [r,g,b]');
            for (const canal of c) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
        }
    }
    const a = sprite('iron');
    a[1][9] = [1, 2, 3];
    assert.notDeepEqual(sprite('iron')[1][9], [1, 2, 3], 'a arte não é compartilhada entre chamadas');
});
