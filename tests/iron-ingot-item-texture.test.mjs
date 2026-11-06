// O ITEM de lingote de FERRO: a mesma forma do lingote de cobre, cor de ferro.
//
// A forma (`LINGOTE_GRADE`) é uma só para todos os metais — o que muda é a
// paleta. O ferro escolhido é o "forjado": o cinza-azulado do metal, com
// **contraste alto** (contorno quase preto, face bem clara), que é o que faz a
// barra ler de longe na barra do inventário.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createMineralSpritePixels, ingotItemGradeFor } from '../world-mineral-textures.js';

const GRADE = ingotItemGradeFor('iron');
const dentro = (x, y) => (GRADE?.[y]?.[x] ?? '.') !== '.';
const sprite = createMineralSpritePixels('ingot', 'iron');
const cor = (x, y) => sprite[y][x];
const chave = (c) => c.join(',');

/** O ferro forjado, tom a tom: 0 contorno · 1 corpo · 2 grão · 3 face · 4 reflexo. */
const PALETA = [
    [38, 42, 46],
    [98, 106, 114],
    [112, 120, 128],
    [192, 202, 208],
    [232, 240, 246],
];

const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const media = (px) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const linha of px) for (const c of linha) {
        if (!c) continue;
        r += c[0]; g += c[1]; b += c[2]; n++;
    }
    return [r / n, g / n, b / n];
};

test('o lingote de ferro usa a mesma forma do de cobre', () => {
    assert.ok(GRADE, 'o ferro precisa da arte desenhada');
    assert.deepEqual(GRADE, ingotItemGradeFor('copper'), 'forma compartilhada: um desenho, todos os metais');
    assert.equal(GRADE.length, 16);
    for (const linha of GRADE) assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
});

test('a silhueta é a barra de 135 px, uma peça só', () => {
    assert.equal(sprite.flat().filter(Boolean).length, 135, 'a barra ocupa 135 px, como a de cobre');
    assert.deepEqual(GRADE.map((l) => [...l].filter((c) => c !== '.').length),
        [0, 0, 2, 6, 10, 14, 16, 16, 16, 16, 15, 12, 8, 4, 0, 0],
        'ponta em cima, cheia no meio, ponta embaixo');
});

test('a arte é 1 px por célula, com fundo transparente', () => {
    for (let y = 0; y < 16; y++) {
        assert.equal(sprite[y].length, 16, `linha ${y} com 16 px`);
        for (let x = 0; x < 16; x++) {
            if (dentro(x, y)) assert.ok(cor(x, y), `(${x},${y}) é metal e ficou vazio`);
            else assert.equal(cor(x, y), null, `(${x},${y}) está fora da barra`);
        }
    }
});

test('cada pixel usa o tom escrito no desenho, e os cinco tons aparecem', () => {
    const usadas = new Set(sprite.flat().filter(Boolean).map(chave));
    assert.equal(usadas.size, 5, `a barra usa os cinco tons (tem ${usadas.size})`);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!dentro(x, y)) continue;
        assert.equal(chave(cor(x, y)), chave(PALETA[Number(GRADE[y][x])]), `(${x},${y}) usa o tom do desenho`);
    }
});

test('o ferro é frio: cinza com azul, nunca avermelhado', () => {
    const m = media(sprite);
    assert.ok(m[2] > m[1] && m[1] > m[0], `ferro fora do azulado? ${m.map((v) => v.toFixed(0)).join('/')}`);
    assert.ok(m[2] - m[0] > 8, `pouco azul: B−R = ${(m[2] - m[0]).toFixed(0)}`);
    // E o cobre, que fica do lado na barra, é o oposto: vermelho.
    const cobre = media(createMineralSpritePixels('ingot', 'copper'));
    assert.ok(m[2] > m[0] && cobre[0] > cobre[2], 'ferro puxa pro azul, cobre pro vermelho');
    assert.ok(cobre[0] - cobre[2] > 70, 'o cobre continua bem quente');
});

test('contraste alto: contorno quase preto, face bem clara', () => {
    const contorno = lum(PALETA[0]);
    const face = lum(PALETA[3]);
    assert.ok(contorno < 60, `o contorno é escuro (luminância ${contorno.toFixed(0)})`);
    assert.ok(face > 180, `a face é clara (luminância ${face.toFixed(0)})`);
    assert.ok(face - contorno > 140, `e o contraste é alto: ${(face - contorno).toFixed(0)}`);

    // O reflexo é o tom mais claro de todos.
    assert.ok(lum(PALETA[4]) > lum(PALETA[3]), 'o reflexo é mais claro que a face');
    const tons = PALETA.map(lum);
    assert.equal(Math.min(...tons), lum(PALETA[0]), 'o tom 0 é o mais escuro');
    assert.equal(Math.max(...tons), lum(PALETA[4]), 'o tom 4 é o mais claro');
});

test('cada lingote tem a sua cor, e ninguém herdou a arte por engano', () => {
    // O ouro também já tem arte: mesma forma, paleta própria.
    assert.deepEqual(ingotItemGradeFor('gold'), GRADE, 'o ouro compartilha a forma');
    assert.notDeepEqual(createMineralSpritePixels('ingot', 'gold'), sprite, 'com a cor do ouro, não a do ferro');

    // E o ferro não pegou a paleta do cobre.
    assert.notDeepEqual(sprite, createMineralSpritePixels('ingot', 'copper'), 'ferro e cobre são metais diferentes');

    // Metal fora da arte continua no retângulo genérico de 80 px.
    const estanho = createMineralSpritePixels('ingot', 'tin');
    assert.equal(ingotItemGradeFor('tin'), null, 'estanho não tem arte');
    assert.equal(estanho.flat().filter(Boolean).length, 80, 'e cai no retângulo de 80 px');
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    assert.deepEqual(createMineralSpritePixels('ingot', 'iron'), sprite, 'duas chamadas dão a mesma arte');
    for (const linha of sprite) for (const c of linha) {
        if (!c) continue;
        assert.equal(c.length, 3, 'cor é [r,g,b]');
        for (const canal of c) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
    }
});
