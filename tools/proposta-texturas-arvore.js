// Primeiros 4 exemplos autorais para melhorar as texturas das árvores do Voxelcraft
// (`TILE.WOOD`, `TILE.WOOD_END`, `TILE.LEAVES` e `TILE.LEAVES_ALT`, todas em 32×32).
//
// Cada exemplo gera malhas 32×32 100% contínuas nas 4 bordas (módulo 32), com
// paletas inteiras harmonizadas à grama e terra aprovadas em `world-ground-textures.js`,
// iluminação coerente vinda do topo-esquerdo e recortes nítidos (`alpha = 0`) nas folhas.

import { TILE } from '../world-catalog.js';
import { createTilePixelSource } from '../world-textures.js';
import { BALANCED_TREE_TEXTURES } from '../world-tree-textures.js';

function ih2(ix, iy, seed) {
    let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
    return t * t * (3 - 2 * t);
}

function pnoise(x, y, nx, ny, seed) {
    const gx = (x / 32) * nx;
    const gy = (y / 32) * ny;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = smooth(gx - x0);
    const fy = smooth(gy - y0);
    const ix0 = ((x0 % nx) + nx) % nx;
    const ix1 = (ix0 + 1) % nx;
    const iy0 = ((y0 % ny) + ny) % ny;
    const iy1 = (iy0 + 1) % ny;
    const a = ih2(ix0, iy0, seed);
    const b = ih2(ix1, iy0, seed);
    const c = ih2(ix0, iy1, seed);
    const d = ih2(ix1, iy1, seed);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

function makeGrid(initRgba = [0, 0, 0, 0]) {
    return Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => [...initRgba]));
}

function setPx(grid, x, y, rgba) {
    const gx = ((x % 32) + 32) % 32;
    const gy = ((y % 32) + 32) % 32;
    grid[gy][gx] = rgba.length === 4 ? rgba : [rgba[0], rgba[1], rgba[2], 255];
}

function stampSprite(grid, ox, oy, rows, charMap, flipX = false) {
    for (let sy = 0; sy < rows.length; sy++) {
        const row = rows[sy];
        const w = row.length;
        for (let sx = 0; sx < w; sx++) {
            const ch = row[flipX ? (w - 1 - sx) : sx];
            if (ch === '.' || !charMap[ch]) continue;
            setPx(grid, ox + sx, oy + sy, charMap[ch]);
        }
    }
}

function buildBarkGrid({
    colWidths,
    pal,
    seed,
    crossFreq = 2,
    streakChance = 0.45,
    mossChance = 0,
    clean = false,
}) {
    const grid = makeGrid([pal.mid[0], pal.mid[1], pal.mid[2], 255]);
    const nCols = colWidths.length;
    const baseX = [0];
    for (const w of colWidths) baseX.push(baseX[baseX.length - 1] + w);

    const furrowAt = (i, y) => {
        const ii = ((i % nCols) + nCols) % nCols;
        const phase = ih2(ii, 0, seed) * Math.PI * 2;
        const phase2 = ih2(ii, 1, seed) * Math.PI * 2;
        const wave = Math.sin((y / 32) * Math.PI * 2 + phase) * 0.85
            + Math.sin((y / 32) * Math.PI * 4 + phase2) * 0.45;
        return Math.round(wave);
    };

    const splits = Array.from({ length: nCols }, (_, c) => {
        const arr = [];
        for (let k = 0; k < crossFreq; k++) {
            const base = Math.floor((k + 0.2 + ih2(c, k + 10, seed) * 0.6) * (32 / crossFreq)) % 32;
            arr.push(base);
        }
        return arr;
    });

    for (let y = 0; y < 32; y++) {
        for (let c = 0; c < nCols; c++) {
            const left = baseX[c] + furrowAt(c, y);
            const right = baseX[c + 1] + furrowAt(c + 1, y);
            const width = Math.max(2, right - left);
            const colTone = ih2(c, 77, seed);

            let dySplit = 99;
            let signedSplit = 99;
            for (const sy of splits[c]) {
                const d = ((y - sy + 48) % 32) - 16;
                if (Math.abs(d) < dySplit) {
                    dySplit = Math.abs(d);
                    signedSplit = d;
                }
            }

            for (let dx = 0; dx < width; dx++) {
                const px = left + dx;
                const slantD = signedSplit - (dx > width * 0.5 ? 1 : 0);
                let color;
                if (dx === 0) {
                    if (mossChance > 0 && pnoise(px, y, 5, 5, seed + 501) > (1 - mossChance)) {
                        color = pal.mossDark;
                    } else {
                        color = pal.fissure;
                    }
                } else if (slantD === 0 && dx < width - 1) {
                    color = mossChance > 0 && pnoise(px, y, 5, 5, seed + 501) > (1 - mossChance * 0.85)
                        ? pal.mossBright
                        : pal.fissure;
                } else if (slantD === 1) {
                    color = pal.hi2 ?? pal.hi;
                } else if (slantD === -1) {
                    color = pal.shadow;
                } else if (dx === 1) {
                    color = (colTone > 0.6 && !clean) ? (pal.hi2 ?? pal.hi) : pal.hi;
                } else if (dx === width - 1) {
                    if (mossChance > 0 && pnoise(px, y, 5, 5, seed + 501) > (1 - mossChance * 0.68)) {
                        color = pal.mossBright;
                    } else {
                        color = pal.shadow;
                    }
                } else if (clean) {
                    color = colTone > 0.55 ? pal.midHi : pal.mid;
                } else {
                    const fiber = pnoise(px * 2, y, 16, 4, seed + 303);
                    if (fiber > 1 - streakChance * 0.42) color = pal.hi;
                    else if (fiber > 0.52) color = pal.midHi;
                    else if (fiber > 0.24) color = pal.mid;
                    else color = pal.shadow;
                }
                setPx(grid, px, y, color);
            }
        }
    }

    return grid;
}

