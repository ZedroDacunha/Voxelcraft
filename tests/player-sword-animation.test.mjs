import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createSwordModel } from '../world-sword-model.js';
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
            anchor.updateWorldMatrix(true, false);
            const toolPose = anchor.matrixWorld.clone();
            applyFirstPersonSwordPose(arm, anchor, swordPose(state, start + ATTACK_COOLDOWN * i / 30));
            anchor.updateWorldMatrix(true, false);
            if (i === 0 || i === 30) assert.ok(anchor.matrixWorld.elements.every((value, k) => Math.abs(value - toolPose.elements[k]) < 1e-9));
            if (i === 15) assert.ok(anchor.matrixWorld.elements[14] < toolPose.elements[14] - .05);
            assert.ok(fist.containsPoint(arm.worldToLocal(anchor.getWorldPosition(new THREE.Vector3()))));
        }
    }
});


test('a espada equipada segue o cabo diagonal da ferramenta e retorna à mesma passada', t => {
    const context = { fillRect() {}, putImageData() {}, getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }) };
    const previousDocument = globalThis.document;
    globalThis.document = { createElement: () => ({ getContext: () => context }) };
    t.after(() => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });
    const sword = createSwordModel(THREE);
    const diagonal = new THREE.Vector3(1, 1, 0).normalize();
    const axis = new THREE.Vector3(0, 1, 0);
    assert.ok(axis.clone().applyQuaternion(sword.quaternion).distanceTo(diagonal) < 1e-9);

    const model = createPlayerModel(THREE);
    const held = createPlayerHeldItem(THREE, model.rightArm);
    const rig = rigLocomotion(THREE, model);
    const swing = createSwordSwing();
    for (const foot of [0, 1]) {
        const start = foot * ATTACK_COOLDOWN;
        beginSwordSwing(swing, 1, start);
        for (const phase of [0, .5, 1]) {
            model.root.rotation.set(0, 0, 0, 'YXZ');
            model.leftArm.rotation.set(0, 0, 0);
            model.rightArm.rotation.set(0, 0, 0);
            rig.elbows[1].rotation.z = 0;
            applyGroundPose(model, rig, groundPose({ foot, run: 1 }, phase * 2 * Math.PI, 1));
            held.update(2, new THREE.Group(), null, true, true);
            const pivot = held.anchor.getObjectByName('toolPose');
            const hand = pivot.getWorldPosition(new THREE.Vector3());
            const toolAxis = diagonal.clone().applyQuaternion(pivot.getWorldQuaternion(new THREE.Quaternion()));

            held.update(1, sword, null, true, true);
            applyThirdPersonSwordPose(model, rig, swordPose(swing, start + phase * ATTACK_COOLDOWN), 1);
            const blade = held.anchor.getObjectByName('toolPose').children[0];
            const swordAxis = axis.clone().applyQuaternion(blade.getWorldQuaternion(new THREE.Quaternion()));
            assert.ok(blade.getWorldPosition(new THREE.Vector3()).distanceTo(held.anchor.getWorldPosition(new THREE.Vector3())) < 1e-9);
            if (phase === .5) {
                assert.ok(swordAxis.distanceTo(toolAxis) > .1, 'o corte sai da pose base');
            } else {
                assert.ok(swordAxis.distanceTo(toolAxis) < 1e-9);
                assert.ok(blade.getWorldPosition(new THREE.Vector3()).distanceTo(hand) < 1e-9);
            }
        }
    }
    model.dispose();
});
