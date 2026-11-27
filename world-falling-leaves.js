import { ID, BLOCKS } from './world-catalog.js';
import { LEAF_COLLISION_RADIUS as R, sweepLeaf, leafSurfaceBelow, leafOverlaps } from './world-falling-leaf-collision.js';

// Arte escolhida na prévia: oval pequena, nervura suave (12×12).
export const LEAF_PIXELS = Object.freeze([
    '............', '.....h......', '....hlm.....', '...hlvmm....',
    '..hllvmm....', '..hlmvmms...', '..hlmmvsd...', '...mmmvsd...',
    '....msadd...', '.....sdd....', '......s.....', '......s.....',
]);
export const LEAF_PALETTE = Object.freeze({
    '.': [0, 0, 0, 0], h: [148, 190, 82, 255], l: [120, 169, 69, 255],
    m: [95, 145, 61, 255], s: [65, 110, 48, 255], d: [43, 83, 38, 255],
    v: [132, 178, 77, 255], a: [82, 128, 53, 255],
});
export const LEAF_SIZE = 0.25;
export const LEAF_MAX = 24;
const SCAN_RADIUS = 10, SCAN_BATCH = 24, SCAN_INTERVAL = 0.2, TREE_TTL = 4;
const offsets = [];
for (let z = -SCAN_RADIUS; z <= SCAN_RADIUS; z++) for (let x = -SCAN_RADIUS; x <= SCAN_RADIUS; x++) {
    if (x * x + z * z <= SCAN_RADIUS * SCAN_RADIUS) offsets.push([x, z]);
}
offsets.sort((a, b) => a[0] ** 2 + a[1] ** 2 - b[0] ** 2 - b[1] ** 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = v => v * v * (3 - 2 * v);

export function leafInterval(level) {
    const w = clamp(Number.isFinite(level) ? level : 0, 0, 1);
    if (w <= 0.2) return 2.8 + (1.6 - 2.8) * smooth(w / 0.2);
    return 1.6 + (1 - 1.6) * smooth((w - 0.2) / 0.8);
}
export function leafLimit(quality) {
    if (quality <= 0.5) return 0;
    if (quality <= 0.75) return 12;
    return LEAF_MAX;
}
export function leafBlockKind(type) {
    if (type === 0) return 'pass';
    if (BLOCKS[type]?.render === 'liquid') return 'water';
    // Portas e camas não ocupam o voxel inteiro: evita atravessar a peça ou
    // deixar uma folha flutuando sobre uma superfície simplificada.
    if (BLOCKS[type]?.render === 'door' || BLOCKS[type]?.render === 'bed') return 'obstacle';
    return BLOCKS[type]?.solid === false ? 'pass' : 'solid';
}

export function createFallingLeaves({ THREE, scene, readBlock, random = Math.random, texture = null }) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    let map = texture;
    if (!map) {
        const data = new Uint8Array(12 * 12 * 4);
        for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) data.set(LEAF_PALETTE[LEAF_PIXELS[y][x]], (y * 12 + x) * 4);
        map = new THREE.DataTexture(data, 12, 12, THREE.RGBAFormat);
        // CanvasTexture da prévia usa origem superior; DataTexture não inverte por padrão.
        map.flipY = true;
        map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter;
        map.generateMipmaps = false; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true;
    }
    const slots = [];
    for (let i = 0; i < LEAF_MAX; i++) {
        // Sem opt-out do tone mapping: a folha é parte do mundo e acompanha o
        // Brilho das opções (gama identidade a 100% não muda a cor de sempre).
        const material = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.01, depthWrite: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false; scene.add(mesh);
        slots.push({ mesh, active: false });
    }
    const trees = new Map();
    let clock = 0, scanTimer = 0, scanIndex = 0, centerX = Infinity, centerZ = Infinity, centerY = Infinity;
    const face = new THREE.Quaternion(), spin = new THREE.Quaternion(), target = new THREE.Quaternion();
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const axisZ = new THREE.Vector3(0, 0, 1), axisX = new THREE.Vector3(), axisY = new THREE.Vector3();

    function scanColumn(x, z, y0) {
        for (let y = y0 + 10; y >= y0 - 6; y--) {
            if (readBlock(x, y, z) !== ID.LEAVES || readBlock(x, y - 1, z) !== 0) continue;
            let best = null;
            for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
                const d = dx * dx + dz * dz;
                if (d === 0 || (best && d >= best.d)) continue;
                if (readBlock(x + dx, y, z + dz) === ID.LOG) best = { x: x + dx, z: z + dz, d };
            }
            if (!best) continue;
            const key = `${best.x},${best.z}`;
            let tree = trees.get(key);
            if (!tree) {
                if (trees.size >= 32) return;
                tree = { x: best.x, z: best.z, sites: new Map(), lastSeen: clock, next: clock + random() * leafInterval(0) };
                trees.set(key, tree);
            }
            tree.lastSeen = clock;
            const siteKey = `${x},${y},${z}`;
            tree.sites.set(siteKey, { x, y, z, time: clock });
            if (tree.sites.size > 24) tree.sites.delete(tree.sites.keys().next().value);
            return;
        }
    }
    function scan(player, dt) {
        const px = Math.floor(player.x), pz = Math.floor(player.z), py = Math.floor(player.y);
        if (Math.abs(px - centerX) > 3 || Math.abs(pz - centerZ) > 3 || Math.abs(py - centerY) > 4) {
            centerX = px; centerZ = pz; centerY = py; scanIndex = 0;
        }
        scanTimer -= dt;
        if (scanTimer > 0) return;
        scanTimer = SCAN_INTERVAL;
        for (let n = 0; n < SCAN_BATCH; n++) {
            const [dx, dz] = offsets[scanIndex++];
            if (scanIndex >= offsets.length) scanIndex = 0;
            scanColumn(centerX + dx, centerZ + dz, centerY);
        }
        for (const [key, tree] of trees) {
            if (clock - tree.lastSeen > TREE_TTL || (tree.x - px) ** 2 + (tree.z - pz) ** 2 > (SCAN_RADIUS + 3) ** 2) trees.delete(key);
        }
    }
    function emit(tree, limit) {
        const slot = slots.slice(0, limit).find(s => !s.active);
        if (!slot || !tree.sites.size) return;
        const sites = [...tree.sites.values()];
        const site = sites[Math.floor(random() * sites.length)];
        if (clock - site.time > TREE_TTL || readBlock(site.x, site.y, site.z) !== ID.LEAVES ||
            readBlock(site.x, site.y - 1, site.z) !== 0 || readBlock(tree.x, site.y, tree.z) !== ID.LOG) return;
        const pos = { x: site.x + 0.22 + random() * 0.56, y: site.y - R - 0.012, z: site.z + 0.22 + random() * 0.56 };
        if (leafOverlaps(pos, readBlock, leafBlockKind)) return;
        Object.assign(slot, { active: true, pos, origin: { ...pos }, age: 0, speed: 0.9 + random() * 0.2,
            phase: random() * Math.PI * 2, rotation: random() * Math.PI * 2, landed: false, landAge: 0, support: null });
        slot.mesh.visible = true;
    }
    function hide(slot) { slot.active = false; slot.mesh.visible = false; }
    function advance(slot, dt) {
        if (slot.landed) {
            slot.landAge += dt;
            const support = readBlock(slot.support.x, slot.support.y, slot.support.z);
            if (support === null || leafBlockKind(support) !== 'solid' || support !== slot.support.type || slot.landAge >= 4.2 ||
                leafOverlaps({ x: slot.pos.x, y: slot.pos.y + R + 0.012, z: slot.pos.z }, readBlock, leafBlockKind)) hide(slot);
            return;
        }
        if (leafOverlaps(slot.pos, readBlock, leafBlockKind)) { hide(slot); return; }
        const age = slot.age + dt, progress = age / (5 * slot.speed);
        const wave = Math.sin(progress * Math.PI * 4 + slot.phase);
        const wave0 = Math.sin(slot.phase);
        const waveZ = Math.sin(progress * Math.PI * 3 + slot.phase * 0.7);
        const waveZ0 = Math.sin(slot.phase * 0.7);
        const next = { x: slot.origin.x + 0.22 * (wave - wave0) + 0.25 * progress,
            y: slot.origin.y - 0.408 * age / slot.speed,
            z: slot.origin.z + 0.08 * (waveZ - waveZ0) };
        const hit = sweepLeaf(slot.pos, next, readBlock, leafBlockKind);
        slot.age = age;
        if (age > 15 || (hit && (hit.kind !== 'solid' || hit.normal?.axis !== 'y' || hit.normal.sign !== 1))) { hide(slot); return; }
        if (hit) {
            slot.pos.x += (next.x - slot.pos.x) * hit.t;
            slot.pos.z += (next.z - slot.pos.z) * hit.t;
            slot.pos.y = hit.y + 1;
            slot.landed = true; slot.landAge = 0;
            slot.support = { x: hit.x, y: hit.y, z: hit.z, type: hit.type };
        } else slot.pos = next;
    }
    function render(slot, camera, light) {
        const mesh = slot.mesh;
        const p = slot.age / (5 * slot.speed);
        const wave = Math.sin(p * Math.PI * 4 + slot.phase);
        const rotation = slot.rotation + wave * 0.22 + 0.8 * Math.PI * 2 * p;
        let tilt = 1, width = 1, y = slot.pos.y + 0.012;
        const surface = slot.landed ? null : leafSurfaceBelow(slot.pos, readBlock, leafBlockKind, 0.55);
        if (!slot.landed) {
            const t = surface ? clamp(1 - (slot.pos.y - R - surface.top) / 0.55, 0, 1) : 0;
            tilt = smooth(t);
            width = (1 - 0.35 * (0.5 + 0.5 * Math.sin(p * Math.PI * 4 + slot.phase))) * (1 - tilt) + tilt;
            y = slot.pos.y - (R - 0.012) * tilt;
        }
        spin.setFromAxisAngle(axisZ, rotation);
        face.copy(camera.quaternion).multiply(spin);
        target.copy(flat).multiply(spin);
        mesh.quaternion.copy(face).slerp(target, tilt);
        if (surface) {
            axisX.set(1, 0, 0).applyQuaternion(mesh.quaternion);
            axisY.set(0, 1, 0).applyQuaternion(mesh.quaternion);
            y = Math.max(y, surface.top + 0.012 + LEAF_SIZE * 0.5 * (Math.abs(axisX.y) * width + Math.abs(axisY.y)));
        }
        mesh.position.set(slot.pos.x, y, slot.pos.z);
        mesh.scale.set(LEAF_SIZE * width, LEAF_SIZE, 1);
        mesh.material.opacity = slot.landed ? clamp(1 - Math.max(0, slot.landAge - 3) / 1.2, 0, 1) : clamp(slot.age / 0.4, 0, 1);
        mesh.material.color.setScalar(clamp(light, 0.3, 1));
    }
    function update(dt, { player, camera, wind = 0, quality = 1, light = 1 } = {}) {
        const limit = leafLimit(quality);
        if (!limit) { clear(); return; }
        if (!(dt > 0) || !player || !camera) return;
        dt = Math.min(dt, 0.1); clock += dt;
        scan(player, dt);
        for (const tree of trees.values()) if (clock >= tree.next) {
            emit(tree, limit);
            tree.next = clock + leafInterval(wind) * (0.75 + random() * 0.5);
        }
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            if (!slot.active) continue;
            if (i >= limit || (slot.pos.x - player.x) ** 2 + (slot.pos.z - player.z) ** 2 > 18 ** 2) { hide(slot); continue; }
            advance(slot, dt);
            if (slot.active) render(slot, camera, light);
        }
    }
    function clear() {
        for (const slot of slots) hide(slot);
        trees.clear(); centerX = centerY = centerZ = Infinity; scanIndex = 0; scanTimer = 0;
    }
    return { update, clear, get count() { return slots.filter(s => s.active).length; }, get treeCount() { return trees.size; } };
}
