// O ITEM de picareta: a arte transcrita do desenho clássico.
//
// Um desenho só (16×16) para todos os materiais; o que muda é a paleta, com nove
// tons: contorno (`O`), quatro da cabeça (`1`…`4`, do escuro ao reflexo) e quatro
// do cabo (`a`…`d`, do escuro ao claro).
//
// A grade e as paletas foram conferidas contra os sprites originais: cada
// material sai **pixel a pixel** igual. Os testes abaixo travam a silhueta, os
// papéis de cada símbolo e as cores por material, para o desenho não degenerar.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PICARETA_GRADE,
    CABO_PALETA,
    PICARETA_PALETAS,
    pickaxeMateriais,
    pickaxeGradeFor,
    pickaxePaletteFor,
    createPickaxeSpritePixels,
} from '../world-tool-textures.js';

const dentro = (x, y) => (PICARETA_GRADE[y]?.[x] ?? '.') !== '.';
const sprite = (mat) => createPickaxeSpritePixels(mat);
const cor = (mat, x, y) => sprite(mat)[y][x];
const chave = (c) => c.join(',');

const MATERIAIS = ['wood', 'stone', 'copper', 'iron', 'gold', 'diamond'];
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const media = (px) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const linha of px) for (const c of linha) {
        if (!c) continue;
        r += c[0]; g += c[1]; b += c[2]; n++;
    }
    return [r / n, g / n, b / n];
};

test('a grade da picareta é 16×16, só com os símbolos do desenho', () => {
    assert.equal(PICARETA_GRADE.length, 16, '16 linhas');
    for (const linha of PICARETA_GRADE) {
        assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
        assert.match(linha, /^[.O1-4a-d]+$/, 'só ".", "O", "1"–"4" e "a"–"d"');
    }
});

test('a silhueta é a da picareta clássica: 68 px, cabeça em cima e cabo na diagonal', () => {
    assert.deepEqual(PICARETA_GRADE.map((l) => [...l].filter((c) => c !== '.').length),
        [0, 0, 5, 9, 8, 4, 6, 6, 6, 6, 6, 4, 3, 3, 2, 0],
        'barra da cabeça em cima, haste à direita e cabo descendo à esquerda');

    const cheios = PICARETA_GRADE.join('').split('').filter((c) => c !== '.').length;
    assert.equal(cheios, 68, 'a picareta ocupa 68 px');

    // Uma peça só: nada de farelo solto.
    const vistos = new Set(['6,2']);
    const pilha = [[6, 2]];
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
    assert.equal(tamanho, 68, 'a picareta é uma peça só');
});

test('a arte é 1 px por célula, com fundo transparente', () => {
    for (const mat of MATERIAIS) {
        const px = sprite(mat);
        assert.equal(px.length, 16, `${mat}: 16 linhas`);
        for (let y = 0; y < 16; y++) {
            assert.equal(px[y].length, 16, `${mat}: linha ${y} com 16 px`);
            for (let x = 0; x < 16; x++) {
                if (dentro(x, y)) assert.ok(px[y][x], `${mat}: (${x},${y}) é ferramenta e ficou vazio`);
                else assert.equal(px[y][x], null, `${mat}: (${x},${y}) está fora da picareta`);
            }
        }
    }
});

test('cada símbolo tem um tom, e todos os símbolos da grade existem nas paletas', () => {
    const simbolos = new Set(PICARETA_GRADE.join('').split('').filter((c) => c !== '.'));
    assert.deepEqual([...simbolos].sort(), ['1', '2', '3', '4', 'O', 'a', 'b', 'c', 'd']);

    for (const mat of MATERIAIS) {
        const paleta = pickaxePaletteFor(mat);
        for (const s of simbolos) {
            const cor = paleta[s] ?? CABO_PALETA[s];
            assert.ok(cor, `${mat}: falta o tom de "${s}"`);
            assert.equal(cor.length, 3, `${mat}: "${s}" é [r,g,b]`);
        }
    }

    // E cada pixel usa mesmo o tom escrito na grade.
    for (const mat of MATERIAIS) {
        const paleta = { ...CABO_PALETA, ...pickaxePaletteFor(mat) };
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const s = PICARETA_GRADE[y][x];
            if (s === '.') continue;
            assert.equal(chave(cor(mat, x, y)), chave(paleta[s]), `${mat}: (${x},${y}) deveria usar "${s}"`);
        }
    }
});

