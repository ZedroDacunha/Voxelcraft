// O fundo do minério é a **pedra de verdade**.
//
// O minério desenhava o próprio cinza (chapado, com um ruído só dele): ao lado
// de um bloco de pedra, parecia outro material com pintinhas. Agora o fundo vem
// de `stonePixel`, a mesma conta do bloco de pedra — quem mudar a pedra muda o
// fundo de todo minério junto.

import test from 'node:test';
import assert from 'node:assert/strict';

import { TILE, TILE_PX } from '../world-catalog.js';
import { createTilePixelSource, stonePixel } from '../world-textures.js';

const pixel = createTilePixelSource();
const ORE_TILES = [TILE.COAL_ORE, TILE.IRON_ORE, TILE.GOLD_ORE, TILE.DIAMOND_ORE, TILE.COPPER_ORE];
const igual = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
const opaco = c => Boolean(c) && c[3] !== 0;
const chave = c => c.slice(0, 3).map(v => Math.round(v)).join(',');

// Separa cada tile em "fundo" (pedra) e "minério" (o que foge da pedra).
function separar(tile) {
    const fundo = [];
    const minerio = [];
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
        const c = pixel(tile, x, y);
        assert.ok(opaco(c), `pixel (${x},${y}) do tile ${tile} deveria ser opaco`);
        (igual(c, stonePixel(x, y, 0)) ? fundo : minerio).push({ x, y, c });
    }
    return { fundo, minerio };
}

test('o bloco de pedra usa a mesma função que o fundo dos minérios', () => {
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
        assert.deepEqual(pixel(TILE.STONE, x, y), stonePixel(x, y, 0), `pedra em (${x},${y})`);
        // A variante (`STONE_ALT`) é a pedra com outro sorteio — a mesma função.
        assert.deepEqual(pixel(TILE.STONE_ALT, x, y), stonePixel(x, y, 1), `pedra alt em (${x},${y})`);
    }
});

test('todo minério tem a pedra atrás — pixel por pixel', () => {
    // Um a um: o fundo tem de bater **exatamente** com a pedra, sem tom próprio.
    for (const tile of ORE_TILES) {
        const { fundo, minerio } = separar(tile);
        assert.ok(minerio.length > 0, `o minério ${tile} não tem minério nenhum`);
        // E o fundo não pode ser o tile inteiro: minério é pedra **com** veio.
        assert.ok(fundo.length > minerio.length, `o minério ${tile} tomou o tile todo`);
        // Se a pedra mudar, o fundo acompanha: um pixel de fundo é a pedra.
        const amostra = fundo[0];
        assert.deepEqual(pixel(tile, amostra.x, amostra.y), stonePixel(amostra.x, amostra.y, 0));
    }
});

test('o fundo do minério não tem mais o cinza chapado de antes', () => {
    // O velho fundo era `116 + ruído` (um cinza quase liso). A pedra tem estratos
    // e grão: o desvio do fundo é bem maior que o de antes, e a média é a da pedra.
    const { fundo } = separar(TILE.COAL_ORE);
    const valores = fundo.map(p => p.c[0]);
    const media = valores.reduce((s, v) => s + v, 0) / valores.length;
    const desvio = Math.sqrt(valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length);
    assert.ok(Math.abs(media - 124) < 12, `a média do fundo é a da pedra (${media.toFixed(1)})`);
    assert.ok(desvio > 4, `e o fundo tem o grão da pedra (desvio ${desvio.toFixed(1)})`);
});

test('cada minério tem o seu veio, e todos são diferentes entre si', () => {
    const assinaturas = new Map();
    for (const tile of ORE_TILES) {
        const { minerio } = separar(tile);
        // Cores do veio: o carvão é escuro, o ouro é dourado — nada de paleta comum.
        const cores = new Set(minerio.map(p => chave(p.c)));
        assert.ok(cores.size >= 2, `o veio de ${tile} tem mais de um tom`);
        assinaturas.set(tile, [...cores].sort().join('|'));
    }
    const unicas = new Set(assinaturas.values());
    assert.equal(unicas.size, ORE_TILES.length, 'cada minério tem a sua paleta');
});

test('o veio de carvão é escuro; o de ouro, claro', () => {
    const brilho = tile => {
        const { minerio } = separar(tile);
        return minerio.reduce((s, p) => s + (p.c[0] + p.c[1] + p.c[2]) / 3, 0) / minerio.length;
    };
    assert.ok(brilho(TILE.COAL_ORE) < 70, `carvão escuro (${brilho(TILE.COAL_ORE).toFixed(0)})`);
    assert.ok(brilho(TILE.GOLD_ORE) > 120, `ouro claro (${brilho(TILE.GOLD_ORE).toFixed(0)})`);
    assert.ok(brilho(TILE.DIAMOND_ORE) > brilho(TILE.COAL_ORE), 'e o diamante é mais claro que o carvão');
});

test('nenhum minério vaza para o tile do lado', () => {
    // A arte é pintada por tile: todo pixel sai opaco e dentro da paleta do jogo.
    for (const tile of ORE_TILES) {
        for (const { c } of separar(tile).minerio) {
            for (const canal of c.slice(0, 3)) {
                assert.ok(canal >= 0 && canal <= 255, `canal fora da faixa em ${tile}: ${canal}`);
            }
        }
    }
});
