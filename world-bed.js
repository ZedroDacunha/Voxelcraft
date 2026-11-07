// A cama: um bloco de **dois voxels** (cabeceira + pés) desenhado com caixas.
//
// São três camas — uma por cor de lã (branca, cinza e preta) — e o modelo é o
// mesmo nas três: muda só a tile do colchão. O travesseiro é branco em todas.
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
import { BED_VARIANTS, BLOCKS, TILE } from './world-catalog.js';

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
// O colchão de cada cor: o par de tiles (topo e lateral) e a madeira embaixo.
// A tabela vem do catálogo (`BED_VARIANTS`), que é quem manda nas cores — aqui
// só se escolhe o jogo de tiles de quem está sendo desenhado.
const QUILT_TILES = Object.freeze(Object.fromEntries(BED_VARIANTS.map(bed => [bed.color, Object.freeze({
    top: bed.top, side: bed.side, bottom: TILE.WOOD_END,
})])));

/** As cores de cama que existem, na ordem do catálogo. */
export const BED_COLORS = Object.freeze(Object.keys(QUILT_TILES));

/** O colchão da cor pedida; cor desconhecida cai na branca. */
function quiltTiles(color) {
    return QUILT_TILES[color] ?? QUILT_TILES.white;
}
const PILLOW_TILES = Object.freeze({
    top: TILE.BED_PILLOW_TOP, side: TILE.BED_PILLOW_SIDE, bottom: TILE.BED_PILLOW_SIDE,
});

const H = BED_HEIGHTS;

/**
 * Quanto uma caixa entra na caixa de baixo, em dezesseis-avos.
 *
 * As peças da cama são **empilhadas** (pernas → travessa → colchão → aba →
 * travesseiro). Se cada uma terminasse exatamente onde a outra começa, as duas
 * teriam faces no mesmo plano — e o passe de recorte desenha os dois lados
 * (`DoubleSide`), então as faces internas brigariam pelo mesmo pixel. Era isso
 * que piscava ao girar a câmera: meia unidade de encaixe resolve sem mudar a
 * silhueta, porque a face que sobra fica **dentro** da peça de cima.
 */
const ENCAIXE = 0.5;

/**
 * Folga mínima nas faces que encostam no mundo (o pé no chão, a lateral do
 * colchão no bloco vizinho). O bloco vizinho desenha a face dele no mesmo plano
 * quando o vizinho é a cama — de novo, dois planos iguais. Três milésimos de
 * bloco é invisível a olho nu e maior que a precisão do buffer de profundidade.
 */
const FOLGA = 0.06;

/** Caixa em dezesseis-avos → caixa em 0..1, no formato que o mesher consome. */
function box(x0, y0, z0, x1, y1, z1, tiles) {
    return { min: [x0 * U, y0 * U, z0 * U], max: [x1 * U, y1 * U, z1 * U], tiles };
}

/** Aplica a folga nas faces que chegam à borda do voxel. */
function comFolga(box, extremidade) {
    const { min, max } = box;
    const f = FOLGA / 16;
    if (min[1] === 0) min[1] = f;
    if (min[0] === 0) min[0] = f;
    if (max[0] === 1) max[0] = 1 - f;
    // No comprimento, só o **fim de fora** precisa de folga: a emenda das duas
    // metades não desenha face nenhuma (é a única que o mesher descarta).
    if (extremidade === 'min' && min[2] === 0) min[2] = f;
    if (extremidade === 'max' && max[2] === 1) max[2] = 1 - f;
    return box;
}

/**
 * As caixas de **meia** cama, no espaço canônico (cabeceira para +Z).
 *
 * As quatro pernas ficam nas quinas de fora da cama inteira — duas na metade dos
 * pés, duas na da cabeceira —, então cada metade traz as suas. O colchão é uma
 * peça só: ele atravessa a emenda das duas metades sem degrau, e é por isso que
 * a beirada de dentro de cada metade vai até 16.
 *
 * As alturas e os encaixes, em dezesseis-avos:
 *
 * ```
 * pernas ......... 0 → 2,5   (entram 0,5 na travessa)
 * travessa ....... 2 → 4,5   (entra 0,5 no colchão)
 * colchão ........ 4 → 8     (vai até a borda do voxel e sobra na madeira)
 * aba do colchão . 7,5 → 9   (entra 0,5 no colchão e recua 1/16 em volta)
 * travesseiro .... 8,5 → 12  (corpo até 11 e tampa 1/16 menor até 12)
 * ```
 */
