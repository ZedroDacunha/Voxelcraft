import test from 'node:test';
import assert from 'node:assert/strict';
import { LANDING_STYLES, sampleLanding } from '../tools/proposta-pouso-folhas.js';

test('pouso da prévia respeita a ilha plana, o tronco e os limites visuais', () => {
    assert.equal(LANDING_STYLES.length, 3);
    for (const style of LANDING_STYLES) {
        let flying = 0, landed = 0;
        for (let t = 0; t < 90; t += 0.025) {
            const leaves = sampleLanding(style, t);
            assert.ok(leaves.length <= 20);
            for (const p of leaves) {
                assert.ok(Object.values(p).every(Number.isFinite));
                assert.ok(p.y >= 1.27 && p.groundY > 1);
                assert.ok(Math.abs(p.x) <= 2.22 && Math.abs(p.z) <= 2.22);
                assert.ok(Math.abs(p.x) >= 0.77 || Math.abs(p.z) >= 0.77, `tronco: ${p.x}, ${p.z}`);
                assert.ok(p.flyingOpacity >= 0 && p.flyingOpacity <= 1);
                assert.ok(p.groundOpacity >= 0 && p.groundOpacity <= 1);
                if (p.flyingOpacity > 0) flying++;
                if (p.groundOpacity > 0) landed++;
            }
        }
        assert.ok(flying && landed);
    }
});

test('as opções têm tempos progressivos e somem sem acumular', () => {
    const totals = LANDING_STYLES.map(style => {
        let total = 0;
        for (let t = 0; t < 90; t += 0.05) total += sampleLanding(style, t).filter(p => p.groundOpacity > 0).length;
        return total;
    });
    assert.ok(totals[0] < totals[1] && totals[1] < totals[2]);
    for (const style of LANDING_STYLES) {
        assert.deepEqual(sampleLanding(style, 0), sampleLanding(style, 90));
    }
});
