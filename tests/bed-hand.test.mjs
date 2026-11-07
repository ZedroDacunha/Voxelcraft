// A CAMA NA MÃO — o modelo de duas células reduzido a um item.
//
// A cama não é cubo, então na mão ela nunca podia usar o cubo genérico: antes
// daqui o que aparecia era o *ícone* extrudado, uma figura chata. Agora é a
// peça de verdade (pernas, travessa, colchão, aba e travesseiro).
//
// O desenho mora em `world-bed-hand.js` como arrays puros, sem THREE, então o
// que pode errar sem dar erro nenhum pode ser testado aqui:
//
// 1. uma face que devia estar enterrada (`tile` nulo) não pode ser desenhada;
// 2. cada face tem de amostrar o **tile dela** — colchão na cor da cama,
//    travesseiro branco, madeira nas pernas;
// 3. o modelo tem de estar centrado em quem gira (a mão), senão a peça orbita
//    uma quina em vez de girar em volta de si mesma.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ATLAS_ROWS, TILE, atlasUV, ATLAS_UV_PAD_PX } from '../world-catalog.js';
import { FACES } from '../world-faces.js';
import { BED_COLORS, bedModelBoxes } from '../world-bed.js';
import { HELD_BED, bedHandGeometry } from '../world-bed-hand.js';

const perto = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/** Quantas faces o modelo realmente desenha (as enterradas saem). */
function facesDesenhadas(color) {
    let total = 0;
    for (const caixa of bedModelBoxes(color)) {
        for (const face of FACES) if (caixa.tiles[face.kind] != null) total++;
    }
    return total;
}

test('a geometria da mão é coerente: 4 vértices e 6 índices por face', () => {
    const geo = bedHandGeometry('white');
    assert.equal(geo.positions.length % 3, 0);
    assert.equal(geo.normals.length, geo.positions.length);
    assert.equal(geo.positions.length / 3, geo.uvs.length / 2, 'um par de UV por vértice');
    const faces = geo.positions.length / 12;
    assert.equal(geo.indices.length, faces * 6);
    // Todo índice aponta para um vértice que existe.
    const vertices = geo.positions.length / 3;
    assert.ok(geo.indices.every(i => Number.isInteger(i) && i >= 0 && i < vertices));
});

test('as faces enterradas ficam de fora (é o que evita buraco preto)', () => {
    for (const color of BED_COLORS) {
        const geo = bedHandGeometry(color);
        assert.equal(geo.positions.length / 12, facesDesenhadas(color), `${color}: desenhou face enterrada`);
        // E o modelo tem menos faces que caixas × 6: o encaixe enterrou algumas.
        assert.ok(facesDesenhadas(color) < bedModelBoxes(color).length * 6);
    }
});

test('cada face amostra o tile dela', () => {
    for (const color of BED_COLORS) {
        const geo = bedHandGeometry(color);
        const esperado = [];
        for (const caixa of bedModelBoxes(color)) {
            for (const face of FACES) {
                const tile = caixa.tiles[face.kind];
                if (tile == null) continue;
                const { u0, v0, uWidth, vHeight } = atlasUV(tile, ATLAS_UV_PAD_PX);
                esperado.push({ u0, v0, u1: u0 + uWidth, v1: v0 + vHeight, tile });
            }
        }
        for (let f = 0; f < esperado.length; f++) {
            const alvo = esperado[f];
            const us = [], vs = [];
            for (let c = 0; c < 4; c++) {
                us.push(geo.uvs[(f * 4 + c) * 2]);
                vs.push(geo.uvs[(f * 4 + c) * 2 + 1]);
            }
            assert.ok(perto(Math.min(...us), alvo.u0) && perto(Math.max(...us), alvo.u1),
                `${color}: face ${f} (tile ${alvo.tile}) com U fora do tile`);
            assert.ok(perto(Math.min(...vs), alvo.v0) && perto(Math.max(...vs), alvo.v1),
                `${color}: face ${f} (tile ${alvo.tile}) com V fora do tile`);
        }
    }
});

test('o colchão muda de tile com a cor; o travesseiro não', () => {
    const tilesDe = (color) => {
        const set = new Set();
        for (const caixa of bedModelBoxes(color)) {
            for (const face of FACES) if (caixa.tiles[face.kind] != null) set.add(caixa.tiles[face.kind]);
        }
        return set;
    };
    // O travesseiro é branco nas três.
    for (const color of BED_COLORS) {
        const set = tilesDe(color);
        assert.ok(set.has(TILE.BED_PILLOW_TOP) && set.has(TILE.BED_PILLOW_SIDE), `${color} sem travesseiro`);
        assert.ok(set.has(TILE.PLANKS), `${color} sem madeira`);
    }
    // E o colchão de cada uma é diferente das outras duas.
    const colchoes = BED_COLORS.map(color => {
        const set = tilesDe(color);
        return [...set].filter(t => t === TILE.BED_TOP || t === TILE.BED_TOP_GRAY || t === TILE.BED_TOP_BLACK)[0];
    });
    assert.deepEqual(colchoes, [TILE.BED_TOP, TILE.BED_TOP_GRAY, TILE.BED_TOP_BLACK]);
});

