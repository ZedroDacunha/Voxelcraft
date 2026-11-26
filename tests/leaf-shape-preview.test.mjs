import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAF_SHAPE_EXAMPLES } from '../tools/proposta-formatos-folhas.js';
import { BALANCED_TREE_TEXTURES } from '../world-tree-textures.js';

test('os quatro estudos mudam o formato, preservando tronco, paleta e recortes', () => {
    assert.equal(LEAF_SHAPE_EXAMPLES.length, 4);
    const allowed = new Set();
    for (let alt = 0; alt < 2; alt++) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        allowed.add(JSON.stringify(BALANCED_TREE_TEXTURES.leaves(x, y, alt)));
    }
    const patterns = new Set();
    for (const example of LEAF_SHAPE_EXAMPLES) {
        let bytes = '';
        for (let alt = 0; alt < 2; alt++) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
            const pixel = example.leaves(x, y, alt);
            assert.equal(pixel[3], BALANCED_TREE_TEXTURES.leaves(x, y, alt)[3]);
            assert.ok(allowed.has(JSON.stringify(pixel)), `cor inesperada em ${example.id}`);
            assert.deepEqual(example.wood(x, y), BALANCED_TREE_TEXTURES.wood(x, y));
            assert.deepEqual(example.woodEnd(x, y), BALANCED_TREE_TEXTURES.woodEnd(x, y));
            bytes += pixel.join(',') + ';';
        }
        patterns.add(bytes);
    }
    assert.equal(patterns.size, 4, 'os formatos devem produzir padrões distintos');
});
