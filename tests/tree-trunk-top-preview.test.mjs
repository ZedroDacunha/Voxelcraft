import test from 'node:test';
import assert from 'node:assert/strict';
import { BARK_COLOR_EXAMPLES } from '../tools/proposta-cores-tronco.js';
import { TRUNK_TOP_EXAMPLES } from '../tools/proposta-topo-tronco.js';

const chosen = BARK_COLOR_EXAMPLES[0];
test('opções preservam fibras naturais, folhagem e borda da casca', () => {
    assert.equal(TRUNK_TOP_EXAMPLES.length, 4);
    const signatures = new Set();
    for (const example of TRUNK_TOP_EXAMPLES) {
        let changed = 0;
        const pixels = [];
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
            const color = example.woodEnd(x, y), original = chosen.woodEnd(x, y);
            assert.ok(color.length === 4 && color.every(c => Number.isInteger(c) && c >= 0 && c <= 255));
            assert.equal(color[3], 255);
            assert.deepEqual(example.woodEnd(x + 32, y - 32), color);
            assert.deepEqual(example.wood(x, y), chosen.wood(x, y));
            assert.deepEqual(example.leaves(x, y, 0), chosen.leaves(x, y, 0));
            assert.deepEqual(example.leaves(x, y, 1), chosen.leaves(x, y, 1));
            const cx = x - 15.5, cy = y - 15.5;
            const d = Math.max(Math.abs(cx), Math.abs(cy)) * 0.76 + Math.hypot(cx, cy) * 0.28;
            if (d >= 11.9) assert.deepEqual(color, original);
            if (color.some((c, i) => c !== original[i])) changed++;
            pixels.push(color.join(','));
        }
        if (example.id === 'atual') assert.equal(changed, 0);
        else assert.ok(changed > 0);
        signatures.add(pixels.join('|'));
    }
    assert.equal(signatures.size, 4);
});
