// O ITEM de lingote de OURO: a mesma forma dos lingotes de cobre e de ferro.
//
// A forma (`LINGOTE_GRADE`) é uma só para todos os metais; o que muda é a paleta.
// O ouro escolhido é o "brilhante": o dourado com **contraste alto**, como no
// ferro — contorno quase preto, face bem quente e reflexo quase branco.
//
// O ouro é o mais **amarelo** dos três: verde e vermelho bem acima do azul. O
// cobre é laranja (vermelho longe do verde) e o ferro é azul (azul acima de tudo).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createMineralSpritePixels, ingotItemGradeFor } from '../world-mineral-textures.js';

const GRADE = ingotItemGradeFor('gold');
const dentro = (x, y) => (GRADE?.[y]?.[x] ?? '.') !== '.';
const sprite = createMineralSpritePixels('ingot', 'gold');
const cor = (x, y) => sprite[y][x];
const chave = (c) => c.join(',');

/** O ouro brilhante, tom a tom: 0 contorno · 1 corpo · 2 grão · 3 face · 4 reflexo. */
const PALETA = [
    [70, 48, 12],
    [186, 138, 32],
    [204, 158, 42],
    [252, 216, 86],
    [255, 246, 178],
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

test('o lingote de ouro usa a mesma forma do cobre e do ferro', () => {
    assert.ok(GRADE, 'o ouro precisa da arte desenhada');
    assert.deepEqual(GRADE, ingotItemGradeFor('copper'), 'forma compartilhada com o cobre');
    assert.deepEqual(GRADE, ingotItemGradeFor('iron'), 'e com o ferro');
    assert.equal(GRADE.length, 16);
    for (const linha of GRADE) assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
});

test('a silhueta é a barra de 135 px', () => {
    assert.equal(sprite.flat().filter(Boolean).length, 135, 'a barra ocupa 135 px, como as outras');
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

test('o metal é ouro: amarelo, com verde e vermelho bem acima do azul', () => {
    const m = media(sprite);
    assert.ok(m[0] > m[2] && m[1] > m[2], `ouro fora do amarelo? ${m.map((v) => v.toFixed(0)).join('/')}`);
    assert.ok(m[1] - m[2] > 70, `pouco amarelo: G−B = ${(m[1] - m[2]).toFixed(0)}`);
    assert.ok(Math.abs(m[0] - m[1]) < 60, `vermelho e verde perto (|R−G| = ${Math.abs(m[0] - m[1]).toFixed(0)})`);
});

test('os três lingotes se distinguem pela cor, não só pela forma', () => {
    const ouro = media(sprite);
    const cobre = media(createMineralSpritePixels('ingot', 'copper'));
    const ferro = media(createMineralSpritePixels('ingot', 'iron'));

    // Ouro: o mais amarelo (verde perto do vermelho, azul lá embaixo).
    assert.ok(ouro[1] - ouro[2] > cobre[1] - cobre[2] + 40, 'o ouro é bem mais amarelo que o cobre');
    // Cobre: laranja (vermelho muito acima do verde).
    assert.ok(cobre[0] - cobre[1] > ouro[0] - ouro[1], 'o cobre é o mais laranja');
    // Ferro: frio, azul acima de tudo.
    assert.ok(ferro[2] > ferro[0] && ferro[2] > ouro[2], 'o ferro é o único frio');
    // Ouro é o mais claro dos três na face.
    assert.ok(lum(PALETA[3]) > lum([246, 182, 132]) && lum(PALETA[3]) > lum([192, 202, 208]),
        'a face do ouro é a mais clara');
});

test('contraste alto: contorno quase preto, face bem clara', () => {
    const contorno = lum(PALETA[0]);
    const face = lum(PALETA[3]);
    assert.ok(contorno < 60, `o contorno é escuro (luminância ${contorno.toFixed(0)})`);
    assert.ok(face > 190, `a face é clara (luminância ${face.toFixed(0)})`);
    assert.ok(face - contorno > 150, `e o contraste é alto: ${(face - contorno).toFixed(0)}`);
    assert.equal(Math.min(...PALETA.map(lum)), contorno, 'o tom 0 é o mais escuro');
    assert.equal(Math.max(...PALETA.map(lum)), lum(PALETA[4]), 'o tom 4 é o mais claro');
});

test('a família fecha: cobre, ferro e ouro têm arte; metal desconhecido cai no genérico', () => {
    for (const material of ['copper', 'iron', 'gold']) {
        assert.ok(ingotItemGradeFor(material), `${material} tem arte`);
        assert.equal(createMineralSpritePixels('ingot', material).flat().filter(Boolean).length, 135,
            `${material} usa a barra de 135 px`);
    }

    // Um metal que não existe na arte continua no retângulo de 80 px — o genérico
    // não foi removido, só deixou de ser usado pelos três.
    assert.equal(ingotItemGradeFor('tin'), null, 'estanho não tem arte');
    const estanho = createMineralSpritePixels('ingot', 'tin');
    assert.equal(estanho.flat().filter(Boolean).length, 80, 'e cai no retângulo de 80 px');
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    assert.deepEqual(createMineralSpritePixels('ingot', 'gold'), sprite, 'duas chamadas dão a mesma arte');
    for (const linha of sprite) for (const c of linha) {
        if (!c) continue;
        assert.equal(c.length, 3, 'cor é [r,g,b]');
        for (const canal of c) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
    }
});
