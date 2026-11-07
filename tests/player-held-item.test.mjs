import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createPlayerModel } from '../player-model.js';
import { createPlayerHeldItem } from '../player-held-item.js';

test('item acompanha braço e compartilha recursos sem alterar primeira pessoa', () => {
    const model = createPlayerModel(THREE);
    const held = createPlayerHeldItem(THREE, model.rightArm);
    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const material = new THREE.MeshBasicMaterial();
    const original = new THREE.Mesh(geometry, material);
    original.position.set(0.03, 0.07, -0.04);
    held.update(4, original, null, false);
    const clone = held.anchor.children[0];
    assert.equal(held.anchor.parent, model.rightArm);
    assert.notEqual(clone, original);
    assert.equal(clone.geometry, geometry);
    assert.equal(clone.material, material);
    assert.deepEqual(clone.position.toArray(), [0, 0, 0]);
    assert.deepEqual(original.position.toArray(), [0.03, 0.07, -0.04]);
    model.root.updateMatrixWorld(true);
    const before = clone.getWorldPosition(new THREE.Vector3());
    model.rightArm.rotation.x = 0.7;
    model.root.updateMatrixWorld(true);
    assert.ok(before.distanceTo(clone.getWorldPosition(new THREE.Vector3())) > 0.1);
    held.update(0, null, null, false);
    assert.equal(held.anchor.children.length, 0);
    model.dispose(); geometry.dispose(); material.dispose();
});

test('troca item e chama sem duplicar; sprite mantém posição do cabo', () => {
    const arm = new THREE.Group(), held = createPlayerHeldItem(THREE, arm);
    const geometry = new THREE.BoxGeometry(1, 1, 1), material = new THREE.MeshBasicMaterial();
    const tool = new THREE.Mesh(geometry, material), flame = new THREE.Mesh(geometry, material);
    tool.position.set(0.119, 0.153, 0);
    held.update(10, tool, flame, true);
    assert.equal(held.anchor.children.length, 2);
    assert.deepEqual(held.anchor.children[0].position.toArray(), tool.position.toArray());
    held.update(10, tool, flame, true);
    assert.equal(held.anchor.children.length, 2);
    held.update(11, tool, null, true);
    assert.equal(held.anchor.children.length, 1);
    held.update(0, null, null, false);
    assert.equal(held.anchor.children.length, 0);
    geometry.dispose(); material.dispose();
});
