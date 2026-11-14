import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { renderInventoryPlayer } from '../inventory-player-preview.js';

test('prévia reutiliza renderer, inverte pixels e restaura destino anterior', () => {
    const previous = {};
    let current = previous, image, rendered = false, angle, camera, bg;
    const renderer = {
        getRenderTarget: () => current,
        setRenderTarget: target => { current = target; },
        clear: () => {},
        render: (scene, cameraArg) => { rendered = Boolean(scene.getObjectByName('player')); angle = scene.getObjectByName('player').rotation.y; camera = cameraArg; bg = scene.background.getHex(); },
        readRenderTargetPixels(target, x, y, w, h, pixels) {
            for (let row = 0; row < h; row++) pixels[row * w * 4] = row;
        },
    };
    const canvas = { getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: data => { image = data; },
    }) };
    renderInventoryPlayer({ THREE, renderer, canvas, angle: 1.2 });
    assert.ok(rendered);
    assert.equal(angle, 1.2);
    assert.equal(bg, 0x000000);
    assert.ok(camera.isPerspectiveCamera);
    assert.equal(camera.aspect, 144 / 192);
    assert.equal(current, previous);
    assert.equal(canvas.width, 144);
    assert.equal(canvas.height, 192);
    assert.equal(image.data[0], 191);
    assert.equal(image.data[191 * 144 * 4], 0);
});

test('destino anterior é restaurado mesmo se a renderização falhar', () => {
    const previous = {};
    let current = previous;
    const renderer = { getRenderTarget: () => current, setRenderTarget: t => { current = t; }, clear() {}, render() { throw Error('falhou'); } };
    const canvas = { getContext: () => ({}) };
    assert.throws(() => renderInventoryPlayer({ THREE, renderer, canvas }), /falhou/);
    assert.equal(current, previous);
});

test('personagem aparece só no inventário pessoal, com rótulo acessível', () => {
    const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../inventory.css', import.meta.url), 'utf8');
    assert.match(html, /<canvas id="inv-player" role="img" tabindex="0" aria-label="Personagem aventureiro: arraste ou use as setas esquerda e direita para girar" hidden><\/canvas>/);
    assert.match(game, /getElementById\('inv-player'\)\.hidden = Boolean\(station\)/);
    assert.match(game, /if \(!station\) inventoryPlayerRotation\.open\(\)/);
    assert.match(css, /#inv-player\[hidden\]\s*\{\s*display:\s*none/);
});

test('modelo inteiro cabe na câmera ao girar para qualquer direção', async () => {
    const { createPlayerModel } = await import('../player-model.js');
    const camera = new THREE.PerspectiveCamera(25.5, 144 / 192, 0.1, 10);
    camera.position.set(0, 1.15, 5); camera.lookAt(0, .9, 0); camera.updateMatrixWorld();
    const model = createPlayerModel(THREE);
    for (let i = 0; i < 36; i++) {
        model.root.rotation.y = i * Math.PI / 18;
        model.root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model.root);
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            const p = new THREE.Vector3(x, y, z).project(camera);
            assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1, `modelo cortado no ângulo ${i * 10}°`);
        }
    }
    model.dispose();
});
