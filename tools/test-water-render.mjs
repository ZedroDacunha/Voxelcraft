import * as THREE from '../vendor/three/three.module.js';
import { createWaterSurfaceMaterial } from '../world-water-material.js';

// Lê o resultado da GPU: um erro de compilação também deixaria todos os
// quadros idênticos. A câmera fica parada para isolar o movimento da água.
export function testWaterRender() {
    const size = 48;
    const renderer = new THREE.WebGLRenderer();
    const target = new THREE.WebGLRenderTarget(size, size);
    const material = createWaterSurfaceMaterial(THREE);
    const plane = new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2);
    const count = plane.attributes.position.count;
    plane.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
    plane.setAttribute('torchInfluence', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x91aac0, 20, 50);
    scene.background = new THREE.Color(0xc8bb94);
    scene.add(new THREE.Mesh(plane, material));
    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);
    camera.position.set(0, 2, 2);
    camera.lookAt(0, 0, 0);
    renderer.setRenderTarget(target);
    function frame(depth, time) {
        for (let i = 0; i < count; i++) plane.attributes.uv.setXY(i, depth, 1);
        plane.attributes.uv.needsUpdate = true;
        material.uniforms.waterTime.value = time;
        renderer.render(scene, camera);
        const pixels = new Uint8Array(size * size * 4);
        renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
        return pixels;
    }
    try {
        const shallow = frame(0.55, 0);
        const later = frame(0.55, 1.25);
        const deep = frame(4.8, 0);
        const different = pixels => pixels.reduce((n, v, i) => n + (Math.abs(v - shallow[i]) > 1), 0);
        return { motion: different(later), depth: different(deep) };
    } finally {
        plane.dispose();
        material.dispose();
        target.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
    }
}
