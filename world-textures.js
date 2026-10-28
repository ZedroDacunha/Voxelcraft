import { hash2, mulberry32 } from './world-math.js';
import { ATLAS_COLUMNS, ITEMS, TILE, TILE_PX } from './world-catalog.js';

// Atlas voxel e sprites determinísticos em canvas.
export function createTextureTools(THREE) {
    const HANDLE_L = [156, 106, 52], HANDLE_D = [112, 74, 34];
    const HEAD_COLORS = { wood: { l: [176, 128, 70], d: [130, 90, 45] }, stone: { l: [150, 150, 152], d: [106, 106, 110] } };
    const spriteCache = {};
    function spritePixels(kind, mat) {
        const key = kind + ':' + mat;
        if (spriteCache[key]) return spriteCache[key];
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
    
        const hLen = kind === 'stick' ? 13 : kind === 'shovel' ? 10 : 10;
        for (let x = 3; x <= hLen; x++) { put(x, 16 - x, HANDLE_L); put(x + 1, 16 - x, HANDLE_D); }
    
        const head = new Set(), add = (x, y) => head.add(x + ',' + y);
        if (kind === 'pickaxe') {
            for (let t = -4; t <= 4; t++) {
                const k = Math.abs(t) >= 3 ? 1 : 0;
                add(10 + t - k, 6 + t + k);
                if (Math.abs(t) <= 3) add(11 + t, 5 + t);
            }
        } else if (kind === 'axe') {
            for (let x = 9; x <= 12; x++) add(x, 2);
            for (let x = 8; x <= 13; x++) add(x, 3);
            for (let x = 8; x <= 12; x++) add(x, 4);
            for (let x = 9; x <= 11; x++) add(x, 5);
        } else if (kind === 'shovel') {
            for (let x = 10; x <= 12; x++) add(x, 2);
            for (let x = 9; x <= 13; x++) { add(x, 3); add(x, 4); }
            for (let x = 10; x <= 12; x++) add(x, 5);
        }
        if (head.size) {
            const hc = HEAD_COLORS[mat];
            for (const k of head) {
                const [x, y] = k.split(',').map(Number);
                const dark = !head.has((x + 1) + ',' + y) || !head.has(x + ',' + (y + 1));
                put(x, y, dark ? hc.d : hc.l);
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
        const grassEdges = [0, 1].map(v => Array.from({ length: TILE_PX }, (_, x) =>
            8 + Math.floor(hash2(x, v, 2024) * 7) + v));
        const cobbleShade = Array.from({ length: 40 }, (_, i) => 104 + hash2(i, 0, 2077) * 32);
        const variantBase = {
            [TILE.GRASS_TOP_ALT]: TILE.GRASS_TOP, [TILE.GRASS_SIDE_ALT]: TILE.GRASS_SIDE,
            [TILE.DIRT_ALT]: TILE.DIRT, [TILE.STONE_ALT]: TILE.STONE, [TILE.LEAVES_ALT]: TILE.LEAVES,
        };
        const oreColors = {
            [TILE.COAL_ORE]:    [[35,35,40], [52,52,58], [70,70,76]],
            [TILE.IRON_ORE]:    [[151,105,78], [183,132,96], [211,160,120]],
            [TILE.GOLD_ORE]:    [[193,139,24], [231,181,35], [250,215,74]],
            [TILE.DIAMOND_ORE]: [[30,151,157], [48,194,190], [102,229,216]],
        };
        const oreCenters = [[7,7], [22,6], [15,18], [26,25], [5,26]];
        const inOre = (x, y, tile) => {
            const shift = tile - TILE.COAL_ORE;
            return oreCenters.some(([cx, cy], i) => {
                const dx = Math.abs(x - ((cx + shift * 3) % 29 + 1));
                const dy = Math.abs(y - cy);
                return dx + dy <= (i % 2 ? 2 : 3) && !(dx === 3 && dy === 0);
            });
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
            switch (tile) {
                case TILE.GRASS_TOP: {
                    const band = (x * 5 + y * 3 + alt) % 7;
                    return [70 + band * 4 + j(3), 145 + band * 5 + j(4), 62 + band * 3 + j(3)];
                }
                case TILE.DIRT: {
                    const pebble = (x * 11 + y * 7 + alt * 3) % 19 === 0;
                    return [132 + j(7) - (pebble ? 24 : 0), 73 + j(5) - (pebble ? 12 : 0), 37 + j(4)];
                }
                case TILE.GRASS_SIDE: {
                    const edge = grassEdges[alt][x];
                    if (y < edge) return [72 + j(5), 151 + j(7) + (edge - y) * 2, 62 + j(4)];
                    const root = y === edge && x % 3 === 0;
                    return [132 + j(7) - (root ? 18 : 0), 73 + j(5), 37 + j(4)];
                }
                case TILE.STONE: {
                    const seam = (x * 13 + y * 7 + alt * 5) % 31 === 0;
                    const c = 119 + j(7) - (seam ? 22 : 0);
                    return [c, c, c + 2];
                }
                case TILE.COAL_ORE: case TILE.IRON_ORE: case TILE.GOLD_ORE: case TILE.DIAMOND_ORE: {
                    if (inOre(x, y, tile)) {
                        const pal = oreColors[tile];
                        return pal[(x * 3 + y * 5) % pal.length];
                    }
                    const c = 116 + j(6) - (((x * 13 + y * 7) % 31 === 0) ? 18 : 0);
                    return [c, c, c + 2];
                }
                case TILE.COBBLE: {
                    const row = Math.floor(y / 8), off = (row % 2) * 5;
                    const col = Math.floor((x + off) / 10);
                    const edge = ((x + off) % 10 === 0) || (y % 8 === 0);
                    const c = edge ? 70 + j(5) : cobbleShade[(row * 5 + col) % cobbleShade.length] + j(5);
                    return [c, c, c];
                }
                case TILE.WOOD: {
                    const fiber = x % 8;
                    const dark = fiber === 0 || fiber === 1 || ((x * 5 + y * 3) % 37 === 0);
                    const knot = (x >= 19 && x <= 22 && y >= 13 && y <= 17);
                    return [dark || knot ? 105 + j(4) : 153 + j(4), dark || knot ? 65 + j(3) : 94 + j(4), dark || knot ? 35 + j(2) : 48 + j(3)];
                }
                case TILE.WOOD_END: {
                    const dx = Math.abs(x - 15.5), dy = Math.abs(y - 15.5);
                    const r = Math.max(dx, dy);
                    if (r > 14) return [91 + j(3), 57 + j(3), 30 + j(2)];
                    const ring = Math.floor(r) % 4 === 0;
                    const core = dx < 2 && dy < 2;
                    return [ring || core ? 119 + j(3) : 174 + j(4), ring || core ? 79 + j(3) : 124 + j(4), ring || core ? 42 + j(2) : 66 + j(3)];
                }
                case TILE.LEAVES: {
                    const leafHole = (px, py) => hash2(px, py, 800 + alt) < 0.07;
                    if (leafHole(x, y) && !leafHole(x - 1, y) && !leafHole(x + 1, y) &&
                        !leafHole(x, y - 1) && !leafHole(x, y + 1)) return [0, 0, 0, 0];
                    const n = ((x * 7 + y * 13 + alt * 2) % 5 === 0) ? -28 : ((x + y) % 7 === 0 ? 16 : 0);
                    return [42 + n * 0.35 + j(4), 126 + n + j(6), 45 + n * 0.4 + j(4)];
                }
                case TILE.PLANKS: {
                    const board = Math.floor(y / 8);
                    const seam = (y % 8 === 0);
                    const vseam = ((x + board * 11) % 16 === 0) && !seam;
                    const shade = seam ? 65 : vseam ? 35 : (board % 2) * 8;
                    return [178 - shade + j(4), 133 - shade + j(4), 78 - shade + j(3)];
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
                case TILE.FURNACE_FRONT: {
                    if (x >= 9 && x <= 22 && y >= 12 && y <= 24) {
                        if (y >= 21) return [235 + j(8), 125 + j(12), 30 + j(6)];
                        return [28 + j(3), 28 + j(3), 32 + j(3)];
                    }
                    const c = ((x < 2 || x > 29 || y < 2 || y > 29) ? 80 : 125) + j(7);
                    return [c, c, c];
                }
                case TILE.CHEST_TOP: {
                    const edge = x < 2 || x > 29 || y < 2 || y > 29;
                    if (edge) return [88 + j(4), 56 + j(3), 24 + j(2)];
                    return [150 + j(4), 100 + j(4), 48 + j(3)];
                }
                case TILE.CHEST_SIDE: {
                    if (y < 2 || y > 29 || x < 2 || x > 29) return [88 + j(4), 56 + j(3), 24 + j(2)];
                    if (y >= 12 && y <= 13) return [70 + j(3), 45 + j(2), 20 + j(2)];
                    if (x >= 14 && x <= 17 && y >= 11 && y <= 18) return [205 + j(6), 190 + j(6), 70 + j(5)];
                    return [160 + j(4), 108 + j(4), 52 + j(3)];
                }
                case TILE.FURNACE_TOP: {
                    const c = ((x < 3 || x > 28 || y < 3 || y > 28) ? 85 : 110) + j(6);
                    return [c, c, c];
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
