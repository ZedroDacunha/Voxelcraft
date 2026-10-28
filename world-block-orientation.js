export const DEFAULT_BLOCK_FACING = 'south';

const FACING_VECTORS = Object.freeze({
    east: [1, 0, 0],
    west: [-1, 0, 0],
    south: [0, 0, 1],
    north: [0, 0, -1],
});

export function isHorizontalFacing(facing) {
    return Object.hasOwn(FACING_VECTORS, facing);
}

export function facingTowardPlayer(blockX, blockZ, playerX, playerZ) {
    const dx = playerX - blockX;
    const dz = playerZ - blockZ;
    if (Math.abs(dx) > Math.abs(dz)) return dx >= 0 ? 'east' : 'west';
    return dz >= 0 ? 'south' : 'north';
}

export function isFrontFace(faceDirection, facing = DEFAULT_BLOCK_FACING) {
    const vector = FACING_VECTORS[facing] || FACING_VECTORS[DEFAULT_BLOCK_FACING];
    return faceDirection[0] === vector[0] && faceDirection[2] === vector[2] && faceDirection[1] === 0;
}

export function tileForBlockFace(tiles, faceKind, faceDirection, facing = DEFAULT_BLOCK_FACING) {
    if (tiles.front !== undefined && isFrontFace(faceDirection, facing)) return tiles.front;
    return tiles[faceKind];
}

export function parseBlockFacings(entries, worldHeight, isOrientableAt = () => true) {
    const facings = new Map();
    if (!Array.isArray(entries)) return facings;
    for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length !== 2) continue;
        const [key, facing] = entry;
        if (typeof key !== 'string' || !/^-?\d+,\d+,-?\d+$/.test(key) || !isHorizontalFacing(facing)) continue;
        const [x, y, z] = key.split(',').map(Number);
        if (y >= 0 && y < worldHeight && isOrientableAt(x, y, z)) facings.set(key, facing);
    }
    return facings;
}

export function serializeBlockFacings(facings, worldHeight) {
    return Array.from(facings).filter(([key, facing]) => {
        if (typeof key !== 'string' || !/^-?\d+,\d+,-?\d+$/.test(key) || !isHorizontalFacing(facing)) return false;
        const y = Number(key.split(',')[1]);
        return y >= 0 && y < worldHeight;
    });
}

export class BlockFacingStore {
    #entries;

    constructor(entries = new Map()) {
        this.#entries = new Map(entries);
    }

    get(x, y, z) {
        return this.#entries.get(`${x},${y},${z}`) || DEFAULT_BLOCK_FACING;
    }

    set(x, y, z, facing) {
        const value = isHorizontalFacing(facing) ? facing : DEFAULT_BLOCK_FACING;
        this.#entries.set(`${x},${y},${z}`, value);
    }

    delete(x, y, z) {
        this.#entries.delete(`${x},${y},${z}`);
    }

    serialize(worldHeight) {
        return serializeBlockFacings(this.#entries, worldHeight);
    }
}
