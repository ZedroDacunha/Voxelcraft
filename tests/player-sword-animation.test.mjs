import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { ATTACK_COOLDOWN } from '../world-creature.js';
import { applyFirstPersonToolPose } from '../world-first-person-tool.js';
import { applyFirstPersonSwordPose, beginSwordSwing, createSwordSwing, swordPose } from '../player-sword-animation.js';

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
            assert.ok(fist.containsPoint(arm.worldToLocal(anchor.getWorldPosition(new THREE.Vector3()))));
        }
    }
});
