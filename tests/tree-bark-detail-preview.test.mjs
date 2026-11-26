import test from 'node:test';
import assert from 'node:assert/strict';
import { BARK_DETAIL_EXAMPLES, createPreviousTrunkTextures } from '../tools/proposta-detalhes-tronco.js';

const current = createPreviousTrunkTextures();

test('quatro detalhes distintos mantêm a casca opaca, a cor e a repetição', () => {
    assert.equal(BARK_DETAIL_EXAMPLES.length, 4);
    const signatures = new Set();
    for (const example of BARK_DETAIL_EXAMPLES) {
        const pixels = [];
        let changed = 0;
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
            const pixel = example.wood(x, y), before = current.wood(x, y);
            assert.equal(pixel.length, 4);
            assert.equal(pixel[3], 255);
            assert.ok(pixel.slice(0, 3).every((n, i) => Number.isInteger(n) && n >= 0 && n <= 255 && Math.abs(n - before[i]) <= 44));
            assert.deepEqual(example.wood(x + 32, y), pixel);
            assert.deepEqual(example.wood(x, y + 32), pixel);
            assert.deepEqual(example.wood(x - 32, y - 32), pixel);
            if (pixel.some((n, i) => n !== before[i])) changed++;
            pixels.push(pixel.join(','));
        }
        assert.ok(changed > 20 && changed < 300, `${example.id}: ${changed} pixels`);
        signatures.add(pixels.join('|'));
    }
    assert.equal(signatures.size, 4);
});

test('topo e duas variantes de folhas permanecem iguais ao jogo', () => {
    for (const example of BARK_DETAIL_EXAMPLES) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        assert.deepEqual(example.woodEnd(x, y), current.woodEnd(x, y));
        assert.deepEqual(example.leaves(x, y, 0), current.leaves(x, y, 0));
        assert.deepEqual(example.leaves(x, y, 1), current.leaves(x, y, 1));
    }
});
