// O veio de ouro: a arte escolhida (opção B · pepitas).
//
// Quarto minério desenhado à mão, com a receita do carvão, do cobre e do ferro:
// máscara de 16×16 blocos (cada bloco vale 2×2 px) sobre a pedra de verdade,
// relevo automático. O ouro é o oposto do ferro em forma: em vez de poucos
// pedaços médios, **muitas pepitas miúdas** espalhadas. A cor é a mais quente e
// a mais clara de todas — amarelo de verdade, não laranja.

import test from 'node:test';
import assert from 'node:assert/strict';

import { TILE, TILE_PX } from '../world-catalog.js';
import { createTilePixelSource, stonePixel } from '../world-textures.js';
import { oreMaskFor } from '../world-mineral-textures.js';

const pixel = createTilePixelSource();
const BLOCO = 2;
const MASCARA = oreMaskFor(TILE.GOLD_ORE);
const MASCARA_FERRO = oreMaskFor(TILE.IRON_ORE);
const MASCARA_COBRE = oreMaskFor(TILE.COPPER_ORE);
const MASCARA_CARVAO = oreMaskFor(TILE.COAL_ORE);
const dentro = (bx, by) => (MASCARA[by]?.[bx] ?? '.') === '#';
const cor = (x, y) => pixel(TILE.GOLD_ORE, x, y).slice(0, 3);
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

test('a máscara do ouro é 16×16 de blocos, só com pedra e veio', () => {
    assert.ok(MASCARA, 'o ouro precisa de uma máscara desenhada');
    assert.equal(MASCARA.length, 16, '16 linhas');
    for (const linha of MASCARA) {
        assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
        assert.match(linha, /^[.#]+$/, 'só "." (pedra) e "#" (ouro)');
    }
    const cheios = MASCARA.join('').split('').filter(c => c === '#').length;
    const cobertura = cheios / 256;
    assert.ok(cobertura > 0.24 && cobertura < 0.34, `cobertura ${(cobertura * 100).toFixed(0)}%`);
});

test('são pepitas: muitas peças pequenas, nenhuma grande', () => {
    const tamanhos = pedacos();
    assert.ok(tamanhos.length >= 10 && tamanhos.length <= 16, `pepitas: ${tamanhos.length}`);
    assert.ok(tamanhos[0] <= 10, `a maior pepita tem ${tamanhos[0]} blocos`);
    assert.ok(tamanhos.every(t => t >= 3), 'nenhuma migalha de 1 ou 2 blocos (viraria sujeira)');
    assert.ok(tamanhos.filter(t => t >= 5).length >= 4, 'algumas pepitas cheias, para não ficar tudo igual');
});

test('o veio de ouro é desenhado em blocos de 2×2 pixels', () => {
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
    assert.ok(beiradasClaras > 10, 'as pepitas têm beirada clara');
    assert.ok(beiradasEscuras > 10, 'e beirada escura');
});

test('o ouro é amarelo: mais vermelho que azul e bem claro', () => {
    const media = mediaDoVeio(TILE.GOLD_ORE, MASCARA);
    assert.ok(media[0] > media[1] && media[1] > media[2], `ouro fora do amarelo? ${media.map(v => v.toFixed(0)).join('/')}`);
    // A pedra atrás é cinza (R ≈ G ≈ B). O ouro é quente e claro.
    const pedra = stonePixel(0, 0, 0);
    const saturacao = c => Math.max(...c) - Math.min(...c);
    assert.ok(saturacao(pedra) < 10, 'a pedra é cinza');
    assert.ok(saturacao(media) > 90, `o veio é amarelo forte (${saturacao(media).toFixed(0)})`);
    assert.ok(media[1] > 150, `o verde tem de subir para virar amarelo (G = ${media[1].toFixed(0)})`);
    assert.ok(brilho(media) > 120, `o ouro é claro (${brilho(media).toFixed(0)})`);
});

test('o ouro é mais claro e mais amarelo que o ferro e o cobre', () => {
    const ouro = mediaDoVeio(TILE.GOLD_ORE, MASCARA);
    const ferro = mediaDoVeio(TILE.IRON_ORE, MASCARA_FERRO);
    const cobre = mediaDoVeio(TILE.COPPER_ORE, MASCARA_COBRE);
    // Os três são "quentes": o que separa o ouro é clarear e amarelar (G sobe junto com R).
    assert.ok(brilho(ouro) > brilho(ferro) + 20, `ouro ${brilho(ouro).toFixed(0)} × ferro ${brilho(ferro).toFixed(0)}`);
    assert.ok(brilho(ouro) > brilho(cobre) + 20, `ouro ${brilho(ouro).toFixed(0)} × cobre ${brilho(cobre).toFixed(0)}`);
    assert.ok(ouro[0] - ouro[2] > ferro[0] - ferro[2] + 40, 'o ouro é mais quente que o ferro');
    assert.ok(ouro[0] - ouro[2] > cobre[0] - cobre[2] + 40, 'o ouro é mais quente que o cobre');
    assert.ok(ouro[1] > cobre[1] + 40, 'e o verde é o que faz o amarelo (o cobre não tem esse verde)');
});

test('as quatro máscaras são diferentes entre si', () => {
    const desenho = MASCARA.join('');
    assert.notEqual(desenho, MASCARA_CARVAO.join(''));
    assert.notEqual(desenho, MASCARA_COBRE.join(''));
    assert.notEqual(desenho, MASCARA_FERRO.join(''));
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
        const a = pixel(TILE.GOLD_ORE, x, y);
        const b = pixel(TILE.GOLD_ORE, x, y);
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
