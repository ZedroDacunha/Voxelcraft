// O panorama da tela inicial: a ilha, o lago e as árvores que giram atrás do
// título — agora montado como o mundo de verdade monta os pedaços dele.
//
// Antes o menu desenhava cada bloco como um cubo inteiro (seis faces, sempre) e
// deixava a luz do Three fazer tudo. O mundo não faz isso: ele tira as faces que
// ninguém vê, escurece o canto onde dois blocos se encostam (`ambientOcclusionAt`
// em game.js) e escreve essa sombra em cor de vértice, que o material multiplica
// pela textura. É daí que vem o relevo que dá gosto de olhar — e era exatamente
// o que faltava no menu.
//
// Aqui a mesma conta, sem Three e sem estado: entra a ilha (blocos em um Map),
// saem as arrays prontas (posições, normais, UV, cores e índices). Quem desenha
// só embrulha isso em `BufferGeometry`.
//
// Duas diferenças propositais em relação ao mundo:
//
// - **Sem luz de bloco**: o panorama é céu aberto, então a iluminação é 1 em
//   todo lugar e a sombra vira `0.58 + nível * 0.14` puro (as mesmas constantes
//   do jogo, quando o céu está no máximo);
// - **Malha única**: são ~20 mil blocos parados, nada muda entre um quadro e
//   outro. Juntar tudo em duas geometrias (opaca e recortada) é mais barato do
//   que instanciar cubo por cubo — e é o que permite a sombra por canto, que
//   malha instanciada não tem (todas as instâncias compartilham os vértices).

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
    centerZ: -3,
    radiusX: 10,
    radiusZ: 7,
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

// Ordem dos cantos idêntica à de `game.js` (FACES): posição 0/1 dentro do cubo e
// UV 0/1 dentro do tile. Trocar a ordem aqui viraria textura espelhada.
const FACES = [
    { kind: 'side', dir: [-1, 0, 0], corners: [{ pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] }, { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] }] },
    { kind: 'side', dir: [1, 0, 0], corners: [{ pos: [1, 1, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [0, 0] }, { pos: [1, 1, 0], uv: [1, 1] }, { pos: [1, 0, 0], uv: [1, 0] }] },
    { kind: 'bottom', dir: [0, -1, 0], corners: [{ pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 0], uv: [1, 1] }, { pos: [0, 0, 0], uv: [0, 1] }] },
    { kind: 'top', dir: [0, 1, 0], corners: [{ pos: [0, 1, 1], uv: [1, 1] }, { pos: [1, 1, 1], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 0] }] },
    { kind: 'side', dir: [0, 0, -1], corners: [{ pos: [1, 0, 0], uv: [0, 0] }, { pos: [0, 0, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 1] }] },
    { kind: 'side', dir: [0, 0, 1], corners: [{ pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 1, 1], uv: [0, 1] }, { pos: [1, 1, 1], uv: [1, 1] }] },
];

const variantFor = (x, y, z) => (hash2(x + y * 13, z - y * 7, 404) > 0.16 ? 0 : 1);
const keyOf = (x, y, z) => `${x},${y},${z}`;

const smoothNoise = (x, z) => Math.sin(x * 0.21) * 1.35 + Math.cos(z * 0.17) * 1.25
    + Math.sin((x + z) * 0.095) * 1.1 + Math.cos((x - z) * 0.13) * 0.65;

/**
 * A ilha do menu: chão com relevo, lago com margem de areia, lençol de terra e
 * pedra embaixo e árvores espalhadas longe do lago.
 *
 * Mesma paisagem de antes — o que mudou foi só o acabamento com que ela é
 * desenhada.
 */
export function buildMenuPanorama({ radius = MENU_PANORAMA_RADIUS } = {}) {
    const blocks = new Map();
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
            const height = isLake ? 0 : Math.max(2, Math.round(4 + smoothNoise(x, z)));
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

            const treeSeed = Math.abs(Math.sin(x * 127.1 + z * 311.7) * 43758.5453) % 1;
            if (treeSeed > 0.89 && !isLake && !isShore && Math.abs(x) + Math.abs(z) > 8) {
                const trunkHeight = 3 + Math.floor(treeSeed * 3);
                for (let y = 1; y <= trunkHeight; y++) addBlock('wood', x, height + y, z);
                const crownY = height + trunkHeight;
                for (let dy = -1; dy <= 1; dy++) {
                    const crownRadius = dy === 1 ? 1 : 2;
                    for (let dx = -crownRadius; dx <= crownRadius; dx++) {
                        for (let dz = -crownRadius; dz <= crownRadius; dz++) {
                            if (Math.abs(dx) === crownRadius && Math.abs(dz) === crownRadius && dy === 0) continue;
                            addBlock('leaves', x + dx, crownY + dy, z + dz, variantFor(x + dx, crownY + dy, z + dz));
                        }
                    }
                }
                addBlock('leaves', x, crownY + 2, z, variantFor(x, crownY + 2, z));
            }
        }
    }

    return { radius, blocks, lake: MENU_LAKE };
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

/**
 * Transforma os blocos em duas geometrias prontas para desenhar.
 *
 * `opaque` é o miolo da ilha (chão, terra, pedra, tronco); `cutout` são as
 * folhas, que precisam de `alphaTest` e de duas faces para os vãos aparecerem.
 */
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
        opaque: finishPart(parts.opaque),
        cutout: finishPart(parts.cutout),
        stats: { blocks: blocks.size, faces },
    };
}
