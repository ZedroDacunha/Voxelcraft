import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFrameSamples } from '../world-performance-samples.js';

test('resume quadros, percentil e engasgos por intervalo real', () => {
    const s = createFrameSamples();
    s.record(99, true); // primeiro intervalo desconhecido
    for (let i = 0; i < 19; i++) s.record(10, true);
    s.record(100, true);
    const v = s.summary();
    assert.equal(v.frames, 20); assert.equal(v.p95, 10); assert.equal(v.slow, 1);
    assert.ok(Math.abs(v.fps - 20000 / 290) < 1e-9);
});
test('limita memória e substitui quadros antigos', () => {
    const s = createFrameSamples(3); s.record(1, true);
    [10, 20, 30, 40].forEach(x => s.record(x, true));
    assert.deepEqual(s.summary(), { frames: 3, seconds: .09, fps: 3000 / 90, p95: 40, slow: 0 });
});
test('ignora intervalo de retorno e dados inválidos; reset limpa', () => {
    const s = createFrameSamples(); s.record(10, true); s.record(16, true);
    s.record(5000, false); s.record(5000, true); s.record(NaN, true); s.record(-1, true);
    assert.equal(s.summary().frames, 1); s.reset(); assert.equal(s.summary(), null);
});
test('integração não coleta no fundo ou sem jogo e F3 reinicia', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /debugFrameSamples\.record\(rawDt \* 1000, debugVisible && worldRunning && !document\.hidden\)/);
    assert.match(source, /debugVisible = visible;\s*debugFrameSamples\.reset\(\)/);
    assert.match(source, /visibilitychange[\s\S]*?document\.hidden\) debugFrameSamples\.record\(0, false\)/);
});
