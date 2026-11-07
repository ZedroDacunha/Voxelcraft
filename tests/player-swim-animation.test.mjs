import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createPlayerModel } from '../player-model.js';
import { advanceSwim, createSwimState, swimPose } from '../player-swim-animation.js';

function step(state, input, n = 60) { for (let i = 0; i < n; i++) advanceSwim(state, { dt: 1 / 60, ...input }); }

test('nado entra e sai suavemente, com água funda e deslocamento', () => {
    const state = createSwimState();
    const moving = { feetInWater: true, onGround: false, gaitAmplitude: .7 };
    advanceSwim(state, { dt: 1 / 60, ...moving });
    assert.ok(state.blend > 0 && state.blend < 1);
    step(state, moving);
    assert.ok(state.blend > .99);
    const previous = state.blend;
    advanceSwim(state, { dt: 1 / 60 });
    assert.ok(state.blend < previous && state.blend > 0);
    step(state, {} , 100);
    assert.equal(state.blend, 0);
});

test('água rasa apoiado e água funda parado não ativam nado', () => {
    const state = createSwimState();
    step(state, { feetInWater: true, onGround: true, gaitAmplitude: .7 });
    assert.equal(state.blend, 0);
    step(state, { headInWater: true, gaitAmplitude: 0 });
    assert.equal(state.blend, 0);
    step(state, { headInWater: true, onGround: true, gaitAmplitude: .7 });
    assert.ok(state.blend > .99);
});

test('posição horizontal mantém o centro fixo em todos os rumos', () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -1]) for (const blend of [0, .5, 1]) {
        const model = createPlayerModel(THREE), pos = new THREE.Vector3(5, 10, -2);
        const pose = swimPose({ blend, phase: 0 }, { yaw, height: 1.8 });
        model.root.position.set(pos.x + pose.offsetX, pos.y + pose.offsetY, pos.z + pose.offsetZ);
        model.root.rotation.set(pose.tilt, yaw, 0, 'YXZ');
        const center = model.root.localToWorld(new THREE.Vector3(0, .9, 0));
        assert.ok(center.distanceTo(pos.clone().add(new THREE.Vector3(0, .9, 0))) < 1e-9);
        model.dispose();
    }
});

test('braços e pernas alternam e voltam à caminhada, mantendo golpe', () => {
    const a = swimPose({ blend: 1, phase: Math.PI / 2 }, { punch: .3 });
    const b = swimPose({ blend: 1, phase: 3 * Math.PI / 2 });
    assert.ok(a.leftLeg > 0 && a.rightLeg < 0 && b.leftLeg < 0 && b.rightLeg > 0);
    assert.ok(a.leftArm > b.leftArm && a.rightArm < b.rightArm);
    const walk = swimPose({ blend: 0, phase: 2 }, { walkSwing: .2, punch: .3 });
    assert.equal(walk.tilt, 0); assert.equal(walk.leftLeg, .2);
    assert.equal(walk.rightLeg, -.2); assert.equal(walk.leftArm, -.2);
    assert.ok(Math.abs(walk.rightArm + .1) < 1e-9);
});

test('o tempo inválido ou negativo não faz a animação retroceder', () => {
    const state = createSwimState();
    advanceSwim(state, { dt: NaN, headInWater: true, gaitAmplitude: 1 });
    advanceSwim(state, { dt: -1, headInWater: true, gaitAmplitude: 1 });
    assert.deepEqual(state, { blend: 0, phase: 0 });
});
