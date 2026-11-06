// O ITEM de cobre bruto: a arte escolhida (opção E · grumos).
//
// Primeiro item de minério desenhado à mão depois do carvão. A arte de item é
// outra coisa que a do bloco: 16×16 pixels com fundo transparente, cada célula
// da máscara valendo **um** pixel do ícone (no bloco, valia 2×2). O relevo é o
// mesmo: cima/esquerda acende, baixo/direita escurece.
//
// Antes, o cobre bruto caía no sprite automático de "minério bruto" — três
// bolhas redondas com contorno, iguais para cobre, ferro e ouro.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createMineralSpritePixels, rawItemMaskFor, coalItemMaskFor } from '../world-mineral-textures.js';

const MASCARA = rawItemMaskFor('copper');
const MASCARA_CARVAO = coalItemMaskFor('mineral');
const dentro = (x, y) => (MASCARA[y]?.[x] ?? '.') === '#';
const sprite = createMineralSpritePixels('raw', 'copper');
const cor = (x, y) => sprite[y][x];
const chave = c => c.join(',');
const brilho = c => (c[0] + c[1] + c[2]) / 3;

/** Cores da arte, escritas de propósito: o teste é a especificação, não o espelho. */
const PALETA = [[104, 56, 40], [168, 88, 56], [200, 120, 80], [232, 152, 104]];
const daPaleta = c => PALETA.some(p => chave(p) === chave(c));

function pedacos() {
    const vistos = new Set();
    const tamanhos = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!dentro(x, y) || vistos.has(`${x},${y}`)) continue;
        const pilha = [[x, y]];
        let tamanho = 0;
        vistos.add(`${x},${y}`);
        while (pilha.length) {
            const [cx, cy] = pilha.pop();
            tamanho++;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (!dentro(nx, ny) || vistos.has(`${nx},${ny}`)) continue;
                vistos.add(`${nx},${ny}`);
                pilha.push([nx, ny]);
            }
        }
        tamanhos.push(tamanho);
    }
    return tamanhos.sort((a, b) => b - a);
}

test('a máscara do item de cobre é 16×16, só com "#" e "."', () => {
    assert.ok(MASCARA, 'o cobre bruto precisa de uma máscara desenhada');
    assert.equal(MASCARA.length, 16, '16 linhas');
    for (const linha of MASCARA) {
        assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
        assert.match(linha, /^[.#]+$/, 'só "." (vazio) e "#" (cobre)');
    }
    const cheios = MASCARA.join('').split('').filter(c => c === '#').length;
    const cobertura = cheios / 256;
    assert.ok(cobertura > 0.27 && cobertura < 0.33, `cobertura ${(cobertura * 100).toFixed(0)}%`);
});

test('são quatro ou cinco grumos cheios, nenhum pixel solto', () => {
    const tamanhos = pedacos();
    assert.ok(tamanhos.length >= 4 && tamanhos.length <= 6, `grumos: ${tamanhos.length}`);
    assert.ok(tamanhos.every(t => t >= 8), 'nenhum grumo pequeno demais para ler o relevo');
    assert.ok(tamanhos[0] <= 22, `o maior grumo tem ${tamanhos[0]} px`);
    assert.ok(tamanhos[0] - tamanhos[tamanhos.length - 1] >= 4, 'os grumos têm tamanhos diferentes');
});

test('a arte de item é 1 px por célula, com fundo transparente', () => {
    assert.equal(sprite.length, 16, '16 linhas de pixels');
    for (let y = 0; y < 16; y++) {
        assert.equal(sprite[y].length, 16, `linha ${y} com 16 px`);
        for (let x = 0; x < 16; x++) {
            if (dentro(x, y)) assert.ok(cor(x, y), `(${x},${y}) é cobre e ficou vazio`);
            else assert.equal(cor(x, y), null, `(${x},${y}) está fora da máscara`);
        }
    }
});

test('o relevo acende em cima/esquerda e escurece embaixo/direita', () => {
    const usadas = new Set(sprite.flat().filter(Boolean).map(chave));
    assert.equal(usadas.size, 4, `a arte usa os quatro tons da paleta (tem ${usadas.size})`);
    for (const c of sprite.flat().filter(Boolean)) assert.ok(daPaleta(c), `cor fora da paleta: ${chave(c)}`);

    const escuro = [...usadas].map(c => c.split(',').map(Number)).sort((a, b) => brilho(a) - brilho(b))[0];
    const claro = [...usadas].map(c => c.split(',').map(Number)).sort((a, b) => brilho(b) - brilho(a))[0];

    let beiradasClaras = 0, beiradasEscuras = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!dentro(x, y)) continue;
        const c = cor(x, y);
        if (!dentro(x, y - 1) || !dentro(x - 1, y)) {
            beiradasClaras++;
            assert.equal(chave(c), chave(claro), `beirada de cima/esquerda clara em (${x},${y})`);
        } else if (!dentro(x, y + 1) || !dentro(x + 1, y)) {
            beiradasEscuras++;
            assert.equal(chave(c), chave(escuro), `beirada de baixo/direita escura em (${x},${y})`);
        }
    }
    assert.ok(beiradasClaras > 15, 'o grumo tem beirada clara');
    assert.ok(beiradasEscuras > 10, 'e beirada escura');
});

