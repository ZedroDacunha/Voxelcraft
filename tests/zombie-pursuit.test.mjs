import test from 'node:test';
import assert from 'node:assert/strict';
import { zombiePursuitStep } from '../world-zombie-pursuit.js';

const args = { position: { x: 0, z: 0 }, target: { x: 3, z: 4 }, speed: 2, dt: 0.5 };
test('passo aponta ao alvo e usa velocidade e tempo', () => {
    const step = zombiePursuitStep(args);
    assert.equal(step.moving, true);
    assert.ok(Math.abs(step.dx - 0.6) < 1e-10);
    assert.ok(Math.abs(step.dz - 0.8) < 1e-10);
});
test('não ultrapassa o alvo e para no alcance de ataque', () => {
    assert.deepEqual(zombiePursuitStep({ ...args, dt: 10 }), { dx: 3, dz: 4, moving: true });
    assert.deepEqual(zombiePursuitStep({ ...args, inAttackReach: true }), { dx: 0, dz: 0, moving: false });
});
test('não anda com alvo ausente, coordenadas inválidas ou tempo inválido', () => {
    const stopped = { dx: 0, dz: 0, moving: false };
    for (const change of [{ target: null }, { dt: 0 }, { dt: Infinity }, { speed: -1 },
        { target: { x: NaN, z: 0 } }, { target: { x: 0, z: 0 } }]) {
        assert.deepEqual(zombiePursuitStep({ ...args, ...change }), stopped);
    }
});
