import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { TILE, TILE_PX } from '../world-catalog.js';
import { createTilePixelSource } from '../world-textures.js';
import { BALANCED_TREE_TEXTURES } from '../world-tree-textures.js';
import { TREE_TEXTURE_EXAMPLES, createCurrentTreeTextures } from '../tools/proposta-texturas-arvore.js';
import { LEAF_OPENING_EXAMPLES } from '../tools/proposta-aberturas-folhas.js';

const tiles = [
    [TILE.WOOD, (tree, x, y) => tree.wood(x, y), 'f40f60c6d8c597d3cbbf806390f4e8d445f94ce48fab4f90725902ecdee919e0'],
    [TILE.WOOD_END, (tree, x, y) => tree.woodEnd(x, y), 'c230bb5c0bc7a3f39a888458b46d2102ab431916a78ddd3e617a950b3f05f169'],
    [TILE.LEAVES, (tree, x, y) => tree.leaves(x, y, 0), 'b54004cb41eb45f01465bd5629e329348658aee1b23b8a059dd131fa2ab4244b'],
    [TILE.LEAVES_ALT, (tree, x, y) => tree.leaves(x, y, 1), '617c4293146ed69d17b0dbde56865c82167f0108ee2b57d7ff2e41c43724cfc5'],
];

test('o atlas usa o tronco equilibrado e as folhas arejadas aprovadas', () => {
    assert.equal(TILE_PX, 32);
    const pixel = createTilePixelSource();
    const current = createCurrentTreeTextures();
    const chosen = LEAF_OPENING_EXAMPLES[2];
    assert.equal(TREE_TEXTURE_EXAMPLES[0], BALANCED_TREE_TEXTURES);
    for (const [tile, sample, expectedHash] of tiles) {
        const bytes = [];
        for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
            const actual = pixel(tile, x, y);
            assert.deepEqual(actual, sample(chosen, x, y));
            assert.deepEqual(actual, sample(current, x, y));
            if (tile === TILE.WOOD || tile === TILE.WOOD_END) {
                assert.deepEqual(actual, sample(BALANCED_TREE_TEXTURES, x, y));
            }
            assert.equal(actual.length, 4);
            assert.ok(actual.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255));
            assert.ok(actual[3] === 0 || actual[3] === 255);
            bytes.push(...actual);
        }
        assert.equal(createHash('sha256').update(Buffer.from(bytes)).digest('hex'), expectedHash);
    }
});

test('as duas variantes de folhas mantêm recortes e padrões distintos', () => {
    const pixel = createTilePixelSource();
    let holes = 0, altHoles = 0, differences = 0;
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
        const a = pixel(TILE.LEAVES, x, y), b = pixel(TILE.LEAVES_ALT, x, y);
        if (a[3] === 0) holes++;
        if (b[3] === 0) altHoles++;
        if (a.some((v, i) => v !== b[i])) differences++;
    }
    assert.ok(holes > 0 && altHoles > 0);
    assert.ok(differences > 0);
});
