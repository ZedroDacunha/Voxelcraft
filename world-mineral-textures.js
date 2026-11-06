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

/**
 * Cobre bruto em **arte de item** (16×16 px: cada célula da máscara é um pixel).
 *
 * Opção **E · grumos**, a escolhida no comparador: quatro grumos de tamanhos
 * diferentes, um grande em cima e três embaixo — um punhado apertado, sem ficar
 * simétrico como o do carvão. Antes o cobre bruto usava o sprite automático de
 * "minério bruto" (três bolhas redondas com contorno), igual para cobre, ferro e
 * ouro: dava para trocar os itens de lugar sem ninguém notar.
 *
 * A cor é o laranja queimado do veio do bloco, em quatro tons: o item e o bloco
 * têm de parecer o mesmo material.
 */
const COBRE_BRUTO_ITEM = Object.freeze({
    paleta: Object.freeze({
        escuro: [104, 56, 40],
        corpo: [168, 88, 56],
        meio: [200, 120, 80],
        claro: [232, 152, 104],
    }),
    mascara: Object.freeze([
        '................',
        '....####........',
        '...#####...###..',
        '...####...#####.',
        '....##....#####.',
        '...........###..',
        '................',
        '..####...####...',
        '.#####..######..',
        '.#####..#####...',
        '..###....###....',
        '................',
        '.....###........',
        '....####........',
        '.....###........',
        '................',
    ]),
});

/**
 * Ferro bruto em **arte de item** (16×16 px: cada célula da máscara é um pixel).
 *
 * Opção **E · grumos** — o mesmo punhado do cobre, mas espelhado e com outros
 * tamanhos: se fosse o desenho idêntico, o jogador voltaria a ter dois itens
 * iguais na barra e só a cor diria qual é qual. A cor é o pêssego do veio do
 * bloco — mais claro e menos saturado que o laranja do cobre.
 */
const FERRO_BRUTO_ITEM = Object.freeze({
    paleta: Object.freeze({
        escuro: [88, 64, 48],
        corpo: [160, 112, 80],
        meio: [192, 152, 112],
        claro: [224, 192, 152],
    }),
    mascara: Object.freeze([
        '................',
        '.........####...',
        '..##....######..',
        '.####...######..',
        '.####....###....',
        '..##............',
        '................',
        '..####...####...',
        '.#####..######..',
        '.#####...#####..',
        '..###....####...',
        '................',
        '....####........',
        '...#####........',
        '....###.........',
        '................',
    ]),
});

/**
 * Ouro bruto em **arte de item** (16×16 px: cada célula da máscara é um pixel).
 *
 * Opção **B · pepitas**: oito pepitas miúdas espalhadas — a mesma ideia do veio
 * do ouro no bloco, que já é pontilhado. Assim o item e o bloco contam a mesma
 * história, e a silhueta não repete nem o punhado do carvão nem os grumos do
 * cobre e do ferro.
 *
 * A cor é o amarelo quente do veio: o mais claro e o mais saturado dos brutos.
 */
const OURO_BRUTO_ITEM = Object.freeze({
    paleta: Object.freeze({
        escuro: [152, 104, 24],
        corpo: [200, 144, 24],
        meio: [232, 184, 40],
        claro: [248, 216, 96],
    }),
    mascara: Object.freeze([
        '................',
        '...###...####...',
        '..####...####...',
        '...##.....##....',
        '................',
        '..###...###.....',
        '.####..####..##.',
        '..##....##..###.',
        '..........####..',
        '................',
        '...####...###...',
        '..#####..####...',
        '...###....##....',
        '................',
        '.....###........',
        '....#####.......',
    ]),
});

/**
 * Diamante em **arte de item** (16×16 px: cada célula da máscara é um pixel).
 *
 * Opção **C · lasca**, a escolhida no comparador. O diamante não é minério bruto:
 * é **gema**, e a arte é de cristal — uma lasca grande atravessada na diagonal,
 * a mesma ideia dos estilhaços do veio no bloco. A estrela (`*`) é o único pixel
 * de brilho do jogo: nenhum outro item tem esse branco, o que faz o diamante
 * piscar na barra sem precisar de cor mais clara que o ciano.
 */
