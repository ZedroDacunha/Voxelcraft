import { hash2, Noise2D, smoothstep } from './world-math.js';
import { OreGenerator } from './world-ore-generation.js';

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
        this.oreGenerator = new OreGenerator(seed, config);
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
    fill(chunk) {
        const { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, ID, BIOME } = this.config;
        const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;
        const coalVeins = this.oreGenerator.createCoalVeinMask(chunk);
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
                        const oreType = this.oreGenerator.getOreType(wx, y, wz, coalVeins[this.index(lx, y, lz)]);
                        if (oreType !== null) type = oreType;
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
