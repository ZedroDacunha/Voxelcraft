import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createWorldSkySystem } from '../world-sky.js';
import { clamp01, smoothstep, mulberry32 } from '../world-math.js';

test('o céu compartilha a cor do horizonte com a névoa e reutiliza a malha ao mergulhar e emergir', () => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0, 1, 100);
    scene.background = new THREE.Color();
    const sky = createWorldSkySystem({
        THREE, clamp01, smoothstep, mulberry32, skyColor: 0x87ceeb, renderDistance: 8, chunkSize: 16,
    });
    sky.create(scene);
    const args = {
        scene, camera: new THREE.PerspectiveCamera(), hemiLight: new THREE.HemisphereLight(),
        sunLight: new THREE.DirectionalLight(),
    };
    const gradient = scene.children.find(child => child.material.isShaderMaterial);
    const { horizon, zenith, twilight, sunDirection } = gradient.material.uniforms;
    assert.equal(gradient.geometry.getAttribute('position').count, 3);
    sky.update({ ...args, worldTime: 0.25 });
    assert.ok(scene.fog.color.equals(horizon.value));
    assert.ok(horizon.value.r > zenith.value.r);
    assert.equal(twilight.value, 0);
    sky.update({ ...args, worldTime: 0, underwater: true });
    assert.equal(gradient.visible, false);
    assert.ok(sunDirection.value.x > 0);
    sky.update({ ...args, worldTime: 0.5 });
    assert.equal(gradient.visible, true);
    assert.ok(sunDirection.value.x < 0);
    assert.equal(twilight.value, 1);
    assert.ok(scene.fog.color.equals(horizon.value));
    sky.update({ ...args, worldTime: 0.75 });
    assert.equal(twilight.value, 0);
    assert.ok(scene.fog.color.equals(horizon.value));
});
