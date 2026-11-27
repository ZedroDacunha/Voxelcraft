import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { FACES } from '../world-faces.js';
import { createWorldClouds, WORLD_CLOUD_CONFIG } from '../world-clouds.js';

function fixture() {
    // Dois degraus contíguos de cada nível, entre duas faixas de ar.
    class Noise {
        fbm(x, z) {
            if (z !== 0 && z !== 1) return 0;
            return [0.18, 0.32, 0.51][x] ?? 0;
        }
    }
    const clouds = createWorldClouds({
        THREE, Noise2D: Noise, faces: FACES,
        config: { ...WORLD_CLOUD_CONFIG, gridSize: 10, cellSize: 1, thickness: 1, noiseScale: 1 },
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    camera.position.x = 0.5;
    clouds.create(scene, 7);
    clouds.update(0, camera);
    return { clouds, camera, mesh: scene.children[0] };
}

test('a nuvem engrossa no centro e só expõe os degraus entre colunas', () => {
    const { clouds, mesh } = fixture();
    assert.equal(clouds.cells, 6);
    const { position, normal } = mesh.geometry.attributes;
    const tops = new Set(), bottoms = new Set(), seams = [];
    for (let i = 0; i < position.count; i += 4) {
        const xs = [], ys = [], zs = [];
        for (let j = i; j < i + 4; j++) {
            xs.push(position.getX(j));
            ys.push(+position.getY(j).toFixed(2));
            zs.push(position.getZ(j));
        }
        if (normal.getY(i) === 1) tops.add(ys[0]);
        if (normal.getY(i) === -1) bottoms.add(ys[0]);
        if (xs.every(x => x === 1)) {
            assert.equal(normal.getX(i), -1);
            assert.equal(Math.max(...zs) - Math.min(...zs), 2);
            seams.push([Math.min(...ys), Math.max(...ys)]);
        }
    }
    assert.deepEqual(tops, new Set([0.55, 1.3, 2.15]));
    assert.deepEqual(bottoms, new Set([0, -0.2, -0.45]));
    assert.deepEqual(seams, [[0.55, 1.3], [-0.2, 0]]);
});

test('o vento e o giro do sol reutilizam a malha dentro da mesma célula', () => {
    const { clouds, camera, mesh } = fixture();
    const geometry = mesh.geometry;
    clouds.update(0.1, camera);
    assert.equal(mesh.geometry, geometry);
    assert.ok(Math.abs(mesh.position.x - 0.16) < 1e-8);
    const sun = new THREE.Vector3(1, 0, 0);
    clouds.updateTint(0.5, 0.9, sun);
    sun.x = -1;
    clouds.updateTint(0.5, 0.9, sun);
    assert.equal(mesh.material.uniforms.sunDirection.value.x, -1);
    assert.equal(mesh.geometry, geometry);
    camera.position.x += 1;
    clouds.update(0, camera);
    assert.notEqual(mesh.geometry, geometry);
});