function makePlacements(seed, countBack, countMid, countFront, spriteCount, holeCount, bigHoles = false) {
    const gen = (nx, ny, sOff) => {
        const out = [];
        for (let gy = 0; gy < ny; gy++) {
            for (let gx = 0; gx < nx; gx++) {
                const jx = Math.floor((gx + 0.15 + ih2(gx, gy, seed + sOff) * 0.7) * (32 / nx));
                const jy = Math.floor((gy + 0.15 + ih2(gx, gy, seed + sOff + 19) * 0.7) * (32 / ny));
                const sp = Math.floor(ih2(gx, gy, seed + sOff + 53) * spriteCount);
                const fl = ih2(gx, gy, seed + sOff + 97) > 0.5;
                out.push([jx, jy, sp, fl]);
            }
        }
        return out;
    };
    const holeShapes = bigHoles
        ? [
            [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1]],
            [[0, 0], [1, 0], [1, 1], [0, 1]],
            [[0, 0], [1, 0], [0, 1]],
            [[1, 0], [0, 1], [1, 1], [1, 2]],
        ]
        : [
            [[0, 0], [1, 0], [0, 1]],
            [[0, 0], [1, 0], [1, 1]],
            [[0, 0], [0, 1], [1, 1]],
            [[0, 0], [1, 0]],
        ];
    const holes = [];
    const hSide = Math.round(Math.sqrt(holeCount));
    for (let gy = 0; gy < hSide; gy++) {
        for (let gx = 0; gx < hSide; gx++) {
            if (holes.length >= holeCount) break;
            const hx = Math.floor((gx + 0.2 + ih2(gx, gy, seed + 701) * 0.6) * (32 / hSide));
            const hy = Math.floor((gy + 0.2 + ih2(gx, gy, seed + 733) * 0.6) * (32 / hSide));
            const sh = holeShapes[Math.floor(ih2(gx, gy, seed + 777) * holeShapes.length)];
            holes.push([hx, hy, sh]);
        }
    }
    return {
        back: gen(countBack[0], countBack[1], 100),
        mid: gen(countMid[0], countMid[1], 200),
        front: gen(countFront[0], countFront[1], 300),
        holes,
    };
}

function buildStampedLeaves({ sprites, backMap, midMap, frontMap, placements, holeTarget = 0.14, seed }) {
    const grid = makeGrid([0, 0, 0, 0]);
    for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
            const n = pnoise(x, y, 6, 6, seed) * 0.65 + pnoise(x, y, 12, 12, seed + 41) * 0.35;
            if (n > holeTarget + 0.18) {
                grid[y][x] = [...backMap.d, 255];
            }
        }
    }

    for (const pass of ['back', 'mid', 'front']) {
        const cmap = pass === 'back' ? backMap : pass === 'mid' ? midMap : frontMap;
        const list = placements[pass];
        for (let i = 0; i < list.length; i++) {
            const [ox, oy, spIdx, flip] = list[i];
            stampSprite(grid, ox, oy, sprites[spIdx], cmap, flip);
        }
    }

    for (const [hx, hy, shape] of placements.holes) {
        for (const [dx, dy] of shape) {
            setPx(grid, hx + dx, hy + dy, [0, 0, 0, 0]);
            const up = grid[((hy + dy - 1) + 32) % 32][((hx + dx) + 32) % 32];
            if (up[3] > 0 && dy === 0) setPx(grid, hx + dx, hy + dy - 1, backMap.s);
        }
    }
    return grid;
}

