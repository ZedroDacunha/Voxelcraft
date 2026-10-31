import { hash2, Noise2D, smoothstep } from './world-math.js';
import { OreGenerator } from './world-ore-generation.js';
import { BlockCatalog, ID } from './world-catalog.js';

function validateGrid(grid) {
    const { width, height, depth } = grid;
    if (![width, height, depth].every(Number.isInteger) ||
        width < 0 || height < 0 || depth < 0 || typeof grid.getBlock !== 'function') {
        throw new TypeError('grid precisa de width, height, depth inteiros e getBlock(x, y, z).');
    }
    return [width, height, depth];
}

export function buildChunkGreedyGeometry(grid) {
    const dims = validateGrid(grid);
    const positions = [], normals = [], uvs = [], indices = [];
    let vertexIndex = 0;

    // A base (u, v) é escolhida para que u × v aponte para +d.
    for (let d = 0; d < 3; d++) {
        const u = (d + 1) % 3;
        const v = (d + 2) % 3;
        const maskWidth = dims[u];
        const maskHeight = dims[v];
        const mask = new Uint32Array(maskWidth * maskHeight);

        for (const sign of [-1, 1]) {
            for (let slice = 0; slice < dims[d]; slice++) {
                mask.fill(0);

                // Cria a máscara de faces visíveis para esta fatia orientada.
                for (let j = 0; j < maskHeight; j++) {
                    for (let i = 0; i < maskWidth; i++) {
                        const cell = [0, 0, 0];
                        cell[d] = slice;
                        cell[u] = i;
                        cell[v] = j;
                        const blockId = grid.getBlock(cell[0], cell[1], cell[2]);
                        if (!(blockId > 0)) continue;

                        const neighbor = [...cell];
                        neighbor[d] += sign;
                        const neighborInside = neighbor.every((coordinate, axis) =>
                            coordinate >= 0 && coordinate < dims[axis]);
                        const neighborId = neighborInside
                            ? grid.getBlock(neighbor[0], neighbor[1], neighbor[2])
                            : 0;
                        if (!BlockCatalog.isOpaque(neighborId)) mask[j * maskWidth + i] = blockId;
                    }
                }

                // Funde primeiro na largura e depois aumenta o retângulo por linhas.
                for (let j = 0; j < maskHeight; j++) {
                    for (let i = 0; i < maskWidth;) {
                        const blockId = mask[j * maskWidth + i];
                        if (blockId === 0) { i++; continue; }

                        let w = 1;
                        while (i + w < maskWidth && mask[j * maskWidth + i + w] === blockId) w++;

                        let h = 1;
                        let canGrow = true;
                        while (j + h < maskHeight && canGrow) {
                            for (let k = 0; k < w; k++) {
                                if (mask[(j + h) * maskWidth + i + k] !== blockId) {
                                    canGrow = false;
                                    break;
                                }
                            }
                            if (canGrow) h++;
                        }

                        const base = [0, 0, 0];
                        base[d] = slice + (sign > 0 ? 1 : 0);
                        base[u] = i;
                        base[v] = j;
                        const du = [0, 0, 0];
                        const dv = [0, 0, 0];
                        du[u] = w;
                        dv[v] = h;
                        const corners = [
                            base,
                            [base[0] + du[0], base[1] + du[1], base[2] + du[2]],
                            [base[0] + du[0] + dv[0], base[1] + du[1] + dv[1], base[2] + du[2] + dv[2]],
                            [base[0] + dv[0], base[1] + dv[1], base[2] + dv[2]],
                        ];
                        const faceVertex = vertexIndex;
                        for (let corner = 0; corner < 4; corner++) {
                            positions.push(...corners[corner]);
                            const normal = [0, 0, 0];
                            normal[d] = sign;
                            normals.push(...normal);
                        }
                        uvs.push(0, 0, w, 0, w, h, 0, h);

                        if (sign > 0) {
                            indices.push(faceVertex, faceVertex + 1, faceVertex + 2,
                                faceVertex, faceVertex + 2, faceVertex + 3);
                        } else {
                            indices.push(faceVertex, faceVertex + 2, faceVertex + 1,
                                faceVertex, faceVertex + 3, faceVertex + 2);
                        }
                        vertexIndex += 4;

                        for (let dy = 0; dy < h; dy++) {
                            for (let dx = 0; dx < w; dx++) mask[(j + dy) * maskWidth + i + dx] = 0;
                        }
                        i += w;
                    }
                }
            }
        }
    }

    return { positions, normals, uvs, indices };
}

