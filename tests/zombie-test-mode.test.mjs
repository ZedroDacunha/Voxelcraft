import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createZombieModel } from '../world-zombie-model.js';
import { createZombieTest } from '../world-zombie-test.js';

test('modelo experimental é construído e anima sem alterar a posição no mundo', () => {
    const previous = globalThis.document;
    globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {} }) }) };
    try {
        const model = createZombieModel(THREE);
        model.root.position.set(2, 4, 6);
        model.animate(1, true);
        assert.deepEqual(model.root.position.toArray(), [2, 4, 6]);
        assert.ok(model.root.children.length);
    } finally { globalThis.document = previous; }
});

test('zumbi de teste caminha apenas onde o mundo permite', () => {
    const model = { root: new THREE.Group(), animate(t, walking) { this.walking = walking; } };
    let allowed = true;
    const zombie = createZombieTest({ model, position: { x: 0, y: 4, z: 0 }, canStand: () => allowed });
    zombie.update(0.05);
    assert.ok(zombie.state.z < 0);
    assert.equal(model.walking, true);
    const before = { x: zombie.state.x, z: zombie.state.z };
    allowed = false;
    zombie.update(0.05);
    assert.equal(zombie.state.x, before.x);
    assert.equal(zombie.state.z, before.z);
    assert.equal(model.walking, false);
});

test('detecção interrompe passeio e faz a cabeça reagir antes do corpo', () => {
    const model = { root: new THREE.Group(), animate(t, walking, attention, headTurn) { Object.assign(this, { walking, attention, headTurn }); } };
    const zombie = createZombieTest({ model, position: { x: 0, y: 0, z: 0 }, canStand: () => true });
    const player = { x: 4, y: 1.55, z: 0, hasLineOfSight: true };
    const initialHeading = zombie.state.heading;
    zombie.update(.05, player);
    assert.equal(zombie.state.noticing, true);
    assert.equal(zombie.state.x, 0);
    assert.equal(zombie.state.z, 0);
    assert.equal(zombie.state.heading, initialHeading);
    assert.notEqual(model.headTurn, 0);
    for (let i = 0; i < 40; i++) zombie.update(.05, player);
    assert.notEqual(zombie.state.heading, initialHeading);
    assert.equal(zombie.state.attention, 1);
    for (let i = 0; i < 35; i++) zombie.update(.05, { ...player, hasLineOfSight: false });
    assert.equal(zombie.state.noticing, false);
    assert.equal(zombie.state.attention, 0);
    assert.equal(model.walking, true);
});

test('jogador criativo e invisível por obstáculo não despertam reação', () => {
    const model = { root: new THREE.Group(), animate() {} };
    const zombie = createZombieTest({ model, position: { x: 0, y: 0, z: 0 }, canStand: () => true });
    zombie.update(.05, { x: 1, y: 1.55, z: 0, hasLineOfSight: true, creative: true });
    assert.equal(zombie.state.noticing, false);
    zombie.update(.05, { x: 1, y: 1.55, z: 0, hasLineOfSight: false });
    assert.equal(zombie.state.noticing, false);
});

test('marcha de alerta movimenta braços e tronco com mochila presa', () => {
    const previous = globalThis.document;
    globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {} }) }) };
    try {
        const model = createZombieModel(THREE);
        const left = model.root.getObjectByName('leftArm');
        const right = model.root.getObjectByName('rightArm');
        const bag = model.root.getObjectByName('estudo-mochila-zumbi');
        assert.equal(bag.parent.name, 'torso');
        model.animate(2, true, 1, 0, -1, 1);
        const pose = [left.rotation.x, right.rotation.x, model.root.children[0].rotation.z];
        model.animate(2.4, true, 1, 0, -1, 1.4);
        assert.notEqual(left.rotation.x, pose[0]);
        assert.notEqual(right.rotation.x, pose[1]);
        assert.notEqual(model.root.children[0].rotation.z, pose[2]);
        model.dispose();
    } finally { globalThis.document = previous; }
});
