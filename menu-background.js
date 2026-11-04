// O panorama animado atrás do título: a ilha gira devagar enquanto o jogo abre.
//
// Ele agora usa a **mesma luz do mundo** em vez de uma cópia parecida:
//
// - a malha vem de `menu-panorama.js`, com as faces escondidas fora e a sombra
//   de canto escrita em cor de vértice — o mesmo relevo dos blocos do jogo;
// - o céu é o `world-sky.js`, que é quem decide cor do fundo, nevoeiro, força e
//   cor do sol (e desenha sol, lua e estrelas). O relógio aqui é parado numa
//   tarde de sol: um menu que escurece sozinho deixaria o título ilegível.
// - as luzes (hemisférica + direcional) nascem com os valores do jogo e são
//   reescritas pelo céu a cada quadro, como no mundo.

import * as THREE from 'three';
import { TILE, TILE_PX, atlasTileRect } from './world-catalog.js';
import { clamp01, mulberry32, smoothstep } from './world-math.js';
import { createTextureTools } from './world-textures.js';
import { createWorldSkySystem } from './world-sky.js';
import { MENU_LAKE, buildMenuPanorama, panoramaGeometry } from './menu-panorama.js';

const canvas = document.getElementById('menu-world');
const titleScreen = document.getElementById('title-screen');
if (!canvas || !titleScreen) throw new Error('A tela inicial não está pronta para mostrar o panorama.');

const SKY_COLOR = 0x9bcce7;
// Onde o sol está no céu do menu, em fração do dia (0 = nascer, 0.25 = meio-dia).
// 0.06 é manhã de céu limpo: dia cheio, luz branca e sombra no ponto mais claro
// do jogo. Baixar para perto de 0.02 dá fim de tarde laranja; subir passa do
// meio-dia. É o único número a mexer para trocar a hora do menu.
const MENU_SUN_TIME = 0.06;
const FOG_NEAR = 42;
const FOG_FAR = 105;

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, FOG_FAR);

// `far` generoso: o sol, a lua e as estrelas ficam a 250 unidades da câmera.
const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 400);
const target = new THREE.Vector3(0, 5, 0);

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight, false);

// Mesmos valores do `init()` do jogo: quem manda neles depois é o céu.
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
sunLight.position.set(10, 20, 10);
scene.add(hemiLight, sunLight);

// Nuvens: o céu avisa a hora e a cor quente para elas acompanharem o sol.
const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xf2f4ec, flatShading: true });
const cloudNight = new THREE.Color(0x232a46);
const cloudDusk = new THREE.Color(0xffb690);
const cloudDay = new THREE.Color(0xf2f4ec);
const cloudColor = new THREE.Color();
const cloudTint = {
    updateTint(day, warm) {
        cloudColor.copy(cloudNight).lerp(cloudDay, day).lerp(cloudDusk, warm * 0.55);
        cloudMaterial.color.copy(cloudColor);
    },
};
const worldSky = createWorldSkySystem({
    THREE,
    clamp01,
    smoothstep,
    mulberry32,
    clouds: cloudTint,
    skyColor: SKY_COLOR,
});
worldSky.create(scene);

// Chão, árvores e lago. A malha já vem com UV do atlas, face escondida fora e
// sombra de canto — o mesmo acabamento dos blocos do jogo.
const atlas = createTextureTools(THREE).createAtlasTexture();
const panorama = buildMenuPanorama();
const panoramaParts = panoramaGeometry(panorama);
const blockMaterials = {
    opaque: new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true }),
    cutout: new THREE.MeshLambertMaterial({
        map: atlas,
        alphaTest: 0.5,
        transparent: false,
        depthWrite: true,
        vertexColors: true,
        side: THREE.DoubleSide,
    }),
};
for (const name of ['opaque', 'cutout']) {
    const part = panoramaParts[name];
    if (!part.faces) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(part.uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(part.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(part.indices, 1));
    const mesh = new THREE.Mesh(geometry, blockMaterials[name]);
    mesh.frustumCulled = false;
    scene.add(mesh);
}

const waterTileCanvas = document.createElement('canvas');
waterTileCanvas.width = waterTileCanvas.height = TILE_PX;
const waterTile = atlasTileRect(TILE.WATER);
waterTileCanvas.getContext('2d').drawImage(atlas.image, waterTile.x, waterTile.y, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);
const waterTexture = new THREE.CanvasTexture(waterTileCanvas);
waterTexture.magFilter = waterTexture.minFilter = THREE.NearestFilter;
waterTexture.generateMipmaps = false;
waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping;
waterTexture.repeat.set(8, 8);
waterTexture.colorSpace = THREE.SRGBColorSpace;
const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshLambertMaterial({ map: waterTexture, transparent: true, opacity: 0.9 }),
);
water.rotation.x = -Math.PI / 2;
water.position.set(MENU_LAKE.centerX, MENU_LAKE.surfaceY, MENU_LAKE.centerZ);
water.scale.set(
    MENU_LAKE.radiusX * Math.sqrt(MENU_LAKE.fill) + 0.5,
    MENU_LAKE.radiusZ * Math.sqrt(MENU_LAKE.fill) + 0.5,
    1,
);
scene.add(water);

const clouds = new THREE.Group();
const cloudShapes = [
    [-25, 20, -12, 8, 1, 4], [-6, 23, -24, 7, 1, 3], [15, 19, -18, 9, 1, 3],
    [30, 22, 2, 8, 1, 4], [-34, 18, 13, 7, 1, 3], [4, 25, 21, 8, 1, 3],
];
for (const [x, y, z, width, height, depth] of cloudShapes) {
    const cloud = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), cloudMaterial);
    cloud.position.set(x, y, z);
    clouds.add(cloud);
}
scene.add(clouds);

function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
}
window.addEventListener('resize', resize, { passive: true });

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let frameId = 0;
let previousFrame = 0;
let angle = -0.1;
function render(now = 0) {
    frameId = 0;
    clouds.position.x = reduceMotion.matches ? 0 : Math.sin(now * 0.000035) * 2.1;
    angle = reduceMotion.matches ? -0.1 : -0.1 + now * 0.000014;
    const radius = 39;
    camera.position.set(Math.sin(angle) * radius, 18.5 + Math.sin(angle * 1.7) * 0.7, Math.cos(angle) * radius);
    camera.lookAt(target);
    worldSky.update({
        scene,
        camera,
        hemiLight,
        sunLight,
        worldTime: MENU_SUN_TIME,
        fogNear: FOG_NEAR,
        fogFar: FOG_FAR,
    });
    renderer.render(scene, camera);
}
function animate(now) {
    frameId = 0;
    if (document.hidden || titleScreen.hidden) return;
    if (now - previousFrame >= 1000 / 30) {
        previousFrame = now;
        render(now);
    }
    frameId = requestAnimationFrame(animate);
}
function start() {
    if (frameId || document.hidden || titleScreen.hidden) return;
    if (reduceMotion.matches) {
        render(performance.now());
        return;
    }
    frameId = requestAnimationFrame(animate);
}
function stop() {
    if (!frameId) return;
    cancelAnimationFrame(frameId);
    frameId = 0;
}

document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
new MutationObserver(() => titleScreen.hidden ? stop() : start()).observe(titleScreen, {
    attributes: true,
    attributeFilter: ['hidden'],
});
reduceMotion.addEventListener?.('change', () => {
    if (reduceMotion.matches) {
        stop();
        render(performance.now());
    } else start();
});
render(0);
start();
