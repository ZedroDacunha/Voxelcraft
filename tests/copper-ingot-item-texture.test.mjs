// O ITEM de lingote de cobre: a forma clássica do lingote, na cor do cobre.
//
// Lingote não é pedra: é **metal fundido**, e a arte é de barra. A forma — e o
// sombreado — vêm do desenho clássico do lingote dos jogos de bloco, transcrito
// pixel a pixel: a barra tombada na diagonal, face de cima na luz, corpo em
// sombra embaixo e à direita, contorno escuro fechando a silhueta.
//
// Arte de item: 16×16 px, 1 px por célula, fundo transparente, 5 tons.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createMineralSpritePixels,
    ingotItemGradeFor,
    rawItemMaskFor,
    gemItemMaskFor,
} from '../world-mineral-textures.js';

const GRADE = ingotItemGradeFor('copper');
const dentro = (x, y) => (GRADE?.[y]?.[x] ?? '.') !== '.';
const sprite = createMineralSpritePixels('ingot', 'copper');
const cor = (x, y) => sprite[y][x];
const tom = (x, y) => Number(GRADE[y][x]);

/** Paleta do cobre fundido, na ordem dos tons do desenho. */
const PALETA = [
    [62, 30, 22],
    [128, 62, 40],
    [146, 72, 46],
    [246, 182, 132],
    [255, 236, 206],
];
const chave = (c) => c.join(',');
const daPaleta = (c) => PALETA.some((p) => chave(p) === chave(c));

const media = (px) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const linha of px) for (const c of linha) {
        if (!c) continue;
        r += c[0]; g += c[1]; b += c[2]; n++;
    }
    return [r / n, g / n, b / n];
};

test('a forma do lingote é 16×16, com tom escrito em cada pixel', () => {
    assert.ok(GRADE, 'o cobre precisa da arte desenhada do lingote');
    assert.equal(GRADE.length, 16, '16 linhas');
    for (const linha of GRADE) {
        assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
        assert.match(linha, /^[0-4.]+$/, 'só "." (vazio) e os tons de 0 a 4');
    }
});

test('a silhueta é a do lingote: ponta em cima, cheia no meio, ponta embaixo', () => {
    assert.deepEqual(GRADE.map((l) => [...l].filter((c) => c !== '.').length),
        [0, 0, 2, 6, 10, 14, 16, 16, 16, 16, 15, 12, 8, 4, 0, 0],
        'a barra tombada: entra pela quina de cima, enche no meio e afina até a ponta de baixo');

    const cheios = GRADE.join('').split('').filter((c) => c !== '.').length;
    assert.equal(cheios, 135, 'a barra ocupa 135 px');
    const cobertura = cheios / 256;
    assert.ok(cobertura > 0.45 && cobertura < 0.60, `cobertura ${(cobertura * 100).toFixed(0)}%`);

    // Uma peça só: nada de farelo solto em volta da barra.
    const vistos = new Set(['10,2']);
    const pilha = [[10, 2]];
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
    assert.equal(tamanho, 135, 'a barra é uma peça só');
});

test('a arte é 1 px por célula, com fundo transparente', () => {
    assert.equal(sprite.length, 16, '16 linhas de pixels');
    for (let y = 0; y < 16; y++) {
        assert.equal(sprite[y].length, 16, `linha ${y} com 16 px`);
        for (let x = 0; x < 16; x++) {
            if (dentro(x, y)) assert.ok(cor(x, y), `(${x},${y}) é metal e ficou vazio`);
            else assert.equal(cor(x, y), null, `(${x},${y}) está fora da barra`);
        }
    }
});

test('os cinco tons do cobre são usados, e só eles', () => {
    const usadas = new Set(sprite.flat().filter(Boolean).map(chave));
    assert.equal(usadas.size, 5, `a barra usa os cinco tons (tem ${usadas.size})`);
    for (const c of sprite.flat().filter(Boolean)) assert.ok(daPaleta(c), `cor fora da paleta: ${chave(c)}`);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!dentro(x, y)) continue;
        assert.equal(chave(cor(x, y)), chave(PALETA[tom(x, y)]), `(${x},${y}) usa o tom escrito no desenho`);
    }
});

