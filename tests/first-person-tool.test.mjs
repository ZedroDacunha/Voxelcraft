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
    assert.ok(tip.y > grip.y && tip.x > grip.x, 'cabeça fica acima e à direita da empunhadura');
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
