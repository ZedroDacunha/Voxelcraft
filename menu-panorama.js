import { FACES } from './world-faces.js';
import { TreeShapes } from './world-tree-shapes.js';
import { ATLAS_UV_PAD_PX, BLOCKS, ID, TILE, atlasUV } from './world-catalog.js';
import { hash2 } from './world-math.js';
import { tileForBlockFace } from './world-block-orientation.js';

/** Meia-largura da ilha, em blocos (é quadrada: de -raio a +raio). */
export const MENU_PANORAMA_RADIUS = 24;

/** Sombra do canto mais fechado — o mesmo `0.58` de `game.js`. */
export const MENU_SHADE_BASE = 0.58;
/** Quanto cada nível de oclusão clareia — o mesmo `0.14` de `game.js`. */
export const MENU_SHADE_STEP = 0.14;

/**
 * O lago: uma elipse no plano x/z. Até `fill` (raio ao quadrado) é água; de
 * `fill` a `shore`, margem de areia. `surfaceY` é a lâmina d'água.
 */
export const MENU_LAKE = Object.freeze({
    centerX: 3,
    centerZ: -5,
    radiusX: 13,
    radiusZ: 9,
    fill: 0.78,
    shore: 1.03,
    surfaceY: 2.42,
});

const KINDS = Object.freeze({
    grass: BLOCKS[ID.GRASS],
    dirt: BLOCKS[ID.DIRT],
    stone: BLOCKS[ID.STONE],
    sand: BLOCKS[ID.SAND],
    wood: BLOCKS[ID.LOG],
    leaves: BLOCKS[ID.LEAVES],
});

// Mesmas variantes de textura do mundo (o segundo conjunto de tiles do atlas):
// sem elas, chão e pedra ficam com cara de papel de parede.
const ALT_TILES = new Map([
    [TILE.GRASS_TOP, TILE.GRASS_TOP_ALT],
    [TILE.GRASS_SIDE, TILE.GRASS_SIDE_ALT],
    [TILE.DIRT, TILE.DIRT_ALT],
    [TILE.STONE, TILE.STONE_ALT],
    [TILE.LEAVES, TILE.LEAVES_ALT],
]);

const variantFor = (x, y, z) => (hash2(x + y * 13, z - y * 7, 404) > 0.16 ? 0 : 1);
const keyOf = (x, y, z) => `${x},${y},${z}`;

const smoothNoise = (x, z) => Math.sin(x * 0.21) * 1.35 + Math.cos(z * 0.17) * 1.25
    + Math.sin((x + z) * 0.095) * 1.1 + Math.cos((x - z) * 0.13) * 0.65;

