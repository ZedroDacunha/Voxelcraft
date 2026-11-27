import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createWorldSkySystem } from '../world-sky.js';
import { clamp01, smoothstep, mulberry32 } from '../world-math.js';

// Clima do céu: a luz difusa do céu leva a mesma tinta do céu (dia neutra,
// crepúsculo quente, noite azul-frio) e a névoa e o fundo viram azul profundo
// ao mergulhar.

function makeScene() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0, 1, 100);
    scene.background = new THREE.Color();
    return scene;
}

function makeSky() {
    return createWorldSkySystem({
        THREE, clamp01, smoothstep, mulberry32, skyColor: 0x87ceeb,
        renderDistance: 8, chunkSize: 16,
    });
}

function makeArgs(scene) {
    return {
        scene,
        camera: new THREE.PerspectiveCamera(),
        hemiLight: new THREE.HemisphereLight(),
        sunLight: new THREE.DirectionalLight(),
    };
}

test('ao meio-dia a luz difusa fica exatamente a branca de sempre', () => {
    const scene = makeScene();
    const sky = makeSky();
    sky.create(scene);
    const { hemiLight } = makeArgs(scene);
    sky.update({ ...makeArgs(scene), worldTime: 0.25, hemiLight });
    // Meio-dia (elevação no zênite): dia = 1 e twilight = 0 — a tinta volta
    // ao branco neutro, então o jogo não muda no dia de sempre.
    assert.ok(hemiLight.color.equals(new THREE.Color(0xffffff)));
    assert.ok(hemiLight.groundColor.equals(new THREE.Color(0x444444)));
});

test('o crepúsculo aquece a luz difusa e a noite fica azul-frio', () => {
    const scene = makeScene();
    const sky = makeSky();
    sky.create(scene);
    const { hemiLight } = makeArgs(scene);
    // Crepúsculo (sol no horizonte): a tinta quente domina.
    sky.update({ ...makeArgs(scene), worldTime: 0, hemiLight });
    assert.ok(hemiLight.color.r > hemiLight.color.b, 'no crepúsculo a luz difusa é quente');
    assert.ok(hemiLight.color.r > 0.9, 'no crepúsculo o vermelho da luz difusa está alto');
    // Noite (sol abaixo do horizonte): azul-frio, e o chão mais escuro.
    sky.update({ ...makeArgs(scene), worldTime: 0.75, hemiLight });
    assert.ok(hemiLight.color.b > hemiLight.color.r, 'na noite a luz difusa é azul');
    assert.ok(hemiLight.groundColor.b > hemiLight.groundColor.r, 'na noite o reflexo do chão também é azul');
    const groundLum = hemiLight.groundColor.r * 0.299 + hemiLight.groundColor.g * 0.587 + hemiLight.groundColor.b * 0.114;
    assert.ok(groundLum < 0.2, 'na noite o chão escurece');
});

test('a intensidade da luz difusa segue a curva de dia, como antes', () => {
    const scene = makeScene();
    const sky = makeSky();
    sky.create(scene);
    const { hemiLight } = makeArgs(scene);
    sky.update({ ...makeArgs(scene), worldTime: 0.25, hemiLight });
    assert.ok(Math.abs(hemiLight.intensity - 0.8) < 0.001);
    sky.update({ ...makeArgs(scene), worldTime: 0.75, hemiLight });
    assert.ok(Math.abs(hemiLight.intensity - 0.22) < 0.001);
});

test('ao mergulhar a névoa e o fundo viram azul profundo', () => {
    const scene = makeScene();
    const sky = makeSky();
    sky.create(scene);
    const { hemiLight } = makeArgs(scene);
    sky.update({ ...makeArgs(scene), worldTime: 0.25, hemiLight });
    assert.ok(scene.fog.color.equals(scene.background));
    const diaBlue = scene.fog.color.b;
    sky.update({ ...makeArgs(scene), worldTime: 0.25, underwater: true, hemiLight });
    assert.ok(scene.fog.color.b > scene.fog.color.r, 'a névoa submersa é azul');
    assert.ok(scene.fog.color.b < diaBlue, 'a névoa submersa é azul profundo, não o céu');
    assert.ok(scene.background.equals(scene.fog.color), 'fundo e névoa combinam');
    assert.ok(hemiLight.color.b > hemiLight.color.r, 'a luz difusa submersa é azul');
    // Descendo de novo, a névoa volta ao horizonte do céu.
    sky.update({ ...makeArgs(scene), worldTime: 0.25, underwater: false, hemiLight });
    assert.ok(scene.fog.color.b > scene.fog.color.r, 'no dia a névoa volta ao azul do céu');
    assert.ok(scene.fog.color.equals(scene.background));
    assert.ok(scene.fog.color.b > diaBlue * 0.8, 'a névoa volta à cor do dia');
});
