// Consultas conservadoras para partículas pequenas contra voxels inteiros.
// `readBlock` retorna null para chunk desconhecido, 0 para ar e outro valor
// para o bloco; `classify` devolve 'solid', 'water' ou 'pass'.
export const LEAF_COLLISION_RADIUS = 0.18;
const EPS = 1e-8;

function intersection(from, delta, x, y, z, radius) {
    let enter = -Infinity, exit = Infinity, normal = null;
    for (const [axis, min, max] of [
        ['x', x - radius, x + 1 + radius],
        ['y', y - radius, y + 1 + radius],
        ['z', z - radius, z + 1 + radius],
    ]) {
        const p = from[axis], d = delta[axis];
        if (Math.abs(d) < EPS) {
            if (p <= min + EPS || p >= max - EPS) return null;
            continue;
        }
        const a = (min - p) / d, b = (max - p) / d;
        const near = Math.min(a, b), far = Math.max(a, b);
        if (near > enter) { enter = near; normal = { axis, sign: a < b ? -1 : 1 }; }
        exit = Math.min(exit, far);
        if (enter > exit) return null;
    }
    if (exit < 0 || enter > 1 || enter < -EPS) return null;
    return { t: Math.max(0, enter), normal };
}

/** Varre todo o segmento, evitando atravessar blocos mesmo com quadros lentos. */
export function sweepLeaf(from, to, readBlock, classify, radius = LEAF_COLLISION_RADIUS) {
    const delta = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    let nearest = null;
    for (let x = Math.floor(Math.min(from.x, to.x) - radius); x <= Math.floor(Math.max(from.x, to.x) + radius); x++) {
        for (let y = Math.floor(Math.min(from.y, to.y) - radius); y <= Math.floor(Math.max(from.y, to.y) + radius); y++) {
            for (let z = Math.floor(Math.min(from.z, to.z) - radius); z <= Math.floor(Math.max(from.z, to.z) + radius); z++) {
                const type = readBlock(x, y, z);
                const kind = type === null ? 'unknown' : classify(type);
                if (kind === 'pass') continue;
                const hit = intersection(from, delta, x, y, z, radius);
                if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, kind, x, y, z, type };
            }
        }
    }
    return nearest;
}

/** Detecta uma edição ou nascimento dentro de um obstáculo ou chunk ausente. */
export function leafOverlaps(pos, readBlock, classify, radius = LEAF_COLLISION_RADIUS) {
    for (let x = Math.floor(pos.x - radius + EPS); x <= Math.floor(pos.x + radius - EPS); x++) {
        for (let y = Math.floor(pos.y - radius + EPS); y <= Math.floor(pos.y + radius - EPS); y++) {
            for (let z = Math.floor(pos.z - radius + EPS); z <= Math.floor(pos.z + radius - EPS); z++) {
                const type = readBlock(x, y, z);
                if (type === null || classify(type) !== 'pass') return true;
            }
        }
    }
    return false;
}

/** Superfície mais alta próxima sob a folha; água e chunks ausentes não pousam. */
export function leafSurfaceBelow(pos, readBlock, classify, distance = 0.8, radius = LEAF_COLLISION_RADIUS) {
    const bottom = pos.y - radius;
    let best = null;
    for (let x = Math.floor(pos.x - radius); x <= Math.floor(pos.x + radius); x++) {
        for (let z = Math.floor(pos.z - radius); z <= Math.floor(pos.z + radius); z++) {
            for (let y = Math.floor(bottom - distance - 1); y <= Math.floor(bottom); y++) {
                const type = readBlock(x, y, z);
                if (type === null || classify(type) !== 'solid') continue;
                const top = y + 1;
                if (top <= bottom + EPS && bottom - top <= distance && (!best || top > best.top)) best = { x, y, z, top, type };
            }
        }
    }
    return best;
}