export function buildMenuPanorama({ radius = MENU_PANORAMA_RADIUS } = {}) {
    const blocks = new Map();
    const heights = new Map();
    const waterDepths = new Map();
    const addBlock = (kind, x, y, z, variant = 0) => {
        blocks.set(keyOf(x, y, z), { kind, variant });
    };

    for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
            const lakeX = (x - MENU_LAKE.centerX) / MENU_LAKE.radiusX;
            const lakeZ = (z - MENU_LAKE.centerZ) / MENU_LAKE.radiusZ;
            const lakeDistance = lakeX * lakeX + lakeZ * lakeZ;
            const isLake = lakeDistance < MENU_LAKE.fill;
            const isShore = lakeDistance >= MENU_LAKE.fill && lakeDistance < MENU_LAKE.shore;
            const terrainHeight = Math.max(2, Math.round(4 + smoothNoise(x, z)));
            const height = isLake ? Math.floor(2 * lakeDistance / MENU_LAKE.fill)
                : Math.min(terrainHeight, 2 + Math.floor(2 * Math.max(0, lakeDistance - MENU_LAKE.shore)));
            heights.set(`${x},${z}`, height);
            if (isLake) waterDepths.set(`${x},${z}`, MENU_LAKE.surfaceY - (height + 0.5));
            const sandyColumn = isLake || isShore;
            addBlock(sandyColumn ? 'sand' : 'grass', x, height, z,
                sandyColumn ? 0 : variantFor(x, height, z));
            for (let depth = 1; depth <= 3; depth++) {
                const layerY = height - depth;
                if (layerY < 0) break;
                addBlock(sandyColumn ? 'sand' : 'dirt', x, layerY, z, variantFor(x, layerY, z));
            }
            for (let layerY = height - 4; layerY >= 0; layerY--) {
                addBlock('stone', x, layerY, z, variantFor(x, layerY, z));
            }

        }
    }

    // O bosque enquadra o lago. A margem voltada para a câmera fica aberta.
    const trees = new TreeShapes(ID);
    const seed = 42;
    const limit = radius - TreeShapes.radius;
    for (let gx = -limit; gx <= limit; gx += 9) {
        for (let gz = -limit; gz <= limit; gz += 9) {
            const x = gx + Math.floor(hash2(gx, gz, seed) * 3) - 1;
            const z = gz + Math.floor(hash2(gx, gz, seed + 1) * 3) - 1;
            const ground = heights.get(`${x},${z}`);
            if (blocks.get(keyOf(x, ground, z))?.kind !== 'grass') continue;
            if (x < MENU_LAKE.centerX && Math.abs(z - MENU_LAKE.centerZ - 0.3 * (x - MENU_LAKE.centerX)) < 10) continue;
            for (const [dx, dy, dz, id] of trees.at(x, z, seed, true).cells) {
                const bx = x + dx, by = ground + dy, bz = z + dz;
                if (dy === 1 && heights.get(`${bx},${bz}`) !== ground) continue;
                const prior = blocks.get(keyOf(bx, by, bz));
                if (prior && (prior.kind !== 'leaves' || id !== ID.LOG)) continue;
                const kind = id === ID.LOG ? 'wood' : 'leaves';
                addBlock(kind, bx, by, bz, variantFor(bx, by, bz));
            }
        }
    }
    return { radius, blocks, lake: MENU_LAKE, waterDepths };
}

const renderOf = entry => (entry ? KINDS[entry.kind].render : null);

/**
 * Peso de oclusão de um vizinho — a mesma escala do jogo: bloco cheio fecha o
 * canto inteiro, folha (recortada) fecha um terço e água/ar não fecham nada.
 */
const occlusionWeight = entry => {
    const render = renderOf(entry);
    if (!entry || render === 'liquid' || render === 'torch') return 0;
    return render === 'cutout' || render === 'door' ? 0.35 : 1;
};

/**
 * Sombra de um canto de face: 3 vizinhos (dois lados e a quina) encostados
 * escurecem; nenhum, deixa o bloco com toda a luz do céu.
 *
 * Mesma matemática de `ambientOcclusionAt` (game.js), só que aqui não há luz de
 * tocha nem céu por bloco: o panorama é céu aberto do começo ao fim.
 */
export function cornerShade(at, x, y, z, face, corner) {
    let axisA;
    let axisB;
    if (face.dir[0] !== 0) { axisA = 1; axisB = 2; }
    else if (face.dir[1] !== 0) { axisA = 0; axisB = 2; }
    else { axisA = 0; axisB = 1; }
    const signA = corner.pos[axisA] === 0 ? -1 : 1;
    const signB = corner.pos[axisB] === 0 ? -1 : 1;
    const baseX = x + face.dir[0];
    const baseY = y + face.dir[1];
    const baseZ = z + face.dir[2];
    const offsetA = [0, 0, 0];
    const offsetB = [0, 0, 0];
    offsetA[axisA] = signA;
    offsetB[axisB] = signB;
    const sideA = occlusionWeight(at(baseX + offsetA[0], baseY + offsetA[1], baseZ + offsetA[2]));
    const sideB = occlusionWeight(at(baseX + offsetB[0], baseY + offsetB[1], baseZ + offsetB[2]));
    const cornerEntry = occlusionWeight(at(
        baseX + offsetA[0] + offsetB[0],
        baseY + offsetA[1] + offsetB[1],
        baseZ + offsetA[2] + offsetB[2],
    ));
    const level = sideA === 1 && sideB === 1 ? 0 : Math.max(0, 3 - sideA - sideB - cornerEntry);
    // `0.58 + 3 * 0.14` não dá exatamente 1 em ponto flutuante: o teto é 1.
    return Math.min(1, MENU_SHADE_BASE + level * MENU_SHADE_STEP);
}