function buildGridFromFn(fn) {
    return Array.from({ length: 32 }, (_, y) =>
        Array.from({ length: 32 }, (_, x) => {
            const c = fn(x, y);
            return c.length === 4 ? c : [c[0], c[1], c[2], 255];
        })
    );
}

// ==================== EXEMPLO 2: CARVALHO ANTIGO DA FLORESTA ====================
function createExample2() {
    const barkPal = {
        fissure: [38, 26, 18],
        shadow: [64, 45, 32],
        mid: [90, 66, 46],
        midHi: [112, 83, 57],
        hi: [134, 101, 69],
        hi2: [150, 116, 80],
        mossDark: [58, 88, 42],
        mossBright: [82, 118, 52],
    };
    const woodGrid = buildBarkGrid({
        colWidths: [6, 5, 6, 5, 5, 5],
        pal: barkPal,
        seed: 208,
        crossFreq: 3,
        streakChance: 0.52,
        mossChance: 0.30,
    });

    const forestSprites = [
        [
            '..hh...',
            '.hllhh.',
            'hlllmmm',
            '.lmmmss',
            'llmmssd',
            '.mmssdd',
        ],
        [
            '.hh.hh.',
            'hllllmm',
            'lllmmms',
            '.lmmmss',
            '..mssd.',
        ],
        [
            '..hhh..',
            '.hlllm.',
            'hllmmms',
            'lmmmmss',
            '.mssdd.',
        ],
    ];
    const leafBack = { d: [24, 50, 28], s: [34, 68, 34], m: [48, 88, 42], l: [62, 106, 48], h: [74, 120, 52] };
    const leafMid = { d: [28, 58, 32], s: [42, 80, 38], m: [62, 108, 46], l: [84, 134, 54], h: [104, 152, 62] };
    const leafFront = { d: [36, 68, 36], s: [54, 96, 44], m: [80, 128, 54], l: [106, 154, 62], h: [132, 174, 72] };

    const leaves0 = buildStampedLeaves({
        sprites: forestSprites, backMap: leafBack, midMap: leafMid, frontMap: leafFront,
        placements: makePlacements(2101, [5, 5], [5, 5], [4, 4], forestSprites.length, 9, false),
        holeTarget: 0.10, seed: 2101,
    });
    const leaves1 = buildStampedLeaves({
        sprites: forestSprites, backMap: leafBack, midMap: leafMid, frontMap: leafFront,
        placements: makePlacements(2201, [5, 5], [5, 5], [4, 4], forestSprites.length, 9, false),
        holeTarget: 0.10, seed: 2201,
    });

    const woodEndGrid = buildGridFromFn((x, y) => {
        const cx = x - 15.5;
        const cy = y - 15.5;
        const wob = (pnoise(x, y, 7, 7, 811) - 0.5) * 1.3;
        const r = Math.max(Math.abs(cx), Math.abs(cy)) * 0.72 + Math.hypot(cx, cy) * 0.33 + wob;
        if (r > 14.6) return pnoise(x, y, 5, 5, 823) > 0.68 ? barkPal.mossBright : barkPal.mid;
        if (r > 13.1) return barkPal.fissure;
        if (cx < -1 && cx > -10 && Math.abs(cy + cx * 0.25) < 0.48) return [76, 48, 28];
        if (r < 2.0) return [76, 48, 28];
        if (r < 5.2) return (Math.floor(r * 1.2) % 2 === 0) ? [142, 98, 54] : [122, 84, 46];
        const rp = (r - 5.2) / 2.35;
        const fr = rp - Math.floor(rp);
        if (fr < 0.30) return [124, 86, 48];
        return (Math.floor(rp) % 2 === 0) ? [206, 172, 114] : [186, 148, 92];
    });

    return {
        id: 'ex2',
        badge: 'Exemplo 2 · Floresta Antiga',
        tag: 'Casca Rugosa com Musgo · Copa Densa',
        title: 'Exemplo 2 — Carvalho Rústico da Mata',
        description: 'Placas grossas de casca escura com discretos pontos de musgo nas fendas, cerne âmbar largo no corte e tufos trilobados densos de mata fechada.',
        recommended: false,
        wood: (x, y) => woodGrid[y][x],
        woodEnd: (x, y) => woodEndGrid[y][x],
        leaves: (x, y, alt = 0) => (alt ? leaves1 : leaves0)[y][x],
    };
}

