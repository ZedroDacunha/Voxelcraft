import test from 'node:test';
import assert from 'node:assert/strict';
import { TREE_TRUNK_REVIEW } from '../tools/proposta-revisao-tronco.js';
import { TRUNK_TOP_EXAMPLES } from '../tools/proposta-topo-tronco.js';
import { createCurrentTreeTextures } from '../tools/proposta-texturas-arvore.js';
import { createPreviousTrunkTextures } from '../tools/proposta-detalhes-tronco.js';

const actual = createCurrentTreeTextures();
const previous = createPreviousTrunkTextures();
test('revisão reúne o tronco implementado contra o anterior, sem alterar as folhas', () => {
    assert.equal(TREE_TRUNK_REVIEW.length, 2);
    const [chosen, reference] = TREE_TRUNK_REVIEW;
    let barkChanges = 0, topChanges = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        assert.deepEqual(chosen.wood(x, y), TRUNK_TOP_EXAMPLES[3].wood(x, y));
        assert.deepEqual(chosen.woodEnd(x, y), TRUNK_TOP_EXAMPLES[3].woodEnd(x, y));
        assert.deepEqual(chosen.wood(x, y), actual.wood(x, y));
        assert.deepEqual(chosen.woodEnd(x, y), actual.woodEnd(x, y));
        assert.deepEqual(reference.wood(x, y), previous.wood(x, y));
        assert.deepEqual(reference.woodEnd(x, y), previous.woodEnd(x, y));
        for (let alt = 0; alt <= 1; alt++) {
            assert.deepEqual(chosen.leaves(x, y, alt), actual.leaves(x, y, alt));
            assert.deepEqual(reference.leaves(x, y, alt), actual.leaves(x, y, alt));
        }
        if (chosen.wood(x, y).some((v, i) => v !== previous.wood(x, y)[i])) barkChanges++;
        if (chosen.woodEnd(x, y).some((v, i) => v !== previous.woodEnd(x, y)[i])) topChanges++;
    }
    assert.ok(barkChanges > 0 && topChanges > 0);
});
