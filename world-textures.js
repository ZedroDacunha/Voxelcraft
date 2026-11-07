import { hash2, mulberry32 } from './world-math.js';
import { ATLAS_COLUMNS, ATLAS_ROWS, BLOCKS, ITEMS, TILE, TILE_PX, atlasTileRect } from './world-catalog.js';
import { createBlockIconPixels } from './world-block-icons.js';
import { MEAT_SPRITE_CORES } from './world-meats.js';
import { createCoalItemSpritePixels, createMineralOrePixel, createMineralSpritePixels, isMineralOreTile } from './world-mineral-textures.js';
import {
    createAxeSpritePixels,
    createPickaxeSpritePixels,
    createShearsSpritePixels,
    createShovelSpritePixels,
} from './world-tool-textures.js';

/**
 * A pedra: mancha em faixas (estrato), grão fino e um respingo aqui e ali.
 *
 * É a mesma conta para o bloco de pedra e para o fundo dos minérios — antes o
 * minério desenhava um cinza liso por conta própria, e a pedra ao lado dele
 * tinha outra textura. Quem muda a pedra muda o fundo de todo minério junto.
 */
export function stonePixel(x, y, alt = 0) {
    const stratum = hash2(Math.floor(x / 4), Math.floor(y / 2), 5021 + alt * 113);
    const grain = hash2(Math.floor(x / 2), Math.floor(y / 2), 641 + alt * 197);
    const fleck = hash2(x, y, 1801 + alt * 67);
    let c = 124 + (stratum - 0.5) * 18 + (grain - 0.5) * 12;
    if (fleck > 0.975) c += 12;
    else if (fleck < 0.025) c -= 12;
    return [c, c + 1, c + 2];
}

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

/**
 * A arte de cada tile, pixel a pixel — sem canvas, sem THREE.
 *
 * Antes isso vivia dentro de `createAtlasTexture`, que precisa de um canvas do
 * navegador: nenhum teste (nem a página de comparação de texturas) conseguia ver
 * um pixel sem montar a folha inteira. Agora é uma função pura de (tile, x, y)
 * para RGBA, e a folha só pinta o que ela devolve.
 */