function canonicalBoxes(part, color = 'white') {
    const head = part === 'head';
    const MATTRESS_TILES = quiltTiles(color);
    const extremidade = head ? 'max' : 'min';   // o fim de fora desta metade
    // Pernas e travessa ficam 1/16 para dentro, e as pernas mais 1/2 ainda: é o
    // que as afasta do plano da travessa (duas faces no mesmo plano piscam).
    const legIn = head ? 11.5 : 1.5;
    const legOut = head ? 14.5 : 4.5;
    const frameIn = head ? 0 : 1;
    const frameOut = head ? 15 : 16;
    // A aba do colchão recua 1/16: um degrau de 1 px no topo, que é o chanfro
    // da imagem de referência. Na emenda das metades ela vai cheia, sem costura.
    const quiltIn = head ? 0 : 1;
    const quiltOut = head ? 15 : 16;
    const H2 = H;
    const caixas = [
        box(legIn, 0, legIn, legOut, H2.leg + ENCAIXE, legOut, WOOD_TILES),
        box(16 - legOut, 0, legIn, 16 - legIn, H2.leg + ENCAIXE, legOut, WOOD_TILES),
        box(1, H2.leg, frameIn, 15, H2.frame + ENCAIXE, frameOut, WOOD_TILES),
        box(0, H2.frame, 0, 16, H2.mattress, 16, MATTRESS_TILES),
        box(1, H2.mattress - ENCAIXE, quiltIn, 15, H2.quilt, quiltOut, MATTRESS_TILES),
        // Travesseiro em duas caixas: o corpo e uma tampa 1/16 menor em volta,
        // que é o chanfro que faz a peça ler como travesseiro fofo e não como
        // um segundo colchãozinho branco.
        ...(head ? [
            // O travesseiro para 1/2 antes da beirada da aba: encostado nela as
            // duas faces caíam no mesmo plano (o mesmo pisca-pisca das pilhas).
            box(1.5, H2.quilt - ENCAIXE, 8.5, 14.5, H2.pillow - 1, 14.5, PILLOW_TILES),
            box(2.5, H2.pillow - 1 - ENCAIXE, 9, 13.5, H2.pillow, 14, PILLOW_TILES),
        ] : []),
    ];
    return enterrarFaces(caixas.map(caixa => comFolga(caixa, extremidade)));
}

/**
 * Tira as faces que ficaram **dentro** de outra caixa.
 *
 * O encaixe das peças deixa a face de baixo de uma dentro da peça de baixo (é o
 * que evita o pisca-pisca). Essas faces nunca aparecem — mas continuam sendo
 * desenhadas, e uma face vista por dentro é preta. Tirando-as, o que sobra é só
 * o que o jogador pode ver: menos triângulo e nenhuma chance de "buraco preto"
 * no travesseiro.
 *
 * Só topo e fundo: as quatro laterais compartilham a mesma tile.
 */
function enterrarFaces(caixas) {
    for (const caixa of caixas) {
        for (const kind of ['top', 'bottom']) {
            const plano = kind === 'top' ? caixa.max[1] : caixa.min[1];
            const dentro = caixas.some(outra => outra !== caixa
                && outra.min[1] < plano - 1e-6 && outra.max[1] > plano + 1e-6
                && outra.min[0] <= caixa.min[0] + 1e-6 && outra.max[0] >= caixa.max[0] - 1e-6
                && outra.min[2] <= caixa.min[2] + 1e-6 && outra.max[2] >= caixa.max[2] - 1e-6);
            if (dentro) caixa.tiles = { ...caixa.tiles, [kind]: null };
        }
    }
    return caixas;
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
export function bedShapes(part, facing = 'south', color = 'white') {
    return canonicalBoxes(part, color).map(({ min, max, tiles }) => {
        const [ax, az] = rotate(min[0], min[2], facing);
        const [bx, bz] = rotate(max[0], max[2], facing);
        return {
            min: [Math.min(ax, bx), min[1], Math.min(az, bz)],
            max: [Math.max(ax, bx), max[1], Math.max(az, bz)],
            tiles,
        };
    });
}

/**
 * `'head'`, `'foot'` ou `null` para o tipo de bloco.
 *
 * A resposta vem do próprio catálogo (`BLOCKS[tipo].bed`), que é onde as três
 * cores foram declaradas: acrescentar uma quarta cama é acrescentar uma linha em
 * `BED_VARIANTS`, sem tocar aqui.
 */
export function bedPart(type) {
    return BLOCKS[type]?.bed?.part ?? null;
}

/** `'white'`, `'gray'`, `'black'` — ou `null` se o bloco não é cama. */
export function bedColor(type) {
    return BLOCKS[type]?.bed?.color ?? null;
}

/** O bloco é uma cama (qualquer metade, qualquer cor)? */
export function isBedBlock(type) {
    return bedPart(type) !== null;
}

/** A metade dos pés? É ela que o item coloca primeiro e que guarda o save. */
export function isBedFoot(type) {
    return bedPart(type) === 'foot';
}

/** O par de um tipo: dado os pés (ou a cabeceira), devolve o outro. */
export function bedTypeForPart(part, color = 'white') {
    const bed = BED_VARIANTS.find(variante => variante.color === color) ?? BED_VARIANTS[0];
    return part === 'head' ? bed.head : bed.foot;
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
export function bedModelBoxes(color = 'white') {
    return [
        ...canonicalBoxes('foot', color),
        ...canonicalBoxes('head', color).map(({ min, max, tiles }) => ({
            min: [min[0], min[1], min[2] + 1],
            max: [max[0], max[1], max[2] + 1],
            tiles,
        })),
    ];
}
