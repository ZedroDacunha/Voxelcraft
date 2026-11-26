import test from 'node:test';
import assert from 'node:assert/strict';
import { fallingLeafPixel } from '../tools/proposta-folhas-caindo.js';
import { FALLING_LEAF_TEXTURE_EXAMPLES } from '../tools/proposta-textura-folha-caindo.js';
import { NATURAL_LEAF_REFINEMENTS } from '../tools/proposta-folha-natural.js';

const chosen = FALLING_LEAF_TEXTURE_EXAMPLES[0];

test('refinamentos mantêm o contorno natural e têm texturas distintas', () => {
    assert.equal(NATURAL_LEAF_REFINEMENTS.length, 4);
    const variants = new Set();
    for (const example of NATURAL_LEAF_REFINEMENTS) {
        const bytes = [];
        assert.equal(example.pixels.length, 12);
        for (let y = 0; y < 12; y++) {
            assert.equal(example.pixels[y].length, 12);
            for (let x = 0; x < 12; x++) {
                const base = fallingLeafPixel(chosen, x, y);
                const color = fallingLeafPixel(example, x, y);
                assert.equal(color[3], base[3]);
                assert.ok(color.every(c => Number.isInteger(c) && c >= 0 && c <= 255));
                bytes.push(...color);
            }
        }
        variants.add(bytes.join(','));
    }
    assert.equal(variants.size, 4);
});
