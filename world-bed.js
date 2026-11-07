// A cama: um bloco de **dois voxels** (cabeceira + pés) desenhado com caixas.
//
// O mesher só sabia desenhar duas formas não cúbicas — a tocha (uma caixa) e a
// porta (uma caixa fina) — e cada uma usava **uma** tile por tipo de face. A
// cama precisa de mais: pernas e moldura de madeira, colchão vermelho e
// travesseiro branco, cada um com o seu material e a sua altura. Por isso o
// modelo mora aqui, em caixas puras (sem THREE), e o mesher só transforma as
// caixas em triângulos.
//
// As medidas estão em dezesseis-avos de bloco, como o desenho original: 0 é o
// chão e 16 é o topo do voxel. O eixo do comprimento é o **Z local**, com a
// cabeceira para o +Z; `facing` gira esse eixo para as quatro direções.
import { ID, TILE } from './world-catalog.js';

/** Um dezesseis-avos de bloco — a unidade em que o modelo é escrito. */
const U = 1 / 16;

// Alturas que definem o perfil da cama. O topo do colchão em 9/16 é o mesmo
// número da cama original: é a altura em que ela vai colidir com o jogador.
export const BED_HEIGHTS = Object.freeze({
    leg: 2,          // pernas de madeira
    frame: 4,        // travessa que sustenta o colchão
    mattress: 8,     // corpo do colchão
    quilt: 9,        // aba do colchão: recua 1/16 e fecha o topo em 9/16
    pillow: 12,      // topo do travesseiro
});

// A estrutura é de carvalho claro — a mesma tábua das construções —, e não a
// madeira escura do tronco: é o que separa a cama do chão sem virar um móvel
// pesado.
const WOOD_TILES = Object.freeze({ top: TILE.PLANKS, side: TILE.PLANKS, bottom: TILE.PLANKS });
const MATTRESS_TILES = Object.freeze({ top: TILE.BED_TOP, side: TILE.BED_SIDE, bottom: TILE.WOOD_END });
const PILLOW_TILES = Object.freeze({
    top: TILE.BED_PILLOW_TOP, side: TILE.BED_PILLOW_SIDE, bottom: TILE.BED_PILLOW_SIDE,
});

const H = BED_HEIGHTS;

/** Caixa em dezesseis-avos → caixa em 0..1, no formato que o mesher consome. */
function box(x0, y0, z0, x1, y1, z1, tiles) {
    return { min: [x0 * U, y0 * U, z0 * U], max: [x1 * U, y1 * U, z1 * U], tiles };
}

/**
 * As caixas de **meia** cama, no espaço canônico (cabeceira para +Z).
 *
 * As quatro pernas ficam nas quinas de fora da cama inteira — duas na metade dos
 * pés, duas na da cabeceira —, então cada metade traz as suas. O colchão é uma
 * peça só: ele atravessa a emenda das duas metades sem degrau, e é por isso que
 * a beirada de dentro de cada metade vai até 16.
 */
function canonicalBoxes(part) {
    const head = part === 'head';
    // Pernas e travessa ficam 1/16 para dentro; o colchão vai até a borda do
    // voxel e **sobra** sobre a estrutura. É essa beirada vermelha por cima da
    // madeira que dá o volume da cama — sem ela o colchão parece uma caixa
    // apoiada numa tábua.
    const outer = head ? 12 : 1;      // onde ficam as pernas desta metade
    const outerEnd = head ? 15 : 4;
    // A aba do colchão recua 1/16: um degrau de 1 px no topo, que é o chanfro
    // da imagem de referência. Na emenda das metades ela vai cheia, sem costura.
    const quiltIn = head ? 0 : 1;
    const quiltOut = head ? 15 : 16;
    return [
        box(1, 0, outer, 4, H.leg, outerEnd, WOOD_TILES),
        box(12, 0, outer, 15, H.leg, outerEnd, WOOD_TILES),
        box(1, H.leg, 1, 15, H.frame, 15, WOOD_TILES),
        box(0, H.frame, 0, 16, H.mattress, 16, MATTRESS_TILES),
        box(1, H.mattress, quiltIn, 15, H.quilt, quiltOut, MATTRESS_TILES),
        // Travesseiro em duas caixas: o corpo e uma tampa 1/16 menor em volta,
        // que é o chanfro que faz a peça ler como travesseiro fofo e não como
        // um segundo colchãozinho branco.
        ...(head ? [
            box(2, H.quilt, 10, 14, H.pillow - 1, 15, PILLOW_TILES),
            box(3, H.pillow - 1, 11, 13, H.pillow, 14, PILLOW_TILES),
        ] : []),
    ];
}

