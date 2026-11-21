import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createPlayerModel } from '../player-model.js';
import { createPlayerHeldItem } from '../player-held-item.js';
import { advanceLocomotion, applyGroundPose, createLocomotion, groundPose, rigLocomotion } from '../player-locomotion.js';

test('os contatos consecutivos alternam o apoio sem salto de fase', () => {
    const state = createLocomotion();
    const start = groundPose(state, 0, 1);
    const end = groundPose(state, 2 * Math.PI, 1);
    advanceLocomotion(state, 1, true, 0);
    const next = groundPose(state, 0, 1);
    assert.deepEqual(end, next);
    assert.equal(next.leg, -start.leg);
});

test('a transição para corrida independe da taxa de quadros', () => {
    function simulate(fps) {
        const state = createLocomotion();
        for (let i = 0; i < fps; i++) advanceLocomotion(state, 0, true, 1 / fps);
        return state.run;
    }
    assert.ok(Math.abs(simulate(30) - simulate(120)) < 1e-10);
});

test('a mão e o item dobram juntos e o nado pode restaurar a pose', () => {
    const model = createPlayerModel(THREE);
    const { anchor } = createPlayerHeldItem(THREE, model.rightArm);
    const originalPosition = anchor.getWorldPosition(new THREE.Vector3());
    const rig = rigLocomotion(THREE, model);
    assert.ok(anchor.getWorldPosition(new THREE.Vector3()).distanceTo(originalPosition) < 1e-9);
    assert.equal(anchor.parent, model.rightArm.getObjectByName('hand').parent);
    const pose = groundPose({ foot: 0, run: 1 }, Math.PI, 1);
    applyGroundPose(model, rig, pose);
    assert.ok(anchor.parent.rotation.x < -0.5);
    assert.ok(model.leftLeg.position.y > rig.hipY);
    applyGroundPose(model, rig, pose, 0);
    assert.ok(Math.abs(anchor.parent.rotation.x) < 1e-9);
    assert.equal(model.leftLeg.position.y, rig.hipY);
    model.dispose();
});
