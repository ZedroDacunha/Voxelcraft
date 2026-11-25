import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createPlayerModel } from '../player-model.js';
import { createPlayerHeldItem } from '../player-held-item.js';
import { applyGroundPose, groundPose, rigLocomotion } from '../player-locomotion.js';
import { ATTACK_COOLDOWN } from '../world-creature.js';
import { applyFirstPersonToolPose } from '../world-first-person-tool.js';
import { applyFirstPersonSwordPose, applyThirdPersonSwordPose, beginSwordSwing, createSwordSwing, swordPose } from '../player-sword-animation.js';

test('segurar o ataque completa o arco antes de iniciar o corte inverso', () => {
    const state = createSwordSwing();
    beginSwordSwing(state, 1, 0);
    beginSwordSwing(state, 1, ATTACK_COOLDOWN / 2);
    assert.equal(state.startedAt, 0);
    assert.ok(swordPose(state, .22).cut > .8);
    const guard = swordPose(state, ATTACK_COOLDOWN);
    assert.deepEqual([guard.prepare, guard.cut, guard.wrist], [0, 0, 0]);
    beginSwordSwing(state, 1, ATTACK_COOLDOWN);
    assert.equal(state.direction, -1);
    beginSwordSwing(state, 1, 2);
    assert.equal(state.direction, 1);
});

test('o ponto de apoio permanece dentro da mão nas duas direções do corte', () => {
    const state = createSwordSwing();
    const arm = new THREE.Group(), anchor = new THREE.Group();
    arm.add(anchor);
    const fist = new THREE.Box3(new THREE.Vector3(-.065, -.065, -.60), new THREE.Vector3(.065, .065, -.40));
    for (const start of [0, ATTACK_COOLDOWN]) {
        beginSwordSwing(state, 1, start);
        for (let i = 0; i <= 30; i++) {
            arm.position.set(.42, -.5, -.25);
            arm.rotation.set(.35, .25, 0);
            applyFirstPersonToolPose(anchor);
            applyFirstPersonSwordPose(arm, anchor, swordPose(state, start + ATTACK_COOLDOWN * i / 30));
            const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(anchor.getWorldQuaternion(new THREE.Quaternion()));
            assert.ok(blade.z < -.25, 'a ponta se afasta da câmera durante todo o golpe');
            assert.ok(fist.containsPoint(arm.worldToLocal(anchor.getWorldPosition(new THREE.Vector3()))));
        }
    }
});


test('na corrida, a ponta segue à frente da mão no corte e no revés', () => {
    const model = createPlayerModel(THREE);
    const held = createPlayerHeldItem(THREE, model.rightArm);
    const rig = rigLocomotion(THREE, model);
    const sword = new THREE.Group();
    sword.userData.isSwordModel = true;
    held.update(1, sword, null, true, true);
    const blade = held.anchor.getObjectByName('toolPose').children[0];
    const swing = createSwordSwing();
    for (const foot of [0, 1]) {
        const start = foot * ATTACK_COOLDOWN;
        beginSwordSwing(swing, 1, start);
        for (let i = 0; i <= 60; i++) {
            const t = i / 60;
            model.root.rotation.set(0, 0, 0, 'YXZ');
            model.rightArm.rotation.set(0, 0, 0);
            model.leftArm.rotation.set(0, 0, 0);
            applyGroundPose(model, rig, groundPose({ foot, run: 1 }, t * 2 * Math.PI, 1));
            applyThirdPersonSwordPose(model, rig, swordPose(swing, start + t * ATTACK_COOLDOWN), 1);
            const tip = blade.localToWorld(new THREE.Vector3(0, 1, 0));
            const grip = blade.getWorldPosition(new THREE.Vector3());
            assert.ok(tip.z > grip.z + .20, 'a lâmina avança no sentido do olhar (+Z)');
        }
    }
    model.dispose();
});
