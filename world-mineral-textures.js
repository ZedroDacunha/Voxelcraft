import { TILE } from './world-catalog.js';
import { hash2 } from './world-math.js';

const ITEM_PALETTES = Object.freeze({
    ingot: Object.freeze({
        iron: { light: [218, 225, 226], mid: [159, 173, 178], dark: [100, 116, 122] },
        gold: { light: [240, 202, 68], mid: [184, 138, 38], dark: [112, 79, 23] },
        copper: { light: [232, 151, 104], mid: [184, 100, 66], dark: [107, 57, 41] },
    }),
    raw: Object.freeze({
        copper: [[236, 153, 103], [181, 96, 62], [105, 55, 41]],
        iron: [[226, 215, 195], [169, 142, 111], [105, 89, 77]],
        gold: [[255, 224, 103], [205, 157, 46], [122, 86, 28]],
    }),
});

const GEM_COLORS = Object.freeze({ light: [157, 250, 235], mid: [53, 204, 194], dark: [25, 119, 144] });
const ORE_COLORS = Object.freeze({
    [TILE.COAL_ORE]: [[35, 35, 40], [52, 52, 58], [70, 70, 76]],
    [TILE.IRON_ORE]: [[151, 105, 78], [183, 132, 96], [211, 160, 120]],
    [TILE.GOLD_ORE]: [[193, 139, 24], [231, 181, 35], [250, 215, 74]],
    [TILE.DIAMOND_ORE]: [[30, 151, 157], [48, 194, 190], [102, 229, 216]],
    [TILE.COPPER_ORE]: [[139, 75, 48], [189, 103, 65], [219, 140, 93]],
});
const ORE_CENTERS = [[7, 7], [22, 6], [15, 18], [26, 25], [5, 26]];

/**
 * Os dois carvões em **arte de item** (16×16 px: cada célula da máscara é um pixel).
 *
 * Opção **E · punhado**: três pedaços. O mineral é pedra — preto frio, cinza-azulado
 * nas beiradas; o vegetal é madeira queimada — marrom-preto, fosco, com falhas de
 * grão. Cor **e** forma diferentes: os dois não se confundem na barra de itens,
 * que era o problema da arte antiga (as duas eram um amontoado chapado).
 */
const CARVAO_ITEM = Object.freeze({
    mineral: Object.freeze({
        paleta: Object.freeze({
            escuro: [16, 16, 24],
            corpo: [40, 40, 48],
            meio: [56, 56, 64],
            claro: [96, 96, 112],
        }),
        mascara: Object.freeze([
            '................',
            '......####......',
            '.....######.....',
            '.....######.....',
            '......####......',
            '................',
            '..####....####..',
            '.######..######.',
            '.######..######.',
            '..####....####..',
            '................',
            '.....######.....',
            '....########....',
            '....########....',
            '.....######.....',
            '................',
        ]),
        grao: false,
    }),
    vegetal: Object.freeze({
        paleta: Object.freeze({
            escuro: [24, 24, 16],
            corpo: [56, 48, 40],
            meio: [72, 56, 48],
            claro: [104, 88, 72],
        }),
        mascara: Object.freeze([
            '................',
            '....####........',
            '...######.......',
            '...######.......',
            '....####........',
            '................',
            '.........#####..',
            '........######..',
            '........######..',
            '.........#####..',
            '................',
            '.....###........',
            '....#####.......',
            '....#####.......',
            '.....###........',
            '................',
        ]),
        grao: true,
    }),
});

/** Relevo de item: beirada de cima/esquerda clara, de baixo/direita escura. */
function pintarItem(mascara, paleta, grao) {
    const dentro = (x, y) => (mascara[y]?.[x] ?? '.') === '#';
    return (x, y) => {
        if (!dentro(x, y)) return null;
        const cima = dentro(x, y - 1), esq = dentro(x - 1, y);
        const baixo = dentro(x, y + 1), dir = dentro(x + 1, y);
        if (!cima || !esq) return paleta.claro;
        if (!baixo || !dir) return paleta.escuro;
        const n = hash2(x, y, 4242);
        let cor = n > 0.55 ? paleta.meio : paleta.corpo;
        // Madeira queimada: riscos curtos no meio do pedaço (o mineral não tem).
        if (grao && hash2(Math.floor(x / 4), Math.floor(y / 2), 9091) > 0.74) cor = paleta.escuro;
        return cor;
    };
}

/** O sprite do item de carvão: `camada` é `'mineral'` ou `'vegetal'`. */
export function createCoalItemSpritePixels(camada = 'mineral') {
    const arte = CARVAO_ITEM[camada];
    if (!arte) return null;
    const pintar = pintarItem(arte.mascara, arte.paleta, arte.grao);
    return Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => pintar(x, y)));
}

/** A máscara da arte de item do carvão (para o teste conferir), ou `null`. */
export function coalItemMaskFor(camada = 'mineral') {
    return CARVAO_ITEM[camada]?.mascara ?? null;
}

