import test from 'node:test';
import assert from 'node:assert/strict';

import { TerrainGenerator } from '../world-terrain.js';
import { ID } from '../world-catalog.js';
import { hash2 } from '../world-math.js';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../world-save-settings.js';

// Configuração mínima do gerador (a mesma forma usada pelo jogo).
const WATER_LEVEL = 26;
const BIOME = Object.freeze({ PLAINS: 0, FOREST: 1, DESERT: 2, ROCKY: 3 });
const TREE_CHANCE_FOREST = 0.035;
const TREE_CHANCE_PLAINS = 0.008;
const CONFIG = Object.freeze({
    CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, ID, BIOME, TREE_CHANCE_FOREST, TREE_CHANCE_PLAINS,
});

const SEED = 12345;
const RADIUS = 3; // 7x7 chunks = 112x112 blocos de mundo
const MIN = -RADIUS * CHUNK_SIZE;
const MAX = (RADIUS + 1) * CHUNK_SIZE - 1;

function newChunk(cx, cz) {
    return { cx, cz, data: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT), maxY: 0 };
}

// Gera a região uma vez só: os testes abaixo olham o mesmo mundo.
const generator = new TerrainGenerator(SEED, CONFIG);
const blocks = new Map();
for (let cx = -RADIUS; cx <= RADIUS; cx++) {
    for (let cz = -RADIUS; cz <= RADIUS; cz++) {
        const chunk = newChunk(cx, cz);
        generator.fill(chunk);
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                for (let y = 0; y < WORLD_HEIGHT; y++) {
                    const type = chunk.data[generator.index(lx, y, lz)];
                    if (type) blocks.set(`${cx * CHUNK_SIZE + lx},${y},${cz * CHUNK_SIZE + lz}`, type);
                }
            }
        }
    }
}

const blockAt = (x, y, z) => blocks.get(`${x},${y},${z}`) || 0;

/**
 * Reproduz a decisão do gerador para cada coluna do mundo: a árvore existe ou
 * não depende só de (x, z), nunca do chunk que a desenha. Serve de oráculo
 * independente para os testes.
 */
function treesInRegion() {
    const trees = [];
    for (let wx = MIN; wx <= MAX; wx++) {
        for (let wz = MIN; wz <= MAX; wz++) {
            if (Math.abs(wx) < 4 && Math.abs(wz) < 4) continue; // área livre do spawn
            const biome = generator.biomeAt(wx, wz);
            if (biome === BIOME.DESERT || biome === BIOME.ROCKY) continue;
            const chance = biome === BIOME.FOREST ? TREE_CHANCE_FOREST : TREE_CHANCE_PLAINS;
            if (hash2(wx, wz, SEED) > chance) continue;
            const column = generator.columnSummary(wx, wz);
            if (column.height <= WATER_LEVEL + 1 || column.submerged) continue;
            const height = 4 + Math.floor(hash2(wx, wz, SEED + 7) * 3);
            if (column.height + height + 2 >= WORLD_HEIGHT) continue;
            trees.push({ wx, wz, ground: column.height, height });
        }
    }
    return trees;
}

const trees = treesInRegion();

test('a região de teste tem árvores suficientes para o cenário ser real', () => {
    assert.ok(trees.length > 60, `poucas árvores no cenário: ${trees.length}`);
});

test('nenhuma copa é cortada na divisa do chunk', () => {
    // Antes da correção, o gerador só plantava entre lx/lz 2..13 e descartava
    // tudo que caía fora do chunk: ~2.500 células de copa viravam ar.
    const cortadas = [];
    for (const tree of trees) {
        for (let dy = tree.height - 2; dy <= tree.height + 1; dy++) {
            const radius = dy >= tree.height ? 1 : 2;
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                    if (dy === tree.height + 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
                    const x = tree.wx + dx, z = tree.wz + dz, y = tree.ground + dy;
                    // só células cujo chunk está na região gerada
                    if (x < MIN || x > MAX || z < MIN || z > MAX) continue;
                    if (blockAt(x, y, z) === 0) cortadas.push(`${x},${y},${z}`);
                }
            }
        }
    }
    assert.deepEqual(cortadas.slice(0, 10), [], `células de copa em ar: ${cortadas.length}`);
});

test('toda célula de tronco é madeira', () => {
    const furos = [];
    for (const tree of trees) {
        for (let k = 1; k <= tree.height; k++) {
            const y = tree.ground + k;
            if (blockAt(tree.wx, y, tree.wz) !== ID.LOG) furos.push(`${tree.wx},${y},${tree.wz}`);
        }
    }
    assert.deepEqual(furos.slice(0, 10), [], `troncos incompletos: ${furos.length}`);
});

test('troncos ocupam todas as colunas locais, inclusive a faixa de borda', () => {
    const perColumn = new Array(CHUNK_SIZE).fill(0);
    let border = 0;
    for (const tree of trees) {
        const lx = ((tree.wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((tree.wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        perColumn[lx]++;
        perColumn[lz]++;
        if (lx <= 1 || lx >= CHUNK_SIZE - 2 || lz <= 1 || lz >= CHUNK_SIZE - 2) border++;
    }
    assert.ok(border > 0, 'nenhuma árvore na faixa de borda dos chunks');
    const vazias = perColumn.map((n, i) => (n ? null : i)).filter(i => i !== null);
    assert.deepEqual(vazias, [], `colunas locais sem nenhuma árvore: ${vazias.join(', ')}`);
});

test('tronco não nasce em coluna alagada', () => {
    const naAgua = trees.filter(tree => blockAt(tree.wx, tree.ground + 1, tree.wz) !== ID.LOG);
    assert.deepEqual(naAgua.slice(0, 5), []);
});

test('a ordem de geração não altera o chunk', () => {
    const first = new TerrainGenerator(SEED, CONFIG);
    const solo = newChunk(2, 2);
    first.fill(solo);

    const after = new TerrainGenerator(SEED, CONFIG);
    for (const [cx, cz] of [[1, 2], [3, 2], [2, 1], [2, 3], [2, 2]]) after.fill(newChunk(cx, cz));
    const depois = newChunk(2, 2);
    after.fill(depois);

    assert.deepEqual(Array.from(depois.data), Array.from(solo.data));
    assert.equal(depois.maxY, solo.maxY);
});
