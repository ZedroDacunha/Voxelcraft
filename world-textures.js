import { hash2, mulberry32 } from './world-math.js';
import { ATLAS_COLUMNS, ITEMS, TILE, TILE_PX } from './world-catalog.js';
import { createMineralOrePixel, createMineralSpritePixels, isMineralOreTile } from './world-mineral-textures.js';

function cobblePixel(x, y, variant) {
    let closest = Infinity, second = Infinity, nearestSite = null;
    const cellX = Math.floor(x / 8), cellY = Math.floor(y / 8);
    for (let gy = cellY - 1; gy <= cellY + 1; gy++) for (let gx = cellX - 1; gx <= cellX + 1; gx++) {
        const wrappedX = ((gx % 4) + 4) % 4, wrappedY = ((gy % 4) + 4) % 4;
        const seed = 3701 + wrappedX * 67 + wrappedY * 131 + variant * 977;
        const siteX = gx * 8 + 4 + (hash2(wrappedX, wrappedY, seed) - 0.5) * 3;
        const siteY = gy * 8 + 4 + (hash2(wrappedY, wrappedX, seed + 1) - 0.5) * 3;
        const distance = (x - siteX) ** 2 + (y - siteY) ** 2;
        if (distance < closest) {
            second = closest;
            closest = distance;
            nearestSite = { x: siteX, y: siteY, seed, wrappedX, wrappedY };
        } else if (distance < second) second = distance;
    }

    const { x: siteX, y: siteY, seed, wrappedX, wrappedY } = nearestSite;
    const edgeNoise = hash2(Math.floor((x - siteX + 12) / 2), Math.floor((y - siteY + 12) / 2), seed + 3);
    if (Math.sqrt(second) - Math.sqrt(closest) < 0.8 + edgeNoise * 1.9) {
        const seam = 48 + hash2(Math.floor(x / 2), Math.floor(y / 2), seed + 5) * 28;
        return [seam, seam + 2, seam + 3];
    }

    const patch = hash2(Math.floor((x - siteX) / 2), Math.floor((y - siteY) / 2), seed + 7);
    const grain = hash2(Math.floor((x - siteX) / 2), Math.floor((y - siteY) / 2), seed + 11);
    const blockShade = 106 + Math.floor(hash2(wrappedX, wrappedY, seed + 13) * 5) * 4;
    const shade = blockShade + (patch < 0.14 ? -15 : patch > 0.86 ? 17 : 0) + (grain - 0.5) * 11;
    return [shade, shade + 1, shade + 2];
}

