import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    buildLightRegions,
    collectChunkRegion,
    lightHaloRadius,
} from '../world-light-region.js';

function makeGetChunk(loaded = null) {
    return (cx, cz) => {
        if (loaded && !loaded.has(`${cx},${cz}`)) return null;
        return { cx, cz };
    };
}

test('halo de luz cobre o alcance máximo além da borda do chunk', () => {
    assert.equal(lightHaloRadius(16, 15), 1);
    assert.equal(lightHaloRadius(16, 1), 0);
    assert.equal(lightHaloRadius(8, 15), 2);
    assert.equal(lightHaloRadius(0, 15), 0);
});

test('região alvo imediata tem 3x3 chunks quando todos estão carregados', () => {
    const region = collectChunkRegion({ cx: 0, cz: 0, radius: 1, getChunk: makeGetChunk() });
    assert.equal(region.length, 9);
    assert.deepEqual(region.map(part => [part.cx, part.cz]), [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 0], [0, 1],
        [1, -1], [1, 0], [1, 1],
    ]);
});

test('região ignora chunks ainda não carregados', () => {
    const loaded = new Set(['0,0', '1,0', '2,0']);
    const region = collectChunkRegion({ cx: 0, cz: 0, radius: 1, getChunk: makeGetChunk(loaded) });
    assert.deepEqual(region.map(part => [part.cx, part.cz]), [[0, 0], [1, 0]]);
});

test('luz de blocos inclui halo externo capaz de alcançar a borda do alvo', () => {
    const { target, block, halo } = buildLightRegions({
        cx: 0,
        cz: 0,
        radius: 1,
        chunkSize: 16,
        maxLight: 15,
        getChunk: makeGetChunk(),
    });
    assert.equal(halo, 1);
    assert.equal(target.length, 9);
    assert.equal(block.length, 25);
    assert.equal(target.some(part => part.cx === 2), false);
    assert.equal(block.some(part => part.cx === 2 && part.cz === 0), true);
});

test('sem alcance de luz além de um bloco, o halo não expande a região', () => {
    const { target, block, halo } = buildLightRegions({
        cx: 0,
        cz: 0,
        radius: 1,
        chunkSize: 16,
        maxLight: 1,
        getChunk: makeGetChunk(),
    });
    assert.equal(halo, 0);
    assert.equal(block, target);
});

test('game.js usa região com halo para luz de blocos e mantém alvo imediato para céu', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /buildLightRegions/);
    assert.match(source, /target: region, block: blockRegion/);
    assert.match(source, /propagateLightChannel\(region, regionIndex, 'skyLight', false\)/);
    assert.match(source, /hasExternalBlockEmitter/);
    assert.match(source, /propagateLightChannel\(blockLightRegion, blockLightRegionIndex, 'blockLight', true\)/);
    assert.doesNotMatch(source, /propagateSkyLight\(/);
});
