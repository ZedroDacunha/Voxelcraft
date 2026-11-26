import test from 'node:test';
import assert from 'node:assert/strict';
import { BARK_DETAIL_EXAMPLES } from '../tools/proposta-detalhes-tronco.js';
import { BARK_COLOR_EXAMPLES } from '../tools/proposta-cores-tronco.js';
const fibers = BARK_DETAIL_EXAMPLES[0];

test('quatro cores preservam o desenho de fibras e repetem sem alterar o topo ou as folhas', () => {
    assert.equal(BARK_COLOR_EXAMPLES.length, 4);
    const signatures = new Set();
    for (const example of BARK_COLOR_EXAMPLES) {
        const mapping = new Map(), result = [];
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
            const source = fibers.wood(x, y), pixel = example.wood(x, y);
            assert.ok(pixel.every(Number.isInteger));
            assert.ok(pixel.every(n => n >= 0 && n <= 255));
            assert.equal(pixel[3], 255);
            assert.deepEqual(example.wood(x + 32, y - 32), pixel);
            assert.deepEqual(example.woodEnd(x, y), fibers.woodEnd(x, y));
            assert.deepEqual(example.leaves(x, y, 0), fibers.leaves(x, y, 0));
            assert.deepEqual(example.leaves(x, y, 1), fibers.leaves(x, y, 1));
            const key = source.join(',');
            if (mapping.has(key)) assert.deepEqual(pixel, mapping.get(key));
            else mapping.set(key, pixel);
            result.push(pixel.join(','));
        }
        signatures.add(result.join('|'));
    }
    assert.equal(signatures.size, 4);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        assert.deepEqual(BARK_COLOR_EXAMPLES[0].wood(x, y), fibers.wood(x, y));
    }
});
