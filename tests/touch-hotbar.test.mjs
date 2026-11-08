import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compactTouchHotbar } from '../world-touch-hotbar.js';

const rect = (left, right) => ({ left, right });
test('paisagem comum: hotbar reduzida, central e livre dos controles', () => {
    const layout = compactTouchHotbar({ width: 784, height: 362,
        controls: [rect(16, 128), rect(650, 704), rect(712, 766)] });
    assert.deepEqual(layout, { slot: 38 });
    const half = (9 * layout.slot + 8 * 3 + 12) / 2;
    assert.ok(784 / 2 - half >= 128 + 8);
    assert.ok(784 / 2 + half <= 650 - 8);
});

test('ajusta casas ao espaço realmente disponível e espelha em modo canhoto', () => {
    const right = { width: 620, height: 320, controls: [rect(16, 148), rect(462, 604)] };
    const left = { ...right, controls: right.controls.map(r => rect(right.width - r.right, right.width - r.left)) };
    assert.deepEqual(compactTouchHotbar(right), { slot: 28 });
    assert.deepEqual(compactTouchHotbar(left), compactTouchHotbar(right));
});

test('sem espaço útil, em retrato ou controles no centro mantém HUD elevado', () => {
    assert.equal(compactTouchHotbar({ width: 500, height: 300, controls: [rect(16, 180), rect(320, 484)] }), null);
    assert.equal(compactTouchHotbar({ width: 390, height: 844, controls: [rect(16, 100)] }), null);
    assert.equal(compactTouchHotbar({ width: 784, height: 362, controls: [rect(360, 410)] }), null);
    assert.equal(compactTouchHotbar({ width: 784, height: 362, controls: [undefined] }), null);
});

test('HUD compacto só muda o modo de toque e conserva área segura', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(css, /body\.touch-mode\.touch-hud-compact #hud-bottom \{[^}]*--hud-slot-size: var\(--touch-hud-slot, 38px\)/);
    assert.match(css, /body\.touch-mode\.touch-hud-compact #hud-bottom \{[^}]*bottom: calc\(10px \+ env\(safe-area-inset-bottom, 0px\)\)/);
    assert.match(css, /body\.touch-mode\.touch-hud-compact #hud-bottom \{[^}]*--stat-size:/);
    assert.match(game, /window\.addEventListener\('resize', applyTouchPositions\)/);
    assert.match(game, /classList\.toggle\('touch-hud-compact', Boolean\(layout\)\)/);
    assert.match(game, /function movePieceDrag[\s\S]*?updateTouchHotbar\(\)/);
});