const DIAMANTE_ITEM = Object.freeze({
    paleta: Object.freeze({
        escuro: [24, 88, 112],
        corpo: [48, 152, 176],
        meio: [80, 196, 216],
        claro: [136, 232, 240],
        brilho: [216, 253, 255],
    }),
    mascara: Object.freeze([
        '................',
        '................',
        '..........###...',
        '.........#####..',
        '........######..',
        '.......######...',
        '......#####.....',
        '.....####*......',
        '....#####.......',
        '....####........',
        '...####.........',
        '...###..........',
        '..###...........',
        '..##............',
        '................',
        '................',
    ]),
});

/**
 * Relevo de item: beirada de cima/esquerda clara, de baixo/direita escura.
 *
 * `*` na máscara é **brilho** — um pixel de luz, usado nas gemas (o diamante tem
 * um branco a mais na paleta). Para o relevo dos vizinhos ele conta como sólido,
 * senão a beirada em volta da estrelinha acenderia à toa.
 */
function pintarItem(mascara, paleta, grao) {
    const celula = (x, y) => mascara[y]?.[x] ?? '.';
    const dentro = (x, y) => { const c = celula(x, y); return c === '#' || c === '*'; };
    return (x, y) => {
        const marca = celula(x, y);
        if (marca === '.') return null;
        if (marca === '*') return paleta.brilho ?? paleta.claro;
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

/** As artes de item dos minérios brutos já desenhadas à mão (as do `raw`). */
const ARTES_ITEM_BRUTO = Object.freeze({
    copper: COBRE_BRUTO_ITEM,
    iron: FERRO_BRUTO_ITEM,
    gold: OURO_BRUTO_ITEM,
});

/** A máscara da arte de item de um minério bruto (para o teste conferir), ou `null`. */
export function rawItemMaskFor(material) {
    return ARTES_ITEM_BRUTO[material]?.mascara ?? null;
}

/** As gemas com arte de item desenhada à mão (o diamante, por enquanto). */
const ARTES_ITEM_GEMA = Object.freeze({ diamond: DIAMANTE_ITEM });

/** A máscara da arte de item de uma gema (para o teste conferir), ou `null`. */
export function gemItemMaskFor(material) {
    return ARTES_ITEM_GEMA[material]?.mascara ?? null;
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
        // Gema com arte desenhada à mão (o diamante): máscara + relevo, com o
        // brilho do `*` — em vez do losango automático.
        const arte = ARTES_ITEM_GEMA[material];
        if (arte) {
            const pintar = pintarItem(arte.mascara, arte.paleta, false);
            return Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => pintar(x, y)));
        }
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
        // Minério bruto com arte desenhada à mão (cobre, ferro e ouro): a mesma
        // máscara + relevo do carvão, em vez do sprite automático de bolhas.
        const arte = ARTES_ITEM_BRUTO[material];
        if (arte) {
            const pintar = pintarItem(arte.mascara, arte.paleta, false);
            return Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => pintar(x, y)));
        }
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

/**
 * Cobre (opção **E · escamas**): pedaços alongados na diagonal, como lascas de
 * metal presas na pedra. Cobre é o minério que o jogador encontra logo depois do
 * carvão — a cor laranja já o separa; a forma evita que ele vire um bloco laranja
 * chapado.
 */
const COBRE = Object.freeze({
    paleta: Object.freeze({
        escuro: [56, 32, 24],
        corpo: [120, 64, 40],
        meio: [160, 88, 56],
        claro: [208, 128, 88],
        brilho: [248, 176, 120],
    }),
    mascara: Object.freeze([
        '................',
        '...###..........',
        '..#####.........',
        '...####..###....',
        '....##..#####...',
        '.........#####..',
        '..###.....###...',
        '.#####..........',
        '.#####....###...',
        '..###....#####..',
        '..........####..',
        '....###....##...',
        '...#####........',
        '...####..###....',
        '....##..#####...',
        '.........#####..',
    ]),
});

