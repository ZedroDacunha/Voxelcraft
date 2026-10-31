import * as THREE from 'three';
import { ATLAS_UV_PAD_PX, BLOCKS, ID, TILE, TILE_PX, atlasTileRect, atlasUV } from './world-catalog.js';
import { hash2 } from './world-math.js';
import { createTextureTools } from './world-textures.js';
import { tileForBlockFace } from './world-block-orientation.js';

const canvas = document.getElementById('menu-world');
const titleScreen = document.getElementById('title-screen');
if (!canvas || !titleScreen) throw new Error('A tela inicial não está pronta para mostrar o panorama.');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bcce7);
scene.fog = new THREE.Fog(0x9bcce7, 42, 105);

const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 150);
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

scene.add(new THREE.HemisphereLight(0xe7f5ff, 0x596343, 2.2));
const sun = new THREE.DirectionalLight(0xfff1cf, 2.4);
sun.position.set(-28, 42, 16);
scene.add(sun);

const atlas = createTextureTools(THREE).createAtlasTexture();
const blockTypes = {
    grass: BLOCKS[ID.GRASS], dirt: BLOCKS[ID.DIRT], stone: BLOCKS[ID.STONE],
    sand: BLOCKS[ID.SAND], wood: BLOCKS[ID.LOG], leaves: BLOCKS[ID.LEAVES],
};
const altTiles = new Map([
    [TILE.GRASS_TOP, TILE.GRASS_TOP_ALT], [TILE.GRASS_SIDE, TILE.GRASS_SIDE_ALT],
    [TILE.DIRT, TILE.DIRT_ALT], [TILE.STONE, TILE.STONE_ALT], [TILE.LEAVES, TILE.LEAVES_ALT],
]);
const positions = {};
for (const kind of Object.keys(blockTypes)) for (const variant of [0, 1]) positions[`${kind}:${variant}`] = [];
const addBlock = (kind, x, y, z, variant = 0) => positions[`${kind}:${variant}`].push([x, y, z]);
const variantFor = (x, y, z) => hash2(x + y * 13, z - y * 7, 404) > 0.16 ? 0 : 1;
const smoothNoise = (x, z) => Math.sin(x * 0.21) * 1.35 + Math.cos(z * 0.17) * 1.25
    + Math.sin((x + z) * 0.095) * 1.1 + Math.cos((x - z) * 0.13) * 0.65;

const faces = [
    { kind: 'side', dir: [-1, 0, 0], corners: [[0,1,0,0,1],[0,0,0,0,0],[0,1,1,1,1],[0,0,1,1,0]] },
    { kind: 'side', dir: [1, 0, 0], corners: [[1,1,1,0,1],[1,0,1,0,0],[1,1,0,1,1],[1,0,0,1,0]] },
    { kind: 'bottom', dir: [0,-1,0], corners: [[1,0,1,1,0],[0,0,1,0,0],[1,0,0,1,1],[0,0,0,0,1]] },
    { kind: 'top', dir: [0,1,0], corners: [[0,1,1,1,1],[1,1,1,0,1],[0,1,0,1,0],[1,1,0,0,0]] },
    { kind: 'side', dir: [0,0,-1], corners: [[1,0,0,0,0],[0,0,0,1,0],[1,1,0,0,1],[0,1,0,1,1]] },
    { kind: 'side', dir: [0,0,1], corners: [[0,0,1,0,0],[1,0,1,1,0],[0,1,1,0,1],[1,1,1,1,1]] },
];

function blockGeometry(block, variant) {
    const positions = [], normals = [], uvs = [], indices = [];
    for (const face of faces) {
        const baseTile = tileForBlockFace(block.tiles, face.kind, face.dir);
        const tile = variant ? (altTiles.get(baseTile) ?? baseTile) : baseTile;
        const { u0, v0, uWidth, vHeight } = atlasUV(tile, ATLAS_UV_PAD_PX);
        const start = positions.length / 3;
        for (const [x, y, z, u, v] of face.corners) {
            positions.push(x - 0.5, y - 0.5, z - 0.5);
            normals.push(...face.dir);
            uvs.push(u0 + u * uWidth, v0 + v * vHeight);
        }
        indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
}

for (let x = -24; x <= 24; x++) {
    for (let z = -24; z <= 24; z++) {
        const lakeX = (x - 3) / 10;
        const lakeZ = (z + 3) / 7;
        const lakeDistance = lakeX * lakeX + lakeZ * lakeZ;
        const isLake = lakeDistance < 0.78;
        const isShore = lakeDistance >= 0.78 && lakeDistance < 1.03;
        const height = isLake ? 0 : Math.max(2, Math.round(4 + smoothNoise(x, z)));
        const sandyColumn = isLake || isShore;
        addBlock(sandyColumn ? 'sand' : 'grass', x, height, z,
            sandyColumn ? 0 : variantFor(x, height, z));
        for (let depth = 1; depth <= 3; depth++) {
            const layerY = height - depth;
            if (layerY < 0) break;
            const layerType = sandyColumn ? 'sand' : 'dirt';
            addBlock(layerType, x, layerY, z, variantFor(x, layerY, z));
        }
        for (let layerY = height - 4; layerY >= 0; layerY--) {
            addBlock('stone', x, layerY, z, variantFor(x, layerY, z));
        }

        const treeSeed = Math.abs(Math.sin(x * 127.1 + z * 311.7) * 43758.5453) % 1;
        if (treeSeed > 0.89 && !isLake && !isShore && Math.abs(x) + Math.abs(z) > 8) {
            const trunkHeight = 3 + Math.floor(treeSeed * 3);
            for (let y = 1; y <= trunkHeight; y++) addBlock('wood', x, height + y, z);
            const crownY = height + trunkHeight;
            for (let dy = -1; dy <= 1; dy++) {
                const radius = dy === 1 ? 1 : 2;
                for (let dx = -radius; dx <= radius; dx++) {
                    for (let dz = -radius; dz <= radius; dz++) {
                        if (Math.abs(dx) === radius && Math.abs(dz) === radius && dy === 0) continue;
                        const leafX = x + dx, leafZ = z + dz, leafY = crownY + dy;
                        addBlock('leaves', leafX, leafY, leafZ, variantFor(leafX, leafY, leafZ));
                    }
                }
            }
            const leafY = crownY + 2;
            addBlock('leaves', x, leafY, z, variantFor(x, leafY, z));
        }
    }
}

const dummy = new THREE.Object3D();
for (const [key, instances] of Object.entries(positions)) {
    if (!instances.length) continue;
    const [kind, variantText] = key.split(':');
    const block = blockTypes[kind];
    const material = new THREE.MeshLambertMaterial({
        map: atlas,
        alphaTest: block.render === 'cutout' ? 0.5 : 0,
        side: block.render === 'cutout' ? THREE.DoubleSide : THREE.FrontSide,
    });
    const mesh = new THREE.InstancedMesh(blockGeometry(block, Number(variantText)), material, instances.length);
    mesh.frustumCulled = false;
    instances.forEach(([x, y, z], index) => {
        dummy.position.set(x, y, z);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
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
water.position.set(3, 2.42, -3);
water.scale.set(10 * Math.sqrt(0.78) + 0.5, 7 * Math.sqrt(0.78) + 0.5, 1);
scene.add(water);

const clouds = new THREE.Group();
const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xf2f4ec, flatShading: true });
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