export const buildChunkGeometry = buildChunkGreedyGeometry;

export function testOcclusionCulling() {
    const opacityChecks = [
        BlockCatalog.isOpaque(ID.GRASS) === true,
        BlockCatalog.isOpaque(ID.DIRT) === true,
        BlockCatalog.isOpaque(ID.STONE) === true,
        BlockCatalog.isOpaque(ID.WATER) === false,
        BlockCatalog.isOpaque(0) === false,
        BlockCatalog.isOpaque(null) === false,
        BlockCatalog.isOpaque(undefined) === false,
        BlockCatalog.isOpaque(-1) === false,
    ];
    const grid = {
        width: 3, height: 3, depth: 3,
        getBlock(x, y, z) {
            return x >= 0 && x < 3 && y >= 0 && y < 3 && z >= 0 && z < 3 ? ID.STONE : 0;
        },
    };
    const geometry = buildChunkGeometry(grid);
    const result = {
        passed: opacityChecks.every(Boolean) && geometry.positions.length / 3 === 24,
        opacityChecksPassed: opacityChecks.every(Boolean),
        vertices: geometry.positions.length / 3,
        expectedVertices: 24,
        faces: geometry.indices.length / 6,
        expectedFaces: 6,
    };
    if (!result.passed) throw new Error(`Falha em testOcclusionCulling: ${JSON.stringify(result)}`);
    return result;
}

export function testGreedyMeshing() {
    const grid = {
        width: 10, height: 1, depth: 10,
        getBlock(x, y, z) {
            return x >= 0 && x < 10 && y === 0 && z >= 0 && z < 10 ? ID.STONE : 0;
        },
    };
    const geometry = buildChunkGreedyGeometry(grid);
    let mergedFaceVertices = 0;
    for (let vertex = 0; vertex < geometry.normals.length / 3; vertex++) {
        if (geometry.normals[vertex * 3 + 1] === 1) mergedFaceVertices++;
    }
    let mergedFaceTriangles = 0;
    for (let index = 0; index < geometry.indices.length; index += 3) {
        const vertex = geometry.indices[index];
        if (geometry.normals[vertex * 3 + 1] === 1) mergedFaceTriangles++;
    }

    const uvs = [];
    for (let vertex = 0; vertex < geometry.normals.length / 3; vertex++) {
        if (geometry.normals[vertex * 3 + 1] === 1) {
            uvs.push(geometry.uvs[vertex * 2], geometry.uvs[vertex * 2 + 1]);
        }
    }
    const maxU = Math.max(...uvs.filter((_, index) => index % 2 === 0));
    const maxV = Math.max(...uvs.filter((_, index) => index % 2 === 1));
    const naiveFaceVertices = 10 * 10 * 4;
    const result = {
        passed: mergedFaceVertices === 4 && mergedFaceTriangles === 2 && maxU === 10 && maxV === 10,
        mergedFaceVertices,
        expectedMergedFaceVertices: 4,
        mergedFaceTriangles,
        expectedMergedFaceTriangles: 2,
        naiveFaceVertices,
        uvRepeat: [maxU, maxV],
        totalMeshVertices: geometry.positions.length / 3,
        totalMeshTriangles: geometry.indices.length / 3,
    };
    if (!result.passed) throw new Error(`Falha em testGreedyMeshing: ${JSON.stringify(result)}`);
    return result;
}

