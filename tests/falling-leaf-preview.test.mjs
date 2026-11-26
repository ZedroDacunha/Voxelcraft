import test from 'node:test';
import assert from 'node:assert/strict';
import { FALLING_LEAF_EXAMPLES, FALLING_LEAF_PALETTE, fallingLeafPixel } from '../tools/proposta-folhas-caindo.js';

test('os quatro estudos de folhinhas são desenhos 12×12 distintos com recorte transparente', () => {
    assert.equal(FALLING_LEAF_EXAMPLES.length, 4);
    const shapes = new Set();
    for (const example of FALLING_LEAF_EXAMPLES) {
        assert.equal(example.pixels.length, 12);
        let opaque = 0, transparent = 0;
        let mask = '';
        for (let y = 0; y < 12; y++) {
            assert.equal(example.pixels[y].length, 12);
            for (let x = 0; x < 12; x++) {
                const key = example.pixels[y][x];
                assert.ok(Object.hasOwn(FALLING_LEAF_PALETTE, key));
                const color = fallingLeafPixel(example, x, y);
                assert.ok(color.every(c => Number.isInteger(c) && c >= 0 && c <= 255));
                assert.ok(color[3] === 0 || color[3] === 255);
                if (color[3] === 0) transparent++; else opaque++;
                mask += color[3] ? '#' : '.';
            }
        }
        assert.ok(transparent > 0 && opaque > 0);
        shapes.add(mask);
    }
    assert.equal(shapes.size, 4);
});
