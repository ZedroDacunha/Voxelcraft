import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createPlayerModel, PLAYER_MODEL_HEIGHT, PLAYER_MODEL_COLORS } from '../player-model.js';

test('corpo do jogador tem seis partes articuladas e medidas em blocos', () => {
    const model = createPlayerModel(THREE);
    assert.deepEqual(model.root.children.map(part => part.name), ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']);
    const bounds = new THREE.Box3().setFromObject(model.root);
    assert.ok(Math.abs(bounds.min.y) < 1e-6);
    assert.ok(Math.abs(bounds.max.y - PLAYER_MODEL_HEIGHT) < 1e-6);
    assert.equal(model.leftArm.position.y, 24 * PLAYER_MODEL_HEIGHT / 32);
    assert.equal(model.leftLeg.position.y, 12 * PLAYER_MODEL_HEIGHT / 32);
    assert.ok(model.head.getObjectByName('pupil').position.z > 0);
    model.dispose();
});

test('modelos independentes aceitam cores e liberam recursos', () => {
    const a = createPlayerModel(THREE, { tunic: 0xff0000 });
    const b = createPlayerModel(THREE);
    const mesh = a.torso.getObjectByName('tunic');
    assert.equal(mesh.material.color.getHex(), 0xff0000);
    assert.equal(b.torso.getObjectByName('tunic').material.color.getHex(), PLAYER_MODEL_COLORS.tunic);
    a.leftArm.rotation.x = 0.5;
    assert.equal(b.leftArm.rotation.x, 0);
    let geometriaLiberada = false, materialLiberado = false;
    mesh.geometry.addEventListener('dispose', () => { geometriaLiberada = true; });
    mesh.material.addEventListener('dispose', () => { materialLiberado = true; });
    a.dispose(); b.dispose();
    assert.ok(geometriaLiberada && materialLiberado);
});
