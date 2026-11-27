// Anti-bandas da luz de bloco: a propagação é em 16 níveis e o degrau entre
// níveis aparece nas faces. O patch do flicker da tocha adiciona um ruído
// de posição (dither) que mascara o degrau — sem custo de passe novo.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { configureTorchFlicker } from '../world-lighting-effects.js';

function patchedMaterial() {
    const material = new THREE.MeshLambertMaterial();
    configureTorchFlicker(material);
    // Simula o ciclo de compilação do three: o onBeforeCompile ganha o shader.
    material.onBeforeCompile({
        vertexShader: '#include <common>\n#include <color_vertex>',
        fragmentShader: '#include <common>\n#include <color_fragment>',
        uniforms: {},
    });
    return material.userData.torchFlickerShader;
}

test('o patch do chunk injeta o dither anti-bandas na luz', () => {
    const shader = patchedMaterial();
    const fs = shader.fragmentShader;
    assert.ok(fs.includes('dither'), 'o shader tem a variável dither');
    assert.match(fs, /fract\(sin\(dot\(gl_FragCoord\.xy/, 'o dither é um hash de posição');
    assert.match(fs, /diffuseColor\.rgb \+= \(dither - 0\.5\) \* 0\.06/, 'o dither é aditivo com amplitude de metade do salto de um nível');
});

test('o dither vem depois do flicker e da chama, sem substituir nada', () => {
    const shader = patchedMaterial();
    const fs = shader.fragmentShader;
    assert.ok(fs.includes('torchFlicker'), 'o flicker da tocha continua');
    assert.ok(fs.includes('firePulse'), 'o pulso da fornalha continua');
    const flicker = fs.indexOf('diffuseColor.rgb *= torchFlicker');
    const flame = fs.indexOf('diffuseColor.rgb *= 1.0 + vFurnaceFlame');
    const dither = fs.indexOf('diffuseColor.rgb += (dither - 0.5) * 0.06');
    assert.ok(flicker > 0 && flame > 0 && dither > 0);
    assert.ok(flicker < flame && flame < dither, 'o dither é a última adição, depois do flicker e da chama');
});

test('a versão do cache do shader cresceu, para recompilar com o dither', () => {
    const material = new THREE.MeshLambertMaterial();
    configureTorchFlicker(material);
    const key = material.customProgramCacheKey();
    assert.match(key, /dither/, 'a chave de cache nomeia a versão com dither');
});
