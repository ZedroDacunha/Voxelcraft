import { hash2 } from './world-math.js';

export const COAL_VEIN_CONFIG = Object.freeze({
    horizontalCellSize: 8,
    verticalCellSize: 7,
    horizontalReach: 3,
    verticalReach: 2,
    seedOffset: 18041,
});

export class OreGenerator {
    constructor(seed, config) {
        this.seed = seed;
        this.config = config;
    }

    index(x, y, z) {
        const { CHUNK_SIZE } = this.config;
        return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
    }

    createCoalVeinMask(chunk) {
        const { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL } = this.config;
        const { horizontalCellSize, verticalCellSize, horizontalReach, verticalReach, seedOffset } = COAL_VEIN_CONFIG;
        const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;
        const mask = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
        const minGX = Math.floor((ox - horizontalReach) / horizontalCellSize);
        const maxGX = Math.floor((ox + CHUNK_SIZE - 1 + horizontalReach) / horizontalCellSize);
        const minGZ = Math.floor((oz - horizontalReach) / horizontalCellSize);
        const maxGZ = Math.floor((oz + CHUNK_SIZE - 1 + horizontalReach) / horizontalCellSize);
        const minGY = Math.floor(-verticalReach / verticalCellSize);
        const maxGY = Math.floor((WORLD_HEIGHT - 1 + verticalReach) / verticalCellSize);

        for (let gx = minGX; gx <= maxGX; gx++) {
            for (let gz = minGZ; gz <= maxGZ; gz++) {
                for (let gy = minGY; gy <= maxGY; gy++) {
                    const cellSeed = gx * 92821 + gz * 68917 + gy * 28387;
                    const anchorSeed = this.seed + seedOffset;
                    const centerX = gx * horizontalCellSize +
                        hash2(cellSeed, gz + gy * 193, anchorSeed + 1) * horizontalCellSize;
                    const centerY = gy * verticalCellSize +
                        hash2(gx + gy * 317, gz + cellSeed, anchorSeed + 2) * verticalCellSize;
                    const centerZ = gz * horizontalCellSize +
                        hash2(gz + gy * 419, gx + cellSeed, anchorSeed + 3) * horizontalCellSize;
                    const chance = centerY >= WATER_LEVEL ? 0.38 : 0.22;
                    if (hash2(cellSeed, gy * 571 + gz, anchorSeed) >= chance) continue;

                    const radiusX = 1.8 + hash2(cellSeed + 11, gz, anchorSeed + 4) * 0.9;
                    const radiusY = 1.0 + hash2(gx, cellSeed + 17, anchorSeed + 5) * 0.6;
                    const radiusZ = 1.8 + hash2(gz, cellSeed + 23, anchorSeed + 6) * 0.9;
                    const minX = Math.max(0, Math.floor(centerX - radiusX - ox));
                    const maxX = Math.min(CHUNK_SIZE - 1, Math.ceil(centerX + radiusX - ox));
                    const minY = Math.max(1, Math.floor(centerY - radiusY));
                    const maxY = Math.min(WORLD_HEIGHT - 1, Math.ceil(centerY + radiusY));
                    const minZ = Math.max(0, Math.floor(centerZ - radiusZ - oz));
                    const maxZ = Math.min(CHUNK_SIZE - 1, Math.ceil(centerZ + radiusZ - oz));

                    for (let y = minY; y <= maxY; y++) {
                        const dy = (y + 0.5 - centerY) / radiusY;
                        for (let z = minZ; z <= maxZ; z++) {
                            const dz = (oz + z + 0.5 - centerZ) / radiusZ;
                            for (let x = minX; x <= maxX; x++) {
                                const dx = (ox + x + 0.5 - centerX) / radiusX;
                                if (dx * dx + dy * dy + dz * dz <= 1) mask[this.index(x, y, z)] = 1;
                            }
                        }
                    }
                }
            }
        }
        return mask;
    }

    getOreType(wx, y, wz, coalVein) {
        const { ID } = this.config;
        const rarity = hash2(wx + y * 31, wz - y * 17, this.seed + 91);
        if (y < 18 && rarity < 0.004) return ID.DIAMOND_ORE;
        if (y < 28 && rarity < 0.010) return ID.GOLD_ORE;
        if (y < 42 && rarity < 0.025) return ID.IRON_ORE;
        if (coalVein) return ID.COAL_ORE;
        if (y >= 28 && rarity < 0.130) return ID.COPPER_ORE;
        return null;
    }
}
