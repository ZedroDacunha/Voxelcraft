// A TESOURA — a última ferramenta a entrar na régua da família.
//
// Até aqui ela era desenhada por código em `world-textures.js` (um "X" de ferro
// com argolas). Agora ela é **base fiel** do sprite clássico com 2 px nossos, as
// lâminas na rampa do ferro e o punho na madeira da tábua — o mesmo cabo das
// outras três ferramentas.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createTextureTools } from '../world-textures.js';
import {
    TESOURA_GRADE,
    PICARETA_PALETAS,
    CABO_PALETA,
    createShearsSpritePixels,
} from '../world-tool-textures.js';

const SIMBOLOS = ['.', 'O', '1', '2', '3', '4', 'a', 'b', 'c', 'd'];
const sprite = createShearsSpritePixels();
const cor = (x, y) => sprite[y][x];
const dentro = (x, y) => TESOURA_GRADE[y]?.[x] !== undefined && TESOURA_GRADE[y][x] !== '.';
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

const perfil = TESOURA_GRADE.map((linha) => [...linha].filter((c) => c !== '.').length);
const total = perfil.reduce((s, v) => s + v, 0);

/** Busca em 4-vizinhos: a tesoura tem que ser uma peça só. */
function pecaUnica() {
    let inicio = null;
    for (let y = 0; y < 16 && !inicio; y++) {
        const x = [...TESOURA_GRADE[y]].findIndex((c) => c !== '.');
        if (x >= 0) inicio = [x, y];
    }
    const vistos = new Set([inicio.join(',')]);
    const pilha = [inicio];
    let alcanca = 0;
    while (pilha.length) {
        const [x, y] = pilha.pop();
        alcanca++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!dentro(nx, ny) || vistos.has(`${nx},${ny}`)) continue;
            vistos.add(`${nx},${ny}`);
            pilha.push([nx, ny]);
        }
    }
    return alcanca;
}

test('a grade da tesoura é 16×16 e só usa o alfabeto da casa', () => {
    assert.equal(TESOURA_GRADE.length, 16, '16 linhas');
    for (const linha of TESOURA_GRADE) {
        assert.equal(linha.length, 16, `linha com 16 colunas — "${linha}"`);
        for (const c of linha) assert.ok(SIMBOLOS.includes(c), `símbolo desconhecido "${c}"`);
    }
    // Nem acento, nem couro: o alfabeto das ferramentas não tem mais `5`, `g` ou `s`.
    assert.ok(!TESOURA_GRADE.join('').includes('5'), 'sem acento');
    assert.ok(!TESOURA_GRADE.join('').includes('g'), 'sem couro');
    assert.ok(!TESOURA_GRADE.join('').includes('s'), 'sem costura');
});

test('a silhueta é a nossa e a tesoura é uma peça só', () => {
    assert.deepEqual(perfil, [0, 0, 5, 6, 7, 8, 9, 8, 7, 7, 8, 6, 5, 3, 0, 0], 'perfil das linhas');
    assert.equal(total, 79, '79 px cheios');
    assert.equal(pecaUnica(), 79, 'tudo ligado numa peça só');
});

test('o que é metal é ferro, e o que é punho é madeira da tábua', () => {
    const ferro = PICARETA_PALETAS.iron;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const s = TESOURA_GRADE[y][x];
        if (s === '.') {
            assert.equal(cor(x, y), null, `(${x},${y}) deveria ser transparente`);
            continue;
        }
        if ('1234O'.includes(s)) assert.deepEqual(cor(x, y), [...ferro[s]], `(${x},${y}): metal "${s}"`);
        else assert.deepEqual(cor(x, y), [...CABO_PALETA[s]], `(${x},${y}): punho "${s}"`);
    }
});

test('as lâminas são claras e o punho é escuro', () => {
    // A leitura da tesoura depende disso: metal claro em cima, punho escuro embaixo.
    const medias = { metal: [], punho: [] };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const s = TESOURA_GRADE[y][x];
        if ('1234O'.includes(s)) medias.metal.push(lum(cor(x, y)));
        else if ('abcd'.includes(s)) medias.punho.push(lum(cor(x, y)));
    }
    const media = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    assert.ok(medias.metal.length > 20, 'tem lâmina');
    assert.ok(medias.punho.length > 20, 'tem punho');
    assert.ok(media(medias.metal) - media(medias.punho) > 60,
        `metal ${media(medias.metal).toFixed(0)} × punho ${media(medias.punho).toFixed(0)}`);
});

test('a tesoura é determinística e a arte não é compartilhada', () => {
    assert.deepEqual(createShearsSpritePixels(), createShearsSpritePixels(), 'duas chamadas, a mesma arte');
    const a = createShearsSpritePixels();
    const antes = JSON.stringify(a);
    a[2][8] = [1, 2, 3];
    assert.equal(JSON.stringify(createShearsSpritePixels()), antes, 'a arte não é compartilhada');
});

test('o atlas desenha a tesoura com esta arte', () => {
    // O caminho de verdade: o atlas pede o sprite da tesoura para o mundo.
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {}, getImageData() { return { data: new Uint8ClampedArray(4) }; } }) }) };
    const THREE = { CanvasTexture: class { constructor(image) { this.image = image; } }, NearestFilter: 1006, ClampToEdgeWrapping: 1001, SRGBColorSpace: 'srgb' };
    const tools = createTextureTools(THREE);
    const doAtlas = tools.spritePixels('shears', 'iron');
    assert.deepEqual(doAtlas, sprite, 'o atlas usa a arte da família, não o desenho antigo');
    delete globalThis.document;
});