export function createTilePixelSource() {
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
        if (isMineralOreTile(tile)) return createMineralOrePixel(tile, x, y, stonePixel);
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
                // A mesma pedra que serve de fundo para todo minério.
                return stonePixel(x, y, alt);
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
            // Lã: cor chapada com fiapos curtos de 2 px e uma trama leve na
            // diagonal. Mancha grande vira sujeira, e ruído puro vira areia —
            // o que faz ler como lã é a trama curta e regular.
            case TILE.WOOL_WHITE:
            case TILE.WOOL_GRAY:
            case TILE.WOOL_BLACK: {
                const base = tile === TILE.WOOL_WHITE ? [234, 230, 219]
                    : tile === TILE.WOOL_GRAY ? [150, 150, 145]
                        : [58, 58, 62];
                const tuft = hash2(Math.floor(x / 2), Math.floor(y / 2), 7717);
                const fuzz = hash2(x, y, 9091);
                let shade = 1 + (tuft - 0.5) * 0.13;
                if (fuzz > 0.92) shade += 0.09;
                else if (fuzz < 0.08) shade -= 0.09;
                // Trama: uma linha clara e uma escura a cada oito pixels.
                if ((x + y) % 8 === 0) shade -= 0.05;
                else if ((x + y) % 8 === 4) shade += 0.04;
                return base.map(channel => Math.max(0, Math.min(255, Math.round(channel * shade))));
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
            case TILE.WOOD_DOOR_UPPER:
            case TILE.WOOD_DOOR_LOWER: {
                // A porta é UMA peça de dois blocos: a arte é desenhada na
                // folha inteira (32×64) e só então recortada nas metades.
                // Desenhar cada metade por si deixava uma faixa escura de
                // 4 px no meio — a porta lia como dois blocos empilhados.
                const upperFace = sourceTile === TILE.WOOD_DOOR_UPPER;
                const gx = x;
                const gy = upperFace ? y : y + TILE_PX;

                // Madeira clara (carvalho), com veio curto e pouco ruído:
                // mancha grande vira sujeira quando o bloco é pequeno na tela.
                const tone = hash2(Math.floor(gx / 2), Math.floor(gy / 6), 8123 + alt * 41);
                const shift = tone > 0.84 ? 8 : tone < 0.16 ? -8 : 0;
                const light = 176 + shift + j(2);
                const base = [light, light * 0.71, light * 0.43];
                const shade = amount => base.map(channel => channel + amount);

                // Batente: borda de fora escurecida, vinco claro por dentro.
                // O contraste do batente é de propósito maior que o do veio:
                // com pouco degrau o vinco some no ruído da madeira e a porta
                // perde a moldura.
                if (gx < 1 || gx > 30 || gy < 1 || gy > 62) return shade(-46);
                if (gx < 2 || gx > 29 || gy < 2 || gy > 61) {
                    return gx === 2 || gy === 2 ? shade(22) : shade(-24);
                }

                // Dobradiças de ferro coladas na borda esquerda, uma por
                // metade — é o que faz o bloco se ler como porta de longe.
                const hingeTop = gy >= 10 && gy <= 12 ? 10 : gy >= 50 && gy <= 52 ? 50 : null;
                if (hingeTop !== null && gx >= 1 && gx <= 7) {
                    if (gy === hingeTop || gy === hingeTop + 2) return [58, 62, 66];
                    if (gx === 2) return [158, 162, 166];
                    if (gx === 3 || gx === 6) return [58, 62, 66];
                    return [108, 112, 116];
                }

                // Maçaneta na altura da mão, com luz em cima à esquerda e
                // sombra embaixo à direita (o dourado chapado sumia no fundo).
                if (gx >= 23 && gx <= 25 && gy >= 29 && gy <= 31) {
                    if (gx === 23 && gy === 29) return [255, 240, 178];
                    if (gx === 25 || gy === 31) return [164, 122, 42];
                    return [234, 198, 98];
                }

                // Dois painéis rebaixados, um em cada metade: borda escura,
                // sombra por dentro em cima/à esquerda, luz embaixo/à direita.
                for (const [panelTop, panelBottom] of [[5, 21], [42, 58]]) {
                    if (gx < 7 || gx > 24 || gy < panelTop || gy > panelBottom) continue;
                    if (gx === 7 || gx === 24 || gy === panelTop || gy === panelBottom) return shade(-20);
                    if (gy === panelTop + 1 || gx === 8) return shade(-34);
                    if (gy === panelBottom - 1 || gx === 23) return shade(20);
                    return shade(-10);
                }

                // Veio curto entre os painéis: sem ele a madeira fica chapada.
                if (gy > 23 && gy < 40 && (gx === 16 || gx === 17)) return shade(-10);
                return base;
            }
            case TILE.MOFIM_LANTERN: {
                // Moldura na cor do bicho (verde-musgo) com o pó aceso no
                // meio: o bloco tem que se ler como "lanterna" mesmo longe.
                const border = x < 3 || x > 28 || y < 3 || y > 28;
                const frame = x < 6 || x > 25 || y < 6 || y > 25;
                if (border) return [58 + j(5), 74 + j(5), 62 + j(4)];
                if (frame) return [86 + j(6), 122 + j(6), 100 + j(5)];
                // Cantos rebitados da moldura.
                if ((x < 8 || x > 23) && (y < 8 || y > 23)) return [120, 150, 128];
                const dx = (x - 15.5) / 10, dy = (y - 15.5) / 10;
                const dist = Math.hypot(dx, dy);
                if (dist > 1) return [70 + j(5), 96 + j(5), 82 + j(4)];
                const glow = 1 - dist;
                const fleck = hash2(x, y, 9311);
                if (glow > 0.62) return [255, 246 + j(6), 190 + j(8)];
                if (glow > 0.3) return [250 + j(5), 214 + j(8), 118 + j(8)];
                const base = 168 + Math.floor(glow * 46) + (fleck > 0.9 ? 18 : 0);
                return [base + j(6), base - 34 + j(6), 46 + j(5)];
            }
            case TILE.WATER: {
                return [45 + j(8), 110 + j(8), 215 + j(8)];
            }
        }
        return [255, 0, 255];
    };
    return pixel;
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
    // O ícone de bloco amostra a arte de verdade do tile, então precisa da mesma
    // fonte de pixels que o atlas usa. Ela é criada uma vez só.
    let fonteDeTiles = null;
    const pixelDoTile = () => (fonteDeTiles ??= createTilePixelSource());

    function spritePixels(kind, mat) {
        const key = kind + ':' + mat;
        if (spriteCache[key]) return spriteCache[key];
        // Bloco na barra/inventário: cubo isométrico de 32×32 (ver world-block-icons.js).
        if (kind === 'block') {
            const bloco = BLOCKS[Number(mat)];
            if (!bloco) return null;
            return (spriteCache[key] = createBlockIconPixels(bloco.tiles, pixelDoTile()));
        }
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
    
        if (kind === 'door') {
            // Sem este caso o item porta ficava com o ícone vazio, porque o
            // atlas só desenha itens que têm sprite definido.
            const doorPixels = [
                '................',
                '..DDDDDDDDDDDD..',
                '..DwwwwwwwwwwD..',
                '..DwwwwwwwwwwD..',
                '..DwwLLwwwwwwD..',
                '..DwwwwwwwwwwD..',
                '..DwwwwwwwwwwD..',
                '..DwwLLwwwwwwD..',
                '..DwwwwwwwwhhD..',
                '..DwwwwwwwwhhD..',
                '..DwwwwwwwwwwD..',
                '..DwwLLwwwwwwD..',
                '..DwwwwwwwwwwD..',
                '..DwwwwwwwwwwD..',
                '..DDDDDDDDDDDD..',
                '................',
            ];
            const doorColors = { D: [92, 60, 34], w: [150, 104, 62], L: [176, 128, 82], h: [226, 190, 96] };
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const color = doorColors[doorPixels[y][x]];
                if (color) put(x, y, color);
            }
            return (spriteCache[key] = g);
        }

        // Carvão vegetal: arte própria (madeira queimada, três gravetos). Antes ele era
        // uma elipse chapada e ficava quase igual ao mineral na barra de itens.
        if (kind === 'charcoal') return (spriteCache[key] = createCoalItemSpritePixels('vegetal'));

        if (kind === 'apple') {
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const dx = (x - 7.5) / 4.5, dy = (y - 9.5) / 4.5;
                if (dx * dx + dy * dy <= 1)
                    put(x, y, ((x === 6 && y === 7) || (x === 5 && y === 8)) ? [240, 110, 100] : (dx + dy > 0.9 ? [150, 25, 30] : [205, 40, 45]));
            }
            put(8, 4, [110, 70, 30]); put(8, 5, [110, 70, 30]); put(9, 4, [60, 150, 50]); put(10, 4, [60, 150, 50]);
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
    
        if (kind === 'mofim-dust') {
            // Poeira de vaga-lume: uns grãos acesos espalhados, com halo fraco.
            const grains = [
                [5, 5, 2], [10, 4, 1], [3, 9, 1], [8, 9, 2], [12, 10, 1], [6, 12, 1], [11, 13, 1],
            ];
            for (const [gx, gy, size] of grains) {
                put(gx, gy, [255, 246, 190]);
                if (size > 1) {
                    put(gx + 1, gy, [250, 214, 118]);
                    put(gx, gy + 1, [236, 186, 86]);
                }
            }
            put(4, 6, [214, 158, 62]);
            put(9, 10, [214, 158, 62]);
            put(7, 13, [206, 148, 56]);
            return (spriteCache[key] = g);
        }

        if (kind === 'wool') {
            // Novelho de lã: quadrado macio com as beiradas irregulares e duas
            // mechas claras. A cor vem do mat (branca, cinza, preta).
            const bases = { white: [236, 232, 221], gray: [152, 152, 146], black: [62, 62, 68] };
            const base = bases[mat] ?? bases.white;
            const light = base.map(c => Math.min(255, c + 22));
            const dark = base.map(c => Math.max(0, c - 30));
            for (let y = 2; y <= 13; y++) for (let x = 2; x <= 13; x++) {
                const edge = x === 2 || x === 13 || y === 2 || y === 13;
                if (edge && hash2(x, y, 4471) < 0.42) continue; // beirada felpuda
                const fuzz = hash2(x, y, 6151);
                put(x, y, edge ? dark : fuzz > 0.86 ? light : dark);
            }
            for (const [x, y] of [[5, 5], [6, 5], [5, 6], [10, 9], [9, 10], [10, 10]]) put(x, y, light);
            return (spriteCache[key] = g);
        }

        // As carnes: um naco de borda escura, duas veias de gordura clara e a
        // ponta do osso aparecendo no canto de cima. A silhueta é a **mesma**
        // para a crua e a assada — o que muda é a paleta (rosado → tostado) e as
        // marcas de grelha, porque o olho tem que reconhecer que é o mesmo
        // pedaço, só assado. As cores vêm de `world-meats.js`: bicho novo com
        // carne ganha o par de sprites só de entrar na tabela de lá.
        const coresCarne = MEAT_SPRITE_CORES[kind];
        if (coresCarne) {
            const cozida = mat === 'cooked';
            const paleta = cozida ? coresCarne.cooked : coresCarne.raw;
            for (let y = 3; y <= 12; y++) for (let x = 2; x <= 12; x++) {
                const dx = (x - 7) / 5, dy = (y - 7.6) / 4.4;
                const d = dx * dx + dy * dy;
                if (d > 1) continue;
                put(x, y, d > 0.6 ? paleta.borda : paleta.carne);
            }
            for (const [x, y] of [[5, 6], [6, 6], [7, 6], [5, 7], [6, 10], [7, 10], [8, 9]]) put(x, y, paleta.gordura);
            // A ponta do osso: em contato com o naco, senão ela flutua solta na
            // barra de itens (era o que acontecia com o desenho antigo).
            for (const [x, y] of [[10, 4], [11, 3], [12, 2], [12, 3], [11, 2], [11, 4]]) put(x, y, paleta.osso);
            if (cozida) {
                // Dois riscos de grelha na diagonal: é o que separa a assada da
                // crua mesmo a 16×16, na barra de itens.
                for (const [x, y] of [[4, 7], [5, 8], [6, 9], [7, 7], [8, 8], [9, 9]]) put(x, y, paleta.marca);
                put(3, 9, paleta.borda);
                put(9, 11, paleta.borda);
            }
            return (spriteCache[key] = g);
        }

        if (kind === 'shears') {
            // Arte da casa (ver GUIA-DE-ARTE.md): base fiel do sprite clássico
            // com 2 px nossos, lâminas de ferro e punho de tábua.
            const arteDaTesoura = createShearsSpritePixels();
            if (arteDaTesoura) return (spriteCache[key] = arteDaTesoura);
            // Desenho antigo, para nada quebrar se a arte sumir.
            const hc = HEAD_COLORS[mat] ?? HEAD_COLORS.iron;
            const blade = (x, y) => put(x, y, hc.l);
            for (let i = 0; i < 7; i++) {
                blade(3 + i, 2 + i);       // lâmina de cima (da esquerda para baixo)
                blade(12 - i, 2 + i);      // lâmina de baixo
            }
            for (let i = 0; i < 7; i++) {
                blade(4 + i, 3 + i);
                blade(11 - i, 3 + i);
            }
            // Pivô no meio e as argolas na ponta de baixo.
            put(7, 8, hc.d); put(8, 8, hc.d); put(7, 9, hc.d); put(8, 9, hc.d);
            for (const [x, y] of [[5, 11], [6, 12], [5, 12], [10, 11], [9, 12], [10, 12]]) put(x, y, hc.d);
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
            // Arte da casa (ver GUIA-DE-ARTE.md e world-tool-textures.js): um
            // desenho só, uma paleta por material. Material fora da arte cai no
            // desenho antigo abaixo, para nada quebrar.
            const arte = createPickaxeSpritePixels(mat);
            if (arte) return (spriteCache[key] = arte);
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
            // Arte da casa (ver GUIA-DE-ARTE.md). Material fora da arte cai no
            // desenho antigo abaixo.
            const arteDaPa = createShovelSpritePixels(mat);
            if (arteDaPa) return (spriteCache[key] = arteDaPa);
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
            // Arte da casa (ver GUIA-DE-ARTE.md). Material fora da arte cai no
            // desenho antigo abaixo.
            const arteDoMachado = createAxeSpritePixels(mat);
            if (arteDoMachado) return (spriteCache[key] = arteDoMachado);
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
        canvas.height = ATLAS_ROWS * TILE_PX;
        const ctx = canvas.getContext('2d', { alpha: true });
        ctx.imageSmoothingEnabled = false;
        const pixel = createTilePixelSource();
        for (const tile of Object.values(TILE)) {
            const { x: originX, y: originY } = atlasTileRect(tile);
            for (let x = 0; x < TILE_PX; x++) for (let y = 0; y < TILE_PX; y++) {
                const raw = pixel(tile, x, y);
                if (raw[3] === 0) continue;
                const c = raw.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(v / 8) * 8)));
                ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
                ctx.fillRect(originX + x, originY + y, 1, 1);
            }
        }
    
        for (const item of Object.values(ITEMS)) {
            if (!item.sprite) continue;
            const pix = spritePixels(item.sprite.kind, item.sprite.mat);
            const { x: originX, y: originY } = atlasTileRect(item.iconTile);
            // Ícone de 16 px é dobrado (2×2); o de bloco já vem em 32 px e ocupa a
            // célula inteira, 1:1 — é o que dá o detalhe do cubo.
            const escala = Math.max(1, Math.round(TILE_PX / pix.length));
            for (let y = 0; y < pix.length; y++) for (let x = 0; x < pix.length; x++) {
                const c = pix[y][x];
                if (!c) continue;
                ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
                ctx.fillRect(originX + x * escala, originY + y * escala, escala, escala);
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