test('a cabeça é a barra de cima e a haste da direita; o cabo é a diagonal', () => {
    // A barra de cima é toda cabeça (ou contorno).
    for (let x = 6; x <= 10; x++) assert.ok('1234'.includes(PICARETA_GRADE[2][x]), `barra de cima em (${x},2)`);
    // A haste da direita também.
    for (let y = 5; y <= 10; y++) assert.ok('O1234'.includes(PICARETA_GRADE[y][13]), `haste em (13,${y})`);
    // O cabo desce à esquerda: lá embaixo só tem cabo.
    for (let x = 2; x <= 5; x++) assert.ok('abcd'.includes(PICARETA_GRADE[13][x]) || PICARETA_GRADE[13][x] === '.',
        `cabo em (${x},13)`);
    // O reflexo (tom 4) fica na haste, embaixo à direita — é o brilho do gume.
    const reflexos = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (PICARETA_GRADE[y][x] === '4') reflexos.push([x, y]);
    }
    assert.deepEqual(reflexos, [[6, 3], [13, 10]], 'dois pixels de reflexo, na cabeça');
});

test('cada material tem a sua paleta, e os tons vão do escuro ao claro', () => {
    const vistas = new Set();
    for (const mat of MATERIAIS) {
        const paleta = pickaxePaletteFor(mat);
        assert.ok(paleta, `${mat} tem paleta`);
        assert.equal(chave(paleta.O), chave(PICARETA_PALETAS[mat].O), `${mat}: usa a própria paleta`);
        // Dentro da cabeça, o tom cresce com o número.
        for (let n = 1; n < 4; n++) {
            assert.ok(lum(paleta[String(n)]) < lum(paleta[String(n + 1)]),
                `${mat}: tom ${n} mais escuro que ${n + 1}`);
        }
        assert.ok(lum(paleta.O) < lum(paleta['1']), `${mat}: o contorno é o mais escuro`);
        vistas.add(chave(paleta['4']));
    }
    assert.equal(vistas.size, MATERIAIS.length, 'nenhum material repete a cor da cabeça de outro');
});

test('os materiais se distinguem pela cor: madeira, pedra, cobre, ferro, ouro e diamante', () => {
    // A média é só da **cabeça** — o cabo é madeira em todas, e puxaria a cor
    // da pedra e do diamante para o marrom.
    const cabeca = (mat) => {
        const px = sprite(mat);
        const caixa = [[], [], []];
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            if (!'O1234'.includes(PICARETA_GRADE[y][x])) continue;
            for (let i = 0; i < 3; i++) caixa[i].push(px[y][x][i]);
        }
        return caixa.map((a) => a.reduce((s, v) => s + v, 0) / a.length);
    };
    const m = Object.fromEntries(MATERIAIS.map((mat) => [mat, cabeca(mat)]));
    assert.ok(m.wood[0] - m.wood[2] > 30, 'madeira é marrom (vermelho acima do azul)');
    assert.ok(Math.abs(m.stone[0] - m.stone[2]) < 4 && Math.abs(m.stone[0] - m.stone[1]) < 4, 'pedra é cinza');
    assert.ok(m.copper[0] - m.copper[2] > 50, 'cobre é quente');
    assert.ok(Math.abs(m.iron[0] - m.iron[2]) < 4 && m.iron[0] > 90, 'ferro é claro e neutro');
    assert.ok(m.gold[1] - m.gold[2] > 70, 'ouro é amarelo');
    assert.ok(m.diamond[2] - m.diamond[0] > 60, 'diamante é ciano');

    // E nenhum par de materiais desenha os mesmos pixels.
    for (let i = 0; i < MATERIAIS.length; i++) for (let j = i + 1; j < MATERIAIS.length; j++) {
        assert.notDeepEqual(sprite(MATERIAIS[i]), sprite(MATERIAIS[j]),
            `${MATERIAIS[i]} e ${MATERIAIS[j]} não podem ser iguais`);
    }
});

test('material fora da arte devolve null, para quem chama cair no desenho antigo', () => {
    assert.equal(createPickaxeSpritePixels('tin'), null);
    assert.equal(pickaxeGradeFor('tin'), null);
    assert.equal(pickaxePaletteFor('tin'), null);
    assert.deepEqual(pickaxeMateriais(), MATERIAIS, 'os materiais são exatamente os do jogo');
    // E os do jogo todos têm arte (não sobrou nenhum no desenho antigo).
    for (const mat of MATERIAIS) assert.ok(pickaxeGradeFor(mat), `${mat} tem arte`);
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    for (const mat of MATERIAIS) {
        assert.deepEqual(createPickaxeSpritePixels(mat), sprite(mat), `${mat}: duas chamadas dão a mesma arte`);
        for (const linha of sprite(mat)) for (const c of linha) {
            if (!c) continue;
            assert.equal(c.length, 3, 'cor é [r,g,b]');
            for (const canal of c) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
        }
    }
    // O sprite é novo a cada chamada: mexer num não estraga o outro.
    const a = sprite('iron');
    a[2][6] = [1, 2, 3];
    assert.notDeepEqual(sprite('iron')[2][6], [1, 2, 3], 'a arte não é compartilhada entre chamadas');
});
