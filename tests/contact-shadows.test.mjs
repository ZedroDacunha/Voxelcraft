// Sombras de contato: blobs escuros no chão sob criaturas terrestres e sob
// o jogador em terceira pessoa. O pool é fixo e só muda de posição.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createContactShadowSystem, CONTACT_SHADOW_OFFSET } from '../world-contact-shadows.js';

// A textura do blob é um canvas radial: no Node não existe document, então
// a árvore de testes provê um stub mínimo (o CanvasTexture do three só
// guarda o canvas; não renderiza nada aqui).
const prevDocument = globalThis.document;
globalThis.document = {
    createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
            createRadialGradient: () => ({ addColorStop() {} }),
            fillStyle: '',
            beginPath() {},
            arc() {},
            fill() {},
        }),
    }),
};

function makeSystem(max = 4) {
    const scene = new THREE.Scene();
    const system = createContactShadowSystem({ THREE, scene, max });
    const blobs = scene.children.filter(child => child.isMesh);
    return { scene, system, blobs };
}

test('o pool nasce com a quantidade de blobs e todos escondidos', () => {
    const { scene, blobs } = makeSystem(5);
    assert.equal(blobs.length, 5, 'o pool tem a quantidade pedida');
    for (const blob of blobs) {
        assert.equal(blob.visible, false, 'blob livre some');
        assert.equal(blob.rotation.x, -Math.PI / 2, 'o blob é um plano deitado');
        assert.equal(blob.material.depthWrite, false, 'o blob não escreve profundidade');
        assert.ok(blob.material.map, 'o blob tem textura radial');
    }
    assert.ok(CONTACT_SHADOW_OFFSET > 0, 'o blob fica acima do chão');
});

test('update posiciona os blobs nos alvos e os livres somem', () => {
    const { system, blobs } = makeSystem(4);
    system.update([
        { x: 3, y: 5, z: 7, radius: 0.8, opacity: 0.4 },
        { x: -2, y: 6, z: 1, radius: 0.9, opacity: 0.5 },
    ]);
    assert.equal(blobs[0].visible, true);
    assert.equal(blobs[1].visible, true);
    assert.equal(blobs[2].visible, false, 'blob sem alvo some');
    assert.equal(blobs[3].visible, false, 'blob sem alvo some');
    assert.equal(blobs[0].position.x, 3);
    assert.equal(blobs[0].position.z, 7);
    assert.equal(blobs[0].position.y, 5 + CONTACT_SHADOW_OFFSET, 'a sombra fica no chão, não no salto');
    assert.equal(blobs[1].position.y, 6 + CONTACT_SHADOW_OFFSET);
    assert.equal(blobs[0].material.opacity, 0.4, 'a opacidade vem do alvo');
    // O raio escala o blob (escala = diâmetro = raio × 2).
    assert.equal(blobs[0].scale.x, 1.6);
    assert.equal(blobs[1].scale.x, 1.8);
});

test('alvos além do pool são ignorados e não quebram o update', () => {
    const { system, blobs } = makeSystem(2);
    system.update([
        { x: 0, y: 0, z: 0, radius: 1, opacity: 0.3 },
        { x: 1, y: 0, z: 0, radius: 1, opacity: 0.3 },
        { x: 2, y: 0, z: 0, radius: 1, opacity: 0.3 },
    ]);
    assert.equal(blobs[0].visible, true);
    assert.equal(blobs[1].visible, true);
    assert.ok(blobs[0].material.opacity <= 1);
});

test('opacidade zero esconde o blob e alvos vazios limpam o pool', () => {
    const { system, blobs } = makeSystem(2);
    system.update([{ x: 1, y: 0, z: 1, radius: 1, opacity: 0 }]);
    assert.equal(blobs[0].visible, false, 'opacidade zero esconde');
    system.update([]);
    assert.equal(blobs[0].visible, false, 'lista vazia limpa todos');
});

after(() => {
    if (prevDocument === undefined) delete globalThis.document;
    else globalThis.document = prevDocument;
});
