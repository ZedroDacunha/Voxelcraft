import { hash2, Noise2D, smoothstep } from './world-math.js';

export class TerrainGenerator {
    constructor(seed, config) {
        this.seed = seed;
        this.config = config;
        this.continents = new Noise2D(seed);
        this.hills = new Noise2D(seed + 1013);
        this.temperature = new Noise2D(seed + 2131);
        this.moisture = new Noise2D(seed + 3769);
        this.caves = new Noise2D(seed + 5021);
        this.caveBranches = new Noise2D(seed + 6073);
        this.rivers = new Noise2D(seed + 7109);
    }
    index(lx, y, lz) {
        const { CHUNK_SIZE } = this.config;
        return lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
    }
    isCave(wx, y, wz) {
        const tunnel = this.caves.noise((wx + y * 0.7) * 0.045, (wz - y * 0.38) * 0.045);
        const branch = this.caveBranches.noise((wx - y * 0.42) * 0.045, (wz + y * 0.65) * 0.045);
        return Math.abs(tunnel) < 0.06 && Math.abs(branch) < 0.06;
    }
    biomeAt(wx, wz) {
        const { BIOME } = this.config;
        const temperature = this.temperature.fbm(wx * 0.002, wz * 0.002, 2);
        const moisture = this.moisture.fbm(wx * 0.0024, wz * 0.0024, 2);
        if (temperature > 0.12 && moisture < -0.05) return BIOME.DESERT;
        if (temperature < -0.14) return BIOME.ROCKY;
        if (moisture > 0.10) return BIOME.FOREST;
        return BIOME.PLAINS;
    }
    baseHeightAt(wx, wz) {
        const { WORLD_HEIGHT } = this.config;
        const c = this.continents.fbm(wx * 0.006, wz * 0.006, 4);
        const h = this.hills.fbm(wx * 0.03, wz * 0.03, 3);
        const plateau = smoothstep(0.1, 0.8, c) * 14;
        return Math.max(3, Math.min(WORLD_HEIGHT - 4, 27 + c * 9 + h * 4 + plateau));
    }
    riverStrengthAt(wx, wz) {
        const distance = Math.abs(this.rivers.noise(wx * 0.015, wz * 0.015));
        return 1 - smoothstep(0.018, 0.04, distance);
    }
    heightFrom(baseHeight, riverStrength) {
        const { WORLD_HEIGHT, WATER_LEVEL } = this.config;
        const naturalTop = Math.floor(baseHeight);
        const riverbed = Math.max(3, Math.min(naturalTop - 1, Math.max(WATER_LEVEL - 1, naturalTop - 3)));
        const height = baseHeight - (baseHeight - riverbed) * riverStrength;
        return Math.max(3, Math.min(WORLD_HEIGHT - 4, Math.floor(height)));
    }
    heightAt(wx, wz) {
        return this.heightFrom(this.baseHeightAt(wx, wz), this.riverStrengthAt(wx, wz));
    }
    createCoalVeinMask(chunk) {
        const { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL } = this.config;
        const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;
        const mask = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
        const cellXZ = 8, cellY = 7, reachXZ = 3, reachY = 2;
        const minGX = Math.floor((ox - reachXZ) / cellXZ);
        const maxGX = Math.floor((ox + CHUNK_SIZE - 1 + reachXZ) / cellXZ);
        const minGZ = Math.floor((oz - reachXZ) / cellXZ);
        const maxGZ = Math.floor((oz + CHUNK_SIZE - 1 + reachXZ) / cellXZ);
        const minGY = Math.floor(-reachY / cellY);
        const maxGY = Math.floor((WORLD_HEIGHT - 1 + reachY) / cellY);
        const localIndex = (x, y, z) => x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;

        for (let gx = minGX; gx <= maxGX; gx++) {
            for (let gz = minGZ; gz <= maxGZ; gz++) {
                for (let gy = minGY; gy <= maxGY; gy++) {
                    const cellSeed = gx * 92821 + gz * 68917 + gy * 28387;
                    const anchorSeed = this.seed + 18041;
                    const centerX = gx * cellXZ + hash2(cellSeed, gz + gy * 193, anchorSeed + 1) * cellXZ;
                    const centerY = gy * cellY + hash2(gx + gy * 317, gz + cellSeed, anchorSeed + 2) * cellY;
                    const centerZ = gz * cellXZ + hash2(gz + gy * 419, gx + cellSeed, anchorSeed + 3) * cellXZ;
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
                                if (dx * dx + dy * dy + dz * dz <= 1) mask[localIndex(x, y, z)] = 1;
                            }
                        }
                    }
                }
            }
        }
        return mask;
    }
    fill(chunk) {
        const { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, ID, BIOME } = this.config;
        const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;
        const coalVeins = this.createCoalVeinMask(chunk);
        const heights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
        const biomes = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const wx = ox + lx, wz = oz + lz;
                const baseHeight = this.baseHeightAt(wx, wz);
                const riverStrength = this.riverStrengthAt(wx, wz);
                const h = this.heightFrom(baseHeight, riverStrength);
                const column = lx + lz * CHUNK_SIZE;
                const biome = this.biomeAt(wx, wz);
                heights[column] = h;
                biomes[column] = biome;

                for (let y = 0; y <= h; y++) {
                    let type;
                    if (y === 0) type = ID.STONE;
                    else if (y === h) {
                        type = (h <= WATER_LEVEL + 1 || biome === BIOME.DESERT) ? ID.SAND :
                            (biome === BIOME.ROCKY ? ID.STONE : ID.GRASS);
                    } else if (y >= h - 3) {
                        type = (h <= WATER_LEVEL + 1 || biome === BIOME.DESERT) ? ID.SAND :
                            (biome === BIOME.ROCKY ? ID.STONE : ID.DIRT);
                    } else {
                        type = ID.STONE;
                        const ore = hash2(ox + lx + y * 31, oz + lz - y * 17, this.seed + 91);
                        if (y < 18 && ore < 0.004) type = ID.DIAMOND_ORE;
                        else if (y < 28 && ore < 0.010) type = ID.GOLD_ORE;
                        else if (y < 42 && ore < 0.025) type = ID.IRON_ORE;
                        else if (coalVeins[this.index(lx, y, lz)]) type = ID.COAL_ORE;
                        else if (y >= 28 && ore < 0.130) type = ID.COPPER_ORE;
                    }
                    if (type === ID.STONE && y >= 6 && y <= h - 4 && this.isCave(wx, y, wz)) type = 0;
                    chunk.data[this.index(lx, y, lz)] = type;
                }

                const riverWaterTop = riverStrength > 0.72 ? Math.max(WATER_LEVEL, Math.floor(baseHeight) - 2) : WATER_LEVEL;
                if (h < riverWaterTop) {
                    for (let y = h + 1; y <= riverWaterTop; y++) {
                        const isShallowChannel = riverStrength > 0.72 && riverWaterTop > WATER_LEVEL && y === riverWaterTop;
                        const channelLevel = 7;
                        const flowingWater = ID.WATER_FLOW_1 + Math.max(1, Math.min(7, Math.round(channelLevel))) - 1;
                        chunk.data[this.index(lx, y, lz)] = isShallowChannel ? flowingWater : ID.WATER;
                    }
                }

                if (h > chunk.maxY) chunk.maxY = h;
                if (riverWaterTop > chunk.maxY) chunk.maxY = riverWaterTop;
            }
        }
        this.plantTrees(chunk, heights, biomes, ox, oz);
    }
    plantTrees(chunk, heights, biomes, ox, oz) {
        const { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, ID, BIOME, TREE_CHANCE_FOREST, TREE_CHANCE_PLAINS } = this.config;
        const set = (lx, y, lz, type) => {
            if (y < 0 || y >= WORLD_HEIGHT) return;
            const i = this.index(lx, y, lz);
            if (chunk.data[i] === 0) { chunk.data[i] = type; if (y > chunk.maxY) chunk.maxY = y; }
        };
        for (let lx = 2; lx <= 13; lx++) {
            for (let lz = 2; lz <= 13; lz++) {
                const wx = ox + lx, wz = oz + lz;
                if (Math.abs(wx) < 4 && Math.abs(wz) < 4) continue;
                const column = lx + lz * CHUNK_SIZE;
                const biome = biomes[column];
                if (biome === BIOME.DESERT || biome === BIOME.ROCKY) continue;
                const treeChance = biome === BIOME.FOREST ? TREE_CHANCE_FOREST : TREE_CHANCE_PLAINS;
                if (hash2(wx, wz, this.seed) > treeChance) continue;
                const h = heights[column];
                if (h <= WATER_LEVEL + 1) continue;
                if (chunk.data[this.index(lx, h + 1, lz)] === ID.WATER) continue;
                const treeHeight = 4 + Math.floor(hash2(wx, wz, this.seed + 7) * 3);
                if (h + treeHeight + 2 >= WORLD_HEIGHT) continue;
                for (let k = 1; k <= treeHeight; k++) set(lx, h + k, lz, ID.LOG);
                for (let dy = treeHeight - 2; dy <= treeHeight + 1; dy++) {
                    const radius = dy >= treeHeight ? 1 : 2;
                    for (let dx = -radius; dx <= radius; dx++) {
                        for (let dz = -radius; dz <= radius; dz++) {
                            if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                            if (dy === treeHeight + 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
                            set(lx + dx, h + dy, lz + dz, ID.LEAVES);
                        }
                    }
                }
            }
        }
    }
}

export function findSpawn(generator, config) {
    const { WATER_LEVEL, TREE_CHANCE_FOREST } = config;
    const step = 4, maxRadius = 512;
    const minHeight = WATER_LEVEL + 2;
    const noTreeNear = (x, z) => {
        for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                if (hash2(x + dx, z + dz, generator.seed) <= TREE_CHANCE_FOREST) return false;
            }
        }
        return true;
    };

    for (let radius = 0; radius <= maxRadius; radius += step) {
        for (let dx = -radius; dx <= radius; dx += step) {
            for (let dz = -radius; dz <= radius; dz += step) {
                if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
                const height = generator.heightAt(dx, dz);
                if (height >= minHeight && noTreeNear(dx, dz)) return { x: dx + 0.5, y: height + 1, z: dz + 0.5 };
            }
        }
    }
    return { x: 0.5, y: Math.max(generator.heightAt(0, 0), WATER_LEVEL) + 1, z: 0.5 };
}