const FACING_VECTORS = Object.freeze({
    east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1],
});

export function bedFacingVector(facing) {
    return FACING_VECTORS[facing] ?? FACING_VECTORS.south;
}

/** Gira um ponto do espaço local (0..1) para a direção `facing`. */
function rotate(x, z, facing) {
    switch (facing) {
        case 'east': return [z, 1 - x];
        case 'west': return [1 - z, x];
        case 'north': return [1 - x, 1 - z];
        default: return [x, z];
    }
}

/**
 * As caixas de uma metade já giradas, prontas para o mesher.
 *
 * Cada caixa carrega as tiles de topo, lateral e fundo — mais de um material por
 * peça, que é a diferença em relação à tocha e à porta.
 */
export function bedShapes(part, facing = 'south') {
    return canonicalBoxes(part).map(({ min, max, tiles }) => {
        const [ax, az] = rotate(min[0], min[2], facing);
        const [bx, bz] = rotate(max[0], max[2], facing);
        return {
            min: [Math.min(ax, bx), min[1], Math.min(az, bz)],
            max: [Math.max(ax, bx), max[1], Math.max(az, bz)],
            tiles,
        };
    });
}

/** `'head'`, `'foot'` ou `null` para o tipo de bloco. */
export function bedPart(type) {
    if (type === ID.BED_HEAD) return 'head';
    if (type === ID.BED_FOOT) return 'foot';
    return null;
}

export function bedTypeForPart(part) {
    return part === 'head' ? ID.BED_HEAD : ID.BED_FOOT;
}

/** O bloco é uma cama (qualquer das duas metades)? */
export function isBedBlock(type) {
    return bedPart(type) !== null;
}

/**
 * A célula da outra metade, dada uma metade e a direção em que a cama cresce
 * (do pé para a cabeceira). Sai daqui a remoção em par: quebrar uma metade
 * derruba a outra e devolve **uma** cama.
 */
export function bedOtherCell(x, z, part, facing) {
    const [dx, dz] = bedFacingVector(facing);
    const sign = part === 'head' ? -1 : 1;
    return { x: x + dx * sign, z: z + dz * sign };
}

/** As duas células da cama, com o pé em `(x, z)` e a cabeceira na direção dele. */
export function bedCells(x, z, facing) {
    const [dx, dz] = bedFacingVector(facing);
    return {
        foot: { x, z },
        head: { x: x + dx, z: z + dz },
    };
}

/**
 * Caixa de colisão da cama: o voxel inteiro no plano, mas só até 9/16 de altura.
 * Sem isso o jogador anda por dentro dela ou fica flutuando em cima do ar.
 */
export const BED_COLLISION_HEIGHT = BED_HEIGHTS.quilt * U;

export function bedCollisionBox() {
    return { minX: 0, maxX: 1, minZ: 0, maxZ: 1, maxY: BED_COLLISION_HEIGHT };
}

/**
 * A cama inteira, com a cabeceira deslocada para +1 em Z — o modelo que o ícone
 * do inventário e a página de comparação desenham. As caixas voltam no espaço
 * canônico (comprimento em Z, de 0 a 2).
 */
export function bedModelBoxes() {
    return [
        ...canonicalBoxes('foot'),
        ...canonicalBoxes('head').map(({ min, max, tiles }) => ({
            min: [min[0], min[1], min[2] + 1],
            max: [max[0], max[1], max[2] + 1],
            tiles,
        })),
    ];
}
