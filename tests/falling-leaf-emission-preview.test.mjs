import test from 'node:test';
import assert from 'node:assert/strict';
import { FALLING_LEAF_EMISSION_STYLES, sampleLeafEmission } from '../tools/proposta-emissao-folhas.js';

test('os estudos emitem sob a copa sem nascer dentro do tronco', () => {
    assert.equal(FALLING_LEAF_EMISSION_STYLES.length, 4);
    for (const style of FALLING_LEAF_EMISSION_STYLES) {
        assert.ok(style.events.length > 0);
        let previous = -1;
        for (const event of style.events) {
            assert.ok(event.time >= previous && event.time < 90);
            previous = event.time;
            const x = Math.round(event.x), z = Math.round(event.z);
            assert.ok(Math.abs(x) <= 2 && Math.abs(z) <= 2);
            assert.ok(!(Math.abs(x) === 2 && Math.abs(z) === 2));
            assert.ok(x !== 0 || z !== 0);
            const samples = sampleLeafEmission(style, event.time + 0.001);
            assert.ok(samples.some(p => Math.abs(p.y - 2.98) < 0.01));
        }
        for (let t = 0; t < 90; t += 0.1) {
            const samples = sampleLeafEmission(style, t);
            assert.ok(samples.length <= 20);
            for (const p of samples) {
                assert.ok(Object.values(p).every(Number.isFinite));
                assert.ok(p.y <= 2.98 && p.opacity >= 0 && p.opacity <= 1);
            }
        }
    }
});

test('frequências são distintas e os grupos têm pausas', () => {
    const [sparse, balanced, frequent, bursts] = FALLING_LEAF_EMISSION_STYLES;
    assert.ok(sparse.events.length < balanced.events.length);
    assert.ok(balanced.events.length < frequent.events.length);
    const intervals = bursts.events.slice(1).map((p, i) => p.time - bursts.events[i].time);
    assert.ok(intervals.some(d => d < 0.3));
    assert.ok(intervals.some(d => d > 3));
});