test('o contorno escuro fecha a barra, e o interior é muito mais claro', () => {
    const contorno = [];
    const interior = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!dentro(x, y)) continue;
        const naBorda = !dentro(x - 1, y) || !dentro(x + 1, y) || !dentro(x, y - 1) || !dentro(x, y + 1);
        (naBorda ? contorno : interior).push(tom(x, y));
    }
    const mediaTom = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    assert.ok(contorno.length >= 30, `a barra tem contorno em ${contorno.length} px`);
    assert.ok(mediaTom(contorno) <= 0.5, `o contorno é escuro (média ${mediaTom(contorno).toFixed(2)})`);
    assert.ok(mediaTom(interior) >= 2, `o interior é claro (média ${mediaTom(interior).toFixed(2)})`);
});

test('a luz vem de cima: face clara em cima, corpo em sombra embaixo', () => {
    const mediaTom = (ys) => {
        let s = 0, n = 0;
        for (const y of ys) for (const c of GRADE[y]) if (c !== '.') { s += Number(c); n++; }
        return s / n;
    };
    const cima = mediaTom([0, 1, 2, 3, 4, 5, 6, 7]);
    const baixo = mediaTom([8, 9, 10, 11, 12, 13, 14, 15]);
    assert.ok(cima > baixo, `topo ${cima.toFixed(2)} × base ${baixo.toFixed(2)}`);

    // O reflexo (tom 4) fica na face de cima — é ele que faz o metal brilhar.
    const linhasDoReflexo = new Set();
    GRADE.forEach((linha, y) => { for (const c of linha) if (c === '4') linhasDoReflexo.add(y); });
    assert.ok(linhasDoReflexo.size >= 3, `o reflexo aparece em ${linhasDoReflexo.size} linhas`);
    assert.ok(Math.max(...linhasDoReflexo) <= 9, 'e sempre na metade de cima da barra');
});

test('o metal é cobre: quente, e não se confunde com o minério bruto', () => {
    const m = media(sprite);
    assert.ok(m[0] > m[1] && m[1] > m[2], `cobre fora do vermelho? ${m.map((v) => v.toFixed(0)).join('/')}`);
    assert.ok(m[0] - m[2] > 70, `pouco vermelho: R−B = ${(m[0] - m[2]).toFixed(0)}`);

    // O minério bruto do cobre continua sendo os grumos, com outra arte.
    const bruto = createMineralSpritePixels('raw', 'copper');
    assert.ok(rawItemMaskFor('copper'), 'o cobre bruto mantém a máscara dele');
    assert.notDeepEqual(bruto, sprite, 'lingote e minério bruto são artes diferentes');
    const cheios = (px) => px.flat().filter(Boolean).length;
    assert.ok(cheios(sprite) > cheios(bruto), 'a barra ocupa mais que os grumos');
});

test('o ouro ainda é o genérico, e ninguém herdou a arte por engano', () => {
    assert.equal(ingotItemGradeFor('gold'), null, 'o ouro ainda não foi redesenhado');
    assert.equal(gemItemMaskFor('copper'), null, 'cobre não é gema');

    // Genérico = o retângulo chapado de sempre: 10 × 8 px, sem um pixel a mais.
    const ouro = createMineralSpritePixels('ingot', 'gold');
    assert.equal(ouro.flat().filter(Boolean).length, 80, 'o ouro continua no retângulo de 80 px');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dentroDoRetangulo = x >= 3 && x <= 12 && y >= 4 && y <= 11;
        assert.equal(Boolean(ouro[y][x]), dentroDoRetangulo, `ouro em (${x},${y})`);
    }

    // O ferro já tem arte, mas com a paleta dele: mesma forma, outra cor.
    assert.deepEqual(ingotItemGradeFor('iron'), GRADE, 'o ferro compartilha a forma');
    assert.notDeepEqual(createMineralSpritePixels('ingot', 'iron'), sprite, 'e não a cor');
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    assert.deepEqual(createMineralSpritePixels('ingot', 'copper'), sprite, 'duas chamadas dão a mesma arte');
    for (const linha of sprite) for (const c of linha) {
        if (!c) continue;
        assert.equal(c.length, 3, 'cor é [r,g,b]');
        for (const canal of c) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
    }
});