test('o modelo fica centrado em quem gira', () => {
    const geo = bedHandGeometry('white');
    const eixos = [[], [], []];
    for (let i = 0; i < geo.positions.length; i += 3) for (let e = 0; e < 3; e++) eixos[e].push(geo.positions[i + e]);
    const [xs, ys, zs] = eixos.map(lista => ({ min: Math.min(...lista), max: Math.max(...lista) }));
    // X e Z simétricos: o giro acontece no meio da peça, não na quina.
    assert.ok(perto(xs.min, -xs.max, 1e-3), `X não centrado: ${xs.min}..${xs.max}`);
    assert.ok(perto(zs.min, -zs.max, 1e-3), `Z não centrado: ${zs.min}..${zs.max}`);
    // O pé fica na base do modelo (y = 0 no espaço do modelo, -escala/2 centrado).
    assert.ok(perto(ys.min, -HELD_BED.scale / 2, 1e-3), `base em ${ys.min}, esperada ${-HELD_BED.scale / 2}`);
    // E o comprimento é o do modelo: duas células (menos a folga das pontas, que
    // afasta as faces do bloco vizinho).
    const comprimento = zs.max - zs.min;
    assert.ok(comprimento <= 2 * HELD_BED.scale + 1e-9, `comprido demais: ${comprimento}`);
    assert.ok(comprimento > 1.98 * HELD_BED.scale, `curto demais: ${comprimento}`);
});

test('a escala é linear (o ajuste da mão não precisa refazer a conta)', () => {
    const pequena = bedHandGeometry('gray', { scale: 0.1 });
    const grande = bedHandGeometry('gray', { scale: 0.2 });
    assert.equal(pequena.positions.length, grande.positions.length);
    for (let i = 0; i < pequena.positions.length; i++) {
        assert.ok(perto(grande.positions[i], pequena.positions[i] * 2, 1e-6));
    }
});

test('a cama na mão não é achatada: tem altura de colchão', () => {
    const geo = bedHandGeometry('black');
    const ys = [];
    for (let i = 1; i < geo.positions.length; i += 3) ys.push(geo.positions[i]);
    const altura = Math.max(...ys) - Math.min(...ys);
    // O modelo vai de 0 a 12/16 (travesseiro): 0,75 da escala.
    assert.ok(perto(altura, 0.75 * HELD_BED.scale, 1e-3), `altura ${altura}`);
});

test('a tabela de faces é única e usada pelo jogo', () => {
    // Seis faces, quatro cantos cada, normal em um eixo só.
    assert.equal(FACES.length, 6);
    for (const face of FACES) {
        assert.equal(face.corners.length, 4);
        assert.equal(face.dir.filter(v => v !== 0).length, 1, 'normal fora dos eixos');
        assert.ok(['side', 'top', 'bottom'].includes(face.kind));
    }
    // E o `game.js` não tem mais uma cópia da tabela.
    const jogo = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.equal(/^const FACES = \[/m.test(jogo), false, 'game.js voltou a definir FACES');
    assert.match(jogo, /import \{ FACES, faceNaBordaDaCelula \} from '\.\/world-faces\.js';/);
});

test('o jogo usa o modelo 3D na mão, antes do ícone extrudado', () => {
    const jogo = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(jogo, /import \{ HELD_BED, bedHandGeometry \} from '\.\/world-bed-hand\.js';/);
    assert.match(jogo, /function buildHeldBedGeo\(color\)/);
    // O ramo da cama tem de vir **antes** do teste de sprite: senão a cama cai
    // no ícone chato e o modelo nunca aparece.
    const ramo = jogo.indexOf("if (item.sprite?.kind === 'bed') {");
    const sprite = jogo.indexOf("if (itemRenderMode(item) === 'sprite') {", ramo);
    assert.ok(ramo > 0 && sprite > ramo, 'a cama perdeu a vez para o ícone extrudado');
    // E o atlas é o mesmo do mundo: a cor vem do tile, não de um material novo.
    assert.match(jogo.slice(ramo, ramo + 400), /world\.material/);
});

test('o atlas não estourou com a cama na mão', () => {
    // A cama na mão não acrescenta tile nenhum: reaproveita os do bloco.
    assert.ok(ATLAS_ROWS * 32 <= 2048);
});
