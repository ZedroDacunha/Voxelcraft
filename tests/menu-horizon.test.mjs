import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { buildMenuPanorama, panoramaGeometry } from '../menu-panorama.js';
import { buildMenuHorizon } from '../menu-horizon.js';
import { MENU_CAMERA, MENU_TURN_SPEED, menuCameraPosition } from '../menu-framing.js';

test('o chão cobre os cantos e o rodapé do menu durante toda a órbita', () => {
    const panorama = buildMenuPanorama();
    const horizon = buildMenuHorizon(THREE, panorama);
    const center = panoramaGeometry(panorama).opaque;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(center.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(center.indices, 1));
    const land = [new THREE.Mesh(geometry), new THREE.Mesh(horizon)];
    const camera = new THREE.PerspectiveCamera(MENU_CAMERA.fov, 1, 0.1, 400);
    const ray = new THREE.Raycaster();
    for (const aspect of [1358 / 608, 32 / 9, 9 / 16]) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        for (let step = 0; step < 16; step++) {
            const pose = menuCameraPosition(step * Math.PI / (8 * MENU_TURN_SPEED));
            camera.position.set(pose.x, pose.y, pose.z);
            camera.lookAt(0, MENU_CAMERA.targetY, 0);
            camera.updateMatrixWorld();
            for (const x of [-1, -0.5, 0, 0.5, 1]) {
                for (const y of [-1, -0.45]) {
                    ray.setFromCamera({ x, y }, camera);
                    const [hit] = ray.intersectObjects(land, false);
                    assert.ok(hit, `sem terreno em ${aspect}, ângulo ${step}, ponto ${x},${y}`);
                    assert.ok(-hit.point.applyMatrix4(camera.matrixWorldInverse).z < camera.far);
                }
            }
        }
    }
});
