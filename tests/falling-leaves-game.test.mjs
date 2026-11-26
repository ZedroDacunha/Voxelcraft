import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { ID } from '../world-catalog.js';
import { NATURAL_LEAF_REFINEMENTS } from '../tools/proposta-folha-natural.js';
import { LEAF_PIXELS, LEAF_PALETTE, LEAF_MAX, leafInterval, leafLimit, leafBlockKind, createFallingLeaves } from '../world-falling-leaves.js';

function makeWorld() {
    const blocks = new Map();
    const set = (x, y, z, id) => blocks.set(`${x},${y},${z}`, id);
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) set(x, 0, z, ID.GRASS);
    for (let y = 1; y <= 5; y++) set(0, y, 0, ID.LOG);
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
        if ((x === 0 && z === 0) || (Math.abs(x) === 2 && Math.abs(z) === 2)) continue;
        set(x, 3, z, ID.LEAVES);
    }
    return { set, read: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0 };
}

test('o jogo conserva a arte e a frequência aprovadas', () => {
    const selected = NATURAL_LEAF_REFINEMENTS[1];
    assert.deepEqual([...LEAF_PIXELS], selected.pixels);
    assert.deepEqual(LEAF_PALETTE, selected.palette);
    assert.equal(leafInterval(0), 2.8);
    assert.equal(leafInterval(0.2), 1.6);
    assert.equal(leafInterval(1), 1);
    assert.equal(leafLimit(0.5), 0);
    assert.equal(leafLimit(0.75), 12);
    assert.equal(leafLimit(1), LEAF_MAX);
    assert.equal(leafBlockKind(ID.TALL_GRASS), 'pass');
    assert.equal(leafBlockKind(ID.WOOD_DOOR_BOTTOM_OPEN), 'obstacle');
    assert.equal(leafBlockKind(ID.GRASS), 'solid');
    assert.equal(leafBlockKind(ID.WATER), 'water');
});

test('detecta árvore, emite, pousa na superfície e respeita limites', () => {
    const world = makeWorld(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 4, 5); camera.lookAt(0, 1, 0);
    const system = createFallingLeaves({ THREE, scene, readBlock: world.read, random: () => 0.5 });
    const opts = { player: { x: 0.5, y: 1, z: 3 }, camera, wind: 1, quality: 1 };
    let max = 0, landed = null;
    for (let i = 0; i < 1600; i++) {
        system.update(0.025, opts);
        max = Math.max(max, system.count);
        for (const mesh of scene.children) if (mesh.visible && Math.abs(mesh.position.y - 1.012) < 1e-7) landed = mesh;
        assert.ok(system.count <= LEAF_MAX);
        for (const mesh of scene.children) if (mesh.visible) {
            const x = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.quaternion).y;
            const y = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion).y;
            assert.ok(mesh.position.y - (Math.abs(x) * mesh.scale.x + Math.abs(y) * mesh.scale.y) / 2 >= 1 - 1e-7);
        }
    }
    assert.ok(system.treeCount > 0 && max > 0 && landed, 'árvore e folhas em queda e pousadas');
    const x = Math.floor(landed.position.x), z = Math.floor(landed.position.z);
    world.set(x, 0, z, 0);
    system.update(0.025, opts);
    assert.equal(landed.visible, false, 'pouso é removido ao perder o suporte');
    system.update(0.025, { ...opts, quality: 0.5 });
    assert.equal(system.count, 0);
    assert.equal(system.treeCount, 0);
});

test('floresta mantém quantidade e trabalho de descoberta limitados', () => {
    const blocks = new Map();
    const put = (x, y, z, id) => blocks.set(`${x},${y},${z}`, id);
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) put(x, 0, z, ID.GRASS);
    for (let tx = -8; tx <= 8; tx += 4) for (let tz = -8; tz <= 8; tz += 4) {
        for (let y = 1; y <= 4; y++) put(tx, y, tz, ID.LOG);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            if (dx || dz) put(tx + dx, 3, tz + dz, ID.LEAVES);
        }
    }
    let reads = 0, maxReads = 0, maxCount = 0;
    const readBlock = (x, y, z) => { reads++; return blocks.get(`${x},${y},${z}`) ?? 0; };
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    const system = createFallingLeaves({ THREE, scene, readBlock, random: () => 0.5 });
    const opts = { player: { x: 0, y: 1, z: 0 }, camera, quality: 1, wind: 1 };
    for (let i = 0; i < 800; i++) {
        reads = 0; system.update(0.05, opts);
        maxReads = Math.max(maxReads, reads); maxCount = Math.max(maxCount, system.count);
    }
    assert.ok(system.treeCount > 8);
    assert.ok(maxCount > 0 && maxCount <= LEAF_MAX);
    assert.ok(maxReads < 3000, `consultas num quadro: ${maxReads}`);
    system.update(0.05, { ...opts, quality: 0.75 });
    assert.ok(system.count <= 12);
});

test('sem tronco ou em chunk ausente não surgem folhas', () => {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    const system = createFallingLeaves({ THREE, scene, readBlock: () => null, random: () => 0.5 });
    for (let i = 0; i < 200; i++) system.update(0.05, { player: { x: 0, y: 1, z: 0 }, camera, quality: 1 });
    assert.equal(system.count, 0);
    assert.equal(system.treeCount, 0);
});