/**
 * Ferro (opção **A · clássico**): cinco pedaços médios e arredondados. O ferro é
 * o minério "do meio" da progressão — nem raro como o ouro, nem banal como o
 * carvão. A forma mais neutra é a que melhor combina: a cor pêssego já o separa
 * do cinza do carvão e do laranja do cobre.
 */
const FERRO = Object.freeze({
    paleta: Object.freeze({
        escuro: [80, 56, 44],
        corpo: [152, 104, 76],
        meio: [184, 132, 96],
        claro: [216, 176, 136],
        brilho: [248, 224, 192],
    }),
    mascara: Object.freeze([
        '................',
        '..###....####...',
        '.#####..######..',
        '.#####..######..',
        '..###....####...',
        '................',
        '...###..####....',
        '..#####.####....',
        '..####...###....',
        '...##...........',
        '................',
        '..####....###...',
        '.#####...#####..',
        '.#####....###...',
        '..###...........',
        '................',
    ]),
});

/**
 * Ouro (opção **B · pepitas**): treze pepitas miúdas espalhadas pelo bloco, em
 * vez de poucos pedaços grandes. É o minério mais raro da progressão e o que
 * mais brilha — pepitas soltas fazem o brilho piscar pelo bloco inteiro, e o
 * jogador reconhece o ouro de longe mesmo com pouca área pintada.
 */
const OURO = Object.freeze({
    paleta: Object.freeze({
        escuro: [152, 104, 24],
        corpo: [200, 144, 24],
        meio: [232, 184, 40],
        claro: [248, 216, 96],
        brilho: [248, 248, 184],
    }),
    mascara: Object.freeze([
        '................',
        '..##...###......',
        '.####..###..##..',
        '..##.......###..',
        '.....###........',
        '..##.###..##....',
        '..##......##....',
        '................',
        '...##...###.....',
        '..###...###.....',
        '......##....###.',
        '..##..##....###.',
        '..##.......###..',
        '.....##.........',
        '....###..##.....',
        '.........###....',
    ]),
});

/**
 * Diamante (opção **B · estilhaços**): doze estilhaços pequenos e irregulares
 * espalhados pelo bloco. O diamante é o fim da progressão: em vez de poucos
 * pedaços gordos, lascas soltas — o ciano-gelo pisca pelo bloco inteiro e não
 * deixa dúvida contra a pedra cinza.
 */
const DIAMANTE = Object.freeze({
    paleta: Object.freeze({
        escuro: [24, 88, 112],
        corpo: [48, 152, 176],
        meio: [80, 196, 216],
        claro: [136, 232, 240],
        brilho: [216, 253, 255],
    }),
    mascara: Object.freeze([
        '................',
        '..#....##.......',
        '.###...##..##...',
        '..#........###..',
        '.....###....#...',
        '..##.##.........',
        '..##......##....',
        '.........###....',
        '...##...##......',
        '..###..###..##..',
        '....#.......###.',
        '..##..##.....#..',
        '..##..###.......',
        '.....###.##.....',
        '...##...###.....',
        '...#.....#......',
    ]),
});

/** Os veios desenhados à mão. Quem não está aqui ainda usa o veio genérico. */
const VEIOS_ARTE = {
    [TILE.COAL_ORE]: CARVAO,
    [TILE.COPPER_ORE]: COBRE,
    [TILE.IRON_ORE]: FERRO,
    [TILE.GOLD_ORE]: OURO,
    [TILE.DIAMOND_ORE]: DIAMANTE,
};

const VEIOS = Object.fromEntries(
    Object.entries(VEIOS_ARTE).map(([tile, arte]) => [tile, pintarVeio(arte.mascara, arte.paleta)]),
);

/** A máscara de um minério (para o teste conferir a arte), ou `null`. */
export function oreMaskFor(tile) {
    return VEIOS_ARTE[tile]?.mascara ?? null;
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

    // Minério com veio desenhado (os cinco, agora): o veio por cima, a pedra atrás.
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
