import test from 'node:test';
import assert from 'node:assert/strict';
import { thirdPersonDistance, thirdPersonLimbSwing, THIRD_PERSON_DISTANCE } from '../player-third-person.js';

test('câmera recua sem atravessar a parede e volta ao máximo ao sair', () => {
    assert.equal(thirdPersonDistance(undefined), THIRD_PERSON_DISTANCE);
    assert.equal(thirdPersonDistance(10), THIRD_PERSON_DISTANCE);
    assert.ok(Math.abs(thirdPersonDistance(1) - 0.8) < 1e-9);
    assert.equal(thirdPersonDistance(0.1), 0);
});
test('braços e pernas seguem a fase da passada e param sem amplitude', () => {
    assert.equal(thirdPersonLimbSwing(0, 1), 0);
    assert.equal(thirdPersonLimbSwing(Math.PI / 2, 0), 0);
    assert.equal(thirdPersonLimbSwing(Math.PI / 2, 1), 0.55);
    assert.ok(thirdPersonLimbSwing(3 * Math.PI / 2, 1) < 0);
});

test('tecla e botão passam por costas, frente e primeira pessoa', async () => {
    const { nextCameraView, cameraOffsetSign } = await import('../player-third-person.js');
    assert.equal(nextCameraView('first'), 'rear');
    assert.equal(nextCameraView('rear'), 'front');
    assert.equal(nextCameraView('front'), 'first');
    assert.equal(nextCameraView('invalida'), 'first');
    assert.equal(cameraOffsetSign('rear'), -1);
    assert.equal(cameraOffsetSign('front'), 1);
});

test('câmera frontal olha para o personagem em qualquer direção', async () => {
    const THREE = await import('../vendor/three/three.module.js');
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    for (const [pitch, yaw] of [[0, 0], [0.5, 1.1], [-0.7, -2]]) {
        const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation);
        const frontLook = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation.clone().multiply(turn));
        assert.ok(frontLook.distanceTo(forward.clone().negate()) < 1e-9);
    }
});

test('as duas entradas alternam a vista e a câmera frontal não muda a mira por toque', async () => {
    const { readFileSync } = await import('node:fs');
    const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    assert.match(game, /case 'KeyV': if \(!event\.repeat\) toggleThirdPerson\(\)/);
    assert.match(game, /id === 'camera'\) toggleThirdPerson\(\)/);
    assert.match(game, /cameraView === 'rear' && !sleep\.active/);
    assert.match(game, /cameraView === 'front'\) thirdCamera\.quaternion\.multiply\(frontCameraTurn\)/);
    assert.match(css, /body\.camera-front #crosshair\s*\{\s*display:\s*none/);
});
