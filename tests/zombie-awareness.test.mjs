import test from 'node:test';
import assert from 'node:assert/strict';
import { ZOMBIE_NOTICE_RADIUS, zombieNoticesPlayer } from '../world-zombie-awareness.js';

test('zumbi percebe jogador visível até 16 blocos', () => {
    assert.equal(ZOMBIE_NOTICE_RADIUS, 16);
    assert.equal(zombieNoticesPlayer({ distance: 0, hasLineOfSight: true }), true);
    assert.equal(zombieNoticesPlayer({ distance: 16, hasLineOfSight: true }), true);
    assert.equal(zombieNoticesPlayer({ distance: 16.01, hasLineOfSight: true }), false);
});

test('não percebe através de obstáculos nem seleciona jogador criativo ou morto', () => {
    assert.equal(zombieNoticesPlayer({ distance: 1, hasLineOfSight: false }), false);
    assert.equal(zombieNoticesPlayer({ distance: 1 }), false);
    assert.equal(zombieNoticesPlayer({ distance: 1, hasLineOfSight: true, creative: true }), false);
    assert.equal(zombieNoticesPlayer({ distance: 1, hasLineOfSight: true, dead: true }), false);
});

test('distâncias inválidas não ativam detecção', () => {
    for (const distance of [-1, NaN, Infinity, undefined, '1']) {
        assert.equal(zombieNoticesPlayer({ distance, hasLineOfSight: true }), false);
    }
});