const emptyPart = () => ({ positions: [], normals: [], uvs: [], colors: [], indices: [] });

const finishPart = part => ({
    positions: Float32Array.from(part.positions),
    normals: Float32Array.from(part.normals),
    uvs: Float32Array.from(part.uvs),
    colors: Float32Array.from(part.colors),
    indices: Uint32Array.from(part.indices),
    get faces() { return this.indices.length / 6; },
    get vertices() { return this.positions.length / 3; },
});

// Os quatro blocos que tocam cada canto compartilham a mesma profundidade
// interpolada. Na margem, os blocos secos contribuem com profundidade zero.
function lakeGeometry({ waterDepths, lake }) {
    const part = emptyPart();
    if (!waterDepths) return finishPart(part);
    const top = FACES.find(face => face.kind === 'top');
    const depthAt = (x, z) => waterDepths.get(`${x},${z}`) ?? 0;
    for (const key of waterDepths.keys()) {
        const [x, z] = key.split(',').map(Number);
        const start = part.positions.length / 3;
        for (const { pos } of top.corners) {
            const cx = x + pos[0], cz = z + pos[2];
            const depth = (depthAt(cx, cz) + depthAt(cx - 1, cz)
                + depthAt(cx, cz - 1) + depthAt(cx - 1, cz - 1)) / 4;
            part.positions.push(cx - 0.5, lake.surfaceY, cz - 0.5);
            part.normals.push(0, 1, 0);
            part.uvs.push(depth, 1);
            part.colors.push(1, 1, 1);
        }
        part.indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
    }
    return finishPart(part);
}

export function panoramaGeometry(panorama) {
    const { blocks } = panorama;
    const at = (x, y, z) => blocks.get(keyOf(x, y, z)) ?? null;
    const parts = { opaque: emptyPart(), cutout: emptyPart() };
    let faces = 0;

    for (const [key, entry] of blocks) {
        const [x, y, z] = key.split(',').map(Number);
        const block = KINDS[entry.kind];
        const part = block.render === 'cutout' ? parts.cutout : parts.opaque;
        for (const face of FACES) {
            const neighbor = at(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
            // Face encostada em bloco cheio não aparece para ninguém: fora.
            if (neighbor && renderOf(neighbor) === 'opaque') continue;
            const baseTile = tileForBlockFace(block.tiles, face.kind, face.dir);
            const tile = entry.variant ? (ALT_TILES.get(baseTile) ?? baseTile) : baseTile;
            const { u0, v0, uWidth, vHeight } = atlasUV(tile, ATLAS_UV_PAD_PX);
            const start = part.positions.length / 3;
            for (const corner of face.corners) {
                part.positions.push(
                    x - 0.5 + corner.pos[0],
                    y - 0.5 + corner.pos[1],
                    z - 0.5 + corner.pos[2],
                );
                part.normals.push(face.dir[0], face.dir[1], face.dir[2]);
                part.uvs.push(u0 + corner.uv[0] * uWidth, v0 + corner.uv[1] * vHeight);
                const shade = cornerShade(at, x, y, z, face, corner);
                part.colors.push(shade, shade, shade);
            }
            part.indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
            faces++;
        }
    }

    return {
        water: lakeGeometry(panorama),
        opaque: finishPart(parts.opaque),
        cutout: finishPart(parts.cutout),
        stats: { blocks: blocks.size, faces },
    };
}
