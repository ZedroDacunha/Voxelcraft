import test from 'node:test';
import assert from 'node:assert/strict';

import { findSpawn, TerrainGenerator } from '../world-terrain.js';
import { TreeShapes } from '../world-tree-shapes.js';
import { ID } from '../world-catalog.js';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../world-save-settings.js';

const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, ROCKY: 3 };
const CONFIG = {
    CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL: 26, ID, BIOME,
    TREE_CHANCE_FOREST: 0.035, TREE_CHANCE_PLAINS: 0.008,
};

function chunkAt(generator, cx, cz) {
    const size = generator.config.CHUNK_SIZE;
    const chunk = { cx, cz, data: new Uint8Array(size * size * WORLD_HEIGHT), maxY: 0 };
    generator.fill(chunk);
    return chunk;
}

test('copas e galhos nas divisas coincidem com uma região gerada inteira', () => {
    const size = CHUNK_SIZE * 3;
    const large = new TerrainGenerator(12345, { ...CONFIG, CHUNK_SIZE: size });
    const regular = new TerrainGenerator(12345, CONFIG);
    let leavesOnEdge = 0, logsOnEdge = 0;
    // Inclui coordenadas negativas e os cantos onde quatro chunks se encontram.
    for (const origin of [-1, 0]) {
        const region = chunkAt(large, origin, origin);
        for (let cz = 2; cz >= 0; cz--) {
            for (let cx = 2; cx >= 0; cx--) {
                const part = chunkAt(regular, origin * 3 + cx, origin * 3 + cz);
                for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) {
                    for (let y = 0; y < WORLD_HEIGHT; y++) {
                        const actual = part.data[regular.index(x, y, z)];
                        const expected = region.data[large.index(cx * CHUNK_SIZE + x, y, cz * CHUNK_SIZE + z)];
                        if ([ID.LEAVES, ID.LOG].includes(actual) || [ID.LEAVES, ID.LOG].includes(expected)) {
                            assert.equal(actual, expected);
                            assert.ok(y <= part.maxY);
                            if ((cx > 0 && x === 0) || (cz > 0 && z === 0)) {
                                if (actual === ID.LOG) logsOnEdge++;
                                if (actual === ID.LEAVES) leavesOnEdge++;
                            }
                        }
                    }
                }
            }
        }
    }
    assert.ok(leavesOnEdge > 0 && logsOnEdge > 0);
});

test('as três silhuetas têm madeira ligada ao pé e cabem na margem dos chunks', () => {
    const shapes = new TreeShapes(ID);
    const neighbors = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const form of ['tall', 'spreading', 'weeping']) {
        for (let variant = 0; variant < 64; variant++) {
            const { cells, height } = shapes.build(form, variant);
            const wood = new Set();
            const all = new Set();
            let branch = false;
            for (const [x, y, z, type] of cells) {
                assert.ok(Math.max(Math.abs(x), Math.abs(z)) <= TreeShapes.radius);
                assert.ok(y >= 1 && y <= height);
                assert.ok(type === ID.LOG || type === ID.LEAVES);
                all.add([x,y,z].join());
                if (type === ID.LOG) {
                    wood.add([x,y,z].join());
                    if (y > 1 && Math.max(Math.abs(x), Math.abs(z)) >= 2) branch = true;
                }
            }
            assert.ok(branch);
            assert.ok(all.size > wood.size);
            for (const remaining of [wood, all]) {
                const queue = [[0, 1, 0]];
                assert.ok(remaining.delete('0,1,0'));
                for (const [x, y, z] of queue) {
                    for (const [dx, dy, dz] of neighbors) {
                        const next = [x + dx, y + dy, z + dz];
                        if (remaining.delete(next.join())) queue.push(next);
                    }
                }
                assert.equal(remaining.size, 0, form + variant);
            }
        }
    }
});

test('sem árvores no deserto, na rocha ou em água', () => {
    for (const [biome, flooded] of [[BIOME.DESERT, false], [BIOME.ROCKY, false], [BIOME.FOREST, true]]) {
        const gen = new TerrainGenerator(5, { ...CONFIG, TREE_CHANCE_FOREST: 1, TREE_CHANCE_PLAINS: 1 });
        gen.biomeAt = () => biome;
        gen.baseHeightAt = () => 38;
        gen.riverStrengthAt = () => flooded ? 1 : 0;
        const { data } = chunkAt(gen, -1, 1);
        assert.ok(!data.includes(ID.LOG) && !data.includes(ID.LEAVES));
    }
});

test('a ordem de geração não altera o chunk', () => {
    const first = new TerrainGenerator(12345, CONFIG);
    const expected = chunkAt(first, 2, 2);
    const after = new TerrainGenerator(12345, CONFIG);
    for (const [cx, cz] of [[1, 2], [3, 2], [2, 1], [2, 3]]) chunkAt(after, cx, cz);
    assert.deepEqual(chunkAt(after, 2, 2), expected);
});

test('o jogador nasce com espaço livre sob as novas copas', () => {
    for (const seed of [1, 42, 817, 1515, 12345, 33901]) {
        const gen = new TerrainGenerator(seed, CONFIG);
        const spawn = findSpawn(gen, CONFIG);
        const x = Math.floor(spawn.x), z = Math.floor(spawn.z);
        const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
        const chunk = chunkAt(gen, cx, cz);
        for (const y of [spawn.y, spawn.y + 1]) {
            const block = chunk.data[gen.index(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)];
            assert.ok(block !== ID.LOG && block !== ID.LEAVES);
        }
    }
});
