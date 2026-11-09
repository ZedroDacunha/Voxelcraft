import test from 'node:test';
import assert from 'node:assert/strict';
import { attackHeld, performTouchTapAttack } from '../world-touch-tap-attack.js';

function simulate(hit) {
    const events = [];
    performTouchTapAttack({
        updateTarget: () => events.push('mira central'),
        strikeCreature: options => { events.push(['criatura', options]); return hit; },
        updateMining: (dt, options) => events.push(['mineração', dt, options]),
        punch: () => events.push('braço'),
    });
    return events;
}

test('toque acerta uma criatura imediatamente, mesmo entre quadros', () => {
    assert.deepEqual(simulate(true), ['mira central', ['criatura', { tap: true }]]);
});

test('sem criatura, golpeia sem conceder mineração instantânea ao bloco', () => {
    assert.deepEqual(simulate(false), ['mira central', ['criatura', { tap: true }],
        ['mineração', 0, { tap: true }], 'braço']);
});

test('soltar uma fonte não cancela outra ação ainda pressionada', () => {
    assert.equal(attackHeld({ gesture: true, button: false }), true);
    assert.equal(attackHeld({ gesture: false, button: true }), true);
    assert.equal(attackHeld({ mouse: true }), true);
    assert.equal(attackHeld(), false);
});
