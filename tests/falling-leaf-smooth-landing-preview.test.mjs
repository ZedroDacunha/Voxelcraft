import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { LONG_LANDING, landingCenterY, sampleSmoothLanding } from '../tools/proposta-pouso-suave.js';

test('transição e posição variam continuamente até o pouso demorado', () => {
    assert.equal(LONG_LANDING.hold, 3);
    assert.equal(LONG_LANDING.fade, 1.2);
    let previous = new Map(), tilted = false, grounded = false;
    for (let t = 0; t < 90; t += 0.02) {
        const leaves = sampleSmoothLanding(t);
        assert.ok(leaves.length <= 20);
        const current = new Map(leaves.map(p => [p.id, p]));
        for (const p of leaves) {
            assert.ok(Object.values(p).every(Number.isFinite));
            assert.ok(Math.abs(p.x) <= 2.22 && Math.abs(p.z) <= 2.22);
            assert.ok(Math.abs(p.x) >= 0.77 || Math.abs(p.z) >= 0.77);
            assert.ok(p.opacity >= 0 && p.opacity <= 1 && p.tilt >= 0 && p.tilt <= 1);
            if (p.tilt > 0 && p.tilt < 1) tilted = true;
            if (p.tilt === 1) grounded = true;
            const before = previous.get(p.id);
            if (before) {
                for (const key of ['x', 'z', 'desiredY', 'rotation', 'width', 'opacity', 'tilt']) {
                    assert.ok(Math.abs(p[key] - before[key]) < 0.12, `${key}: ${before[key]} -> ${p[key]}`);
                }
                if (before.tilt === 1 && p.tilt === 1) {
                    for (const key of ['x', 'z', 'desiredY', 'rotation', 'width']) assert.equal(p[key], before[key]);
                }
            }
        }
        previous = current;
    }
    assert.ok(tilted && grounded);
    assert.deepEqual(sampleSmoothLanding(0), sampleSmoothLanding(90));
});

test('plano rotacionado nunca atravessa a grama em diferentes câmeras e tamanhos', () => {
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    for (const pitch of [-1.15, 0, 0.38, 1.15]) for (const yaw of [0, 0.68, 2]) {
        const camera = new THREE.PerspectiveCamera();
        camera.position.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
        camera.lookAt(0, 0, 0);
        for (const size of [0.18, 0.25, 0.38]) for (let t = 0; t <= 1.001; t += 0.05) {
            const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.3);
            const q = camera.quaternion.clone().multiply(rotation).slerp(flat.clone().multiply(rotation), t);
            const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q).y;
            const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q).y;
            const width = 0.8;
            const y = landingCenterY(1.012, size, width, ax, ay);
            for (const x of [-1, 1]) for (const z of [-1, 1]) {
                assert.ok(y + x * size * width * ax / 2 + z * size * ay / 2 >= 1.011999);
            }
        }
    }
});
