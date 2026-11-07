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

test('ferramentas giram em torno do cabo, acompanham o braço e não mudam a malha original', async () => {
    const { THIRD_TOOL_GRIP, THIRD_TOOL_POSE } = await import('../player-held-item.js');
    const arm = new THREE.Group();
    const held = createPlayerHeldItem(THREE, arm);
    const geometry = new THREE.BoxGeometry(0.54, 0.54, 0.034);
    const material = new THREE.MeshBasicMaterial();
    const original = new THREE.Mesh(geometry, material);
    original.position.set(0.119, 0.153, 0);
    held.update(1, original, null, true, true);
    const pivot = held.anchor.getObjectByName('toolPose');
    const copy = pivot.children[0];
    assert.equal(pivot.rotation.order, 'YXZ');
    assert.equal(pivot.rotation.y, THIRD_TOOL_POSE.yaw);
    assert.equal(pivot.rotation.z, THIRD_TOOL_POSE.roll);
    assert.equal(pivot.scale.x, 0.85);
    assert.deepEqual(original.position.toArray(), [0.119, 0.153, 0]);
    // O centro do cabo do sprite fica exatamente no pivô da mão.
    assert.ok(copy.localToWorld(new THREE.Vector3(-THIRD_TOOL_GRIP.x, -THIRD_TOOL_GRIP.y, 0))
        .distanceTo(held.anchor.getWorldPosition(new THREE.Vector3())) < 1e-9);
    const tip = copy.localToWorld(new THREE.Vector3(0.15, 0.15, 0));
    assert.ok(tip.z > held.anchor.getWorldPosition(new THREE.Vector3()).z, 'cabeça aponta para a frente');
    held.update(2, original, null, true, false);
    assert.equal(held.anchor.getObjectByName('toolPose'), undefined, 'outros itens mantêm a pose antiga');
    geometry.dispose(); material.dispose();
});
