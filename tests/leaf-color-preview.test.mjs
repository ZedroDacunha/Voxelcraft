import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAF_SHAPE_EXAMPLES } from '../tools/proposta-formatos-folhas.js';
import { LEAF_COLOR_EXAMPLES } from '../tools/proposta-cores-folhas.js';

const chosen = LEAF_SHAPE_EXAMPLES[0];

test('os estudos de cor preservam os formatos, a distribuição, os recortes e o tronco escolhidos', () => {
    assert.equal(LEAF_COLOR_EXAMPLES.length, 4);
    const patterns = new Set();
    for (const example of LEAF_COLOR_EXAMPLES) {
        const mapping = new Map();
        const reverse = new Map();
        let bytes = '';
        for (let alt = 0; alt < 2; alt++) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
            const before = chosen.leaves(x, y, alt), after = example.leaves(x, y, alt);
            assert.equal(after[3], before[3]);
            assert.deepEqual(example.wood(x, y), chosen.wood(x, y));
            assert.deepEqual(example.woodEnd(x, y), chosen.woodEnd(x, y));
            const a = before.join(','), b = after.join(',');
            if (mapping.has(a)) assert.equal(mapping.get(a), b);
            if (reverse.has(b)) assert.equal(reverse.get(b), a);
            mapping.set(a, b);
            reverse.set(b, a);
            bytes += b + ';';
        }
        patterns.add(bytes);
    }
    assert.equal(patterns.size, 4);
});