export function createMineralSpritePixels(kind, material) {
    if (!['ingot', 'gem', 'raw', 'coal'].includes(kind)) return null;

    const pixels = Array.from({ length: 16 }, () => Array(16).fill(null));
    const put = (x, y, color) => {
        if (x >= 0 && x < 16 && y >= 0 && y < 16) pixels[y][x] = color;
    };

    if (kind === 'ingot') {
        const palettes = ITEM_PALETTES.ingot;
        const colors = palettes[material] || palettes.iron;
        for (let y = 4; y <= 11; y++) {
            for (let x = 3; x <= 12; x++) {
                const edge = x === 3 || x === 12 || y === 4 || y === 11;
                put(x, y, edge ? colors.dark : (y <= 6 ? colors.light : colors.mid));
            }
        }
        put(4, 5, colors.light); put(5, 5, colors.light); put(6, 5, colors.light);
        return pixels;
    }

    if (kind === 'gem') {
        for (let y = 4; y <= 11; y++) {
            const inset = y <= 7 ? y - 4 : 11 - y;
            for (let x = 4 + inset; x <= 11 - inset; x++) {
                const edge = x === 4 + inset || x === 11 - inset || y === 4 || y === 11;
                put(x, y, edge ? GEM_COLORS.dark : (x + y < 12 ? GEM_COLORS.light : GEM_COLORS.mid));
            }
        }
        put(6, 6, GEM_COLORS.light); put(7, 6, GEM_COLORS.light);
        return pixels;
    }

    if (kind === 'raw') {
        const [light, mid, dark] = ITEM_PALETTES.raw[material] || ITEM_PALETTES.raw.iron;
        for (const [cx, cy, rx, ry] of [[6, 8, 3, 3], [10, 6, 2, 2], [10, 10, 3, 2]]) {
            for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
                const edge = Math.abs(x - cx) === rx || Math.abs(y - cy) === ry;
                if (((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1.35) {
                    put(x, y, edge ? dark : (x + y < cx + cy ? light : mid));
                }
            }
        }
        return pixels;
    }

    return createCoalItemSpritePixels('mineral');
}

export function isMineralOreTile(tile) {
    return Object.hasOwn(ORE_COLORS, tile);
}

/**
 * Minério em pixel art: uma máscara e um relevo automático.
 *
 * A máscara é 16×16 "blocos" e cada bloco vale `BLOCO × BLOCO` pixels — é o que dá
 * o traço chunky (um pedaço de carvão de 3–4 blocos fica com 6–8 px, como no
 * gênero). A máscara só diz **onde** tem minério; o relevo acende a beirada de
 * cima/esquerda e escurece a de baixo/direita, o que separa o veio da pedra sem
 * precisar de contorno desenhado à mão.
 *
 * Cada minério ganha a sua máscara e a sua paleta; a conta é a mesma.
 */
const BLOCO = 2;

/** Desenha uma máscara com a paleta dada. Devolve `null` fora do veio. */
function pintarVeio(mascara, paleta) {
    const dentro = (bx, by) => (mascara[by]?.[bx] ?? '.') === '#';
    return (x, y) => {
        const bx = Math.floor(x / BLOCO), by = Math.floor(y / BLOCO);
        if (!dentro(bx, by)) return null;
        const cima = dentro(bx, by - 1), esq = dentro(bx - 1, by);
        const baixo = dentro(bx, by + 1), dir = dentro(bx + 1, by);
        const n = hash2(bx, by, 6007);
        // Bloco sozinho (nódulo de 1 bloco) não tem beirada: fica chapado,
        // senão ele vira um "+" claro no meio da pedra.
        if (!cima && !esq && !baixo && !dir) return n > 0.5 ? paleta.corpo : paleta.meio;
        if (!cima || !esq) return paleta.claro;
        if (!baixo || !dir) return paleta.escuro;
        if (n > 0.93) return paleta.brilho;
        return n > 0.62 ? paleta.meio : paleta.corpo;
    };
}

/**
 * Carvão (opção **D · antracito**): poucos pedaços, grandes e densos — quase
 * metade do bloco. É o carvão que se vê de longe: quando o jogador abre a
 * caverna, o veio tem de saltar da parede antes de ele chegar perto.
 */
const CARVAO = Object.freeze({
    paleta: Object.freeze({
        escuro: [21, 21, 26],
        corpo: [39, 39, 46],
        meio: [52, 52, 60],
        claro: [82, 86, 98],
        brilho: [118, 122, 134],
    }),
    mascara: Object.freeze([
        '................',
        '...####...####..',
        '..######.######.',
        '.#######.######.',
        '.#######.#######',
        '..######..#####.',
        '...####....###..',
        '................',
        '....#####.......',
        '...#######..##..',
        '..########.####.',
        '..########.####.',
        '...#######..##..',
        '....#####.......',
        '................',
        '................',
    ]),
});

/** Os veios desenhados à mão. Quem não está aqui ainda usa o veio genérico. */
const VEIOS = {
    [TILE.COAL_ORE]: pintarVeio(CARVAO.mascara, CARVAO.paleta),
};

/** A máscara de um minério (para o teste conferir a arte), ou `null`. */
export function oreMaskFor(tile) {
    if (tile === TILE.COAL_ORE) return CARVAO.mascara;
    return null;
}

/**
 * O minério: a **pedra de verdade** (`stonePixel`, a mesma do bloco de pedra) com
 * os veios por cima.
 *
 * Antes o fundo era um cinza liso desenhado aqui, com um ruído próprio: o bloco
 * de minério não combinava com a pedra ao lado — parecia outro material com
 * pintinhas. Agora quem manda no fundo é a textura da pedra, que vem de fora
 * (`stone`) para este módulo não conhecer a arte do resto do mundo.
 */
export function createMineralOrePixel(tile, x, y, stone) {
    const palette = ORE_COLORS[tile];
    if (!palette) return null;

    // Minério com veio desenhado (hoje o carvão): o veio por cima, a pedra atrás.
    const veio = VEIOS[tile];
    if (veio) return veio(x, y) ?? stone(x, y, 0);

    const shift = tile - TILE.COAL_ORE;
    const inOre = ORE_CENTERS.some(([cx, cy], index) => {
        const dx = Math.abs(x - ((cx + shift * 3) % 29 + 1));
        const dy = Math.abs(y - cy);
        return dx + dy <= (index % 2 ? 2 : 3) && !(dx === 3 && dy === 0);
    });
    if (inOre) return palette[(x * 3 + y * 5) % palette.length];

    return stone(x, y, 0);
}
