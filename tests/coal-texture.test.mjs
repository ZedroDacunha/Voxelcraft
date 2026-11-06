// O veio de carvão: a arte escolhida (opção D · antracito).
//
// O carvão deixou de ser "losangos miúdos listrados" e virou poucos pedaços
// grandes e densos, desenhados numa máscara de 16×16 blocos com relevo
// automático (luz em cima/esquerda, sombra embaixo/direita). Este teste cuida da
// arte: a máscara, o tamanho dos pedaços, as cores e o relevo.

import test from 'node:test';
import assert from 'node:assert/strict';

import { TILE, TILE_PX } from '../world-catalog.js';
import { createTilePixelSource, stonePixel } from '../world-textures.js';
import { oreMaskFor } from '../world-mineral-textures.js';

const pixel = createTilePixelSource();
const BLOCO = 2;
const MASCARA = oreMaskFor(TILE.COAL_ORE);
const dentro = (bx, by) => (MASCARA[by]?.[bx] ?? '.') === '#';
const cor = (x, y) => pixel(TILE.COAL_ORE, x, y).slice(0, 3);
const chave = c => c.join(',');
const cinza = c => (c[0] + c[1] + c[2]) / 3;

test('a máscara do carvão é 16×16 de blocos, só com pedra e veio', () => {
    assert.equal(MASCARA.length, 16, '16 linhas');
    for (const linha of MASCARA) {
        assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
        assert.match(linha, /^[.#]+$/, 'só "." (pedra) e "#" (carvão)');
    }
    const cheios = MASCARA.join('').split('').filter(c => c === '#').length;
    const cobertura = cheios / 256;
    // Antracito é denso de propósito: quase metade do bloco (e não o bloco todo).
    assert.ok(cobertura > 0.35 && cobertura < 0.6, `cobertura ${(cobertura * 100).toFixed(0)}%`);
});

test('são poucos pedaços, e os maiores são grandes', () => {
    // Inunda cada pedaço (4-vizinhos) e mede o tamanho.
    const vistos = new Set();
    const tamanhos = [];
    for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) {
        if (!dentro(bx, by) || vistos.has(`${bx},${by}`)) continue;
        const pilha = [[bx, by]];
        let tamanho = 0;
        vistos.add(`${bx},${by}`);
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
        tamanhos.push(tamanho);
    }
    tamanhos.sort((a, b) => b - a);
    assert.ok(tamanhos.length >= 3 && tamanhos.length <= 7, `poucos pedaços (${tamanhos.length})`);
    assert.ok(tamanhos[0] >= 8, `o maior pedaço é grande (${tamanhos[0]} blocos)`);
    assert.ok(tamanhos.filter(t => t >= 6).length >= 2, 'pelo menos dois pedaços graúdos');
});

test('o veio é desenhado em blocos de 2×2 pixels', () => {
    // A arte é chunky: dentro do veio, os quatro pixels de um bloco são da mesma
    // cor (a pedra de fundo, não — ela é o grão do jogo).
    for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) {
        if (!dentro(bx, by)) continue;
        const cores = new Set();
        for (let dy = 0; dy < BLOCO; dy++) for (let dx = 0; dx < BLOCO; dx++) {
            cores.add(chave(cor(bx * BLOCO + dx, by * BLOCO + dy)));
        }
        assert.equal(cores.size, 1, `bloco (${bx},${by}) com ${cores.size} cores`);
    }
    assert.equal(TILE_PX, 16 * BLOCO, 'a máscara cobre o tile inteiro');
});

test('o relevo acende em cima/esquerda e escurece embaixo/direita', () => {
    const cores = new Set();
    for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) {
        if (dentro(bx, by)) cores.add(chave(cor(bx * BLOCO, by * BLOCO)));
    }
    const ordenadas = [...cores].map(c => c.split(',').map(Number)).sort((a, b) => cinza(a) - cinza(b));
    const escuro = ordenadas[0];
    const claro = ordenadas[ordenadas.length - 1];

    let beiradasClaras = 0, beiradasEscuras = 0;
    for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) {
        if (!dentro(bx, by)) continue;
        const c = cor(bx * BLOCO, by * BLOCO);
        if (!dentro(bx, by - 1) || !dentro(bx - 1, by)) {
            beiradasClaras++;
            assert.ok(cinza(c) > cinza(escuro), `beirada de cima/esquerda clara em (${bx},${by})`);
            assert.ok(cinza(c) >= cinza(ordenadas[Math.floor(ordenadas.length / 2)]), 'é dos tons claros');
        } else if (!dentro(bx, by + 1) || !dentro(bx + 1, by)) {
            beiradasEscuras++;
            assert.equal(chave(c), chave(escuro), `beirada de baixo/direita escura em (${bx},${by})`);
        }
    }
    assert.ok(beiradasClaras > 10, 'o veio tem beirada clara');
    assert.ok(beiradasEscuras > 10, 'e beirada escura');
    assert.ok(claro && escuro, 'a paleta tem os dois extremos');
});

test('carvão é escuro: nenhum pixel do veio chega perto do cinza da pedra', () => {
    let total = 0, soma = 0, maximo = 0;
    for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) {
        if (!dentro(bx, by)) continue;
        const c = cor(bx * BLOCO, by * BLOCO);
        total++;
        soma += cinza(c);
        maximo = Math.max(maximo, cinza(c));
    }
    assert.ok(soma / total < 65, `média escura (${(soma / total).toFixed(0)})`);
    assert.ok(maximo < 130, `nem o brilho passa de 130 (${maximo.toFixed(0)})`);
    // E o fundo continua sendo a pedra, que é bem mais clara.
    assert.ok(cinza(stonePixel(0, 0, 0)) > 100, 'a pedra atrás é clara');
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
        const a = pixel(TILE.COAL_ORE, x, y);
        const b = pixel(TILE.COAL_ORE, x, y);
        assert.deepEqual(a, b, `pixel (${x},${y}) estável`);
        for (const canal of a) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
    }
});

test('o veio antigo do carvão (losangos listrados) não existe mais', () => {
    // O veio velho pintava `paleta[(x * 3 + y * 5) % 3]` nos losangos: listras de
    // 1 px. Hoje tudo é bloco de 2×2 — se sobrar listra, a troca não pegou.
    for (let y = 0; y < TILE_PX; y++) for (let x = 1; x < TILE_PX; x++) {
        const a = cor(x, y), b = cor(x - 1, y);
        if (chave(a) !== chave(b) && chave(a) !== chave(cor(x, y - 1 < 0 ? 0 : y))) {
            // muda de cor no meio de um bloco só se a coluna for par (limite de bloco)
            assert.equal(x % BLOCO, 0, `transição fora do limite de bloco em (${x},${y})`);
        }
    }
});
