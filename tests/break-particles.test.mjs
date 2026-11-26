import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createBreakParticleSystem } from '../world-break-particles.js';

function setup() {
    const scene = new THREE.Scene();
    const particles = createBreakParticleSystem({
        THREE,
        getScene: () => scene,
        getBlockColor: () => 0x745238,
        getImmersionAt: () => 0,
        isSolidAt: (x, y, z) => y < 0 || x !== -3 || z !== 5,
    });
    return { scene, particles };
}

test('a quebra gera cubos na célula e deixa três fragmentos no chão antes de sumirem', () => {
    const { scene, particles } = setup();
    particles.spawn(-3, 0, 5, 1);
    const octants = new Set();
    for (const mesh of scene.children) {
        const { x, y, z } = mesh.position;
        assert.equal(Math.floor(x), -3);
        assert.equal(Math.floor(y), 0);
        assert.equal(Math.floor(z), 5);
        octants.add([x > -2.5, y > 0.5, z > 5.5].join(','));
        assert.equal(mesh.geometry.type, 'BoxGeometry');
        assert.ok(mesh.scale.x === mesh.scale.y && mesh.scale.y === mesh.scale.z);
    }
    assert.equal(scene.children.length, 12);
    assert.equal(octants.size, 8);
    for (let frame = 0; frame < 90; frame++) {
        particles.update(1 / 60);
        for (const mesh of scene.children) {
            assert.ok(mesh.position.y >= 0);
            assert.ok(mesh.position.x >= -3 && mesh.position.x <= -2);
            assert.ok(mesh.position.z >= 5 && mesh.position.z <= 6);
        }
    }
    assert.equal(particles.count, 3);
    for (const mesh of scene.children) {
        assert.ok(Math.abs(mesh.position.y - 0.05 * mesh.scale.y) < 1e-7);
    }
    for (let frame = 0; frame < 120; frame++) particles.update(1 / 60);
    assert.equal(particles.count, 0);
    assert.equal(scene.children.length, 0);
});

test('o efeito de golpe continua nas coordenadas exatas do animal', () => {
    const { scene, particles } = setup();
    particles.spawn(2.3, 10, 5.5, null, { color: 0xffffff, count: 1, spread: 0 });
    assert.deepEqual(scene.children[0].position.toArray(), [2.3, 10, 5.5]);
    particles.clear();
    assert.equal(scene.children.length, 0);
});