// Atlas voxel e sprites determinísticos em canvas.
export function createTextureTools(THREE) {
    const HEAD_COLORS = {
        wood: { l: [176, 128, 70], d: [130, 90, 45] },
        stone: { l: [150, 150, 152], d: [106, 106, 110] },
        copper: { l: [207, 126, 82], d: [120, 66, 43] },
        iron: { l: [210, 218, 220], d: [126, 139, 145] },
        gold: { l: [250, 211, 65], d: [163, 111, 24] },
        diamond: { l: [95, 224, 215], d: [25, 119, 144] },
    };
    const spriteCache = {};
    const stickPixels = [
        '.............md.',
        '............mwm.',
        '...........mwd..',
        '..........mwm...',
        '.........mwd....',
        '........mw......',
        '.......mw.......',
        '......mww.......',
        '.....mwd........',
        '....mw..........',
        '....mw..........',
        '...mwd..........',
        '.dmw............',
        'mww.............',
        '.dd.............',
        '................',
    ];
    const stickColors = {
        d: [41, 28, 12],
        m: [73, 53, 11],
        w: [139, 103, 35],
    };
    const pickaxeHandlePixels = [
        '................',
        '................',
        '................',
        '................',
        '................',
        '.........mw.....',
        '........mww.....',
        '.......mwd......',
        '......mw........',
        '......mw........',
        '.....mwd........',
        '...dmw..........',
        '..mww...........',
        '...dd...........',
        '................',
        '................',
    ];
    const pickaxeHeadPixels = [
        '................',
        '................',
        '......ooooo.....',
        '.....ollllo.....',
        '......ommmmo....',
        '.........oommo..',
        '...........ommo.',
        '............omo.',
        '............omo.',
        '............omo.',
        '............omo.',
        '............oo..',
        '.............o..',
        '................',
        '................',
        '................',
    ];
    const shovelHeadPixels = [
        '................',
        '................',
        '...........ooo..',
        '..........olllo.',
        '.........ollllo.',
        '........ollllo..',
        '..........mmmo..',
        '..........omo...',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
    ];
    const metalHeadColors = (mat) => {
        const hc = HEAD_COLORS[mat];
        return {
            o: hc.d.map(channel => Math.round(channel * 0.36)),
            l: hc.l.map(channel => Math.min(255, Math.round(channel * 1.1))),
            m: hc.l.map((channel, i) => Math.round(channel * 0.58 + hc.d[i] * 0.42)),
            d: hc.d.map((channel, i) => Math.round(channel * 0.78 + hc.l[i] * 0.22)),
        };
    };
    function spritePixels(kind, mat) {
        const key = kind + ':' + mat;
        if (spriteCache[key]) return spriteCache[key];
        const mineralSprite = createMineralSpritePixels(kind, mat);
        if (mineralSprite) return (spriteCache[key] = mineralSprite);
        const g = Array.from({ length: 16 }, () => Array(16).fill(null));
        const put = (x, y, c) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = c; };
    
        if (kind === 'torch') {
            for (let y = 0; y < 16; y++) {
                if (y <= 7) {
                    const spread = y < 3 ? 1 : y < 6 ? 2 : 3;
                    for (let x = 8 - spread; x <= 8 + spread; x++) {
                        const color = y < 2 ? [230, 48, 28] : y < 4 ? [255, 126, 20] : y < 7 ? [255, 218, 52] : [255, 248, 210];
                        if ((x + y) % 4 !== 0) put(x, y, color);
                    }
                } else if (y >= 7) {
                    for (let x = 7; x <= 9; x++) put(x, y, x === 7 ? [91, 56, 30] : x === 8 ? [145, 91, 47] : [104, 65, 35]);
                }
            }
            return (spriteCache[key] = g);
        }
    
        if (kind === 'apple' || kind === 'charcoal') {
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                if (kind === 'apple') {
                    const dx = (x - 7.5) / 4.5, dy = (y - 9.5) / 4.5;
                    if (dx * dx + dy * dy <= 1)
                        put(x, y, ((x === 6 && y === 7) || (x === 5 && y === 8)) ? [240, 110, 100] : (dx + dy > 0.9 ? [150, 25, 30] : [205, 40, 45]));
                } else {
                    const dx = (x - 7.5) / 5, dy = (y - 9) / 3.6;
                    if (dx * dx + dy * dy <= 1) put(x, y, (x + y) % 3 === 0 ? [75, 75, 82] : [38, 38, 44]);
                }
            }
            if (kind === 'apple') { put(8, 4, [110, 70, 30]); put(8, 5, [110, 70, 30]); put(9, 4, [60, 150, 50]); put(10, 4, [60, 150, 50]); }
            return (spriteCache[key] = g);
        }

        if (kind === 'wheat-seeds') {
            const seedPixels = [
                '................',
                '................',
                '........h.......',
                '.......hmd......',
                '........md......',
                '......hmd.......',
                '.....hmd........',
                '......md........',
                '.....hmd........',
                '......md........',
                '.......md.......',
                '........d.......',
                '................',
                '................',
                '................',
                '................',
            ];
            const seedColors = { h: [246, 220, 139], m: [203, 164, 79], d: [133, 99, 43] };
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const color = seedColors[seedPixels[y][x]];
                if (color) put(x, y, color);
            }
            return (spriteCache[key] = g);
        }
    
        if (kind === 'stick') {
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const color = stickColors[stickPixels[y][x]];
                if (color) put(x, y, color);
            }
            return (spriteCache[key] = g);
        }

        if (kind === 'pickaxe') {
            // Cabo em mapa separado para permitir ajustar a haste e a cabeça
            // sem que uma parte altere a silhueta da outra.
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const color = stickColors[pickaxeHandlePixels[y][x]];
                if (color) put(x, y, color);
            }
            const colors = metalHeadColors(mat);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const color = colors[pickaxeHeadPixels[y][x]];
                if (color) put(x, y, color);
            }
            return (spriteCache[key] = g);
        }

        if (kind === 'shovel') {
            // A pá mantém o cabo diagonal do graveto; só a cabeça muda para a
            // silhueta compacta e arredondada da referência.
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const color = stickColors[pickaxeHandlePixels[y][x]];
                if (color) put(x, y, color);
            }
            const colors = metalHeadColors(mat);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const color = colors[shovelHeadPixels[y][x]];
                if (color) put(x, y, color);
            }
            return (spriteCache[key] = g);
        }

        if (kind === 'axe') {
            // Copia o trecho diagonal do próprio graveto; a cabeça é desenhada
            // depois e cobre a ponta, mantendo o encaixe de cada ferramenta.
            const offsetX = kind === 'axe' ? 0 : 2;
            const offsetY = kind === 'axe' ? 0 : -1;
            for (let y = 6; y <= 14; y++) for (let x = 0; x < 16; x++) {
                const color = stickColors[stickPixels[y][x]];
                if (color) put(x + offsetX, y + offsetY, color);
            }
        }
    
        const head = new Set(), add = (x, y) => head.add(x + ',' + y);
        if (kind === 'axe') {
            // Silhueta compacta em degraus do machado clássico. O gume abre
            // para a esquerda e a cabeça afunila até o encaixe do cabo.
            for (let x = 8; x <= 9; x++) add(x, 1);
            for (let x = 7; x <= 10; x++) add(x, 2);
            for (let x = 6; x <= 11; x++) add(x, 3);
            for (let x = 5; x <= 12; x++) add(x, 4);
            for (let x = 5; x <= 13; x++) add(x, 5);
            for (let x = 6; x <= 13; x++) add(x, 6);
            for (let x = 8; x <= 12; x++) add(x, 7);
            for (let x = 9; x <= 11; x++) add(x, 8);
        }
        if (head.size) {
            const hc = HEAD_COLORS[mat];
            for (const k of head) {
                const [x, y] = k.split(',').map(Number);
                if (kind === 'axe') {
                    const edge = !head.has((x - 1) + ',' + y) || !head.has((x + 1) + ',' + y) ||
                        !head.has(x + ',' + (y - 1)) || !head.has(x + ',' + (y + 1));
                    const shade = (amount) => hc.l.map((channel, i) => Math.round(channel * amount + hc.d[i] * (1 - amount)));
                    const outline = hc.d.map(channel => Math.round(channel * 0.55));
                    const bevel = x <= 7 && y >= 3 && y <= 6;
                    const socket = x >= 10 && y >= 6;
                    if (edge) put(x, y, outline);
                    else if (bevel) put(x, y, hc.l);
                    else if (socket || y >= 7) put(x, y, hc.d);
                    else if (y <= 2) put(x, y, shade(0.78));
                    else put(x, y, shade(0.48));
                } else {
                    const dark = !head.has((x + 1) + ',' + y) || !head.has(x + ',' + (y + 1));
                    put(x, y, dark ? hc.d : hc.l);
                }
            }
        }
        return (spriteCache[key] = g);
    }
    
    function createAtlasTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = ATLAS_COLUMNS * TILE_PX;
        canvas.height = TILE_PX;
        const ctx = canvas.getContext('2d', { alpha: true });
        ctx.imageSmoothingEnabled = false;
        const grassEdges = [0, 1].map(variant => Array.from({ length: TILE_PX }, (_, x) =>
            4 + Math.floor(hash2(x, variant, 2024) * 4)));
        const grassRoots = [0, 1].map(variant => Array.from({ length: TILE_PX }, (_, x) => {
            const rootChance = hash2(Math.floor(x / 2), 0, 2781 + variant * 91);
            return rootChance > 0.7 ? 1 + Math.floor(hash2(x, variant, 991) * 3) : 0;
        }));
        const variantBase = {
            [TILE.GRASS_TOP_ALT]: TILE.GRASS_TOP, [TILE.GRASS_SIDE_ALT]: TILE.GRASS_SIDE,
            [TILE.DIRT_ALT]: TILE.DIRT, [TILE.STONE_ALT]: TILE.STONE, [TILE.LEAVES_ALT]: TILE.LEAVES,
        };
        const pixel = (sourceTile, x, y) => {
            const tile = variantBase[sourceTile] ?? sourceTile;
            const alt = sourceTile !== tile ? 1 : 0;
            let noiseSample = 0;
            const j = (radius) => {
                const value = hash2(x + noiseSample * 31, y - noiseSample * 17, 2024 + sourceTile * 101);
                noiseSample++;
                return (value * 2 - 1) * radius;
            };
            const soilPixel = (px, py) => {
                const patch = hash2(Math.floor(px / 4), Math.floor(py / 4), 431 + alt * 73);
                const fleck = hash2(Math.floor(px / 2), Math.floor(py / 2), 8101 + alt * 109);
                let color = patch < 0.18 ? [103, 70, 46] : patch > 0.81 ? [151, 105, 68] : [128, 87, 56];
                if (fleck > 0.975) color = [194, 144, 96];
                else if (fleck > 0.84) color = [166, 113, 73];
                else if (fleck < 0.08) color = [88, 61, 42];
                else if (fleck < 0.11) color = [129, 123, 108];
                const fine = (hash2(px, py, 2203 + alt * 137) - 0.5) * 10;
                return color.map(channel => channel + fine);
            };
            const grassPixel = (px, py, muted = false) => {
                const patch = hash2(Math.floor(px / 4), Math.floor(py / 3), 2909 + alt * 131);
                const clump = hash2(Math.floor(px / 2), Math.floor(py / 2), 6343 + alt * 157);
                const fleck = hash2(px, py, 511 + alt * 191);
                let color = patch < 0.16 ? [68, 112, 45] : patch > 0.84 ? [105, 148, 60] : [86, 133, 53];
                if (clump > 0.91) color = [116, 157, 65];
                else if (clump < 0.08) color = [61, 103, 42];
                if (fleck > 0.985) color = [127, 166, 74];
                else if (fleck < 0.015) color = [53, 91, 38];
                const grain = (hash2(px, py, 927 + alt * 233) - 0.5) * 8;
                color = color.map(channel => channel + grain);
                return muted ? color.map(channel => channel * 0.78) : color;
            };
            if (isMineralOreTile(tile)) return createMineralOrePixel(tile, x, y, j);
            switch (tile) {
                case TILE.GRASS_TOP: {
                    return grassPixel(x, y);
                }
                case TILE.DIRT: {
                    return soilPixel(x, y);
                }
                case TILE.GRASS_SIDE: {
                    const edge = grassEdges[alt][x];
                    if (y < edge) return grassPixel(x, y);
                    if (grassRoots[alt][x] > 0 && y - edge < grassRoots[alt][x]) return grassPixel(x, y, true);
                    return soilPixel(x, y);
                }
                case TILE.STONE: {
                    const stratum = hash2(Math.floor(x / 4), Math.floor(y / 2), 5021 + alt * 113);
                    const grain = hash2(Math.floor(x / 2), Math.floor(y / 2), 641 + alt * 197);
                    const fleck = hash2(x, y, 1801 + alt * 67);
                    let c = 124 + (stratum - 0.5) * 18 + (grain - 0.5) * 12;
                    if (fleck > 0.975) c += 12;
                    else if (fleck < 0.025) c -= 12;
                    return [c, c + 1, c + 2];
                }
                case TILE.COBBLE: {
                    return cobblePixel(x, y, alt);
                }
                case TILE.WOOD: {
                    const column = Math.floor(x / 2);
                    const stripe = hash2(column, 0, 3623);
                    const segment = hash2(column, Math.floor(y / 6), 4919);
                    let color = [119, 101, 67];
                    if (stripe < 0.18) color = [75, 61, 41];
                    else if (stripe < 0.38) color = [94, 77, 51];
                    else if (stripe > 0.91) color = [158, 137, 91];
                    else if (stripe > 0.76) color = [137, 115, 75];
                    if (segment > 0.84) color = color.map(channel => channel + 15);
                    else if (segment < 0.14) color = color.map(channel => channel - 13);
                    const barkChip = hash2(x, Math.floor(y / 2), 6833);
                    if (barkChip > 0.985) color = [57, 45, 31];
                    return color.map(channel => channel + j(2));
                }
                case TILE.WOOD_END: {
                    const dx = Math.abs(x - 15.5), dy = Math.abs(y - 15.5);
                    const r = Math.max(dx, dy);
                    const depth = 15.5 - r;
                    if (r > 14.5) return [81 + j(2), 63 + j(2), 39 + j(2)];
                    const ring = depth > 1 && Math.floor(depth) % 4 === 3;
                    if (ring) return [127 + j(2), 99 + j(2), 59 + j(2)];
                    const band = Math.floor(depth / 4) % 2;
                    const heartwood = dx < 2 && dy < 2;
                    const color = heartwood ? [197, 161, 99] : band ? [216, 187, 128] : [199, 169, 108];
                    const grain = (hash2(Math.floor(x / 4), Math.floor(y / 4), 7727) - 0.5) * 5;
                    return color.map(channel => channel + grain + j(2));
                }
                case TILE.LEAVES: {
                    const canopy = hash2(Math.floor(x / 4), Math.floor(y / 4), 800 + alt * 97);
                    const opening = hash2(Math.floor(x / 2), Math.floor(y / 2), 1901 + alt * 131);
                    const tinyOpening = hash2(x, y, 3119 + alt * 173);
                    if (opening < (canopy < 0.4 ? 0.22 : 0.13) || (opening < 0.32 && tinyOpening < 0.055)) {
                        return [0, 0, 0, 0];
                    }

                    const leaf = hash2(Math.floor(x / 2), Math.floor(y / 2), 4517 + alt * 199);
                    let color = canopy < 0.24 ? [29, 76, 29] : canopy > 0.84 ? [65, 126, 43] : [43, 103, 36];
                    if (leaf > 0.86) color = [75, 137, 48];
                    else if (leaf < 0.12) color = [34, 86, 31];
                    const glint = hash2(x, y, 7321 + alt * 223);
                    if (glint > 0.975) color = [91, 151, 54];
                    const fine = (hash2(x, y, 8161 + alt * 251) - 0.5) * 8;
                    return color.map(channel => channel + fine);
                }
                case TILE.PLANKS: {
                    const board = Math.floor(y / 8);
                    const row = y % 8;
                    const offset = (board % 2) * 8;
                    if (row === 0) return [123 + j(2), 91 + j(2), 51 + j(2)];
                    if (row === 1) return [177 + j(2), 142 + j(2), 86 + j(2)];
                    if (row === 7) return [151 + j(2), 116 + j(2), 67 + j(2)];

                    const joint = (x + offset) % 16;
                    if (joint === 0 && row >= 2 && row <= 6) return [126 + j(2), 94 + j(2), 55 + j(2)];
                    if (joint === 1 && row >= 2 && row <= 6) return [202 + j(2), 166 + j(2), 106 + j(2)];

                    const grain = hash2(Math.floor((x + offset) / 4), Math.floor(row / 2), 1171 + board * 83);
                    const streak = hash2(Math.floor((x + offset) / 10), row, 2489 + board * 109);
                    const base = board % 2 ? [183, 147, 91] : [191, 155, 99];
                    let variation = (grain - 0.5) * 8 + (streak > 0.88 ? 4 : streak < 0.12 ? -4 : 0);
                    if (row === 2) variation += 4;
                    if (row === 6) variation -= 3;
                    return base.map(channel => channel + variation + j(2));
                }
                case TILE.CRAFT_TOP: {
                    // Moldura de madeira escura e grade 3x3 original, com pequenos rebites dourados.
                    if (x < 2 || x > 29 || y < 2 || y > 29) return [70 + j(3), 44 + j(2), 23 + j(2)];
                    if (x < 4 || x > 27 || y < 4 || y > 27) return [111 + j(3), 69 + j(2), 32 + j(2)];
                    const gridLine = x === 10 || x === 11 || x === 20 || x === 21 ||
                        y === 10 || y === 11 || y === 20 || y === 21;
                    if (gridLine) return [76 + j(3), 48 + j(2), 24 + j(2)];
                    const corner = (x >= 4 && x <= 5 || x >= 26 && x <= 27) &&
                        (y >= 4 && y <= 5 || y >= 26 && y <= 27);
                    if (corner) return [224 + j(3), 166 + j(3), 72 + j(2)];
                    const cellAccent = ((x + 2 * y) % 13 === 0) && x > 5 && x < 26 && y > 5 && y < 26;
                    if (cellAccent) return [198 + j(3), 111 + j(3), 52 + j(2)];
                    return [180 + j(4), 126 + j(4), 69 + j(3)];
                }
                case TILE.CRAFT_SIDE: {
                    const inRect = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
                    let wood = [170 + j(4), 125 + j(4), 72 + j(3)];
                    if (x === 0 || x === 31 || y < 4) wood = [91 + j(3), 57 + j(2), 28 + j(2)];
                    else if (y === 12 || y === 22) wood = [124 + j(3), 82 + j(3), 43 + j(2)];
                    else if (x % 16 === 0) wood = [128 + j(3), 87 + j(3), 46 + j(2)];
    
                    // Régua de marceneiro à esquerda.
                    if (inRect(3, 8, 8, 28)) {
                        if (x === 3 || x === 8 || y === 8 || y === 28) return [63, 39, 21];
                        if (x === 4 || x === 7) return [207, 157, 83];
                        if (x === 5 || x === 6) {
                            if (x === 6 && (y - 9) % 4 === 0) return [91, 57, 28];
                            return [226, 184, 108];
                        }
                    }
    
                    // Cinzel ao centro: cabo de madeira, virola escura e lâmina de aço.
                    if (inRect(13, 7, 18, 15)) {
                        if (x === 13 || x === 18 || y === 7 || y === 15) return [61, 38, 21];
                        return [184, 126, 64];
                    }
                    if (inRect(12, 14, 19, 16)) return [74, 46, 24];
                    if (inRect(13, 16, 18, 25)) {
                        if (x === 13 || x === 18 || y === 25) return [58, 43, 34];
                        return (x === 15 || x === 16) ? [181, 192, 190] : [112, 125, 127];
                    }
                    if (inRect(14, 26, 17, 28)) return [192, 202, 197];
    
                    // Plaina à direita: corpo baixo, lâmina aparente e empunhadura curta.
                    if (inRect(23, 7, 27, 15)) {
                        if (x === 23 || x === 27 || y === 7 || y === 15) return [64, 39, 20];
                        return [190, 137, 75];
                    }
                    if (inRect(21, 16, 29, 25)) {
                        if (x === 21 || x === 29 || y === 16 || y === 25) return [59, 37, 20];
                        if (y === 17 || y === 18) return [181, 190, 184];
                        if (x === 24 || x === 25) return [133, 88, 43];
                        return [176, 124, 66];
                    }
                    return wood;
                }
                case TILE.FURNACE_FRONT:
                case TILE.FURNACE_FRONT_ON: {
                    const lit = tile === TILE.FURNACE_FRONT_ON;
                    const opening = (y >= 8 && y <= 14) || (y >= 20 && y <= 26);
                    if (opening && x >= 6 && x <= 25) {
                        const rim = x === 6 || x === 25 || y === 8 || y === 14 || y === 20 || y === 26;
                        if (rim) return [37 + j(3), 38 + j(3), 39 + j(3)];
                        if (!lit) {
                            const cavity = x < 9 || x > 22 || y === 10 || y === 11 || y === 22 || y === 23;
                            const c = cavity ? 17 + j(2) : 8 + j(2);
                            return [c, c + 1, c + 2];
                        }

                        const fireY = (y >= 20 ? y - 12 : y);
                        const center = 15 + Math.floor(Math.sin((x + (y >= 20 ? 3 : 0)) * 1.3) * 2);
                        const flameWidth = fireY < 10 ? 1 : fireY < 12 ? 3 : 6;
                        if (Math.abs(x - center) <= flameWidth && fireY >= 9 && fireY <= 13) {
                            if (fireY <= 9) return [255, 235 + j(8), 83 + j(18)];
                            if (fireY <= 11) return [255, 139 + j(22), 24 + j(10)];
                            return [236 + j(12), 56 + j(12), 15 + j(8)];
                        }
                        const c = 12 + j(3);
                        return [c, c + 1, c + 2];
                    }

                    const edge = x < 2 || x > 29 || y < 2 || y > 29;
                    const seam = x === 4 || x === 27 || y === 4 || y === 27;
                    if (edge) return [65 + j(3), 67 + j(3), 68 + j(3)];
                    if (seam) return [89 + j(4), 91 + j(4), 92 + j(4)];
                    const fleck = hash2(Math.floor(x / 3), Math.floor(y / 3), 3217);
                    const shade = fleck > 0.8 ? 157 : fleck < 0.18 ? 105 : 130;
                    return [shade + j(7), shade + j(7), shade + 2 + j(7)];
                }
                case TILE.FURNACE_SIDE: {
                    if (x < 2 || x > 29 || y < 2 || y > 29) return [65 + j(3), 67 + j(3), 68 + j(3)];
                    if (x < 4 || x > 27 || y < 4 || y > 27) return [91 + j(4), 93 + j(4), 94 + j(4)];
                    const patch = hash2(Math.floor(x / 4), Math.floor(y / 4), 4829);
                    const fleck = hash2(x, y, 6029);
                    let c = patch < 0.2 ? 104 : patch > 0.8 ? 151 : 128;
                    if (fleck > 0.96) c += 18;
                    else if (fleck < 0.04) c -= 15;
                    return [c + j(4), c + j(4), c + 2 + j(4)];
                }
                case TILE.CHEST_TOP: {
                    if (x < 2 || x > 29 || y < 2 || y > 29) return [43 + j(3), 31 + j(2), 20 + j(2)];
                    if (x < 4 || x > 27 || y < 4 || y > 27) return [89 + j(4), 57 + j(3), 29 + j(2)];
                    if (y === 6 || y === 7 || y === 24 || y === 25) return [105 + j(3), 68 + j(2), 34 + j(2)];
                    const grain = hash2(Math.floor(x / 3), Math.floor(y / 2), 761 + alt * 53);
                    const topWood = grain > 0.8 ? [206, 145, 61] : grain < 0.18 ? [153, 99, 42] : [181, 119, 48];
                    return topWood.map(channel => channel + j(4));
                }
                case TILE.CHEST_SIDE: {
                    if (x < 2 || x > 29 || y < 2 || y > 29) return [40 + j(3), 30 + j(2), 20 + j(2)];
                    if (y < 5 || y > 27 || x === 3 || x === 28) return [75 + j(4), 49 + j(3), 27 + j(2)];
                    if (y >= 9 && y <= 11) return [48 + j(3), 37 + j(2), 25 + j(2)];
                    const board = Math.floor((x + 3) / 8);
                    const seam = (x + 3) % 8 < 2;
                    const variation = hash2(Math.floor(x / 3), Math.floor(y / 4), 1961 + alt * 71);
                    const sideWood = seam ? [124, 78, 37] : variation > 0.82 ? [203, 142, 59] : [177, 112, 44];
                    if (board === 2 && y > 13 && y < 20 && x % 7 === 0) return [132 + j(3), 82 + j(2), 39 + j(2)];
                    return sideWood.map(channel => channel + j(4));
                }
                case TILE.CHEST_FRONT: {
                    if (x < 2 || x > 29 || y < 2 || y > 29) return [34 + j(2), 27 + j(2), 19 + j(2)];
                    if (y < 5 || y > 27 || x < 4 || x > 27) return [70 + j(3), 47 + j(2), 27 + j(2)];
                    if (y >= 8 && y <= 10) return [39 + j(2), 31 + j(2), 22 + j(2)];
                    const grain = hash2(Math.floor(x / 3), Math.floor(y / 4), 2903 + alt * 97);
                    let wood = grain > 0.82 ? [204, 143, 59] : grain < 0.16 ? [151, 97, 40] : [178, 113, 44];
                    if (x === 8 || x === 23) wood = [128, 81, 38];
                    if (y >= 11 && y <= 12 && x >= 13 && x <= 18) return [35 + j(2), 28 + j(2), 20 + j(2)];
                    if (x >= 13 && x <= 18 && y >= 11 && y <= 20) {
                        const latchEdge = x === 13 || x === 18 || y === 11 || y === 20;
                        if (y >= 15 && y <= 19 && x >= 14 && x <= 17) return latchEdge ? [91, 89, 80] : [143, 148, 144];
                        return latchEdge ? [61, 59, 52] : [187, 190, 177];
                    }
                    if (x === 14 && y === 13) return [224, 224, 207];
                    return wood.map(channel => channel + j(3));
                }
                case TILE.CHEST_FRONT_OPEN: {
                    if (x < 2 || x > 29 || y < 2 || y > 29) return [34 + j(2), 27 + j(2), 19 + j(2)];
                    if (x < 4 || x > 27 || y > 27) return [70 + j(3), 47 + j(2), 27 + j(2)];
                    if (y <= 4) {
                        if (y === 2 || y === 4) return [103 + j(3), 66 + j(2), 31 + j(2)];
                        if (x >= 14 && x <= 17 && y === 3) return [188, 190, 178];
                        return [185 + j(4), 122 + j(3), 48 + j(2)];
                    }
                    if (y <= 11) {
                        if (y === 5 || y === 11 || x === 4 || x === 27) return [62 + j(2), 41 + j(2), 24 + j(2)];
                        if (x >= 14 && x <= 17 && y <= 8) return [156 + j(3), 158 + j(3), 148 + j(3)];
                        return [25 + j(3), 20 + j(2), 16 + j(2)];
                    }
                    if (y === 12 || y === 13) return [49 + j(2), 34 + j(2), 22 + j(2)];
                    const grain = hash2(Math.floor(x / 3), Math.floor(y / 4), 2903 + alt * 97);
                    let wood = grain > 0.82 ? [204, 143, 59] : grain < 0.16 ? [151, 97, 40] : [178, 113, 44];
                    if (x === 8 || x === 23) wood = [128, 81, 38];
                    return wood.map(channel => channel + j(3));
                }
                case TILE.FURNACE_TOP: {
                    if (x < 2 || x > 29 || y < 2 || y > 29) return [61 + j(3), 63 + j(3), 64 + j(3)];
                    if (x < 4 || x > 27 || y < 4 || y > 27) return [91 + j(4), 93 + j(4), 94 + j(4)];
                    const patch = hash2(Math.floor(x / 3), Math.floor(y / 3), 7043);
                    const fleck = hash2(x, y, 8041);
                    let c = patch < 0.18 ? 104 : patch > 0.82 ? 154 : 130;
                    if (fleck > 0.975) c += 24;
                    else if (fleck < 0.025) c -= 19;
                    return [c + j(5), c + j(5), c + 2 + j(5)];
                }
                case TILE.SAND: {
                    const c = 215 + j(12);
                    return [c, c - 20, c - 70];
                }
                case TILE.TORCH_FLAME: {
                    const center = 15 + Math.sin(y * 0.52) * 3;
                    const width = y < 6 ? 3 + Math.floor(y / 2) : y < 18 ? 7 : y < 25 ? 5 : 2;
                    const dx = Math.abs(x - center);
                    if (dx > width) return [0, 0, 0, 0];
                    if (y < 6) return [220 + j(12), 38 + j(8), 20 + j(6)];
                    if (y < 13) return [255, 114 + j(14), 18 + j(8)];
                    if (y < 23) return [255, 220 + j(12), 48 + j(10)];
                    return [255, 248, 205];
                }
                case TILE.WATER: {
                    return [45 + j(8), 110 + j(8), 215 + j(8)];
                }
            }
            return [255, 0, 255];
        };
    
        for (const tile of Object.values(TILE)) {
            for (let x = 0; x < TILE_PX; x++) for (let y = 0; y < TILE_PX; y++) {
                const raw = pixel(tile, x, y);
                if (raw[3] === 0) continue;
                const c = raw.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(v / 8) * 8)));
                ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
                ctx.fillRect(tile * TILE_PX + x, y, 1, 1);
            }
        }
    
        for (const item of Object.values(ITEMS)) {
            if (!item.sprite) continue;
            const pix = spritePixels(item.sprite.kind, item.sprite.mat);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const c = pix[y][x];
                if (!c) continue;
                ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
                ctx.fillRect(item.iconTile * TILE_PX + x * 2, y * 2, 2, 2);
            }
        }
    
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    }
    
    function createNoiseTexture(rgb, seed, jitter = 12) {
        const c = document.createElement('canvas');
        c.width = c.height = 8;
        const ctx = c.getContext('2d');
        const rnd = mulberry32(seed);
        for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
            const d = (rnd() * 2 - 1) * jitter;
            ctx.fillStyle = `rgb(${Math.round(rgb[0] + d)},${Math.round(rgb[1] + d)},${Math.round(rgb[2] + d)})`;
            ctx.fillRect(x, y, 1, 1);
        }
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }
    
    return { spritePixels, createAtlasTexture, createNoiseTexture };
}
