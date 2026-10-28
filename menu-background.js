import * as THREE from 'three';

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

const cube = new THREE.BoxGeometry(1, 1, 1);
const palettes = {
    grass: 0x65a843,
    dirt: 0x795638,
    stone: 0x777d78,
    sand: 0xcdbb78,
    wood: 0x725033,
    leaves: 0x477b39,
};
const positions = Object.fromEntries(Object.keys(palettes).map(kind => [kind, []]));
const addBlock = (kind, x, y, z, scale = 1) => positions[kind].push([x, y, z, scale]);
const smoothNoise = (x, z) => Math.sin(x * 0.21) * 1.35 + Math.cos(z * 0.17) * 1.25
    + Math.sin((x + z) * 0.095) * 1.1 + Math.cos((x - z) * 0.13) * 0.65;

for (let x = -24; x <= 24; x++) {
    for (let z = -24; z <= 24; z++) {
        const lakeX = (x - 3) / 10;
        const lakeZ = (z + 3) / 7;
        const lakeDistance = lakeX * lakeX + lakeZ * lakeZ;
        const isLake = lakeDistance < 0.78;
        const isShore = lakeDistance >= 0.78 && lakeDistance < 1.03;
        const height = isLake ? 0 : Math.max(2, Math.round(4 + smoothNoise(x, z)));
        addBlock(isLake || isShore ? 'sand' : 'grass', x, height, z);
        addBlock('dirt', x, height - 1, z);
        if (height > 2) addBlock('stone', x, height - 2, z);

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
                        addBlock('leaves', x + dx, crownY + dy, z + dz);
                    }
                }
            }
            addBlock('leaves', x, crownY + 2, z);
        }
    }
}

const dummy = new THREE.Object3D();
for (const [kind, color] of Object.entries(palettes)) {
    const instances = positions[kind];
    const material = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const mesh = new THREE.InstancedMesh(cube, material, instances.length);
    mesh.frustumCulled = false;
    instances.forEach(([x, y, z, scale], index) => {
        dummy.position.set(x, y, z);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
}

const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshLambertMaterial({ color: 0x4e9eae, transparent: true, opacity: 0.9 }),
);
water.rotation.x = -Math.PI / 2;
water.position.set(3, 2.42, -3);
water.scale.set(10.7, 7.6, 1);
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
