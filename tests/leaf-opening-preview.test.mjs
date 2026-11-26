import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAF_COLOR_EXAMPLES, naturalLeafUncut } from '../tools/proposta-cores-folhas.js';
import { LEAF_OPENING_EXAMPLES } from '../tools/proposta-aberturas-folhas.js';

const chosen = LEAF_COLOR_EXAMPLES[0];

test('as aberturas preservam a cor e o desenho do formato escolhido, mudando só a máscara', () => {
    assert.equal(LEAF_OPENING_EXAMPLES.length, 4);
    const counts = [];
    for (const example of LEAF_OPENING_EXAMPLES) {
        const holes = [0, 0];
        let variantDifference = 0;
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
            assert.deepEqual(example.wood(x, y), chosen.wood(x, y));
            assert.deepEqual(example.woodEnd(x, y), chosen.woodEnd(x, y));
            for (let alt = 0; alt < 2; alt++) {
                const p = example.leaves(x, y, alt);
                if (p[3] === 0) {
                    holes[alt]++;
                    assert.deepEqual(p, [0, 0, 0, 0]);
                } else {
                    assert.deepEqual(p, naturalLeafUncut(x, y, alt));
                    if (chosen.leaves(x, y, alt)[3] === 255) assert.deepEqual(p, chosen.leaves(x, y, alt));
                }
                if (example.id === 'atual') assert.deepEqual(p, chosen.leaves(x, y, alt));
            }
            if (example.leaves(x, y, 0)[3] !== example.leaves(x, y, 1)[3]) variantDifference++;
        }
        assert.ok(variantDifference > 0, 'as variantes não devem ter máscaras idênticas');
        counts.push(holes);
    }
    assert.deepEqual(counts, [[41, 41], [90, 63], [133, 133], [195, 195]]);
});
