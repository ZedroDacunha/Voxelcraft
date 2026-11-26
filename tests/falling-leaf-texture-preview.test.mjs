import test from 'node:test';
import assert from 'node:assert/strict';
import { FALLING_LEAF_EXAMPLES, fallingLeafPixel } from '../tools/proposta-folhas-caindo.js';
import { FALLING_LEAF_TEXTURE_EXAMPLES } from '../tools/proposta-textura-folha-caindo.js';

const original = FALLING_LEAF_EXAMPLES[0];

test('detalhes preservam o contorno oval escolhido e criam quatro texturas distintas', () => {
    assert.equal(FALLING_LEAF_TEXTURE_EXAMPLES.length, 4);
    const variants = new Set();
    for (const example of FALLING_LEAF_TEXTURE_EXAMPLES) {
        const bytes = [];
        assert.equal(example.pixels.length, 12);
        for (let y = 0; y < 12; y++) {
            assert.equal(example.pixels[y].length, 12);
            for (let x = 0; x < 12; x++) {
                const base = fallingLeafPixel(original, x, y);
                const color = fallingLeafPixel(example, x, y);
                assert.equal(color[3], base[3], `contorno alterado em ${example.id}: ${x},${y}`);
                assert.ok(color.every(c => Number.isInteger(c) && c >= 0 && c <= 255));
                bytes.push(...color);
            }
        }
        variants.add(bytes.join(','));
    }
    assert.equal(variants.size, 4);
});