// ==================== EXEMPLO 3: CEDRO / IPÊ DO CAMPO ====================
function createExample3() {
    const barkPal = {
        fissure: [52, 26, 20],
        shadow: [82, 43, 31],
        mid: [112, 62, 43],
        midHi: [136, 79, 54],
        hi: [160, 98, 66],
        hi2: [180, 118, 80],
    };
    const woodGrid = buildBarkGrid({
        colWidths: [4, 3, 4, 3, 4, 4, 3, 4, 3],
        pal: barkPal,
        seed: 303,
        crossFreq: 1,
        streakChance: 0.60,
    });

    const cedarSprites = [
        [
            '...hh..',
            '.hhllmm',
            'hllmmss',
            '.mmssdd',
        ],
        [
            '..hh...',
            '.hllmm.',
            'llmmmss',
            '.mssdd.',
        ],
        [
            '.hh....',
            'hlllmm.',
            '.lmmmss',
            '..ssdd.',
        ],
    ];
    const leafBack = { d: [28, 66, 30], s: [40, 88, 36], m: [56, 112, 44], l: [74, 132, 50], h: [90, 148, 56] };
    const leafMid = { d: [34, 76, 34], s: [48, 102, 42], m: [72, 132, 50], l: [98, 158, 58], h: [122, 176, 66] };
    const leafFront = { d: [42, 88, 38], s: [62, 118, 48], m: [94, 152, 58], l: [124, 178, 68], h: [150, 198, 80] };

    const leaves0 = buildStampedLeaves({
        sprites: cedarSprites, backMap: leafBack, midMap: leafMid, frontMap: leafFront,
        placements: makePlacements(3101, [5, 5], [5, 5], [4, 4], cedarSprites.length, 16, true),
        holeTarget: 0.22, seed: 3101,
    });
    const leaves1 = buildStampedLeaves({
        sprites: cedarSprites, backMap: leafBack, midMap: leafMid, frontMap: leafFront,
        placements: makePlacements(3201, [5, 5], [5, 5], [4, 4], cedarSprites.length, 16, true),
        holeTarget: 0.22, seed: 3201,
    });

    const woodEndGrid = buildGridFromFn((x, y) => {
        const cx = x - 15.5;
        const cy = y - 15.5;
        const wob = (pnoise(x, y, 6, 6, 1201) - 0.5) * 0.85;
        const r = Math.max(Math.abs(cx), Math.abs(cy)) * 0.74 + Math.hypot(cx, cy) * 0.30 + wob;
        if (r > 14.9) return (cx + cy < 0) ? barkPal.midHi : barkPal.mid;
        if (r > 13.4) return barkPal.fissure;
        if (r < 1.6) return [90, 46, 32];
        if (r < 4.2) return [164, 102, 64];
        const rp = (r - 2.0) / 2.2;
        const fr = rp - Math.floor(rp);
        if (fr < 0.28) return [146, 90, 56];
        return (Math.floor(rp) % 2 === 0) ? [222, 184, 134] : [204, 160, 108];
    });

    return {
        id: 'ex3',
        badge: 'Exemplo 3 · Vivo & Arejado',
        tag: 'Tronco Cedro Avermelhado · Copa Leve',
        title: 'Exemplo 3 — Cedro Quente & Folhagem Fresca',
        description: 'Fibras verticais contínuas em marrom-cedro avermelhado, corte cor de mel e folíolos alongados em verde-primavera com respiros mais abertos para o céu.',
        recommended: false,
        wood: (x, y) => woodGrid[y][x],
        woodEnd: (x, y) => woodEndGrid[y][x],
        leaves: (x, y, alt = 0) => (alt ? leaves1 : leaves0)[y][x],
    };
}

