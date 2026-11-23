import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { planZombieStep, zombieStepPosition } from '../world-zombie-step.js';
import { createZombieTest } from '../world-zombie-test.js';

// Um degrau de 1 bloco, com o corpo aproximando pela esquerda.
const occupy = (x, y) => !(x + .3 > 2 && x - .3 < 3 && y < 1);
const stand = (x, y) => occupy(x, y) && ((y === 0 && x + .3 <= 2) || (y === 1 && x - .3 >= 2 && x + .3 <= 3));
const start = { x: 1.7, y: 0, z: .5 };
test('planeja subida somente quando há apoio e espaço', () => {
    const jump = planZombieStep(start, { x: 1, z: 0 }, occupy, stand);
    assert.ok(jump);
    assert.equal(zombieStepPosition(jump, 0).y, 0);
    assert.equal(zombieStepPosition(jump, 1).y, 1);
    assert.equal(planZombieStep(start, { x: 1, z: 0 }, (x, y) => y < .5 && occupy(x, y), stand), null);
    assert.equal(planZombieStep(start, { x: 1, z: 0 }, occupy, () => false), null);
});
test('zumbi sobe sem atravessar o degrau e aterrissa apoiado', () => {
    const model = { root: new THREE.Group(), animate() {} };
    const zombie = createZombieTest({ model, position: start, canStand: stand, canOccupy: occupy });
    const player = { x: 4, y: 2.55, z: .5, hasLineOfSight: true,
        box: { min: { x: 3.7, y: 1, z: .2 }, max: { x: 4.3, y: 2.8, z: .8 } } };
    let jumped = false;
    for (let i = 0; i < 100; i++) {
        zombie.update(.05, player);
        if (zombie.state.jump) jumped = true;
        assert.ok(occupy(zombie.state.x, zombie.state.y, zombie.state.z));
        if (jumped && !zombie.state.jump) break;
    }
    assert.ok(jumped);
    assert.equal(zombie.state.y, 1);
    assert.ok(stand(zombie.state.x, zombie.state.y, zombie.state.z));
});

test('ao mudar o cenário durante a subida, volta à origem segura', () => {
    let blocked = false;
    const dynamicOccupy = (x, y, z) => !blocked && occupy(x, y, z);
    const model = { root: new THREE.Group(), animate() {} };
    const zombie = createZombieTest({ model, position: start, canStand: stand, canOccupy: dynamicOccupy });
    const player = { x: 4, y: 2.55, z: .5, hasLineOfSight: true,
        box: { min: { x: 3.7, y: 1, z: .2 }, max: { x: 4.3, y: 2.8, z: .8 } } };
    for (let i = 0; i < 80 && !zombie.state.jump; i++) zombie.update(.05, player);
    assert.ok(zombie.state.jump);
    blocked = true;
    zombie.update(.05, player);
    assert.equal(zombie.state.jump, null);
    assert.deepEqual({ x: zombie.state.x, y: zombie.state.y, z: zombie.state.z }, start);
});

test('desce um bloco apenas com espaço e apoio no destino', async () => {
    const { planZombieDescent } = await import('../world-zombie-step.js');
    const from = { x: 2.3, y: 1, z: .5 };
    const air = (x, y) => !(x + .3 > 2 && y < 1);
    const floor = (x, y) => air(x, y) && ((y === 1 && x - .3 >= 2) || (y === 0 && x + .3 <= 2));
    const plan = planZombieDescent(from, { x: -1, z: 0 }, air, floor);
    assert.ok(plan);
    assert.equal(zombieStepPosition(plan, .5).y, 1);
    assert.equal(zombieStepPosition(plan, 1).y, 0);
    assert.equal(planZombieDescent(from, { x: -1, z: 0 }, air, () => false), null);
    assert.equal(planZombieDescent(from, { x: -1, z: 0 }, (_x, y) => y > .5, floor), null);
    const model = { root: new THREE.Group(), animate() {} };
    const z = createZombieTest({ model, position: from, canStand: floor, canOccupy: air });
    const player = { x: 0, y: 1.55, z: .5, hasLineOfSight: true,
        box: { min: { x: -.3, y: 0, z: .2 }, max: { x: .3, y: 1.8, z: .8 } } };
    let started = false;
    for (let i = 0; i < 100; i++) {
        z.update(.05, player);
        if (z.state.jump) started = true;
        assert.ok(air(z.state.x, z.state.y));
        if (started && !z.state.jump) break;
    }
    assert.ok(started);
    assert.equal(z.state.y, 0);
    assert.ok(floor(z.state.x, z.state.y));
});
