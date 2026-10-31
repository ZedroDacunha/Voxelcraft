import test from 'node:test';
import assert from 'node:assert/strict';

import { clamp01, mulberry32, Noise2D, smoothstep } from '../world-math.js';
import { ID } from '../world-catalog.js';
import { TerrainGenerator } from '../world-terrain.js';
import { createTerrainWorkerSource } from '../world-terrain-worker.js';

const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 64;
const WATER_LEVEL = 26;
const BIOME = Object.freeze({ PLAINS: 0, FOREST: 1, DESERT: 2, ROCKY: 3 });
const TERRAIN_CONFIG = Object.freeze({
    CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, ID, BIOME,
    TREE_CHANCE_FOREST: 0.035, TREE_CHANCE_PLAINS: 0.008,
});

function runWorkerSource(seed, cx, cz) {
    const source = createTerrainWorkerSource({ CHUNK_SIZE, WORLD_HEIGHT, TERRAIN_CONFIG });
    let result = null;
    const self = { onmessage: null, postMessage: message => { result = message; } };
    // O worker real só usa `self`; executamos o mesmo código num escopo isolado.
    const factory = new Function('self', `${source}\nreturn self;`);
    factory(self);
    self.onmessage({ data: { jobId: 1, cx, cz, seed } });
    return result;
}

test('o código do worker inclui todas as dependências do gerador', () => {
    const source = createTerrainWorkerSource({ CHUNK_SIZE, WORLD_HEIGHT, TERRAIN_CONFIG });
    for (const dependency of ['class Noise2D', 'class OreGenerator', 'class TerrainGenerator', 'COAL_VEIN_CONFIG']) {
        assert.ok(source.includes(dependency), `worker sem ${dependency}`);
    }
});

test('worker gera exatamente o mesmo chunk que a thread principal', () => {
    const seed = 12345;
    for (const [cx, cz] of [[0, 0], [3, -2], [-7, 11]]) {
        const workerChunk = runWorkerSource(seed, cx, cz);
        assert.ok(workerChunk, 'o worker não respondeu');
        assert.equal(workerChunk.cx, cx);
        assert.equal(workerChunk.cz, cz);
        assert.ok(workerChunk.data instanceof ArrayBuffer);
        assert.equal(workerChunk.data.byteLength, CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);

        const generator = new TerrainGenerator(seed, TERRAIN_CONFIG);
        const expected = { cx, cz, data: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT), maxY: 0 };
        generator.fill(expected);
        assert.equal(workerChunk.maxY, expected.maxY, `maxY diferente em ${cx},${cz}`);
        assert.deepEqual(new Uint8Array(workerChunk.data), expected.data, `terreno diferente em ${cx},${cz}`);
    }
});

test('funções auxiliares exportadas continuam disponíveis para o worker', () => {
    assert.equal(typeof clamp01, 'function');
    assert.equal(typeof smoothstep, 'function');
    assert.equal(typeof mulberry32, 'function');
    assert.equal(typeof Noise2D, 'function');
});
