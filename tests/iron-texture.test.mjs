// O veio de ferro: a arte escolhida (opção A · clássico).
//
// Terceiro minério desenhado à mão, com a receita do carvão e do cobre: máscara
// de 16×16 blocos (cada bloco vale 2×2 px) sobre a pedra de verdade, relevo
// automático. O ferro é o mais neutro dos três: pedaços médios arredondados e
// pêssego queimado — claro o bastante para não virar ouro, quente o bastante
// para não virar pedra.

import test from 'node:test';
import assert from 'node:assert/strict';

import { TILE, TILE_PX } from '../world-catalog.js';
import { createTilePixelSource, stonePixel } from '../world-textures.js';
import { oreMaskFor } from '../world-mineral-textures.js';

const pixel = createTilePixelSource();
const BLOCO = 2;
const MASCARA = oreMaskFor(TILE.IRON_ORE);
const MASCARA_COBRE = oreMaskFor(TILE.COPPER_ORE);
const MASCARA_CARVAO = oreMaskFor(TILE.COAL_ORE);
const dentro = (bx, by) => (MASCARA[by]?.[bx] ?? '.') === '#';
const cor = (x, y) => pixel(TILE.IRON_ORE, x, y).slice(0, 3);
const chave = c => c.join(',');
const brilho = c => (c[0] + c[1] + c[2]) / 3;

/** Média do veio (só os blocos pintados). */
function mediaDoVeio(tile, mascara) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) {
        if ((mascara[by]?.[bx] ?? '.') !== '#') continue;
        const c = pixel(tile, bx * BLOCO, by * BLOCO);
        r += c[0]; g += c[1]; b += c[2]; n++;
    }
    return [r / n, g / n, b / n];
}

function pedacos() {
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
    return tamanhos.sort((a, b) => b - a);
}

test('a máscara do ferro é 16×16 de blocos, só com pedra e veio', () => {
    assert.ok(MASCARA, 'o ferro precisa de uma máscara desenhada');
    assert.equal(MASCARA.length, 16, '16 linhas');
    for (const linha of MASCARA) {
        assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
        assert.match(linha, /^[.#]+$/, 'só "." (pedra) e "#" (ferro)');
    }
    const cheios = MASCARA.join('').split('').filter(c => c === '#').length;
    const cobertura = cheios / 256;
    assert.ok(cobertura > 0.3 && cobertura < 0.45, `cobertura ${(cobertura * 100).toFixed(0)}%`);
});

test('são pedaços médios: nem migalha, nem filão', () => {
    const tamanhos = pedacos();
    assert.ok(tamanhos.length >= 5 && tamanhos.length <= 7, `pedaços: ${tamanhos.length}`);
    assert.ok(tamanhos[0] >= 14, `o maior pedaço tem ${tamanhos[0]} blocos`);
    assert.ok(tamanhos.filter(t => t >= 11).length >= 5, 'pelo menos cinco pedaços cheios');
});

test('o veio de ferro é desenhado em blocos de 2×2 pixels', () => {
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
    const ordenadas = [...cores].map(c => c.split(',').map(Number)).sort((a, b) => brilho(a) - brilho(b));
    const escuro = ordenadas[0];
    assert.ok(cores.size >= 4, `a paleta precisa de pelo menos 4 tons (tem ${cores.size})`);

    let beiradasClaras = 0, beiradasEscuras = 0;
    for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) {
        if (!dentro(bx, by)) continue;
        const c = cor(bx * BLOCO, by * BLOCO);
        if (!dentro(bx, by - 1) || !dentro(bx - 1, by)) {
            beiradasClaras++;
            assert.ok(brilho(c) > brilho(escuro), `beirada de cima/esquerda clara em (${bx},${by})`);
        } else if (!dentro(bx, by + 1) || !dentro(bx + 1, by)) {
            beiradasEscuras++;
            assert.equal(chave(c), chave(escuro), `beirada de baixo/direita escura em (${bx},${by})`);
        }
    }
    assert.ok(beiradasClaras > 10, 'o veio tem beirada clara');
    assert.ok(beiradasEscuras > 10, 'e beirada escura');
});

test('o ferro é pêssego: claro, quente e diferente do cinza da pedra', () => {
    const media = mediaDoVeio(TILE.IRON_ORE, MASCARA);
    assert.ok(media[0] > media[1] && media[1] > media[2], `ferro esverdeado? ${media.map(v => v.toFixed(0)).join('/')}`);
    assert.ok(media[0] - media[2] > 40, `pouco quente: R−B = ${(media[0] - media[2]).toFixed(0)}`);
    // A pedra atrás é cinza (R ≈ G ≈ B). O ferro tem brilho parecido com o dela —
    // quem separa os dois é a cor, não a claridade.
    const pedra = stonePixel(0, 0, 0);
    const saturacao = c => Math.max(...c) - Math.min(...c);
    assert.ok(saturacao(pedra) < 10, 'a pedra é cinza');
    assert.ok(saturacao(media) > 40, `o veio é colorido (${saturacao(media).toFixed(0)})`);
});

test('o ferro é mais claro e menos saturado que o cobre (é o que separa os dois laranjas)', () => {
    const ferro = mediaDoVeio(TILE.IRON_ORE, MASCARA);
    const cobre = mediaDoVeio(TILE.COPPER_ORE, MASCARA_COBRE);
    // Claro/menos saturado que o cobre: é o que separa os dois laranjas.
    assert.ok(brilho(ferro) > brilho(cobre) + 15, `ferro ${brilho(ferro).toFixed(0)} × cobre ${brilho(cobre).toFixed(0)}`);
    assert.ok(ferro[0] - ferro[2] < cobre[0] - cobre[2], 'o ferro é menos saturado que o cobre');
});

test('as três máscaras são diferentes entre si', () => {
    assert.notEqual(MASCARA.join(''), MASCARA_CARVAO.join(''));
    assert.notEqual(MASCARA.join(''), MASCARA_COBRE.join(''));
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
        const a = pixel(TILE.IRON_ORE, x, y);
        const b = pixel(TILE.IRON_ORE, x, y);
        assert.deepEqual(a, b, `pixel (${x},${y}) estável`);
        for (const canal of a) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
    }
});

test('não sobrou listra de 1 px no meio do veio', () => {
    for (let y = 0; y < TILE_PX; y++) for (let x = 1; x < TILE_PX; x++) {
        const by = Math.floor(y / BLOCO);
        if (!dentro(Math.floor(x / BLOCO), by) || !dentro(Math.floor((x - 1) / BLOCO), by)) continue;
        if (chave(cor(x, y)) === chave(cor(x - 1, y))) continue;
        assert.equal(x % BLOCO, 0, `transição no meio do bloco em (${x},${y})`);
    }
});
