import * as THREE from 'three';
import { createWaterSurfaceMaterial } from './world-water-material.js';
import { clamp01, mulberry32, Noise2D, smoothstep } from './world-math.js';
import { createTextureTools } from './world-textures.js';
import { createWorldClouds, WORLD_CLOUD_CONFIG } from './world-clouds.js';
import { buildMenuHorizon } from './menu-horizon.js';
import { TILE, atlasTileRect } from './world-catalog.js';
import { FACES } from './world-faces.js';
import { createWorldSkySystem } from './world-sky.js';
import { MENU_CAMERA, MENU_SUN_TIME, menuCameraPosition } from './menu-framing.js';
import { buildMenuPanorama, panoramaGeometry } from './menu-panorama.js';

const canvas = document.getElementById('menu-world');
const titleScreen = document.getElementById('title-screen');
if (!canvas || !titleScreen) throw new Error('A tela inicial não está pronta para mostrar o panorama.');

const SKY_COLOR = 0x9bcce7;
// A hora do menu e o enquadramento da ilha moram em `menu-framing.js`: é lá que a
// conta do sol em quadro fica testável (aqui há DOM, e teste não entra).
const FOG_NEAR = 44;
const FOG_FAR = 143;

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, FOG_FAR);

// `far` generoso: o sol, a lua e as estrelas ficam a 250 unidades da câmera.
const camera = new THREE.PerspectiveCamera(MENU_CAMERA.fov, 1, 0.1, 400);
const target = new THREE.Vector3(0, MENU_CAMERA.targetY, 0);

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));


// Mesmos valores do `init()` do jogo: quem manda neles depois é o céu.
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
sunLight.position.set(10, 20, 10);
scene.add(hemiLight, sunLight);

const clouds = createWorldClouds({
    THREE, Noise2D, faces: FACES,
    config: { ...WORLD_CLOUD_CONFIG, height: 28, cellSize: 5, thickness: 2, speed: 0.45 },
});
clouds.create(scene, 42);
const worldSky = createWorldSkySystem({
    THREE,
    clamp01,
    smoothstep,
    mulberry32,
    clouds,
    skyColor: SKY_COLOR,
});
worldSky.create(scene);

// Chão, árvores e lago. A malha já vem com UV do atlas, face escondida fora e
// sombra de canto — o mesmo acabamento dos blocos do jogo.
const atlas = createTextureTools(THREE).createAtlasTexture();
const panorama = buildMenuPanorama();
// Fora do bosque, o tile se repete a cada bloco mesmo nas faces distantes.
function horizonMaterial(tile) {
    const { x, y, size } = atlasTileRect(tile);
    const image = document.createElement('canvas');
    image.width = image.height = size;
    image.getContext('2d').drawImage(atlas.image, x, y, size, size, 0, 0, size, size);
    const texture = new THREE.CanvasTexture(image);
    texture.colorSpace = atlas.colorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    return new THREE.MeshLambertMaterial({ map: texture });
}
scene.add(new THREE.Mesh(buildMenuHorizon(THREE, panorama), [
    horizonMaterial(TILE.GRASS_TOP), horizonMaterial(TILE.DIRT),
]));
const panoramaParts = panoramaGeometry(panorama);
const waterMaterial = createWaterSurfaceMaterial(THREE);
const materials = {
    water: waterMaterial,
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
for (const [name, material] of Object.entries(materials)) {
    const part = panoramaParts[name];
    if (!part.faces) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(part.uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(part.colors, 3));
    if (name === 'water') {
        geometry.setAttribute('torchInfluence', new THREE.BufferAttribute(new Float32Array(part.vertices), 1));
    }
    geometry.setIndex(new THREE.BufferAttribute(part.indices, 1));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
}

function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (reduceMotion.matches && !document.hidden && !titleScreen.hidden) render(0, 0);
}
window.addEventListener('resize', resize, { passive: true });

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let frameId = 0;
let previousFrame = 0;
let elapsed = 0;
function render(now, deltaSeconds) {
    // O giro e o ponto de partida (virado para o sol) vêm de `menu-framing.js`.
    const pose = menuCameraPosition(now, { reduced: reduceMotion.matches });
    camera.position.set(pose.x, pose.y, pose.z);
    camera.lookAt(target);
    clouds.update(deltaSeconds, camera);
    worldSky.update({
        scene,
        camera,
        hemiLight,
        sunLight,
        worldTime: MENU_SUN_TIME,
        fogNear: FOG_NEAR,
        fogFar: FOG_FAR,
    });
    // A luz de preenchimento separa as copas da encosta atrás dos botões.
    hemiLight.intensity *= 1.35;
    const water = waterMaterial.uniforms;
    water.waterTime.value = (now * 0.001) % (20 * Math.PI);
    water.horizonColor.value.copy(scene.fog.color);
    water.lightDirection.value.copy(sunLight.position).normalize();
    water.lightColor.value.copy(sunLight.color).multiplyScalar(sunLight.intensity);
    water.daylight.value = worldSky.day;
    renderer.render(scene, camera);
}
function animate(now) {
    frameId = 0;
    if (document.hidden || titleScreen.hidden) return;
    if (now - previousFrame >= 1000 / 30) {
        const delta = Math.min(now - previousFrame, 100);
        previousFrame = now;
        elapsed += delta;
        render(elapsed, delta / 1000);
    }
    frameId = requestAnimationFrame(animate);
}
function start() {
    if (frameId || document.hidden || titleScreen.hidden) return;
    if (reduceMotion.matches) {
        render(0, 0);
        return;
    }
    previousFrame = performance.now();
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
    stop();
    start();
});
resize();
start();
