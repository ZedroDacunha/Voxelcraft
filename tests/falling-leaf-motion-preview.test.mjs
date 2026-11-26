import test from 'node:test';
import assert from 'node:assert/strict';
import { FALLING_LEAF_MOTIONS, sampleFallingLeafMotion } from '../tools/proposta-movimento-folhas.js';

test('as quatro opções geram trajetórias limitadas, suaves e diferentes', () => {
    assert.equal(FALLING_LEAF_MOTIONS.length, 4);
    const signatures = new Set();
    for (const profile of FALLING_LEAF_MOTIONS) {
        let previous = null;
        for (let step = 0; step < 100; step++) {
            const p = sampleFallingLeafMotion(profile, profile.duration * step / 100, 0);
            for (const value of Object.values(p)) assert.ok(Number.isFinite(value));
            assert.ok(p.y >= 1.08 && p.y <= 3.12);
            assert.ok(p.opacity >= 0 && p.opacity <= 1);
            assert.ok(p.width > 0 && p.width <= 1);
            if (previous) assert.ok(p.y < previous.y, 'a folha deve descer durante a demonstração');
            previous = p;
        }
        const a = sampleFallingLeafMotion(profile, 0.37, 2);
        const b = sampleFallingLeafMotion(profile, 0.37 + profile.duration, 2);
        for (const key of Object.keys(a)) assert.ok(Math.abs(a[key] - b[key]) < 1e-9, 'o ciclo deve se repetir');
        assert.equal(sampleFallingLeafMotion(profile, 0, 0).opacity, 0);
        signatures.add(JSON.stringify(sampleFallingLeafMotion(profile, 1.1, 2)));
    }
    assert.equal(signatures.size, 4);
});
