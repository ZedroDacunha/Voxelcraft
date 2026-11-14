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

test('cabeça tem couro cabeludo completo, sem geometria de cabelo e com rosto preservado', () => {
    const model = createPlayerModel(THREE); model.root.updateMatrixWorld(true);
    const head = model.head;
    const face = head.getObjectByName('face');
    const bounds = new THREE.Box3().setFromObject(face);
    assert.ok(Math.abs(bounds.max.y - PLAYER_MODEL_HEIGHT) < 1e-6);
    assert.equal(face.geometry.parameters.width, 8 * PLAYER_MODEL_HEIGHT / 32);
    assert.equal(face.geometry.parameters.height, 8 * PLAYER_MODEL_HEIGHT / 32);
    assert.equal(face.geometry.parameters.depth, 8 * PLAYER_MODEL_HEIGHT / 32);
    assert.equal(head.children.filter(p => p.name.startsWith('hair-') || p.name.startsWith('fringe-')).length, 0);
    assert.equal(head.children.filter(p => p.name === 'eyebrow').length, 2);
    assert.equal(head.children.filter(p => p.name === 'eye-white').length, 2);
    assert.equal(head.children.filter(p => p.name === 'pupil').length, 2);
    assert.ok(head.getObjectByName('mouth'));
    let released = false; face.geometry.addEventListener('dispose', () => released = true);
    model.dispose(); assert.equal(released, true);
});

test('olhos da referência têm pupilas simétricas dentro da parte branca e não sobrepõem sobrancelhas', () => {
    const model = createPlayerModel(THREE); model.root.updateMatrixWorld(true);
    const list = name => model.head.children.filter(part => part.name === name).sort((a, b) => a.position.x - b.position.x);
    const whites = list('eye-white'), pupils = list('pupil'), eyebrows = list('eyebrow');
    assert.equal(whites.length, 2); assert.equal(pupils.length, 2);
    for (let i = 0; i < 2; i++) {
        const white = new THREE.Box3().setFromObject(whites[i]);
        const pupil = new THREE.Box3().setFromObject(pupils[i]);
        const brow = new THREE.Box3().setFromObject(eyebrows[i]);
        assert.ok(pupil.min.x > white.min.x && pupil.max.x < white.max.x);
        assert.ok(pupil.min.y > white.min.y && pupil.max.y < white.max.y);
        assert.ok(pupil.max.z > white.max.z, 'pupila à frente do branco');
        assert.ok(white.max.y < brow.min.y, 'olho não atravessa a sobrancelha');
        assert.ok(Math.abs(pupils[i].position.x) < Math.abs(whites[i].position.x));
    }
    assert.ok(Math.abs(pupils[0].position.x + pupils[1].position.x) < 1e-10);
    model.dispose();
});
