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

test('cabelo cobre a pele e suas peças não disputam o mesmo espaço', () => {
    const model = createPlayerModel(THREE);
    model.root.updateMatrixWorld(true);
    const bounds = name => new THREE.Box3().setFromObject(model.head.getObjectByName(name));
    const face = bounds('face');
    const top = bounds('hair-top');
    const hair = ['hair-top', 'hair-back', 'hair-left', 'hair-right'].map(bounds);
    // A pele não pode ter uma face no mesmo plano que o topo visível do cabelo.
    assert.ok(top.max.y > face.max.y + 0.001);
    assert.ok(top.min.x < face.min.x && top.max.x > face.max.x);
    assert.ok(top.min.z < face.min.z && top.max.z > face.max.z);
    // As peças se encostam, mas não se atravessam nem dividem superfícies visíveis.
    for (let i = 0; i < hair.length; i++) for (let j = i + 1; j < hair.length; j++) {
        const overlap = new THREE.Box3().copy(hair[i]).intersect(hair[j]);
        if (!overlap.isEmpty()) {
            const size = overlap.getSize(new THREE.Vector3());
            assert.ok(size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6, `cabelo ${i} e ${j} se sobrepõem`);
        }
    }
    model.dispose();
});

test('rosto tem olhos maiores, sobrancelhas e mechas sem faces coplanares com a pele', () => {
    const model = createPlayerModel(THREE); model.root.updateMatrixWorld(true);
    const parts = name => model.head.children.filter(part => part.name === name);
    const bounds = part => new THREE.Box3().setFromObject(part);
    const face = bounds(model.head.getObjectByName('face'));
    assert.equal(parts('eyebrow').length, 2);
    assert.equal(parts('eye-white').length, 2);
    assert.equal(parts('pupil').length, 2);
    for (const name of ['fringe-left', 'fringe-middle', 'fringe-right']) {
        const fringe = model.head.getObjectByName(name); assert.ok(fringe);
        assert.ok(bounds(fringe).min.z > face.max.z);
    }
    for (const eyebrow of parts('eyebrow')) assert.ok(bounds(eyebrow).min.z > face.max.z);
    for (const eye of parts('eye-white')) assert.equal(eye.geometry.parameters.height, 1.7 * PLAYER_MODEL_HEIGHT / 32);
    let released = false; model.head.getObjectByName('fringe-left').geometry.addEventListener('dispose', () => released = true);
    model.dispose(); assert.equal(released, true);
});