test('o item é cobre: laranja queimado, bem quente', () => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const linha of sprite) for (const c of linha) {
        if (!c) continue;
        r += c[0]; g += c[1]; b += c[2]; n++;
    }
    const media = [r / n, g / n, b / n];
    assert.ok(media[0] > media[1] && media[1] > media[2], `cobre esverdeado? ${media.map(v => v.toFixed(0)).join('/')}`);
    assert.ok(media[0] - media[2] > 90, `pouco quente: R−B = ${(media[0] - media[2]).toFixed(0)}`);
    assert.ok(media[0] > 150, `o cobre é claro o bastante (R = ${media[0].toFixed(0)})`);
});

test('o item de cobre não se confunde com o de carvão', () => {
    const carvao = createMineralSpritePixels('coal', 'coal');
    assert.ok(carvao, 'o carvão continua com a arte dele');
    assert.notEqual(MASCARA.join(''), MASCARA_CARVAO.join(''), 'as máscaras são diferentes');

    const mediaDe = (px) => {
        let r = 0, g = 0, b = 0, n = 0;
        for (const linha of px) for (const c of linha) {
            if (!c) continue;
            r += c[0]; g += c[1]; b += c[2]; n++;
        }
        return [r / n, g / n, b / n];
    };
    const cobre = mediaDe(sprite);
    const carvaoMedia = mediaDe(carvao);
    // Cobre é quente (R acima de B), carvão é frio (B acima de R): a cor separa.
    assert.ok(cobre[0] - cobre[2] > carvaoMedia[0] - carvaoMedia[2] + 80,
        `cobre ${(cobre[0] - cobre[2]).toFixed(0)} × carvão ${(carvaoMedia[0] - carvaoMedia[2]).toFixed(0)}`);
    assert.ok(brilho(cobre) > brilho(carvaoMedia) + 60, 'e o cobre é bem mais claro que o carvão');
});

test('cada minério bruto tem a sua arte; o ouro segue no genérico', () => {
    assert.equal(rawItemMaskFor('gold'), null, 'o ouro ainda não tem arte desenhada');
    // O ferro ganhou a arte dele depois (PR do ferro bruto): máscara própria,
    // que não é a do cobre.
    const ferroMascara = rawItemMaskFor('iron');
    assert.ok(ferroMascara, 'o ferro bruto tem máscara');
    assert.notEqual(ferroMascara.join(''), MASCARA.join(''), 'ferro e cobre não usam o mesmo desenho');
    const ferro = createMineralSpritePixels('raw', 'iron');
    assert.ok(ferro, 'o ferro bruto continua com sprite');
    assert.notEqual(JSON.stringify(ferro), JSON.stringify(sprite), 'ferro e cobre não são o mesmo sprite');
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    const outra = createMineralSpritePixels('raw', 'copper');
    assert.deepEqual(outra, sprite, 'duas chamadas dão a mesma arte');
    for (const linha of sprite) for (const c of linha) {
        if (!c) continue;
        assert.equal(c.length, 3, 'cor é [r,g,b]');
        for (const canal of c) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
    }
});
