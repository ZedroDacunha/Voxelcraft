import test from 'node:test';
import assert from 'node:assert/strict';
import { WIND_LEAF_SCENARIOS, leafIntervalForWind } from '../tools/proposta-emissao-vento.js';
import { sampleLeafEmission, createLeafEmissionStyle } from '../tools/proposta-emissao-folhas.js';

test('calmaria discreta e vento entre equilibrado e frequente', () => {
    assert.deepEqual(WIND_LEAF_SCENARIOS.map(s => s.interval), [2.8, 1.6, 1]);
    assert.equal(leafIntervalForWind(-1), 2.8);
    assert.equal(leafIntervalForWind(Infinity), 2.8);
    assert.equal(leafIntervalForWind(2), 1);
    let previous = 2.8;
    for (let n = 0; n <= 1000; n++) {
        const level = n / 1000;
        const interval = leafIntervalForWind(level);
        assert.ok(interval <= previous + 1e-12 && interval >= 1);
        if (level >= 0.2) assert.ok(interval >= 0.85 && interval <= 1.6);
        previous = interval;
    }
    assert.ok(Math.abs(leafIntervalForWind(0.2 - 1e-6) - leafIntervalForWind(0.2 + 1e-6)) < 1e-8);
});

test('cenários preservam a emissão sob a copa e o movimento da prévia anterior', () => {
    assert.throws(() => createLeafEmissionStyle({ interval: 0 }));
    for (const style of WIND_LEAF_SCENARIOS) {
        for (const event of style.events) {
            const x = Math.round(event.x), z = Math.round(event.z);
            assert.ok(Math.abs(x) <= 2 && Math.abs(z) <= 2);
            assert.ok(!(Math.abs(x) === 2 && Math.abs(z) === 2));
            assert.ok(x !== 0 || z !== 0);
        }
        for (let t = 0; t < 90; t += 0.1) {
            const samples = sampleLeafEmission(style, t);
            assert.ok(samples.length <= 20);
            assert.ok(samples.every(p => Object.values(p).every(Number.isFinite) && p.y <= 2.98));
        }
    }
    assert.ok(WIND_LEAF_SCENARIOS[0].events.length < WIND_LEAF_SCENARIOS[1].events.length);
    assert.ok(WIND_LEAF_SCENARIOS[1].events.length < WIND_LEAF_SCENARIOS[2].events.length);
});
