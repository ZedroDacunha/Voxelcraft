import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { renderInventoryPlayer } from '../inventory-player-preview.js';

test('prévia reutiliza renderer, inverte pixels e restaura destino anterior', () => {
    const previous = {};
    let current = previous, image, rendered = false;
    const renderer = {
        getRenderTarget: () => current,
        setRenderTarget: target => { current = target; },
        clear: () => {},
        render: scene => { rendered = Boolean(scene.getObjectByName('player')); },
        readRenderTargetPixels(target, x, y, w, h, pixels) {
            for (let row = 0; row < h; row++) pixels[row * w * 4] = row;
        },
    };
    const canvas = { getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: data => { image = data; },
    }) };
    renderInventoryPlayer({ THREE, renderer, canvas });
    assert.ok(rendered);
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
    assert.match(html, /<canvas id="inv-player" role="img" aria-label="Personagem aventureiro" hidden><\/canvas>/);
    assert.match(game, /getElementById\('inv-player'\)\.hidden = Boolean\(station\)/);
    assert.match(game, /if \(!station\)\s*\{\s*const canvas = document\.getElementById\('inv-player'\)/);
    assert.match(css, /#inv-player\[hidden\]\s*\{\s*display:\s*none/);
});
