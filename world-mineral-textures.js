import { TILE } from './world-catalog.js';

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
const COAL_VEINS = Object.freeze([[5, 9, 3], [9, 7, 4], [10, 10, 3]]);
const ORE_COLORS = Object.freeze({
    [TILE.COAL_ORE]: [[35, 35, 40], [52, 52, 58], [70, 70, 76]],
    [TILE.IRON_ORE]: [[151, 105, 78], [183, 132, 96], [211, 160, 120]],
    [TILE.GOLD_ORE]: [[193, 139, 24], [231, 181, 35], [250, 215, 74]],
    [TILE.DIAMOND_ORE]: [[30, 151, 157], [48, 194, 190], [102, 229, 216]],
    [TILE.COPPER_ORE]: [[139, 75, 48], [189, 103, 65], [219, 140, 93]],
});
const ORE_CENTERS = [[7, 7], [22, 6], [15, 18], [26, 25], [5, 26]];

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

    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let shade = null;
        for (const [cx, cy, radius] of COAL_VEINS) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= radius * radius) {
                shade = (x + 2 * y) % 5 === 0 ? [91, 91, 99] : [37, 37, 43];
            }
        }
        if (shade) put(x, y, shade);
    }
    return pixels;
}

export function isMineralOreTile(tile) {
    return Object.hasOwn(ORE_COLORS, tile);
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

    const shift = tile - TILE.COAL_ORE;
    const inOre = ORE_CENTERS.some(([cx, cy], index) => {
        const dx = Math.abs(x - ((cx + shift * 3) % 29 + 1));
        const dy = Math.abs(y - cy);
        return dx + dy <= (index % 2 ? 2 : 3) && !(dx === 3 && dy === 0);
    });
    if (inOre) return palette[(x * 3 + y * 5) % palette.length];

    return stone(x, y, 0);
}
