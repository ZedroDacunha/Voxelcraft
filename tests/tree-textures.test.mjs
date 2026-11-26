import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { TILE, TILE_PX } from '../world-catalog.js';
import { createTilePixelSource } from '../world-textures.js';
import { BALANCED_TREE_TEXTURES } from '../world-tree-textures.js';
import { TREE_TEXTURE_EXAMPLES, createCurrentTreeTextures } from '../tools/proposta-texturas-arvore.js';

const tiles = [
    [TILE.WOOD, (tree, x, y) => tree.wood(x, y), 'f40f60c6d8c597d3cbbf806390f4e8d445f94ce48fab4f90725902ecdee919e0'],
    [TILE.WOOD_END, (tree, x, y) => tree.woodEnd(x, y), 'c230bb5c0bc7a3f39a888458b46d2102ab431916a78ddd3e617a950b3f05f169'],
    [TILE.LEAVES, (tree, x, y) => tree.leaves(x, y, 0), 'd6c7ddaffb9a8ea174e9c80c7100208d522719b23fdd59e3844e6b74dc74e1f0'],
    [TILE.LEAVES_ALT, (tree, x, y) => tree.leaves(x, y, 1), '8ab2111ecafa8759772027efeb9ac347d3eda4ca863ceda38b260822e6320ca5'],
];

test('o atlas usa exatamente as quatro texturas aprovadas do exemplo equilibrado', () => {
    assert.equal(TILE_PX, 32);
    const pixel = createTilePixelSource();
    const current = createCurrentTreeTextures();
    assert.equal(TREE_TEXTURE_EXAMPLES[0], BALANCED_TREE_TEXTURES);
    for (const [tile, sample, expectedHash] of tiles) {
        const bytes = [];
        for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
            const actual = pixel(tile, x, y);
            assert.deepEqual(actual, sample(BALANCED_TREE_TEXTURES, x, y));
            assert.deepEqual(actual, sample(current, x, y));
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
