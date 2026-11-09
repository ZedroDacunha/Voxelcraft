import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findFreeTouchRect, overlappingTouchPieces, touchMoveAllowed, touchOverlapArea } from '../world-touch-collision.js';

const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height });
const bounds = { left: 6, top: 6, right: 794, bottom: 394 };

test('detecta colisões e mantém margem sem confundir controles distantes', () => {
    const a = rect(10, 10, 50, 50), b = rect(58, 10, 50, 50), c = rect(62, 10, 50, 50);
    assert.ok(touchOverlapArea(a, b) > 0);
    assert.equal(touchOverlapArea(a, c), 0);
    assert.equal(touchOverlapArea(a, b), touchOverlapArea(b, a));
    assert.deepEqual([...overlappingTouchPieces([{ piece: 'a', rect: a }, { piece: 'b', rect: b }, { piece: 'c', rect: rect(500, 10, 40, 40) }])], ['a', 'b']);
});

test('arrasto não entra em outro controle, mas permite separar posições antigas', () => {
    const other = rect(100, 100, 50, 50);
    assert.equal(touchMoveAllowed(rect(10, 100, 50, 50), rect(90, 100, 50, 50), [other]), false);
    assert.equal(touchMoveAllowed(rect(90, 100, 50, 50), rect(80, 100, 50, 50), [other]), true);
    assert.equal(touchMoveAllowed(rect(90, 100, 50, 50), rect(95, 100, 50, 50), [other]), false);
    assert.equal(touchMoveAllowed(rect(90, 100, 50, 50), rect(10, 100, 50, 50), [other]), true);
});

test('reorganização encontra espaço próximo, dentro da área segura', () => {
    const other = rect(100, 100, 60, 60);
    const desired = rect(120, 110, 40, 40);
    const free = findFreeTouchRect(desired, bounds, [other]);
    assert.ok(free);
    assert.equal(touchOverlapArea(free, other), 0);
    assert.ok(free.left >= bounds.left && free.right <= bounds.right);
    assert.ok(free.top >= bounds.top && free.bottom <= bounds.bottom);
    assert.deepEqual(findFreeTouchRect(rect(300, 100, 40, 40), bounds, [other]), rect(300, 100, 40, 40));
});

test('quando não cabe, não inventa uma posição inválida', () => {
    const tiny = { left: 0, top: 0, right: 90, bottom: 90 };
    assert.equal(findFreeTouchRect(rect(0, 0, 50, 50), tiny, [rect(0, 0, 50, 90)]), null);
    assert.equal(findFreeTouchRect(rect(0, 0, 100, 100), tiny, []), null);
});

test('reorganização em sequência evita sobreposição após giro quando há espaço', () => {
    const placements = [], desired = [rect(10, 10, 90, 90), rect(80, 30, 40, 40), rect(82, 40, 40, 40), rect(100, 45, 40, 40)];
    for (const item of desired) {
        const free = findFreeTouchRect(item, { left: 6, top: 6, right: 390, bottom: 200 }, placements);
        assert.ok(free);
        assert.ok(placements.every(previous => touchOverlapArea(free, previous) === 0));
        placements.push(free);
    }
});

test('integração protege posição salva, área segura e mostra aviso ao bloquear', () => {
    const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    const solve = game.slice(game.indexOf('function resolveTouchPositions()'), game.indexOf('function applyTouchPositions()'));
    assert.doesNotMatch(solve, /saveTouchPositions|touchPositions\[/);
    assert.match(solve, /findFreeTouchRect\(rect, bounds, placed\)/);
    assert.match(game, /if \(!touchMoveAllowed\(current, candidate, others\)\)/);
    assert.match(game, /classList\.add\('touch-blocked'\)/);
    assert.match(game, /window\.addEventListener\('resize', applyTouchPositions\)/);
    assert.match(html, /id="touch-edit-notice" role="status" aria-live="polite"/);
    assert.match(css, /#touch-safe-zone \{[^}]*safe-area-inset-left/);
    assert.match(css, /touch-blocked/);
});