if (typeof window !== 'undefined') {
    window.testOcclusionCulling = testOcclusionCulling;
    window.testGreedyMeshing = testGreedyMeshing;
}

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
        const waterTops = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
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
                waterTops[column] = riverWaterTop;
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
        this.plantTrees(chunk, heights, biomes, waterTops, ox, oz);
        this.plantTallGrass(chunk, heights, biomes, ox, oz);
    }
    plantTallGrass(chunk, heights, biomes, ox, oz) {
        const { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, ID, BIOME } = this.config;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const column = lx + lz * CHUNK_SIZE;
                const y = heights[column];
                if (biomes[column] === BIOME.DESERT || biomes[column] === BIOME.ROCKY || y <= WATER_LEVEL + 1) continue;
                const plantY = y + 1;
                if (plantY >= WORLD_HEIGHT || chunk.data[this.index(lx, plantY, lz)] !== 0) continue;
                const wx = ox + lx, wz = oz + lz;
                if (hash2(wx, wz, this.seed + 901) >= 0.13) continue;
                chunk.data[this.index(lx, plantY, lz)] = ID.TALL_GRASS;
                if (plantY > chunk.maxY) chunk.maxY = plantY;
            }
        }
    }
    /**
     * Altura, bioma e "está debaixo d'água" de uma coluna em coordenadas de
     * mundo. `fill()` já calcula isso para as colunas do próprio chunk; esta
     * versão serve a margem, onde só existem as coordenadas.
     */
    columnSummary(wx, wz) {
        const { WATER_LEVEL } = this.config;
        const baseHeight = this.baseHeightAt(wx, wz);
        const riverStrength = this.riverStrengthAt(wx, wz);
        const height = this.heightFrom(baseHeight, riverStrength);
        const riverWaterTop = riverStrength > 0.72 ? Math.max(WATER_LEVEL, Math.floor(baseHeight) - 2) : WATER_LEVEL;
        return { height, biome: this.biomeAt(wx, wz), submerged: height < riverWaterTop };
    }
    /**
     * Planta árvores cujo tronco pode estar até `canopy` blocos fora do chunk.
     *
     * A decisão de cada árvore depende só de (x, z) do mundo: o hash da coluna,
     * a altura do terreno e o bioma. Por isso a árvore é idêntica não importa
     * qual chunk seja gerado primeiro, e a copa que atravessa a divisa aparece
     * completa nos dois lados — cada chunk escreve apenas as células que são
     * dele. Antes o laço ia de 2 a 13 (16 - 2 - 1) para nunca escrever fora do
     * chunk, o que deixava uma faixa de 4 blocos sem árvores em cada divisa,
     * visível como grade nas florestas.
     */
    plantTrees(chunk, heights, biomes, waterTops, ox, oz) {
        const { CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, ID, BIOME, TREE_CHANCE_FOREST, TREE_CHANCE_PLAINS } = this.config;
        const canopy = 2;
        // Maior chance entre os biomas: com ela o hash da coluna descarta ~96%
        // das posições antes de qualquer cálculo de ruído.
        const maxChance = Math.max(TREE_CHANCE_FOREST, TREE_CHANCE_PLAINS);
        const set = (lx, y, lz, type) => {
            if (y < 0 || y >= WORLD_HEIGHT) return;
            if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
            const i = this.index(lx, y, lz);
            const current = chunk.data[i];
            // Tronco vence folha — sem isso a copa de uma árvore vizinha corta o
            // tronco de outra e a árvore nasce partida. Folha só ocupa ar e nada
            // sobrescreve o terreno.
            if (type === ID.LOG) { if (current !== 0 && current !== ID.LEAVES) return; }
            else if (current !== 0) return;
            chunk.data[i] = type;
            if (y > chunk.maxY) chunk.maxY = y;
        };
        for (let lx = -canopy; lx < CHUNK_SIZE + canopy; lx++) {
            for (let lz = -canopy; lz < CHUNK_SIZE + canopy; lz++) {
                const wx = ox + lx, wz = oz + lz;
                if (Math.abs(wx) < 4 && Math.abs(wz) < 4) continue;
                const roll = hash2(wx, wz, this.seed);
                if (roll > maxChance) continue;
                const inside = lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE;
                const column = lx + lz * CHUNK_SIZE;
                let h, biome, submerged;
                if (inside) {
                    h = heights[column];
                    biome = biomes[column];
                    submerged = h < waterTops[column];
                } else {
                    const summary = this.columnSummary(wx, wz);
                    h = summary.height;
                    biome = summary.biome;
                    submerged = summary.submerged;
                }
                if (biome === BIOME.DESERT || biome === BIOME.ROCKY) continue;
                const treeChance = biome === BIOME.FOREST ? TREE_CHANCE_FOREST : TREE_CHANCE_PLAINS;
                if (roll > treeChance) continue;
                if (h <= WATER_LEVEL + 1) continue;
                if (submerged) continue;
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