// ==================== EXEMPLO 4: NOGUEIRA PINTADA (CLEAN PIXEL ART) ====================
function createExample4() {
    const barkPal = {
        fissure: [46, 33, 25],
        shadow: [74, 53, 39],
        mid: [104, 76, 55],
        midHi: [126, 95, 68],
        hi: [152, 117, 84],
        hi2: [168, 133, 96],
    };
    const woodGrid = buildBarkGrid({
        colWidths: [6, 5, 6, 5, 5, 5],
        pal: barkPal,
        seed: 404,
        crossFreq: 2,
        streakChance: 0,
        clean: true,
    });

    const cozySprites = [
        [
            '..hhhh..',
            '.hllllm.',
            'hllllmmm',
            'lllmmmms',
            'lmmmmmss',
            '.mmssdd.',
            '..dddd..',
        ],
        [
            '..hhh..',
            '.hlllm.',
            'hlllmmm',
            'llmmmms',
            '.mmmss.',
            '..ddd..',
        ],
    ];
    const leafBack = { d: [32, 62, 36], s: [44, 82, 42], m: [60, 104, 48], l: [78, 124, 54], h: [94, 140, 60] };
    const leafMid = { d: [34, 66, 38], s: [50, 92, 44], m: [74, 122, 52], l: [98, 148, 60], h: [122, 168, 70] };
    const leafFront = { d: [40, 76, 40], s: [60, 106, 48], m: [88, 138, 58], l: [114, 162, 66], h: [142, 184, 78] };

    const leaves0 = buildStampedLeaves({
        sprites: cozySprites, backMap: leafBack, midMap: leafMid, frontMap: leafFront,
        placements: makePlacements(4101, [4, 4], [4, 4], [3, 3], cozySprites.length, 12, false),
        holeTarget: 0.13, seed: 4101,
    });
    const leaves1 = buildStampedLeaves({
        sprites: cozySprites, backMap: leafBack, midMap: leafMid, frontMap: leafFront,
        placements: makePlacements(4201, [4, 4], [4, 4], [3, 3], cozySprites.length, 12, false),
        holeTarget: 0.13, seed: 4201,
    });

    const woodEndGrid = buildGridFromFn((x, y) => {
        const cx = x - 15.5;
        const cy = y - 15.5;
        const ax = Math.abs(cx);
        const ay = Math.abs(cy);
        const r = Math.max(ax, ay) * 0.65 + Math.hypot(cx, cy) * 0.40;
        if (r > 15.0) return (cx + cy < 0) ? barkPal.hi : barkPal.mid;
        if (r > 13.5) return barkPal.fissure;
        if (r < 1.8) return [82, 56, 38];
        if (r < 4.0) return [156, 116, 76];
        const band = Math.floor((r - 4.0) / 1.55);
        if (band % 3 === 0) return [136, 100, 64];
        return band % 2 === 0 ? [220, 192, 140] : [200, 170, 116];
    });

    return {
        id: 'ex4',
        badge: 'Exemplo 4 · Pintado / Clean',
        tag: 'Pixel Art Limpo · Poucos Tons',
        title: 'Exemplo 4 — Nogueira Suave Ilustrada',
        description: 'Grandes placas chanfradas sem ruído solto, anéis limpos de leitura imediata e cachos redondos aveludados estilo pixel-art ilustrado.',
        recommended: false,
        wood: (x, y) => woodGrid[y][x],
        woodEnd: (x, y) => woodEndGrid[y][x],
        leaves: (x, y, alt = 0) => (alt ? leaves1 : leaves0)[y][x],
    };
}

export function createCurrentTreeTextures() {
    const source = createTilePixelSource();
    const clampByte = v => Math.max(0, Math.min(255, Math.round(v)));
    const wrap = c => c.length === 4
        ? [clampByte(c[0]), clampByte(c[1]), clampByte(c[2]), clampByte(c[3])]
        : [clampByte(c[0]), clampByte(c[1]), clampByte(c[2]), 255];
    const woodGrid = Array.from({ length: 32 }, (_, y) =>
        Array.from({ length: 32 }, (_, x) => wrap(source(TILE.WOOD, x, y))));
    const woodEndGrid = Array.from({ length: 32 }, (_, y) =>
        Array.from({ length: 32 }, (_, x) => wrap(source(TILE.WOOD_END, x, y))));
    const leaves0 = Array.from({ length: 32 }, (_, y) =>
        Array.from({ length: 32 }, (_, x) => wrap(source(TILE.LEAVES, x, y))));
    const leaves1 = Array.from({ length: 32 }, (_, y) =>
        Array.from({ length: 32 }, (_, x) => wrap(source(TILE.LEAVES_ALT, x, y))));
    return {
        id: 'atual',
        badge: 'Referência · Atual no Jogo',
        tag: 'Procedural Atual (world-textures.js)',
        title: 'Atual no Jogo',
        description: 'Texturas atualmente utilizadas pelo jogo.',
        wood: (x, y) => woodGrid[y][x],
        woodEnd: (x, y) => woodEndGrid[y][x],
        leaves: (x, y, alt = 0) => (alt ? leaves1 : leaves0)[y][x],
    };
}

export const TREE_TEXTURE_EXAMPLES = [
    BALANCED_TREE_TEXTURES,
    createExample2(),
    createExample3(),
    createExample4(),
];
