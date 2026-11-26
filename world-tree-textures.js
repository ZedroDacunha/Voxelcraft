// Texturas de carvalho equilibrado aprovadas para o atlas do jogo.
// As folhas podem ser refinadas separadamente sem mudar a casca ou o corte.

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

function createBalancedTreeTextures() {
    const barkPal = {
        fissure: [48, 31, 19],
        shadow: [76, 50, 31],
        mid: [106, 73, 45],
        midHi: [126, 89, 55],
        hi: [148, 108, 67],
        hi2: [168, 126, 80],
    };
    const woodGrid = buildBarkGrid({
        colWidths: [5, 4, 5, 4, 5, 4, 5],
        pal: barkPal,
        seed: 101,
        crossFreq: 2,
        streakChance: 0.45,
    });

    const oakSprites = [
        [
            '..hh..',
            '.hllm.',
            'hllmmm',
            'lmmmms',
            '.mmss.',
            '..dd..',
        ],
        [
            '.hhh..',
            'hlllm.',
            'llmmms',
            '.mmmss',
            '..msd.',
        ],
        [
            '..hl..',
            '.hllmm',
            '.llmmm',
            '..mmss',
            '...dd.',
        ],
    ];
    const leafBack = { d: [32, 62, 30], s: [42, 78, 36], m: [56, 100, 44], l: [72, 118, 50], h: [84, 132, 54] };
    const leafMid = { d: [36, 68, 32], s: [50, 92, 42], m: [74, 122, 52], l: [96, 144, 62], h: [116, 160, 68] };
    const leafFront = { d: [44, 80, 38], s: [64, 108, 48], m: [92, 140, 60], l: [116, 162, 68], h: [142, 180, 78] };

    const leaves0 = buildStampedLeaves({
        sprites: oakSprites, backMap: leafBack, midMap: leafMid, frontMap: leafFront,
        placements: makePlacements(1101, [5, 5], [5, 5], [4, 4], oakSprites.length, 16, false),
        holeTarget: 0.14, seed: 1101,
    });
    const leaves1 = buildStampedLeaves({
        sprites: oakSprites, backMap: leafBack, midMap: leafMid, frontMap: leafFront,
        placements: makePlacements(1201, [5, 5], [5, 5], [4, 4], oakSprites.length, 16, false),
        holeTarget: 0.14, seed: 1201,
    });

    const woodEndGrid = buildGridFromFn((x, y) => {
        const cx = x - 15.5;
        const cy = y - 15.5;
        const wob = (pnoise(x, y, 6, 6, 401) - 0.5) * 1.05;
        const ax = Math.abs(cx);
        const ay = Math.abs(cy);
        const oct = Math.max(ax, ay) * 0.76 + Math.hypot(cx, cy) * 0.28 + wob;
        const notch = ((ax > ay ? y : x) % 6) === 0;
        if (oct > 15.0) {
            if (notch) return barkPal.shadow;
            return (cx + cy < 0) ? barkPal.hi : barkPal.mid;
        }
        if (oct > 13.7) return (cx + cy < 0) ? barkPal.midHi : barkPal.shadow;
        if (oct > 12.8) return barkPal.fissure;
        if (cy > 1 && cy < 10 && Math.abs(cx - cy * 0.32) < 0.50) return [92, 62, 36];
        if (oct < 1.7) return [92, 62, 36];
        if (oct < 3.5) return [160, 120, 70];
        const rp = (oct - 2.2) / 2.65;
        const fr = rp - Math.floor(rp);
        if (fr < 0.27) return [140, 102, 58];
        return (Math.floor(rp) % 2 === 0) ? [214, 182, 124] : [196, 162, 104];
    });

    return {
        id: 'ex1',
        badge: 'Exemplo 1 · Equilibrado',
        tag: 'Carvalho Solar · Paleta da Grama',
        title: 'Exemplo 1 — Carvalho Clássico Harmonizado',
        description: 'Tiras longas de casca castanho-quente sem costura vertical, corte com anéis octogonais suaves e folhas ovaladas sobrepostas na mesma família verde-oliva da nova grama.',
        recommended: true,
        wood: (x, y) => woodGrid[y][x],
        woodEnd: (x, y) => woodEndGrid[y][x],
        leaves: (x, y, alt = 0) => (alt ? leaves1 : leaves0)[y][x],
    };
}


export const BALANCED_TREE_TEXTURES = createBalancedTreeTextures();
