import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createPlayerModel, PLAYER_MODEL_HEIGHT } from '../player-model.js';
import { createPlayerArmor } from '../player-armor.js';
import { createFirstPersonBody } from '../player-first-person-body.js';
import { ID } from '../world-catalog.js';

test('trocar a câmera preserva o equipamento e desenha a ferramenta só na mão certa', () => {
    const model = createPlayerModel(THREE);
    const armor = createPlayerArmor(THREE, model, PLAYER_MODEL_HEIGHT / 32);
    const item = new THREE.Object3D();
    model.rightArm.add(item);
    const view = createFirstPersonBody(model);
    const visible = () => {
        const parts = new Set();
        model.root.traverseVisible(o => parts.add(o));
        return parts;
    };
    view.setFirstPerson(true);
    for (const material of ['COPPER', 'IRON', 'GOLD', 'DIAMOND']) {
        armor.setEquipment(['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(slot => ({ id: ID[material + '_' + slot] })));
        const parts = visible();
        for (const o of [model.head, model.leftArm, model.rightArm, item]) assert.ok(!parts.has(o));
        const names = [...parts].map(o => o.name);
        assert.equal(names.filter(n => n === 'chest-torso-pivot').length, 1);
        assert.ok(!names.includes('chest-left-pivot') && !names.includes('chest-right-pivot'));
    }
    view.setFirstPerson(false);
    const parts = visible();
    assert.ok(parts.has(model.head) && parts.has(item));
    assert.equal([...parts].filter(o => o.name === 'chest-left-pivot').length, 1);
    armor.dispose();
    model.dispose();
});

test('olhando para baixo a câmera enxerga tronco e ambas as pernas, de pé e agachado', () => {
    const model = createPlayerModel(THREE);
    const view = createFirstPersonBody(model);
    view.setFirstPerson(true);
    const ray = new THREE.Raycaster();
    const origin = new THREE.Vector3(12, 5, -27);
    for (const [height, eye, yaw] of [[1.8, 1.62, 0], [1.5, 1.27, 1.4]]) {
        model.root.position.copy(origin);
        model.root.rotation.set(0, yaw, 0, 'YXZ');
        model.root.scale.y = height / PLAYER_MODEL_HEIGHT;
        view.align(origin, yaw);
        model.root.updateMatrixWorld(true);
        const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 300);
        camera.position.copy(origin);
        camera.position.y += eye;
        camera.rotation.set(-1.54, yaw - Math.PI, 0, 'YXZ');
        camera.updateMatrixWorld();
        const meshes = [];
        model.root.traverseVisible(o => { if (o.isMesh) meshes.push(o); });
        ray.setFromCamera(new THREE.Vector2(0, 0), camera);
        assert.equal(ray.intersectObjects(meshes, false).length, 0);
        const seen = new Set();
        for (let x = -0.5; x <= 0.5; x += 0.05) {
            for (let y = -0.98; y < 0; y += 0.03) {
                ray.setFromCamera(new THREE.Vector2(x, y), camera);
                let part = ray.intersectObjects(meshes, false)[0]?.object;
                if (!part) continue;
                while (part.parent !== model.root) part = part.parent;
                seen.add(part);
            }
        }
        for (const part of [model.torso, model.leftLeg, model.rightLeg]) assert.ok(seen.has(part), part.name);
    }
    model.dispose();
});
