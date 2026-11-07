import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { FIRST_TOOL_POSE, applyFirstPersonToolPose } from '../world-first-person-tool.js';
import { createPlayerHeldItem, THIRD_TOOL_GRIP } from '../player-held-item.js';

test('a ferramenta gira ao redor do cabo e aponta para cima', () => {
    const anchor = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(.54, .54, .034));
    applyFirstPersonToolPose(anchor);
    mesh.position.set(...FIRST_TOOL_POSE.grip); anchor.add(mesh);
    const grip = mesh.localToWorld(new THREE.Vector3(-FIRST_TOOL_POSE.grip[0], -FIRST_TOOL_POSE.grip[1], 0));
    assert.ok(grip.distanceTo(anchor.getWorldPosition(new THREE.Vector3())) < 1e-9);
    const tip = mesh.localToWorld(new THREE.Vector3(.15, .15, 0));
    assert.ok(tip.y > grip.y, 'cabeça fica acima da empunhadura');
    assert.ok(Math.abs(FIRST_TOOL_POSE.position[2] + .6) < .02, 'cabo no fim da mão');
    mesh.geometry.dispose(); mesh.material.dispose();
});

test('a pose de primeira pessoa não altera a terceira', () => {
    const arm = new THREE.Group(), third = createPlayerHeldItem(THREE, arm);
    const geometry = new THREE.BoxGeometry(.5, .5, .03), material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...FIRST_TOOL_POSE.grip);
    third.update(1, mesh, null, true, true);
    const copy = third.anchor.getObjectByName('toolPose').children[0];
    assert.deepEqual(copy.position.toArray(), [THIRD_TOOL_GRIP.x, THIRD_TOOL_GRIP.y, 0]);
    assert.notEqual(copy, mesh);
    geometry.dispose(); material.dispose();
});

test('a pose se aplica só às ferramentas e mantém a animação do braço', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /HELD_TOOL_KINDS = new Set\(\['pickaxe', 'axe', 'shovel', 'shears'\]\)/);
    assert.match(source, /if \(HELD_TOOL_KINDS\.has\(item\.sprite\.kind\)\) heldMesh\.position\.set\(\.\.\.FIRST_TOOL_POSE\.grip\)/);
    assert.match(source, /if \(HELD_TOOL_KINDS\.has\(heldToolKind\)\) \{\s*applyFirstPersonToolPose\(heldAnchor\)/);
    assert.match(source, /advanceHandAnimation\(handAnim, dt/);
});


test('projetada pela câmera do jogo, a ferramenta sobe mais do que avança para o lado', () => {
    const camera = new THREE.PerspectiveCamera(70, 4 / 3, 0.01, 5);
    camera.updateProjectionMatrix();
    const arm = new THREE.Group();
    arm.position.set(0.42, -0.50, -0.25);
    arm.rotation.set(0.35, 0.25, 0);
    const anchor = new THREE.Group();
    arm.add(anchor);
    applyFirstPersonToolPose(anchor);
    const grip = anchor.localToWorld(new THREE.Vector3(0, 0, 0)).project(camera);
    const tip = anchor.localToWorld(new THREE.Vector3(0.35, 0.35, 0)).project(camera);
    assert.ok(tip.y > grip.y, 'cabeça aparece acima do cabo na tela');
    assert.ok(tip.y - grip.y > 2 * Math.abs(tip.x - grip.x), 'cabo é predominantemente vertical na tela');
    assert.ok(tip.x < 1 && tip.y < 1, 'a cabeça fica dentro do quadro 4:3');
});


test('a face da ferramenta vira um pouco de lado sem deslocar a empunhadura', () => {
    const arm = new THREE.Group();
    arm.position.set(0.42, -0.50, -0.25);
    arm.rotation.set(0.35, 0.25, 0);
    const anchor = new THREE.Group();
    arm.add(anchor);
    applyFirstPersonToolPose(anchor);
    arm.updateMatrixWorld(true);
    const grip = anchor.getWorldPosition(new THREE.Vector3());
    const currentNormal = new THREE.Vector3(0, 0, 1).transformDirection(anchor.matrixWorld);
    const oldAnchor = anchor.clone();
    oldAnchor.rotation.y = -20 * Math.PI / 180;
    arm.add(oldAnchor);
    arm.updateMatrixWorld(true);
    const oldNormal = new THREE.Vector3(0, 0, 1).transformDirection(oldAnchor.matrixWorld);
    assert.ok(currentNormal.z < oldNormal.z, 'face menos voltada para a câmera');
    assert.ok(currentNormal.z > 0.7, 'ajuste é sutil, não deixa a ferramenta de perfil');
    assert.ok(grip.distanceTo(oldAnchor.getWorldPosition(new THREE.Vector3())) < 1e-9, 'mão mantém a mesma posição');
    assert.equal(anchor.rotation.z, 50 * Math.PI / 180, 'inclinação vertical preservada');
});
