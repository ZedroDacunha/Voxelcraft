
import { openDatabase as dbOpen, storeRequest as dbRun } from './world-storage.js';
import { hash2, mulberry32, Noise2D } from './world-math.js';
import { ATLAS_COLUMNS, BLOCKS, FUEL, ID, ITEMS, matchRecipe, RECIPES, SMELT, TILE, TILE_PX } from './world-catalog.js';

async function loadThreeModules() {
    const providers = [
        { name: 'unpkg', base: 'https://unpkg.com/three@0.160.0' },
        { name: 'jsDelivr', base: 'https://cdn.jsdelivr.net/npm/three@0.160.0' },
    ];
    let lastError = null;
    for (const provider of providers) {
        try {
            const [THREE, controls] = await Promise.all([
                import(`${provider.base}/build/three.module.js`),
                import(`${provider.base}/examples/jsm/controls/PointerLockControls.js`),
            ]);
            return { THREE, PointerLockControls: controls.PointerLockControls };
        } catch (error) {
            lastError = error;
            console.warn(`Falha ao carregar Three.js por ${provider.name}; tentando o próximo CDN.`, error);
        }
    }

    const loading = document.getElementById('world-loading');
    loading.hidden = false;
    document.getElementById('world-loading-title').textContent = 'Não foi possível carregar o jogo';
    document.getElementById('world-loading-fill').style.width = '0%';
    document.getElementById('world-loading-detail').textContent = 'As bibliotecas do jogo estão indisponíveis. Verifique sua conexão e recarregue a página.';
    throw lastError || new Error('Não foi possível carregar o Three.js por nenhum CDN.');
}

const { THREE, PointerLockControls } = await loadThreeModules();

// =====================================================================
// 1. CONFIGURAÇÃO
// =====================================================================
const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 64;
const RENDER_DISTANCE = 4;     // em chunks
const GEN_PER_FRAME = 2;       // chunks gerados por quadro
const MESH_PER_FRAME = 2;      // malhas reconstruídas por quadro
const REACH = 5;               // alcance de interação (blocos)
const ACTIVE_WORLD = window.ACTIVE_WORLD;
if (!ACTIVE_WORLD || !Number.isFinite(ACTIVE_WORLD.seed) || !ACTIVE_WORLD.saveKey) {
    throw new Error('Selecione um mundo antes de iniciar o jogo.');
}
const SEED = ACTIVE_WORLD.seed;
const SKY_COLOR = 0x87CEEB;
const GPU_PREF = new URLSearchParams(location.search).get('gpu') === 'default' ? 'default' : 'high-performance';
const FRAME_BUDGET_MS = 7;     // tempo máximo por quadro gasto gerando/montando chunks
const MAX_PIXEL_RATIO = Number(new URLSearchParams(location.search).get('pr')) || 1.5;

// Física do jogador
const GRAVITY = 30;
const JUMP_SPEED = 9.5;
const WALK_SPEED = 4.3;
const SPRINT_SPEED = 5.6;
const CROUCH_SPEED = 1.3;
const PLAYER_RADIUS = 0.3;
const H_STAND = 1.8, H_CROUCH = 1.5;
const EYE_STAND = 1.62, EYE_CROUCH = 1.27;
const WATER_LEVEL = 26; // Nível base do mar

// Sobrevivência
const MAX_HEALTH = 20, MAX_HUNGER = 20, MAX_BREATH = 20;
const SPRINT_MIN_HUNGER = 7;
const EAT_TIME = 1.6;
const INVULN_TIME = 0.5;
const DEATH_DROP_TTL = 600;

// Dia, Noite e Nuvens
const DAY_LENGTH = 1200;
const START_TIME = 0.2;
const CLOUD_CELL = 8;
const CLOUD_THICK = 3;
const CLOUD_GRID = 32;
const CLOUD_Y = 80;
const CLOUD_SPEED = 1.6;
const CLOUD_SCALE = 0.13;
const CLOUD_THRESHOLD = 0.12;
const SKY_DISTANCE = 250;

// Mão em primeira pessoa
const HAND_BASE = { x: 0.42, y: -0.50, z: -0.25 };
const HELD_TOOL_ROT = [0.3, -0.55, 0.0];
const HELD_BLOCK_ROT = [0.25, 0.7, 0.0];
const HELD_BLOCK_POS = [0.03, 0.07, -0.04];

// =====================================================================
// 2. SISTEMA DE ÁGUA (catálogo em world-catalog.js)
// =====================================================================
class WaterSystem {
    static get surfaceHeight() { return 0.88; }
    static isBlock(type) { return BLOCKS[type]?.render === 'liquid'; }
    static flowBlockForLevel(level) {
        const clamped = Math.max(1, Math.min(7, Math.round(level)));
        return ID.WATER_FLOW_1 + clamped - 1;
    }
    static surfaceHeightFor(type, aboveType) {
        const block = BLOCKS[type];
        if (block?.falling) return 1;
        if (block?.flowing) return block.waterLevel;
        return aboveType === 0 ? WaterSystem.surfaceHeight : 1;
    }

    constructor(atlas) {
        this.material = new THREE.MeshLambertMaterial({
            map: atlas, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, vertexColors: true
        });
        this.headInWater = false;
        this.feetInWater = false;
        this.flowQueue = [];
        this.queuedCells = new Set();
        this.flowTimer = 0;
    }

    isAdjacent(world, x, y, z) {
        return WaterSystem.isBlock(world.getBlock(x + 1, y, z)) ||
            WaterSystem.isBlock(world.getBlock(x - 1, y, z)) ||
            WaterSystem.isBlock(world.getBlock(x, y + 1, z)) ||
            WaterSystem.isBlock(world.getBlock(x, y - 1, z)) ||
            WaterSystem.isBlock(world.getBlock(x, y, z + 1)) ||
            WaterSystem.isBlock(world.getBlock(x, y, z - 1));
    }

    updateSubmersion(world, player) {
        const wasHeadInWater = this.headInWater;
        const px = Math.floor(player.pos.x);
        const pz = Math.floor(player.pos.z);
        const headY = Math.floor(player.pos.y + player.eye);
        const feetY = Math.floor(player.pos.y);
        this.headInWater = WaterSystem.isBlock(world.getBlock(px, headY, pz));
        this.feetInWater = WaterSystem.isBlock(world.getBlock(px, feetY, pz));
        if (this.headInWater !== wasHeadInWater) updateBreathUI();
    }

    enqueue(x, y, z) {
        if (y < 0 || y >= WORLD_HEIGHT || this.flowQueue.length >= 4096) return;
        const key = `${x},${y},${z}`;
        if (this.queuedCells.has(key)) return;
        this.queuedCells.add(key);
        this.flowQueue.push({ x, y, z, key });
    }

    activate(world, x, y, z) {
        const cells = [[0,0,0], [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
        for (const [dx, dy, dz] of cells) {
            const px = x + dx, py = y + dy, pz = z + dz;
            if (WaterSystem.isBlock(world.getBlock(px, py, pz))) this.enqueue(px, py, pz);
        }
    }

    hasNearbySource(world, start, maxSteps = 7) {
        const queue = [{ x: start.x, y: start.y, z: start.z, steps: 0 }];
        const visited = new Set([`${start.x},${start.y},${start.z}`]);
        const directions = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
        for (let i = 0; i < queue.length; i++) {
            const cell = queue[i];
            const block = BLOCKS[world.getBlock(cell.x, cell.y, cell.z)];
            if (block?.waterSource) return true;
            if (cell.steps >= maxSteps) continue;
            for (const [dx, dy, dz] of directions) {
                const x = cell.x + dx, y = cell.y + dy, z = cell.z + dz;
                if (y < 0 || y >= WORLD_HEIGHT) continue;
                const key = `${x},${y},${z}`;
                const nextSteps = cell.steps + (dy === 0 ? 1 : 0);
                if (visited.has(key) || nextSteps > maxSteps || !WaterSystem.isBlock(world.getBlock(x, y, z))) continue;
                visited.add(key);
                queue.push({ x, y, z, steps: nextSteps });
            }
        }
        return false;
    }

    updateFlow(world, dt) {
        this.flowTimer += dt;
        if (this.flowTimer < 0.18) return;
        this.flowTimer = 0;

        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        for (let step = 0; step < 8 && this.flowQueue.length; step++) {
            const cell = this.flowQueue.shift();
            this.queuedCells.delete(cell.key);
            const type = world.getBlock(cell.x, cell.y, cell.z);
            const block = BLOCKS[type];
            if (!block || block.render !== 'liquid') continue;

            // Fontes permanecem; água de fluxo sem fonte próxima evapora.
            if (!block.waterSource && !this.hasNearbySource(world, cell, 7)) {
                if (world.setBlock(cell.x, cell.y, cell.z, 0)) {
                    for (const [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                        this.enqueue(cell.x + dx, cell.y + dy, cell.z + dz);
                    }
                }
                continue;
            }

            const level = block.waterSource || block.falling ? 8 : block.flowLevel;
            const belowY = cell.y - 1;
            if (belowY > 0 && world.getBlock(cell.x, belowY, cell.z) === 0) {
                if (world.setBlock(cell.x, belowY, cell.z, ID.WATER_FALL)) {
                    this.enqueue(cell.x, belowY, cell.z);
                    continue;
                }
            }
            if (level <= 1) continue;

            const nextType = WaterSystem.flowBlockForLevel(level - 1);
            for (const [dx, dz] of directions) {
                const x = cell.x + dx, z = cell.z + dz;
                const adjacentType = world.getBlock(x, cell.y, z);
                const adjacent = BLOCKS[adjacentType];
                if (adjacentType !== 0 && !(adjacent?.flowing && adjacent.flowLevel < level - 1)) continue;
                if (world.setBlock(x, cell.y, z, nextType)) this.enqueue(x, cell.y, z);
            }
        }
    }

    update(world, dt, now) {
        const pulse = Math.sin(now * 0.0017);
        this.material.color.setRGB(0.96 + pulse * 0.025, 0.98 + pulse * 0.02, 1);
        this.updateFlow(world, dt);
    }
}

// =====================================================================
// 3. TEXTURAS (ATLAS ÚNICO 32x32 POR TILE, DETERMINÍSTICO)
// =====================================================================
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

// =====================================================================
// 4. RUÍDO COM SEED E GERADOR DE TERRENO
// =====================================================================
const idx = (lx, y, lz) => lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
const chunkKey = (cx, cz) => `${cx},${cz}`;

const floorDiv = (a, b) => Math.floor(a / b);
const BIOME = Object.freeze({ PLAINS: 0, FOREST: 1, DESERT: 2, ROCKY: 3 });
const TREE_CHANCE_FOREST = 0.035;
const TREE_CHANCE_PLAINS = 0.008;

class TerrainGenerator {

    constructor(seed) {
        this.seed = seed;
        this.continents = new Noise2D(seed);
        this.hills = new Noise2D(seed + 1013);
        this.temperature = new Noise2D(seed + 2131);
        this.moisture = new Noise2D(seed + 3769);
        this.caves = new Noise2D(seed + 5021);
        this.caveBranches = new Noise2D(seed + 6073);
        this.rivers = new Noise2D(seed + 7109);
    }
    isCave(wx, y, wz) {
        const tunnel = this.caves.noise((wx + y * 0.7) * 0.045, (wz - y * 0.38) * 0.045);
        const branch = this.caveBranches.noise((wx - y * 0.42) * 0.045, (wz + y * 0.65) * 0.045);
        return Math.abs(tunnel) < 0.06 && Math.abs(branch) < 0.06;
    }
    biomeAt(wx, wz) {
        const temperature = this.temperature.fbm(wx * 0.002, wz * 0.002, 2);
        const moisture = this.moisture.fbm(wx * 0.0024, wz * 0.0024, 2);
        if (temperature > 0.12 && moisture < -0.05) return BIOME.DESERT;
        if (temperature < -0.14) return BIOME.ROCKY;
        if (moisture > 0.10) return BIOME.FOREST;
        return BIOME.PLAINS;
    }
    baseHeightAt(wx, wz) {
        const c = this.continents.fbm(wx * 0.006, wz * 0.006, 4);
        const h = this.hills.fbm(wx * 0.03, wz * 0.03, 3);
        const plateau = smoothstep(0.1, 0.8, c) * 14;
        return Math.max(3, Math.min(WORLD_HEIGHT - 4, 27 + c * 9 + h * 4 + plateau));
    }
    riverStrengthAt(wx, wz) {
        const distance = Math.abs(this.rivers.noise(wx * 0.015, wz * 0.015));
        return 1 - smoothstep(0.018, 0.04, distance);
    }
    heightFrom(baseHeight, riverStrength) {
        const naturalTop = Math.floor(baseHeight);
        const riverbed = Math.max(3, Math.min(naturalTop - 1, Math.max(WATER_LEVEL - 1, naturalTop - 3)));
        const height = baseHeight - (baseHeight - riverbed) * riverStrength;
        return Math.max(3, Math.min(WORLD_HEIGHT - 4, Math.floor(height)));
    }
    heightAt(wx, wz) {
        return this.heightFrom(this.baseHeightAt(wx, wz), this.riverStrengthAt(wx, wz));
    }
    fill(chunk) {
        const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;
        const heights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
        const biomes = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const wx = ox + lx, wz = oz + lz;
                const baseHeight = this.baseHeightAt(wx, wz);
                const riverStrength = this.riverStrengthAt(wx, wz);
                const h = this.heightFrom(baseHeight, riverStrength);
                const column = lx + lz * CHUNK_SIZE;
                const biome = this.biomeAt(wx, wz);
                heights[column] = h;
                biomes[column] = biome;
                
                // Terreno sólido
                for (let y = 0; y <= h; y++) {
                    let type;
                    if (y === 0) type = ID.STONE;
                    else if (y === h) {
                        type = (h <= WATER_LEVEL + 1 || biome === BIOME.DESERT) ? ID.SAND :
                            (biome === BIOME.ROCKY ? ID.STONE : ID.GRASS);
                    }
                    else if (y >= h - 3) {
                        type = (h <= WATER_LEVEL + 1 || biome === BIOME.DESERT) ? ID.SAND :
                            (biome === BIOME.ROCKY ? ID.STONE : ID.DIRT);
                    }
                    else {
                        type = ID.STONE;
                        const ore = hash2(ox + lx + y * 31, oz + lz - y * 17, this.seed + 91);
                        if (y < 18 && ore < 0.004) type = ID.DIAMOND_ORE;
                        else if (y < 28 && ore < 0.010) type = ID.GOLD_ORE;
                        else if (y < 42 && ore < 0.025) type = ID.IRON_ORE;
                        else if (ore < 0.050) type = ID.COAL_ORE;
                    }
                    if (type === ID.STONE && y >= 6 && y <= h - 4 && this.isCave(wx, y, wz)) type = 0;
                    chunk.data[idx(lx, y, lz)] = type;
                }
                
                const riverWaterTop = riverStrength > 0.72 ? Math.max(WATER_LEVEL, Math.floor(baseHeight) - 2) : WATER_LEVEL;
                if (h < riverWaterTop) {
                    for (let y = h + 1; y <= riverWaterTop; y++) {
                        const isShallowChannel = riverStrength > 0.72 && riverWaterTop > WATER_LEVEL && y === riverWaterTop;
                        const channelLevel = 7;
                        chunk.data[idx(lx, y, lz)] = isShallowChannel
                            ? WaterSystem.flowBlockForLevel(channelLevel)
                            : ID.WATER;
                    }
                }

                if (h > chunk.maxY) chunk.maxY = h;
                if (riverWaterTop > chunk.maxY) chunk.maxY = riverWaterTop;
            }
        }
        this.plantTrees(chunk, heights, biomes, ox, oz);
    }
    plantTrees(chunk, heights, biomes, ox, oz) {
        const set = (lx, y, lz, t) => {
            if (y < 0 || y >= WORLD_HEIGHT) return;
            const i = idx(lx, y, lz);
            if (chunk.data[i] === 0) { chunk.data[i] = t; if (y > chunk.maxY) chunk.maxY = y; }
        };
        for (let lx = 2; lx <= 13; lx++) {
            for (let lz = 2; lz <= 13; lz++) {
                const wx = ox + lx, wz = oz + lz;
                if (Math.abs(wx) < 4 && Math.abs(wz) < 4) continue;
                const column = lx + lz * CHUNK_SIZE;
                const biome = biomes[column];
                if (biome === BIOME.DESERT || biome === BIOME.ROCKY) continue;
                const treeChance = biome === BIOME.FOREST ? TREE_CHANCE_FOREST : TREE_CHANCE_PLAINS;
                if (hash2(wx, wz, this.seed) > treeChance) continue;
                const h = heights[column];
                
                if (h <= WATER_LEVEL + 1) continue; // Sem árvores debaixo d'água ou nas praias
                if (chunk.data[idx(lx, h + 1, lz)] === ID.WATER) continue;
                
                const th = 4 + Math.floor(hash2(wx, wz, this.seed + 7) * 3);
                if (h + th + 2 >= WORLD_HEIGHT) continue;
                for (let k = 1; k <= th; k++) set(lx, h + k, lz, ID.LOG);
                for (let dy = th - 2; dy <= th + 1; dy++) {
                    const r = dy >= th ? 1 : 2;
                    for (let dx = -r; dx <= r; dx++) {
                        for (let dz = -r; dz <= r; dz++) {
                            if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                            if (dy === th + 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
                            set(lx + dx, h + dy, lz + dz, ID.LEAVES);
                        }
                    }
                }
            }
        }
    }
}

function findSpawn(gen) {
        const STEP = 4, MAX_R = 512;
        const minH = WATER_LEVEL + 2;

        const noTreeNear = (x, z) => {
            for (let dx = -3; dx <= 3; dx++)
                for (let dz = -3; dz <= 3; dz++)
                    if (hash2(x + dx, z + dz, gen.seed) <= TREE_CHANCE_FOREST) return false;
            return true;
        };

        for (let r = 0; r <= MAX_R; r += STEP) {
            for (let dx = -r; dx <= r; dx += STEP) {
                for (let dz = -r; dz <= r; dz += STEP) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                    const h = gen.heightAt(dx, dz);
                    if (h >= minH && noTreeNear(dx, dz)) return { x: dx + 0.5, y: h + 1, z: dz + 0.5 };
                }
            }
        }
        return { x: 0.5, y: Math.max(gen.heightAt(0, 0), WATER_LEVEL) + 1, z: 0.5 };
}

// =====================================================================
// 5. CHUNKS, MALHA COM FACES VISÍVEIS E MUNDO
// =====================================================================
class Chunk {
    constructor(cx, cz) {
        this.cx = cx;
        this.cz = cz;
        this.data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
        this.skyLight = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
        this.blockLight = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
        this.maxY = 0;
        this.mesh = null;
        this.flameMesh = null;
    }
}

function createTorchFlameTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 32;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < 32; y++) {
        const center = 8 + Math.sin(y * 0.48) * 1.2;
        const width = y < 5 ? 1.5 + y * 0.55 : y < 15 ? 5 + (y - 5) * 0.2 : y < 25 ? 7 - (y - 15) * 0.22 : 4 - (y - 25) * 0.25;
        for (let x = 0; x < 16; x++) {
            const dx = Math.abs(x + 0.5 - center);
            if (dx > width) continue;
            const color = y < 6 ? (dx < width * 0.45 ? '#ff7a18' : '#d92e18') : y < 14 ? (dx < width * 0.42 ? '#fff06a' : '#ff7b12') : y < 25 ? (dx < width * 0.48 ? '#fff5a0' : '#ffd52b') : (dx < width * 0.45 ? '#fff9df' : '#ffdc42');
            ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1);
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

function buildTorchFlameGeometry(centers) {
    const positions = [], uvs = [], phases = [], indices = [], half = 0.16, bottom = 0.66, height = 0.36;
    for (const [x, y, z, phase] of centers) for (let plane = 0; plane < 2; plane++) {
        const base = positions.length / 3;
        if (plane === 0) positions.push(x-half,y+bottom,z, x+half,y+bottom,z, x-half,y+bottom+height,z, x+half,y+bottom+height,z);
        else positions.push(x,y+bottom,z-half, x,y+bottom,z+half, x,y+bottom+height,z-half, x,y+bottom+height,z+half);
        uvs.push(0,0, 1,0, 0,1, 1,1); phases.push(phase, phase, phase, phase); indices.push(base,base+1,base+2, base+2,base+1,base+3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('flamePhase', new THREE.Float32BufferAttribute(phases, 1));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
}

function buildHeldTorchFlameGeometry() {
    const positions = [], uvs = [], phases = [], indices = [];
    const halfWidth = 0.119, halfDepth = 0.055, bottom = 0, height = 0.272, phase = 1.9;
    for (let plane = 0; plane < 2; plane++) {
        const base = positions.length / 3;
        if (plane === 0) positions.push(-halfWidth,bottom,0.002, halfWidth,bottom,0.002, -halfWidth,bottom+height,0.002, halfWidth,bottom+height,0.002);
        else positions.push(0,bottom,-halfDepth, 0,bottom,halfDepth, 0,bottom+height,-halfDepth, 0,bottom+height,halfDepth);
        uvs.push(0,0, 1,0, 0,1, 1,1); phases.push(phase, phase, phase, phase);
        indices.push(base,base+1,base+2, base+2,base+1,base+3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('flamePhase', new THREE.Float32BufferAttribute(phases, 1));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
}
const TORCH_PARTS = [
    { min: [0.45, 0.02, 0.45], max: [0.55, 0.70, 0.55], tiles: { top: TILE.WOOD_END, side: TILE.WOOD, bottom: TILE.WOOD_END } },
];
const FACES = [
    { kind: 'side',   dir: [-1, 0, 0], corners: [ { pos: [0,1,0], uv: [0,1] }, { pos: [0,0,0], uv: [0,0] }, { pos: [0,1,1], uv: [1,1] }, { pos: [0,0,1], uv: [1,0] } ] },
    { kind: 'side',   dir: [ 1, 0, 0], corners: [ { pos: [1,1,1], uv: [0,1] }, { pos: [1,0,1], uv: [0,0] }, { pos: [1,1,0], uv: [1,1] }, { pos: [1,0,0], uv: [1,0] } ] },
    { kind: 'bottom', dir: [ 0,-1, 0], corners: [ { pos: [1,0,1], uv: [1,0] }, { pos: [0,0,1], uv: [0,0] }, { pos: [1,0,0], uv: [1,1] }, { pos: [0,0,0], uv: [0,1] } ] },
    { kind: 'top',    dir: [ 0, 1, 0], corners: [ { pos: [0,1,1], uv: [1,1] }, { pos: [1,1,1], uv: [0,1] }, { pos: [0,1,0], uv: [1,0] }, { pos: [1,1,0], uv: [0,0] } ] },
    { kind: 'side',   dir: [ 0, 0,-1], corners: [ { pos: [1,0,0], uv: [0,0] }, { pos: [0,0,0], uv: [1,0] }, { pos: [1,1,0], uv: [0,1] }, { pos: [0,1,0], uv: [1,1] } ] },
    { kind: 'side',   dir: [ 0, 0, 1], corners: [ { pos: [0,0,1], uv: [0,0] }, { pos: [1,0,1], uv: [1,0] }, { pos: [0,1,1], uv: [0,1] }, { pos: [1,1,1], uv: [1,1] } ] },
];
const UV_PAD = 0.0005;

function variantTile(tile, wx, y, wz) {
    if (hash2(wx + y * 13, wz - y * 7, 404) > 0.16) return tile;
    if (tile === TILE.GRASS_TOP) return TILE.GRASS_TOP_ALT;
    if (tile === TILE.GRASS_SIDE) return TILE.GRASS_SIDE_ALT;
    if (tile === TILE.DIRT) return TILE.DIRT_ALT;
    if (tile === TILE.STONE) return TILE.STONE_ALT;
    if (tile === TILE.LEAVES) return TILE.LEAVES_ALT;
    return tile;
}

class World {
    constructor(scene, seed) {
        this.scene = scene;
        this.seed = seed;
        this.generator = new TerrainGenerator(seed);
        this.chunks = new Map();
        this.edits = new Map();
        this.dirty = new Set();
        this.lightDirty = new Set();
        this.lightSourceChunks = new Set();
        this.lastLightMs = 0;
        this.lastMeshMs = 0;
        this.sandQueue = [];
        this.queuedSand = new Set();
        this.animatedSandTargets = new Set();
        this.animatedSandByKey = new Map();
        this.fallingSandAnimations = [];
        this.nextSandStepAt = 0;
        this.editCache = new Map();
        this.genQueue = [];
        this.lastPcx = null;
        this.lastPcz = null;
        this.terrainWorker = null;
        this.terrainWorkerUrl = null;
        this.terrainJobs = new Map();
        this.pendingChunkKeys = new Set();
        this.nextTerrainJobId = 1;
        this.createTerrainWorker();
        const atlas = createAtlasTexture();
        this.material = new THREE.MeshLambertMaterial({ map: atlas });
        this.sandFallGeometry = buildCubeGeo(BLOCKS[ID.SAND].tiles, 1);
        this.chunkMaterial = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
        this.cutoutMaterial = new THREE.MeshLambertMaterial({
            map: atlas, alphaTest: 0.5, transparent: false, depthWrite: true, vertexColors: true,
        });
        
        this.torchFlameMaterial = new THREE.MeshBasicMaterial({ map: createTorchFlameTexture(), transparent: false, alphaTest: 0.5, depthWrite: true, side: THREE.DoubleSide, toneMapped: false });
        this.configureTorchFlameAnimation(this.torchFlameMaterial);
        this.configureTorchFlicker(this.chunkMaterial);
        this.configureTorchFlicker(this.cutoutMaterial);
        this.water = new WaterSystem(atlas);
    }

    configureTorchFlicker(material) {
        material.onBeforeCompile = shader => {
            shader.uniforms.uTorchTime = { value: 0 };
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                '#include <common>\nuniform float uTorchTime;\nattribute float torchInfluence;\nvarying float vTorchInfluence;'
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <color_vertex>',
                '#include <color_vertex>\nvTorchInfluence = torchInfluence;'
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                '#include <common>\nuniform float uTorchTime;\nvarying float vTorchInfluence;'
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                '#include <color_fragment>\nfloat torchFlicker = 1.0 + vTorchInfluence * (0.035 * sin(uTorchTime * 8.7) + 0.02 * sin(uTorchTime * 13.1 + 1.2));\ndiffuseColor.rgb *= torchFlicker;'
            );
            material.userData.torchFlickerShader = shader;
        };
        material.customProgramCacheKey = () => 'voxel-torch-flicker-v1';
    }
    configureTorchFlameAnimation(material) {
        material.onBeforeCompile = shader => {
            shader.uniforms.uFlameTime = { value: 0 };
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                '#include <common>\nuniform float uFlameTime;\nattribute float flamePhase;'
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\nfloat flameTip = uv.y * uv.y;\ntransformed.x += flameTip * (0.018 * sin(uFlameTime * 7.0 + flamePhase + position.x * 9.0 + position.z * 6.0));\ntransformed.z += flameTip * (0.012 * sin(uFlameTime * 5.3 + flamePhase * 1.37 + position.x * 5.0 + position.z * 8.0));'
            );
            material.userData.flameAnimationShader = shader;
        };
        material.customProgramCacheKey = () => 'voxel-torch-flame-animation-v1';
    }
    rebuildSkyLightColumn(chunk, lx, lz) {
        let light = 15;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
            const i = idx(lx, y, lz);
            const type = chunk.data[i];
            if (type === 0) { chunk.skyLight[i] = light; continue; }
            if (type === ID.LEAVES) {
                chunk.skyLight[i] = light;
                light = Math.max(0, light - 3);
                continue;
            }
            if (WaterSystem.isBlock(type)) {
                chunk.skyLight[i] = light;
                light = Math.max(0, light - 1);
                continue;
            }
            chunk.skyLight[i] = 0;
            if (BLOCKS[type]?.solid !== false) light = 0;
        }
    }

    rebuildSkyLight(chunk) {
        // A luz só alcança 15 células; um anel de chunks cobre qualquer influência local,
        // inclusive diagonais nas quinas, e evita recalcular o mundo inteiro.
        const region = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const part = this.getChunk(chunk.cx + dx, chunk.cz + dz);
                if (part) region.push(part);
            }
        }
        if (!region.length) return;

        const regionIndex = new Map(region.map((part, i) => [part, i]));
        const hasBlockEmitter = region.some(part => this.lightSourceChunks.has(chunkKey(part.cx, part.cz)));
        for (const part of region) {
            this.lightDirty.delete(part);
            part.blockLight.fill(0);
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                for (let lz = 0; lz < CHUNK_SIZE; lz++) this.rebuildSkyLightColumn(part, lx, lz);
            }
        }
        this.propagateSkyLight(region, regionIndex, hasBlockEmitter);
        for (const part of region) this.dirty.add(part);
    }

    propagateSkyLight(region, regionIndex, hasBlockEmitter = true) {
        this.propagateLightChannel(region, regionIndex, 'skyLight', false);
        if (hasBlockEmitter) this.propagateLightChannel(region, regionIndex, 'blockLight', true);
    }

    propagateLightChannel(region, regionIndex, channel, seedEmitters) {
        const volume = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;
        const buckets = Array.from({ length: 16 }, () => []);
        const directions = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
        let hasEmitter = false;
        const canSeedSky = (chunk, lx, y, lz, level) => {
            for (const [dx, dy, dz] of directions) {
                const ny = y + dy;
                if (ny < 0 || ny >= WORLD_HEIGHT) continue;
                let nx = lx + dx, nz = lz + dz;
                let cx = chunk.cx, cz = chunk.cz;
                if (nx < 0) { cx--; nx += CHUNK_SIZE; } else if (nx >= CHUNK_SIZE) { cx++; nx -= CHUNK_SIZE; }
                if (nz < 0) { cz--; nz += CHUNK_SIZE; } else if (nz >= CHUNK_SIZE) { cz++; nz -= CHUNK_SIZE; }
                const target = this.getChunk(cx, cz);
                if (regionIndex.get(target) === undefined) continue;
                if (level - 1 > target[channel][idx(nx, ny, nz)]) return true;
            }
            return false;
        };
        for (let chunkIndex = 0; chunkIndex < region.length; chunkIndex++) {
            const chunk = region[chunkIndex];
            const lightMap = chunk[channel];
            for (let i = 0; i < lightMap.length; i++) {
                let emission = 0;
                if (seedEmitters) {
                    emission = BLOCKS[chunk.data[i]]?.light ?? 0;
                    if (emission > lightMap[i]) lightMap[i] = emission;
                    if (emission > 0) hasEmitter = true;
                }
                const level = lightMap[i];
                if (level > 1 && (seedEmitters ? emission > 0 : canSeedSky(
                    chunk, i % CHUNK_SIZE,
                    Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE)),
                    Math.floor(i / CHUNK_SIZE) % CHUNK_SIZE, level
                ))) buckets[level].push(chunkIndex * volume + i);
            }
        }
        if (seedEmitters && !hasEmitter) return;
        const spread = (sourceLevel, sourceChunk, nx, y, nz) => {
            if (y < 0 || y >= WORLD_HEIGHT) return;
            let cx = sourceChunk.cx, cz = sourceChunk.cz;
            if (nx < 0) { cx--; nx += CHUNK_SIZE; } else if (nx >= CHUNK_SIZE) { cx++; nx -= CHUNK_SIZE; }
            if (nz < 0) { cz--; nz += CHUNK_SIZE; } else if (nz >= CHUNK_SIZE) { cz++; nz -= CHUNK_SIZE; }
            const target = this.getChunk(cx, cz);
            const targetChunkIndex = regionIndex.get(target);
            if (targetChunkIndex === undefined) return;
            const targetIndex = idx(nx, y, nz);
            const type = target.data[targetIndex], block = BLOCKS[type];
            if (type !== 0 && block?.solid !== false && type !== ID.LEAVES && !WaterSystem.isBlock(type)) return;
            const attenuation = type === ID.LEAVES ? (channel === 'skyLight' ? 3 : 2) : WaterSystem.isBlock(type) ? 2 : 1;
            const candidate = sourceLevel - attenuation, targetLight = target[channel];
            if (candidate <= targetLight[targetIndex]) return;
            targetLight[targetIndex] = candidate;
            if (candidate > 1) buckets[candidate].push(targetChunkIndex * volume + targetIndex);
        };
        for (let level = 15; level > 1; level--) {
            const queue = buckets[level];
            for (let cursor = 0; cursor < queue.length; cursor++) {
                const node = queue[cursor], chunkIndex = Math.floor(node / volume), i = node - chunkIndex * volume;
                const chunk = region[chunkIndex];
                if (chunk[channel][i] !== level) continue;
                const lx = i % CHUNK_SIZE, lz = Math.floor(i / CHUNK_SIZE) % CHUNK_SIZE;
                const y = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE));
                spread(level, chunk, lx + 1, y, lz); spread(level, chunk, lx - 1, y, lz);
                spread(level, chunk, lx, y + 1, lz); spread(level, chunk, lx, y - 1, lz);
                spread(level, chunk, lx, y, lz + 1); spread(level, chunk, lx, y, lz - 1);
            }
        }
    }
    createTerrainWorker() {
        if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function') return;
        const workerSource = [
            `const CHUNK_SIZE = ${CHUNK_SIZE};`,
            `const WORLD_HEIGHT = ${WORLD_HEIGHT};`,
            `const WATER_LEVEL = ${WATER_LEVEL};`,
            `const ID = ${JSON.stringify(ID)};`,
            `const BIOME = ${JSON.stringify(BIOME)};`,
            `const TREE_CHANCE_FOREST = ${TREE_CHANCE_FOREST};`,
            `const TREE_CHANCE_PLAINS = ${TREE_CHANCE_PLAINS};`,
            `const clamp01 = ${clamp01.toString()};`,
            `const smoothstep = ${smoothstep.toString()};`,
            `const idx = ${idx.toString()};`,
            mulberry32.toString(), hash2.toString(), Noise2D.toString(),
            `const WaterSystem = { flowBlockForLevel(level) { const clamped = Math.max(1, Math.min(7, Math.round(level))); return ID.WATER_FLOW_1 + clamped - 1; } };`,
            TerrainGenerator.toString(),
            `let workerGenerator = null; let workerSeed = null;`,
            `self.onmessage = ({ data }) => {`,
            `  if (!workerGenerator || workerSeed !== data.seed) { workerGenerator = new TerrainGenerator(data.seed); workerSeed = data.seed; }`,
            `  const chunk = { cx: data.cx, cz: data.cz, data: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT), maxY: 0 };`,
            `  workerGenerator.fill(chunk);`,
            `  self.postMessage({ jobId: data.jobId, cx: data.cx, cz: data.cz, maxY: chunk.maxY, data: chunk.data.buffer }, [chunk.data.buffer]);`,
            `};`
        ].join('\n');

        try {
            this.terrainWorkerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
            this.terrainWorker = new Worker(this.terrainWorkerUrl);
            this.terrainWorker.onmessage = event => this.receiveTerrainChunk(event.data);
            this.terrainWorker.onerror = event => this.failTerrainWorker(event);
            this.terrainWorker.onmessageerror = event => this.failTerrainWorker(event);
        } catch (error) {
            this.failTerrainWorker(error);
        }
    }

    failTerrainWorker(error) {
        if (error && typeof error.preventDefault === 'function') error.preventDefault();
        if (this.terrainWorker) this.terrainWorker.terminate();
        this.terrainWorker = null;
        if (this.terrainWorkerUrl) URL.revokeObjectURL(this.terrainWorkerUrl);
        this.terrainWorkerUrl = null;
        this.terrainJobs.clear();
        this.pendingChunkKeys.clear();
        this.genQueue.length = 0;
        this.lastPcx = this.lastPcz = null;
        console.warn('Web Worker do terreno indisponível; usando geração por etapas na thread principal.', error);
    }

    receiveTerrainChunk(result) {
        const job = this.terrainJobs.get(result?.jobId);
        if (!job) return;
        this.terrainJobs.delete(result.jobId);
        this.pendingChunkKeys.delete(job.key);
        const expectedBytes = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;
        if (result.cx !== job.cx || result.cz !== job.cz || !(result.data instanceof ArrayBuffer) ||
            result.data.byteLength !== expectedBytes || !Number.isInteger(result.maxY) ||
            result.maxY < 0 || result.maxY >= WORLD_HEIGHT) {
            this.failTerrainWorker(new Error('Resposta inválida ao gerar chunk.'));
            return;
        }
        if (this.lastPcx !== null && Math.max(Math.abs(job.cx - this.lastPcx), Math.abs(job.cz - this.lastPcz)) > RENDER_DISTANCE + 1) return;
        const chunk = new Chunk(job.cx, job.cz);
        chunk.data = new Uint8Array(result.data);
        chunk.maxY = result.maxY;
        if (this.terrainWorkerUrl) { URL.revokeObjectURL(this.terrainWorkerUrl); this.terrainWorkerUrl = null; }
        this.finishGeneratedChunk(chunk);
    }

    requestTerrainChunk(cx, cz) {
        const key = chunkKey(cx, cz);
        if (!this.terrainWorker || this.pendingChunkKeys.has(key) || this.getChunk(cx, cz)) return;
        const jobId = this.nextTerrainJobId++;
        this.pendingChunkKeys.add(key);
        this.terrainJobs.set(jobId, { cx, cz, key });
        try {
            this.terrainWorker.postMessage({ jobId, cx, cz, seed: this.seed });
        } catch (error) {
            this.failTerrainWorker(error);
        }
    }
    getChunk(cx, cz) { return this.chunks.get(chunkKey(cx, cz)); }

    refreshLightSourceChunk(cx, cz, chunk = this.getChunk(cx, cz)) {
        const key = chunkKey(cx, cz);
        if (!chunk) { this.lightSourceChunks.delete(key); return; }
        for (const type of chunk.data) {
            if (BLOCKS[type]?.light > 0) { this.lightSourceChunks.add(key); return; }
        }
        this.lightSourceChunks.delete(key);
    }

    getBlock(x, y, z) {
        if (y < 0 || y >= WORLD_HEIGHT) return 0;
        const chunk = this.getChunk(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE));
        if (!chunk) return 0;
        return chunk.data[idx(x - chunk.cx * CHUNK_SIZE, y, z - chunk.cz * CHUNK_SIZE)];
    }

    isSolidForPhysics(x, y, z) {
        if (y < 0) return true;
        if (y >= WORLD_HEIGHT) return false;
        const chunk = this.getChunk(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE));
        if (!chunk) return true;
        const type = chunk.data[idx(x - chunk.cx * CHUNK_SIZE, y, z - chunk.cz * CHUNK_SIZE)];
        return type !== 0 && (BLOCKS[type]?.solid ?? true);
    }

    setBlock(x, y, z, type) {
        if (y < 0 || y >= WORLD_HEIGHT) return false;
        const cx = floorDiv(x, CHUNK_SIZE), cz = floorDiv(z, CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        if (!chunk) return false;
        const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
        const i = idx(lx, y, lz);
        const oldType = chunk.data[i];
        if (oldType === ID.SAND && type !== ID.SAND) this.cancelFallingSand(x, y, z);
        chunk.data[i] = type;
        if ((BLOCKS[oldType]?.light ?? 0) !== (BLOCKS[type]?.light ?? 0)) this.refreshLightSourceChunk(cx, cz, chunk);
        if (type === ID.SAND) this.queueFallingSand(x, y, z);
        if (type !== oldType && (type === 0 || BLOCKS[type]?.solid === false) && y + 1 < WORLD_HEIGHT) {
            this.queueFallingSand(x, y + 1, z);
        }
        this.lightDirty.add(chunk);
        if (type !== 0 && y > chunk.maxY) chunk.maxY = y;

        const key = chunkKey(cx, cz);
        let ed = this.edits.get(key);
        if (!ed) { ed = new Map(); this.edits.set(key, ed); }
        ed.set(i, type);
        this.editCache.delete(key);

        // Agenda a remalha para o orçamento de frame de World.update().
        this.dirty.add(chunk);
        if (lx === 0) this.remeshIfReady(cx - 1, cz);
        if (lx === CHUNK_SIZE - 1) this.remeshIfReady(cx + 1, cz);
        if (lz === 0) this.remeshIfReady(cx, cz - 1);
        if (lz === CHUNK_SIZE - 1) this.remeshIfReady(cx, cz + 1);
        return true;
    }

    queueFallingSand(x, y, z) {
        if (y <= 0 || y >= WORLD_HEIGHT) return;
        const key = `${x},${y},${z}`;
        if (this.queuedSand.has(key)) return;
        this.queuedSand.add(key);
        this.sandQueue.push({ x, y, z, key });
    }

    cancelFallingSand(x, y, z) {
        const key = `${x},${y},${z}`;
        const animation = this.animatedSandByKey.get(key);
        if (!animation) return;
        this.animatedSandByKey.delete(key);
        this.animatedSandTargets.delete(key);
        this.scene.remove(animation.mesh);
        const index = this.fallingSandAnimations.indexOf(animation);
        if (index !== -1) this.fallingSandAnimations.splice(index, 1);
        const chunk = this.getChunk(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE));
        if (chunk) this.dirty.add(chunk);
    }

    updateFallingSand() {
        const now = performance.now();
        for (let i = this.fallingSandAnimations.length - 1; i >= 0; i--) {
            const animation = this.fallingSandAnimations[i];
            const progress = Math.min(1, (now - animation.startedAt) / animation.duration);
            const eased = progress * progress * (3 - 2 * progress);
            animation.mesh.position.y = animation.startY + (animation.targetY - animation.startY) * eased;
            if (progress < 1) continue;

            this.scene.remove(animation.mesh);
            this.fallingSandAnimations.splice(i, 1);
            this.animatedSandByKey.delete(animation.key);
            this.animatedSandTargets.delete(animation.key);
            const chunk = this.getChunk(floorDiv(animation.x, CHUNK_SIZE), floorDiv(animation.z, CHUNK_SIZE));
            if (chunk) this.dirty.add(chunk);
            this.queueFallingSand(animation.x, animation.targetBlockY, animation.z);
            this.queueFallingSand(animation.x, animation.sourceY + 1, animation.z);
        }

        if (now < this.nextSandStepAt) return;
        this.nextSandStepAt = now + 80;
        for (let starts = 0; starts < 2 && this.sandQueue.length; starts++) {
            const cell = this.sandQueue.pop();
            this.queuedSand.delete(cell.key);
            if (this.getBlock(cell.x, cell.y, cell.z) !== ID.SAND) continue;
            if (this.animatedSandTargets.has(cell.key)) continue;

            const cx = floorDiv(cell.x, CHUNK_SIZE), cz = floorDiv(cell.z, CHUNK_SIZE);
            if (!this.getChunk(cx, cz)) continue;
            const passThrough = [];
            let targetY = cell.y;
            while (targetY > 1) {
                const belowType = this.getBlock(cell.x, targetY - 1, cell.z);
                if (belowType === 0) { targetY--; continue; }
                const belowBlock = BLOCKS[belowType];
                if (belowBlock?.solid === false) {
                    passThrough.push({ y: targetY - 1, type: belowType });
                    targetY--;
                    continue;
                }
                break;
            }
            if (targetY === cell.y) continue;

            if (!this.setBlock(cell.x, cell.y, cell.z, 0)) continue;
            for (const displaced of passThrough) {
                if (!this.setBlock(cell.x, displaced.y, cell.z, 0)) continue;
                if (WaterSystem.isBlock(displaced.type)) {
                    this.water.activate(this, cell.x, displaced.y, cell.z);
                    continue;
                }
                const droppedId = BLOCKS[displaced.type]?.drop;
                if (droppedId && ITEMS[droppedId]) {
                    spawnItemEntity(droppedId, 1,
                        new THREE.Vector3(cell.x + 0.5, displaced.y + 0.5, cell.z + 0.5),
                        new THREE.Vector3(0, 0.12, 0), 0.35);
                }
            }
            if (this.setBlock(cell.x, targetY, cell.z, ID.SAND)) {
                const key = `${cell.x},${targetY},${cell.z}`;
                const mesh = new THREE.Mesh(this.sandFallGeometry, this.material);
                mesh.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
                this.scene.add(mesh);
                const animation = {
                    x: cell.x, z: cell.z, sourceY: cell.y, targetBlockY: targetY,
                    key, mesh, startedAt: now,
                    duration: Math.min(1.25, 0.42 + Math.sqrt(cell.y - targetY) * 0.13),
                    startY: cell.y + 0.5, targetY: targetY + 0.5,
                };
                this.fallingSandAnimations.push(animation);
                this.animatedSandTargets.add(key);
                this.animatedSandByKey.set(key, animation);
            } else {
                this.setBlock(cell.x, cell.y, cell.z, ID.SAND);
            }
        }
    }

    remeshIfReady(cx, cz) {
        const c = this.getChunk(cx, cz);
        if (c) this.dirty.add(c);
    }

    generateChunk(cx, cz) {
        if (this.terrainWorker) {
            this.requestTerrainChunk(cx, cz);
            return;
        }
        this.generateChunkSync(cx, cz);
    }

    generateChunkSync(cx, cz) {
        const chunk = new Chunk(cx, cz);
        this.generator.fill(chunk);
        this.finishGeneratedChunk(chunk);
    }

    finishGeneratedChunk(chunk) {
        const key = chunkKey(chunk.cx, chunk.cz);
        const ed = this.edits.get(key);
        let hasEditedLightSource = false;
        if (ed) {
            for (const [i, t] of ed) {
                chunk.data[i] = t;
                if (BLOCKS[t]?.light > 0) hasEditedLightSource = true;
                const y = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE));
                const lx = i % CHUNK_SIZE;
                const lz = Math.floor(i / CHUNK_SIZE) % CHUNK_SIZE;
                const x = chunk.cx * CHUNK_SIZE + lx, z = chunk.cz * CHUNK_SIZE + lz;
                if (t === ID.SAND) this.queueFallingSand(x, y, z);
                if (t === 0 && y + 1 < WORLD_HEIGHT) this.queueFallingSand(x, y + 1, z);
                if (t !== 0) {
                    if (y > chunk.maxY) chunk.maxY = y;
                }
            }
        }
        this.chunks.set(key, chunk);
        if (hasEditedLightSource) this.refreshLightSourceChunk(chunk.cx, chunk.cz, chunk);
        this.lightDirty.add(chunk);
        this.dirty.add(chunk);
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const neighbor = this.getChunk(chunk.cx + dx, chunk.cz + dz);
            if (neighbor) this.dirty.add(neighbor);
        }
    }

    meshChunk(chunk) {
        this.dirty.delete(chunk);
        if (chunk.flameMesh) { this.scene.remove(chunk.flameMesh); chunk.flameMesh.geometry.dispose(); chunk.flameMesh = null; }
        if (chunk.mesh) {
            this.scene.remove(chunk.mesh);
            chunk.mesh.geometry.dispose();
            chunk.mesh = null;
        }

        const CS = CHUNK_SIZE, CS2 = CS * CS;
        const data = chunk.data;
        const nxm = this.getChunk(chunk.cx - 1, chunk.cz);
        const nxp = this.getChunk(chunk.cx + 1, chunk.cz);
        const nzm = this.getChunk(chunk.cx, chunk.cz - 1);
        const nzp = this.getChunk(chunk.cx, chunk.cz + 1);
        const neighbors = [
            [this.getChunk(chunk.cx - 1, chunk.cz - 1), nzm, this.getChunk(chunk.cx + 1, chunk.cz - 1)],
            [nxm, chunk, nxp],
            [this.getChunk(chunk.cx - 1, chunk.cz + 1), nzp, this.getChunk(chunk.cx + 1, chunk.cz + 1)]
        ];

        const blockAt = (lx, y, lz) => {
            if (y < 0) return 1;
            if (y >= WORLD_HEIGHT) return 0;
            if (lx < 0 || lx >= CS || lz < 0 || lz >= CS) {
                const xOffset = lx < 0 ? -1 : lx >= CS ? 1 : 0;
                const zOffset = lz < 0 ? -1 : lz >= CS ? 1 : 0;
                const neighbor = neighbors[zOffset + 1][xOffset + 1];
                if (!neighbor) return xOffset && zOffset ? 0 : 1;
                const localX = lx - xOffset * CS, localZ = lz - zOffset * CS;
                return neighbor.data[localX + localZ * CS + y * CS2];
            }
            return data[lx + lz * CS + y * CS2];
        };

        const sampleLight = (channel, lx, y, lz, outsideY) => {
            if (y < 0 || y >= WORLD_HEIGHT) return outsideY;
            const xOffset = lx < 0 ? -1 : lx >= CS ? 1 : 0;
            const zOffset = lz < 0 ? -1 : lz >= CS ? 1 : 0;
            const target = neighbors[zOffset + 1][xOffset + 1];
            if (!target) return 0;
            const localX = lx - xOffset * CS, localZ = lz - zOffset * CS;
            return target[channel][localX + localZ * CS + y * CS2];
        };
        const skyLightAt = (lx, y, lz) => {
            return sampleLight('skyLight', lx, y, lz, y < 0 ? 0 : 15);
        };

        const blockLightAt = (lx, y, lz) => {
            return sampleLight('blockLight', lx, y, lz, 0);
        };
        const solid = (lx, y, lz, currentType, dir) => {
            const nx = lx + dir[0], ny = y + dir[1], nz = lz + dir[2];
            const nType = blockAt(nx, ny, nz);
            const currentRender = BLOCKS[currentType]?.render;
            const neighborRender = BLOCKS[nType]?.render;
            if (currentRender === 'torch') return false;
            if (currentRender === 'liquid') {
                if (nType === 0) return false;
                if (neighborRender !== 'liquid') return true;
                if (dir[1] !== 0) return true;
                const currentHeight = WaterSystem.surfaceHeightFor(currentType, blockAt(lx, y + 1, lz));
                const neighborHeight = WaterSystem.surfaceHeightFor(nType, blockAt(nx, ny + 1, nz));
                return currentHeight <= neighborHeight + 0.0001;
            }
            return nType !== 0 && neighborRender !== 'liquid' && neighborRender !== 'torch';
        };

        const occludesAO = type => type !== 0 && BLOCKS[type]?.render !== 'liquid' && BLOCKS[type]?.render !== 'torch';
        const ambientOcclusionAt = (lx, y, lz, face, corner, includeAO = true) => {
            let axisA, axisB;
            if (face.dir[0] !== 0) { axisA = 1; axisB = 2; }
            else if (face.dir[1] !== 0) { axisA = 0; axisB = 2; }
            else { axisA = 0; axisB = 1; }
            const signA = corner.pos[axisA] === 0 ? -1 : 1;
            const signB = corner.pos[axisB] === 0 ? -1 : 1;
            const baseX = lx + face.dir[0], baseY = y + face.dir[1], baseZ = lz + face.dir[2];
            let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
            if (axisA === 0) ax = signA; else if (axisA === 1) ay = signA; else az = signA;
            if (axisB === 0) bx = signB; else if (axisB === 1) by = signB; else bz = signB;
            const sideAType = includeAO ? blockAt(baseX + ax, baseY + ay, baseZ + az) : 0;
            const sideBType = includeAO ? blockAt(baseX + bx, baseY + by, baseZ + bz) : 0;
            const cornerType = includeAO ? blockAt(baseX + ax + bx, baseY + ay + by, baseZ + az + bz) : 0;
            const sideA = occludesAO(sideAType) ? 1 : 0;
            const sideB = occludesAO(sideBType) ? 1 : 0;
            const cornerOcclusion = occludesAO(cornerType) ? 1 : 0;
            const level = includeAO ? (sideA && sideB ? 0 : 3 - sideA - sideB - cornerOcclusion) : 3;
            const sampleSky = (x, yy, z) => skyLightAt(x, yy, z);
            const sampleBlock = (x, yy, z) => blockLightAt(x, yy, z);
            const sky = (sampleSky(baseX, baseY, baseZ) + sampleSky(baseX + ax, baseY + ay, baseZ + az) +
                sampleSky(baseX + bx, baseY + by, baseZ + bz) + sampleSky(baseX + ax + bx, baseY + ay + by, baseZ + az + bz)) / 60;
            const local = (sampleBlock(baseX, baseY, baseZ) + sampleBlock(baseX + ax, baseY + ay, baseZ + az) +
                sampleBlock(baseX + bx, baseY + by, baseZ + bz) + sampleBlock(baseX + ax + bx, baseY + ay + by, baseZ + az + bz)) / 60;
            const illumination = Math.max(0.18 + sky * 0.82, 0.18 + Math.min(2.2, local * 2.4) * 0.82);
            const base = (0.58 + level * 0.14) * illumination;
            const warmth = Math.min(0.22, local * 0.24);
            return [base * (1 + warmth), base, base * (1 - warmth * 0.85), local];
        };

        const initialVertexCapacity = CS * CS * 8;
        const initialIndexCapacity = CS * CS * 12;
        let positions = new Float32Array(initialVertexCapacity * 3);
        let normals = new Float32Array(initialVertexCapacity * 3);
        let uvs = new Float32Array(initialVertexCapacity * 2);
        let colors = new Float32Array(initialVertexCapacity * 3);
        let torchInfluence = new Float32Array(initialVertexCapacity);
        let indices = new Uint32Array(initialIndexCapacity);
        let cutoutIndices = new Uint32Array(initialIndexCapacity);
        let waterIndices = new Uint32Array(initialIndexCapacity);
        let vertexCount = 0, indexCount = 0, cutoutIndexCount = 0, waterIndexCount = 0;
        const growTypedArray = (array, required) => {
            if (required <= array.length) return array;
            let capacity = Math.max(64, array.length);
            while (capacity < required) capacity *= 2;
            const grown = new array.constructor(capacity);
            grown.set(array);
            return grown;
        };
        const uWidth = 1 / ATLAS_COLUMNS - 2 * UV_PAD;
        const torchFlameCenters = [];

        for (let y = 0; y <= chunk.maxY; y++) {
            for (let lz = 0; lz < CS; lz++) {
                for (let lx = 0; lx < CS; lx++) {
                    const t = data[lx + lz * CS + y * CS2];
                    if (t === 0) continue;
                    if (t === ID.SAND && this.animatedSandTargets.has(`${chunk.cx * CS + lx},${y},${chunk.cz * CS + lz}`)) continue;
                    const block = BLOCKS[t];
                    const tiles = block.tiles;
                    const renderMode = block.render;
                    const aboveType = y + 1 < WORLD_HEIGHT ? data[lx + lz * CS + (y + 1) * CS2] : 0;
                    const blockTop = renderMode === 'liquid' ? WaterSystem.surfaceHeightFor(t, aboveType) : 1;
                    const shapeCount = renderMode === 'torch' ? TORCH_PARTS.length : 1;
                    const orientation = block.orientation || [0, 0];
                    if (renderMode === 'torch') {
                        const lean = block.orientation ? (0.82 * 0.35 - 0.38) : 0;
                        const wx = chunk.cx * CS + lx, wz = chunk.cz * CS + lz;
                        const phase = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453) % (Math.PI * 2);
                        torchFlameCenters.push([lx + 0.5 + orientation[0] * lean, y, lz + 0.5 + orientation[1] * lean, phase]);
                    }
                    for (let shapeIndex = 0; shapeIndex < shapeCount; shapeIndex++) {
                        const shape = renderMode === 'torch' ? TORCH_PARTS[shapeIndex] : null;
                        for (const f of FACES) {
                        const neighborX = lx + f.dir[0], neighborY = y + f.dir[1], neighborZ = lz + f.dir[2];
                        const neighborType = blockAt(neighborX, neighborY, neighborZ);
                        if (renderMode !== 'torch' && solid(lx, y, lz, t, f.dir)) continue;
                        const wx = chunk.cx * CS + lx, wz = chunk.cz * CS + lz;
                        const tile = shape ? shape.tiles[f.kind] : variantTile(tiles[f.kind], wx, y, wz);
                        const u0 = tile / ATLAS_COLUMNS + UV_PAD;
                        const ndx = vertexCount;
                        positions = growTypedArray(positions, (vertexCount + 4) * 3);
                        normals = growTypedArray(normals, (vertexCount + 4) * 3);
                        uvs = growTypedArray(uvs, (vertexCount + 4) * 2);
                        colors = growTypedArray(colors, (vertexCount + 4) * 3);
                        torchInfluence = growTypedArray(torchInfluence, vertexCount + 4);
                        let target, targetOffset;
                        if (renderMode === 'cutout' || renderMode === 'torch') {
                            cutoutIndices = growTypedArray(cutoutIndices, cutoutIndexCount + 6);
                            target = cutoutIndices; targetOffset = cutoutIndexCount; cutoutIndexCount += 6;
                        } else if (renderMode === 'liquid') {
                            waterIndices = growTypedArray(waterIndices, waterIndexCount + 6);
                            target = waterIndices; targetOffset = waterIndexCount; waterIndexCount += 6;
                        } else {
                            indices = growTypedArray(indices, indexCount + 6);
                            target = indices; targetOffset = indexCount; indexCount += 6;
                        }
                        let cornerIndex = 0;
                        for (const c of f.corners) {
                            let py = y + (shape ? shape.min[1] + c.pos[1] * (shape.max[1] - shape.min[1]) : c.pos[1]);
                            if (renderMode === 'liquid') {
                                if (c.pos[1] === 1) py = y + blockTop;
                                else if (f.kind === 'side' && BLOCKS[neighborType]?.render === 'liquid') {
                                    const neighborAbove = blockAt(neighborX, neighborY + 1, neighborZ);
                                    py = y + WaterSystem.surfaceHeightFor(neighborType, neighborAbove);
                                }
                            }
                            const vertex = vertexCount + cornerIndex++;
                            const p = vertex * 3, uv = vertex * 2;
                            const localY = shape ? shape.min[1] + c.pos[1] * (shape.max[1] - shape.min[1]) : c.pos[1];
                            const wallOffset = renderMode === 'torch' && block.orientation ? (localY * 0.35 - 0.38) : 0;
                            positions[p] = lx + (shape ? shape.min[0] + c.pos[0] * (shape.max[0] - shape.min[0]) + orientation[0] * wallOffset : c.pos[0]); positions[p + 1] = py; positions[p + 2] = lz + (shape ? shape.min[2] + c.pos[2] * (shape.max[2] - shape.min[2]) + orientation[1] * wallOffset : c.pos[2]);
                            normals[p] = f.dir[0]; normals[p + 1] = f.dir[1]; normals[p + 2] = f.dir[2];
                            uvs[uv] = u0 + c.uv[0] * uWidth;
                            uvs[uv + 1] = UV_PAD + c.uv[1] * (1 - 2 * UV_PAD);
                            const shade = ambientOcclusionAt(lx, y, lz, f, c, renderMode !== 'liquid');
                            colors[p] = shade[0]; colors[p + 1] = shade[1]; colors[p + 2] = shade[2];
                            torchInfluence[vertex] = shade[3];
                        }
                        vertexCount += 4;
                        target[targetOffset] = ndx; target[targetOffset + 1] = ndx + 1;
                        target[targetOffset + 2] = ndx + 2; target[targetOffset + 3] = ndx + 2;
                        target[targetOffset + 4] = ndx + 1; target[targetOffset + 5] = ndx + 3;
                        }
                    }
                }
            }
        }

        if (vertexCount === 0) return;

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, vertexCount * 3), 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(normals.subarray(0, vertexCount * 3), 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs.subarray(0, vertexCount * 2), 2));
        geo.setAttribute('color', new THREE.BufferAttribute(colors.subarray(0, vertexCount * 3), 3));
        geo.setAttribute('torchInfluence', new THREE.BufferAttribute(torchInfluence.subarray(0, vertexCount), 1));

        const totalIndexCount = indexCount + cutoutIndexCount + waterIndexCount;
        const mergedIndices = vertexCount > 65535 ? new Uint32Array(totalIndexCount) : new Uint16Array(totalIndexCount);
        let offset = 0;
        if (indexCount) { mergedIndices.set(indices.subarray(0, indexCount), offset); geo.addGroup(offset, indexCount, 0); offset += indexCount; }
        if (cutoutIndexCount) { mergedIndices.set(cutoutIndices.subarray(0, cutoutIndexCount), offset); geo.addGroup(offset, cutoutIndexCount, 1); offset += cutoutIndexCount; }
        if (waterIndexCount) { mergedIndices.set(waterIndices.subarray(0, waterIndexCount), offset); geo.addGroup(offset, waterIndexCount, 2); }
        geo.setIndex(new THREE.BufferAttribute(mergedIndices, 1));

        const mesh = new THREE.Mesh(geo, [this.chunkMaterial, this.cutoutMaterial, this.water.material]);
        mesh.position.set(chunk.cx * CS, 0, chunk.cz * CS);
        this.scene.add(mesh);
        chunk.mesh = mesh;
        if (torchFlameCenters.length) {
            chunk.flameMesh = new THREE.Mesh(buildTorchFlameGeometry(torchFlameCenters), this.torchFlameMaterial);
            chunk.flameMesh.position.set(chunk.cx * CS, 0, chunk.cz * CS);
            this.scene.add(chunk.flameMesh);
        }
    }

    rebuildGenQueue(pcx, pcz) {
        const R = RENDER_DISTANCE + 1;
        const list = [];
        for (let dx = -R; dx <= R; dx++) {
            for (let dz = -R; dz <= R; dz++) {
                const cx = pcx + dx, cz = pcz + dz;
                if (!this.getChunk(cx, cz) && !this.pendingChunkKeys.has(chunkKey(cx, cz))) list.push({ cx, cz, d: dx * dx + dz * dz });
            }
        }
        list.sort((a, b) => a.d - b.d);
        this.genQueue = list;
    }

    unloadFar(pcx, pcz) {
        for (const [key, c] of this.chunks) {
            if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > RENDER_DISTANCE + 2) {
                for (const animation of [...this.fallingSandAnimations]) {
                    if (floorDiv(animation.x, CHUNK_SIZE) === c.cx && floorDiv(animation.z, CHUNK_SIZE) === c.cz) {
                        this.cancelFallingSand(animation.x, animation.targetBlockY, animation.z);
                    }
                }
                if (c.flameMesh) { this.scene.remove(c.flameMesh); c.flameMesh.geometry.dispose(); }
                if (c.mesh) {
                    this.scene.remove(c.mesh);
                    c.mesh.geometry.dispose();
                }
                this.dirty.delete(c);
                this.lightDirty.delete(c);
                this.lightSourceChunks.delete(key);
                this.chunks.delete(key);
                for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
                    if (dx === 0 && dz === 0) continue;
                    const neighbor = this.getChunk(c.cx + dx, c.cz + dz);
                    if (neighbor) this.lightDirty.add(neighbor);
                }
            }
        }
    }

    hasAllNeighbors(c) {
        return this.getChunk(c.cx + 1, c.cz) && this.getChunk(c.cx - 1, c.cz) &&
               this.getChunk(c.cx, c.cz + 1) && this.getChunk(c.cx, c.cz - 1);
    }

    update(px, pz, budgets = {}) {
        this.updateFallingSand();
        const unlimited = budgets.gen === Infinity;
        const t0 = performance.now();
        const genDeadline = t0 + FRAME_BUDGET_MS * 0.45;
        const meshDeadline = t0 + FRAME_BUDGET_MS;
        const torchTime = t0 * 0.001;
        const flamePulse = 0.95 + 0.05 * Math.sin(torchTime * 9.4);
        this.torchFlameMaterial.color.setRGB(flamePulse, flamePulse * 0.96, flamePulse * 0.9);
        const flameShader = this.torchFlameMaterial.userData.flameAnimationShader;
        if (flameShader) flameShader.uniforms.uFlameTime.value = torchTime;
        for (const material of [this.chunkMaterial, this.cutoutMaterial]) {
            const shader = material.userData.torchFlickerShader;
            if (shader) shader.uniforms.uTorchTime.value = torchTime;
        }
        const pcx = floorDiv(px, CHUNK_SIZE), pcz = floorDiv(pz, CHUNK_SIZE);

        if (pcx !== this.lastPcx || pcz !== this.lastPcz) {
            this.lastPcx = pcx; this.lastPcz = pcz;
            this.rebuildGenQueue(pcx, pcz);
            this.unloadFar(pcx, pcz);
        }

        let genCount = 0;
        while (this.genQueue.length && (unlimited || genCount === 0 || performance.now() < genDeadline)) {
            const c = this.genQueue.shift();
            if (!this.getChunk(c.cx, c.cz) && !this.pendingChunkKeys.has(chunkKey(c.cx, c.cz))) { this.generateChunk(c.cx, c.cz); genCount++; }
        }
        this.frameGen = genCount; this.frameMesh = 0;
        // Agrupa alterações do mesmo chunk e limita o custo da propagação por quadro.
        let lightCount = 0;
        this.lastLightMs = 0;
        for (const chunk of this.lightDirty) {
            this.lightDirty.delete(chunk);
            const lightStart = performance.now();
            this.rebuildSkyLight(chunk);
            this.lastLightMs += performance.now() - lightStart;
            if (++lightCount >= 1 && !unlimited) break;
        }

        if (this.dirty.size) {
            const cand = [];
            for (const c of this.dirty) {
                const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
                if (d > RENDER_DISTANCE || !this.hasAllNeighbors(c)) continue;
                cand.push({ c, d: (c.cx - pcx) ** 2 + (c.cz - pcz) ** 2 });
            }
            cand.sort((a, b) => a.d - b.d);
            let n = 0;
            this.lastMeshMs = 0;
            for (; n < cand.length && (unlimited || performance.now() < meshDeadline); n++) {
                const meshStart = performance.now();
                this.meshChunk(cand[n].c);
                this.lastMeshMs += performance.now() - meshStart;
            }
            this.frameMesh = n;
        } else {
            this.lastMeshMs = 0;
        }
    }
}

// =====================================================================
// 5A. CRIATURAS PASSIVAS — Mofim
// =====================================================================
class CreatureSystem {
    constructor(world) {
        this.world = world;
        this.entities = [];
        this.nextSpawnAt = 0;
        this.spawnAttempt = 0;
        this.nextId = 1;
        this.cube = new THREE.BoxGeometry(1, 1, 1);
        this.materials = {
            body: new THREE.MeshLambertMaterial({ color: 0x438f78 }),
            belly: new THREE.MeshLambertMaterial({ color: 0xb7d8a1 }),
            wing: new THREE.MeshLambertMaterial({ color: 0xb8e5d8, transparent: true, opacity: 0.78 }),
            eye: new THREE.MeshLambertMaterial({ color: 0x173b42 }),
            glow: new THREE.MeshBasicMaterial({ color: 0xf2c86b })
        };
    }

    surfaceAt(x, z) {
        const bx = Math.floor(x), bz = Math.floor(z);
        if (!this.world.getChunk(floorDiv(bx, CHUNK_SIZE), floorDiv(bz, CHUNK_SIZE))) return null;
        const y = this.world.generator.heightAt(bx, bz);
        const top = this.world.getBlock(bx, y, bz);
        if (top !== ID.GRASS && top !== ID.DIRT) return null;
        if (this.world.getBlock(bx, y + 1, bz) !== 0 || this.world.getBlock(bx, y + 2, bz) !== 0) return null;
        return y + 1;
    }

    addPart(group, material, x, y, z, sx, sy, sz) {
        const mesh = new THREE.Mesh(this.cube, material);
        mesh.position.set(x, y, z);
        mesh.scale.set(sx, sy, sz);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        group.add(mesh);
        return mesh;
    }

    createModel() {
        const group = new THREE.Group();
        this.addPart(group, this.materials.body, 0, 0.24, 0, 0.46, 0.34, 0.42);
        this.addPart(group, this.materials.belly, 0, 0.18, 0.215, 0.28, 0.18, 0.025);
        this.addPart(group, this.materials.body, 0, 0.43, 0.105, 0.30, 0.28, 0.28);
        this.addPart(group, this.materials.eye, -0.075, 0.46, 0.248, 0.045, 0.06, 0.025);
        this.addPart(group, this.materials.eye, 0.075, 0.46, 0.248, 0.045, 0.06, 0.025);
        const leftWing = this.addPart(group, this.materials.wing, -0.29, 0.32, -0.015, 0.24, 0.12, 0.035);
        const rightWing = this.addPart(group, this.materials.wing, 0.29, 0.32, -0.015, 0.24, 0.12, 0.035);
        leftWing.rotation.z = -0.25;
        rightWing.rotation.z = 0.25;
        this.addPart(group, this.materials.glow, 0, 0.62, 0.08, 0.07, 0.07, 0.07);
        return { group, leftWing, rightWing };
    }

    trySpawn(playerPos, now) {
        if (now < this.nextSpawnAt || this.entities.length >= 3) return;
        this.nextSpawnAt = now + 4.5;
        const seed = this.world.seed + this.spawnAttempt++ * 7919;
        for (let attempt = 0; attempt < 10; attempt++) {
            const angle = hash2(seed, attempt, 41) * Math.PI * 2;
            const distance = 9 + hash2(seed, attempt, 89) * 15;
            const x = playerPos.x + Math.cos(angle) * distance;
            const z = playerPos.z + Math.sin(angle) * distance;
            const y = this.surfaceAt(x, z);
            if (y === null) continue;
            if (this.entities.some(e => (e.x - x) ** 2 + (e.z - z) ** 2 < 64)) continue;
            const model = this.createModel();
            model.group.position.set(x, y, z);
            this.world.scene.add(model.group);
            this.entities.push({ id: this.nextId++, x, y, z, targetX: x, targetZ: z, turnAt: now,
                phase: hash2(seed, attempt, 131) * Math.PI * 2, heading: 0, ...model });
            return;
        }
    }

    update(dt, playerPos, active) {
        if (!active) return;
        const now = performance.now() * 0.001;
        this.trySpawn(playerPos, now);
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const e = this.entities[i];
            const dxp = e.x - playerPos.x, dzp = e.z - playerPos.z;
            if (dxp * dxp + dzp * dzp > 38 * 38) {
                this.world.scene.remove(e.group);
                this.entities.splice(i, 1);
                continue;
            }
            if (now >= e.turnAt) {
                const seed = this.world.seed + e.id * 104729 + Math.floor(now * 0.2);
                const angle = hash2(seed, e.id, 7) * Math.PI * 2;
                const distance = 1.5 + hash2(seed, e.id, 13) * 3;
                e.targetX = e.x + Math.cos(angle) * distance;
                e.targetZ = e.z + Math.sin(angle) * distance;
                e.turnAt = now + 2 + hash2(seed, e.id, 23) * 3;
            }
            const dx = e.targetX - e.x, dz = e.targetZ - e.z;
            const distance = Math.hypot(dx, dz);
            if (distance > 0.08) {
                const step = Math.min(distance, 0.72 * dt);
                const nx = e.x + dx / distance * step, nz = e.z + dz / distance * step;
                const ny = this.surfaceAt(nx, nz);
                if (ny !== null && Math.abs(ny - e.y) <= 1) {
                    e.x = nx; e.z = nz; e.y = ny;
                    e.heading = Math.atan2(dx, dz);
                } else {
                    e.turnAt = now;
                }
            }
            e.group.position.set(e.x, e.y + Math.sin(now * 3 + e.phase) * 0.035, e.z);
            e.group.rotation.y = e.heading;
            const flap = Math.sin(now * 8 + e.phase) * 0.18;
            e.leftWing.rotation.z = -0.25 + flap;
            e.rightWing.rotation.z = 0.25 - flap;
        }
    }
}

// =====================================================================
// 5B. INVENTÁRIO E FERRAMENTAS
// =====================================================================
class Inventory {
    constructor(size) { this.slots = Array.from({ length: size }, () => null); }
    add(id, count, from = 0, to = this.slots.length, damage = 0) {
        const max = ITEMS[id].maxStack;
        for (let i = from; i < to && count > 0; i++) {
            const s = this.slots[i];
            if (s && s.id === id && s.count < max) {
                const n = Math.min(max - s.count, count);
                s.count += n; count -= n;
            }
        }
        for (let i = from; i < to && count > 0; i++) {
            if (!this.slots[i]) {
                const n = Math.min(max, count);
                const st = { id, count: n };
                if (damage > 0) st.damage = damage;
                this.slots[i] = st;
                count -= n;
            }
        }
        return count;
    }
    canAdd(id) {
        const max = ITEMS[id].maxStack;
        return this.slots.some(s => !s || (s.id === id && s.count < max));
    }
    spaceFor(id) {
        const max = ITEMS[id].maxStack;
        let space = 0;
        for (const s of this.slots) {
            if (!s) space += max;
            else if (s.id === id) space += max - s.count;
        }
        return space;
    }
    removeOne(slotIndex) {
        const s = this.slots[slotIndex];
        if (!s) return false;
        s.count--;
        if (s.count <= 0) this.slots[slotIndex] = null;
        return true;
    }
}

const ITEM_ICONS = {};
const BLOCK_COLORS = {};

function initItemIcons() {
    const atlas = world.material.map.image;
    let iconCss = '';
    for (const [id, item] of Object.entries(ITEMS)) {
        const c = document.createElement('canvas');
        c.width = c.height = TILE_PX;
        c.getContext('2d').drawImage(atlas, item.iconTile * TILE_PX, 0, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);
        ITEM_ICONS[id] = c.toDataURL();
        iconCss += `.ico-${id}{background-image:url('${ITEM_ICONS[id]}')}\n`;
    }
    const st = document.createElement('style');
    st.textContent = iconCss;
    document.head.appendChild(st);
}

function computeBlockColors() {
    const ctx = world.material.map.image.getContext('2d');
    for (const [id, b] of Object.entries(BLOCKS)) {
        const d = ctx.getImageData(b.tiles.side * TILE_PX, 0, TILE_PX, TILE_PX).data;
        let r = 0, g = 0, bl = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 128) continue;
            r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++;
        }
        BLOCK_COLORS[id] = new THREE.Color().setRGB(r / n / 255, g / n / 255, bl / n / 255, THREE.SRGBColorSpace);
    }
}

function toolInfo(stack) {
    const it = stack && ITEMS[stack.id];
    return it && it.tool ? it.tool : null;
}

function canHarvest(type, stack) {
    const b = BLOCKS[type];
    if (!b.requiresTool) return true;
    const t = toolInfo(stack);
    return !!t && t.type === b.tool && t.tier >= (b.minTier || 0);
}

function getBreakTime(type, stack) {
    const b = BLOCKS[type];
    const base = b.hardness * 1.5;
    if (!canHarvest(type, stack)) return b.hardness * 5;
    const t = toolInfo(stack);
    const speed = (t && t.type === b.tool) ? t.speed : 1;
    return base / speed;
}

function damageTool(slotIndex, amount = 1) {
    const s = inventory.slots[slotIndex];
    const it = s && ITEMS[s.id];
    if (!it || !it.maxDurability) return;
    s.damage = (s.damage || 0) + amount;
    if (s.damage >= it.maxDurability) {
        inventory.slots[slotIndex] = null;
        showToast(`${it.name} quebrou!`);
    }
    updateHotbarUI();
}

let toastTimer = 0;
function showToast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2000);
}

const furnaces = new Map();
let station = null;
let furnaceDirty = false;

function updateFurnaces(dt) {
    for (const f of furnaces.values()) {
        const s = f.inv.slots;
        const rec = s[0] && SMELT[s[0].id];
        const canSmelt = !!rec && (!s[2] || (s[2].id === rec.result && s[2].count < ITEMS[rec.result].maxStack));
        const open = station && station.furnace === f;

        if (f.burn <= 0 && canSmelt && s[1] && FUEL[s[1].id]) {
            f.burn = f.burnMax = FUEL[s[1].id];
            f.inv.removeOne(1);
            if (open) furnaceDirty = true;
        }
        if (f.burn > 0) {
            f.burn = Math.max(0, f.burn - dt);
            if (canSmelt) {
                f.cook += dt;
                if (f.cook >= rec.time) {
                    f.cook = 0;
                    f.inv.removeOne(0);
                    if (s[2]) s[2].count++; else s[2] = { id: rec.result, count: 1 };
                    if (open) furnaceDirty = true;
                }
            } else f.cook = Math.max(0, f.cook - dt * 2);
        } else f.cook = Math.max(0, f.cook - dt * 2);
    }
}

function updateFurnaceBars() {
    const f = station && station.furnace;
    if (!f) return;
    document.getElementById('fur-flame').style.width = (f.burnMax ? f.burn / f.burnMax * 100 : 0) + '%';
    const rec = f.inv.slots[0] && SMELT[f.inv.slots[0].id];
    document.getElementById('fur-prog').style.width = (rec ? Math.min(1, f.cook / rec.time) * 100 : 0) + '%';
}

function spillFurnace(x, y, z) {
    const key = `${x},${y},${z}`, f = furnaces.get(key);
    if (!f) return;
    for (const s of f.inv.slots) if (s) {
        spawnItemEntity(s.id, s.count, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
            new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), 0.5, s.damage || 0);
    }
    furnaces.delete(key);
}

const chests = new Map();
function spillChest(x, y, z) {
    const key = `${x},${y},${z}`, c = chests.get(key);
    if (!c) return;
    for (const st of c.inv.slots) if (st) {
        spawnItemEntity(st.id, st.count, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
            new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 3), 0.5, st.damage || 0);
    }
    chests.delete(key);
}

function openStation(type, hit) {
    if (type === 'crafting') { openInventory({ type }); return; }
    if (type === 'chest') {
        const ckey = `${hit.x},${hit.y},${hit.z}`;
        let c = chests.get(ckey);
        if (!c) { c = { inv: new Inventory(27) }; chests.set(ckey, c); }
        openInventory({ type, chest: c });
        return;
    }
    const key = `${hit.x},${hit.y},${hit.z}`;
    let f = furnaces.get(key);
    if (!f) { f = { inv: new Inventory(3), burn: 0, burnMax: 0, cook: 0 }; furnaces.set(key, f); }
    openInventory({ type, furnace: f });
}

const particles = [];
const particleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const particleMats = {};

function waterImmersionAt(world, x, y, z, halfHeight) {
    const bx = Math.floor(x), by = Math.floor(y - halfHeight + 0.001), bz = Math.floor(z);
    const type = world.getBlock(bx, by, bz);
    if (!WaterSystem.isBlock(type)) return 0;
    const surface = by + WaterSystem.surfaceHeightFor(type, world.getBlock(bx, by + 1, bz));
    return Math.max(0, Math.min(1, (surface - (y - halfHeight)) / (halfHeight * 2)));
}

function spawnBreakParticles(x, y, z, type) {
    if (!particleMats[type]) particleMats[type] = new THREE.MeshBasicMaterial({ color: BLOCK_COLORS[type] });
    for (let i = 0; i < 12 && particles.length < 150; i++) {
        const mesh = new THREE.Mesh(particleGeo, particleMats[type]);
        mesh.position.set(x + Math.random(), y + Math.random(), z + Math.random());
        scene.add(mesh);
        particles.push({
            mesh,
            vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3 + 1, (Math.random() - 0.5) * 3),
            life: 0.6 + Math.random() * 0.4,
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); continue; }
        p.vel.y -= 18 * dt;
        const immersion = waterImmersionAt(world, p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 0.05);
        if (immersion > 0) {
            p.vel.y += 20 * immersion * dt;
            p.vel.multiplyScalar(Math.exp(-4.5 * immersion * dt));
        }
        p.mesh.position.addScaledVector(p.vel, dt);
    }
}

function buildCubeGeo(tiles, size) {
    const positions = [], normals = [], uvs = [], indices = [];
    const uWidth = 1 / ATLAS_COLUMNS - 2 * UV_PAD;
    for (const f of FACES) {
        const u0 = tiles[f.kind] / ATLAS_COLUMNS + UV_PAD;
        const ndx = positions.length / 3;
        for (const c of f.corners) {
            positions.push((c.pos[0] - 0.5) * size, (c.pos[1] - 0.5) * size, (c.pos[2] - 0.5) * size);
            normals.push(f.dir[0], f.dir[1], f.dir[2]);
            uvs.push(u0 + c.uv[0] * uWidth, UV_PAD + c.uv[1] * (1 - 2 * UV_PAD));
        }
        indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
}

function buildSpriteGeo(pix, px, depth) {
    const pos = [], nor = [], col = [], ind = [];
    const filled = (cx, cy) => cx >= 0 && cx < 16 && cy >= 0 && cy < 16 && pix[cy][cx];
    const tmp = new THREE.Color();
    for (let cy = 0; cy < 16; cy++) {
        for (let cx = 0; cx < 16; cx++) {
            const c = pix[cy][cx];
            if (!c) continue;
            tmp.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
            const gy = 15 - cy;
            for (const f of FACES) {
                if (f.dir[2] === 0 && filled(cx + f.dir[0], cy - f.dir[1])) continue;
                const base = pos.length / 3;
                for (const k of f.corners) {
                    pos.push((cx - 8 + k.pos[0]) * px, (gy - 8 + k.pos[1]) * px, (k.pos[2] - 0.5) * depth);
                    nor.push(f.dir[0], f.dir[1], f.dir[2]);
                    col.push(tmp.r, tmp.g, tmp.b);
                }
                ind.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
            }
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(ind);
    return geo;
}

const spriteMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

const ITEM_SIZE = 0.28;
const itemEntities = [];
const itemGeometryCache = {};
const _pickupCenter = new THREE.Vector3();
const _pickupRay = new THREE.Vector3();

function getItemGeometry(itemId) {
    if (itemGeometryCache[itemId]) return itemGeometryCache[itemId];
    const item = ITEMS[itemId];
    const geo = item.sprite
        ? buildSpriteGeo(spritePixels(item.sprite.kind, item.sprite.mat), ITEM_SIZE * 1.6 / 16, ITEM_SIZE * 0.25)
        : buildCubeGeo(BLOCKS[item.block].tiles, ITEM_SIZE);
    itemGeometryCache[itemId] = geo;
    return geo;
}

function spawnItemEntity(id, count, pos, vel, delay = 0.5, damage = 0, opts = {}) {
    if (ITEMS[id].maxStack > 1 && !opts.noMerge) {
        for (const e of itemEntities) {
            if (e.id === id && e.pos.distanceToSquared(pos) < 1.0 && e.count + count <= ITEMS[id].maxStack) {
                e.count += count;
                return;
            }
        }
    }
    const block = ITEMS[id].block != null ? BLOCKS[ITEMS[id].block] : null;
    const mat = ITEMS[id].sprite ? spriteMaterial :
        (block?.render === 'cutout' ? world.cutoutMaterial :
            (block?.render === 'liquid' ? world.water.material : world.material));
    const mesh = new THREE.Mesh(getItemGeometry(id), mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    itemEntities.push({ id, count, damage, pos: pos.clone(), vel: vel.clone(), mesh, age: opts.age || 0, ttl: opts.ttl || 300, delay, onGround: false, phase: Math.random() * 6.28 });
}

function removeItemEntity(i) {
    scene.remove(itemEntities[i].mesh);
    itemEntities.splice(i, 1);
}

function updateItemEntities(dt) {
    const half = ITEM_SIZE / 2;
    _pickupCenter.set(player.pos.x, player.pos.y + 0.9, player.pos.z);

    for (let i = itemEntities.length - 1; i >= 0; i--) {
        const e = itemEntities[i];
        const loaded = !!world.getChunk(floorDiv(e.pos.x, CHUNK_SIZE), floorDiv(e.pos.z, CHUNK_SIZE));
        if (!loaded) {
            // Mantém qualquer drop enquanto o chunk está descarregado; o TTL pausa fora da área carregada.
            e.mesh.visible = false;
            continue;
        }
        e.mesh.visible = true;
        e.age += dt;
        if (e.age > e.ttl) { removeItemEntity(i); continue; }

        if (world.isSolidForPhysics(Math.floor(e.pos.x), Math.floor(e.pos.y), Math.floor(e.pos.z))) {
            e.pos.y = Math.floor(e.pos.y) + 1 + half;
        }

        const immersion = waterImmersionAt(world, e.pos.x, e.pos.y, e.pos.z, half);
        e.vel.y = Math.max(e.vel.y - 22 * dt + 24 * immersion * dt, -30);
        const nx = e.pos.x + e.vel.x * dt;
        if (world.isSolidForPhysics(Math.floor(nx), Math.floor(e.pos.y), Math.floor(e.pos.z))) e.vel.x = 0; else e.pos.x = nx;
        const nz = e.pos.z + e.vel.z * dt;
        if (world.isSolidForPhysics(Math.floor(e.pos.x), Math.floor(e.pos.y), Math.floor(nz))) e.vel.z = 0; else e.pos.z = nz;
        const ny = e.pos.y + e.vel.y * dt;
        if (world.isSolidForPhysics(Math.floor(e.pos.x), Math.floor(ny - half), Math.floor(e.pos.z))) {
            if (e.vel.y < 0) { e.pos.y = Math.floor(ny - half) + 1 + half; e.onGround = true; }
            e.vel.y = 0;
        } else {
            e.pos.y = ny;
            e.onGround = false;
        }
        const friction = Math.min(1, (e.onGround ? 6 : 0.5) * dt);
        e.vel.x -= e.vel.x * friction;
        e.vel.z -= e.vel.z * friction;
        if (immersion > 0) {
            const waterDrag = Math.exp(-4.2 * immersion * dt);
            e.vel.x *= waterDrag;
            e.vel.z *= waterDrag;
            e.vel.y *= Math.exp(-1.2 * immersion * dt);
        }

        if (e.age >= e.delay && inventory.canAdd(e.id)) {
            const dx = _pickupCenter.x - e.pos.x, dy = _pickupCenter.y - e.pos.y, dz = _pickupCenter.z - e.pos.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            const d = Math.sqrt(d2);
            const blocked = d > 0.001 && raycastVoxels(
                e.pos,
                _pickupRay.set(dx / d, dy / d, dz / d),
                Math.max(0, d - 0.05)
            );
            if (!blocked && d2 < 0.36) {
                const left = inventory.add(e.id, e.count, 0, inventory.slots.length, e.damage);
                updateHotbarUI();
                if (left === 0) { removeItemEntity(i); continue; }
                e.count = left;
            } else if (!blocked && d2 < 2.25) {
                e.pos.x += dx / d * 6 * dt; e.pos.y += dy / d * 6 * dt; e.pos.z += dz / d * 6 * dt;
                e.vel.set(0, 0, 0);
            }
        }

        e.mesh.position.set(e.pos.x, e.pos.y + 0.05 + Math.sin(e.age * 3 + e.phase) * 0.04, e.pos.z);
        e.mesh.rotation.y = e.age * 1.5 + e.phase;
    }
}

function dropSelectedItem() {
    if (!controls.isLocked) return;
    const s = inventory.slots[selectedSlot];
    if (!s) return;
    const id = s.id, damage = s.damage || 0;
    inventory.removeOne(selectedSlot);
    camera.getWorldDirection(tmpDir);
    const pos = camera.position.clone().addScaledVector(tmpDir, 0.5);
    pos.y -= 0.2;
    const vel = tmpDir.clone().multiplyScalar(5);
    vel.y += 2;
    spawnItemEntity(id, 1, pos, vel, 1.5, damage);
    updateHotbarUI();
}

const CRACK_STAGES = 10;
let crackMesh = null, crackTexture = null;

function createCrackAssets() {
    const cell = 2, grid = TILE_PX / cell;
    const rnd = mulberry32(77);
    const branches = [];
    for (let b = 0; b < 7; b++) {
        let fx = grid / 2, fy = grid / 2;
        let a = (b / 7) * Math.PI * 2 + rnd() * 0.6;
        const path = [];
        for (let k = 0; k < 12; k++) {
            fx += Math.cos(a); fy += Math.sin(a);
            a += (rnd() - 0.5) * 0.9;
            path.push([Math.round(fx), Math.round(fy)]);
        }
        branches.push(path);
    }
    const cells = [], seen = new Set();
    for (let k = 0; k < 12; k++) {
        for (const path of branches) {
            const [cx, cy] = path[k];
            const key = cx + ',' + cy;
            if (cx < 0 || cy < 0 || cx >= grid || cy >= grid || seen.has(key)) continue;
            seen.add(key);
            cells.push([cx, cy]);
        }
    }
    const canvas = document.createElement('canvas');
    canvas.width = CRACK_STAGES * TILE_PX;
    canvas.height = TILE_PX;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    for (let st = 0; st < CRACK_STAGES; st++) {
        const n = Math.ceil(cells.length * (st + 1) / CRACK_STAGES);
        for (let k = 0; k < n; k++) ctx.fillRect(st * TILE_PX + cells[k][0] * cell, cells[k][1] * cell, cell, cell);
    }
    crackTexture = new THREE.CanvasTexture(canvas);
    crackTexture.magFilter = THREE.NearestFilter;
    crackTexture.minFilter = THREE.NearestFilter;
    crackTexture.generateMipmaps = false;
    crackTexture.colorSpace = THREE.SRGBColorSpace;
    crackTexture.repeat.set(1 / CRACK_STAGES, 1);

    crackMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.003, 1.003, 1.003),
        new THREE.MeshBasicMaterial({
            map: crackTexture, transparent: true, depthWrite: false,
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        })
    );
    crackMesh.visible = false;
    scene.add(crackMesh);
}

const mining = { active: false, x: 0, y: 0, z: 0, progress: 0, cooldown: 0 };

function resetMining() {
    mining.active = false;
    mining.progress = 0;
    if (crackMesh) crackMesh.visible = false;
}

function breakBlock(x, y, z) {
    const type = world.getBlock(x, y, z);
    if (!type) return;
    const held = inventory.slots[selectedSlot];
    const harvest = canHarvest(type, held);
    const drop = BLOCKS[type].drop;
    if (type === ID.FURNACE) spillFurnace(x, y, z);
    if (type === ID.CHEST) spillChest(x, y, z);
    const touchesWater = world.water.isAdjacent(world, x, y, z);
    world.setBlock(x, y, z, touchesWater ? ID.WATER : 0);
    if (touchesWater) world.water.activate(world, x, y, z);
    spawnBreakParticles(x, y, z, type);
    if (harvest && drop && Math.random() < (BLOCKS[type].dropChance ?? 1)) {
        spawnItemEntity(
            drop, 1,
            new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
            new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2)
        );
    }
    damageTool(selectedSlot, 1);
    addExhaustion(0.005);
}

function updateMining(dt) {
    mining.cooldown = Math.max(0, mining.cooldown - dt);
    if (!leftHeld || !currentHit) { resetMining(); return; }

    if (currentHit.y === 0) {
        mining.progress = 0;
        crackMesh.visible = false;
        return;
    }
    if (mining.cooldown > 0) return;

    if (!mining.active || mining.x !== currentHit.x || mining.y !== currentHit.y || mining.z !== currentHit.z) {
        mining.active = true;
        mining.x = currentHit.x; mining.y = currentHit.y; mining.z = currentHit.z;
        mining.progress = 0;
    }

    mining.progress += dt / getBreakTime(currentHit.type, inventory.slots[selectedSlot]);

    if (mining.progress >= 1) {
        breakBlock(mining.x, mining.y, mining.z);
        resetMining();
        mining.cooldown = 0.2;
        return;
    }
    crackMesh.position.set(mining.x + 0.5, mining.y + 0.5, mining.z + 0.5);
    crackTexture.offset.x = Math.min(CRACK_STAGES - 1, Math.floor(mining.progress * CRACK_STAGES)) / CRACK_STAGES;
    crackMesh.visible = mining.progress > 0;
}

function selectedItemText() {
    const s = inventory.slots[selectedSlot];
    if (!s) return 'mão vazia';
    const it = ITEMS[s.id];
    let t = `${it.name} x${s.count}`;
    if (it.maxDurability) t += ` (durabilidade ${it.maxDurability - (s.damage || 0)}/${it.maxDurability})`;
    return t;
}

function selectSlot(n) {
    if (n === selectedSlot) return;
    selectedSlot = n;
    resetMining();
    updateHotbarUI();
}

function initGameplayAssets() {
    initItemIcons();
    computeBlockColors();
    createCrackAssets();
    buildInventoryUI();
    buildRecipeList();
    
    
    updateHotbarUI();
}

// =====================================================================
// 5C. MÃO EM PRIMEIRA PESSOA
// =====================================================================
let handScene, handCamera, handPivot, heldAnchor, handAmbient;
let heldMesh = null, heldFlameMesh = null, heldTorchLight = null, heldId = -1;
const handAnim = { mining: 0, phase: 0, punch: 0, sw: 1, eat: 0 };
const heldGeoCache = {};

function createHand() {
    handScene = new THREE.Scene();
    handCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 5);
    handAmbient = new THREE.AmbientLight(0xffffff, 0.75);
    handScene.add(handAmbient);
    heldTorchLight = new THREE.PointLight(0xffb45b, 0, 7, 2);
    heldTorchLight.castShadow = false;
    scene.add(heldTorchLight);
    const dl = new THREE.DirectionalLight(0xffffff, 0.5);
    dl.position.set(0.5, 1, 0.8);
    handScene.add(dl);

    handPivot = new THREE.Group();
    const sleeve = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.40),
        new THREE.MeshLambertMaterial({ map: createNoiseTexture([70, 110, 190], 11) }));
    sleeve.position.z = -0.20;
    const hand = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.13, 0.20),
        new THREE.MeshLambertMaterial({ map: createNoiseTexture([214, 166, 125], 12, 8) }));
    hand.position.z = -0.50;
    heldAnchor = new THREE.Group();
    heldAnchor.position.set(0, 0.03, -0.62);
    handPivot.add(sleeve, hand, heldAnchor);
    handScene.add(handPivot);
}

function refreshHeldItem() {
    const s = inventory.slots[selectedSlot];
    const id = s ? s.id : 0;
    if (id === heldId) return;
    heldId = id;
    handAnim.sw = 0;
    if (heldMesh) { heldAnchor.remove(heldMesh); heldMesh = null; }
    if (heldFlameMesh) { heldAnchor.remove(heldFlameMesh); heldFlameMesh = null; }
    heldAnchor.rotation.set(0, 0, 0);
    if (!id) return;
    const item = ITEMS[id];
    if (item.sprite) {
        const px = 0.034;
        const key = 'spr' + id;
        if (!heldGeoCache[key]) {
            let pixels = spritePixels(item.sprite.kind, item.sprite.mat);
            if (item.sprite.kind === 'torch') {
                pixels = pixels.map(row => row.slice());
                for (let y = 0; y <= 7; y++) pixels[y].fill(null);
            }
            heldGeoCache[key] = buildSpriteGeo(pixels, px, px);
        }
        heldMesh = new THREE.Mesh(heldGeoCache[key], spriteMaterial);
        const hasHandle = !!item.tool || item.sprite.kind === 'stick';
        heldMesh.position.set(hasHandle ? 3.5 * px : 0, hasHandle ? 4.5 * px : 0, 0);
        heldAnchor.rotation.set(...HELD_TOOL_ROT);
    } else {
        const key = 'blk' + id;
        if (!heldGeoCache[key]) heldGeoCache[key] = buildCubeGeo(BLOCKS[item.block].tiles, 0.3);
        const block = BLOCKS[item.block];
        const mat = block?.render === 'cutout' ? world.cutoutMaterial :
            (block?.render === 'liquid' ? world.water.material : world.material);
        heldMesh = new THREE.Mesh(heldGeoCache[key], mat);
        heldMesh.position.set(...HELD_BLOCK_POS);
        heldAnchor.rotation.set(...HELD_BLOCK_ROT);
    }
    heldAnchor.add(heldMesh);
    if (item.sprite?.kind === 'torch') {
        if (!heldGeoCache.torchFlame) heldGeoCache.torchFlame = buildHeldTorchFlameGeometry();
        heldFlameMesh = new THREE.Mesh(heldGeoCache.torchFlame, world.torchFlameMaterial);
        heldAnchor.add(heldFlameMesh);
    }
}

function updateHand(dt) {
    refreshHeldItem();
    updateHeldTorchLight();
    const miningNow = (leftHeld && currentHit && currentHit.y !== 0) ? 1 : 0;
    handAnim.mining += (miningNow - handAnim.mining) * Math.min(1, 12 * dt);
    if (miningNow) handAnim.phase += dt * 9;
    handAnim.punch = Math.max(0, handAnim.punch - dt / 0.28);
    handAnim.sw = Math.min(1, handAnim.sw + dt / 0.25);

    const m = handAnim.mining * Math.abs(Math.sin(handAnim.phase));
    const p = Math.sin((1 - handAnim.punch) * Math.PI);
    const swing = Math.max(m, p);
    const dip = (1 - handAnim.sw) * (1 - handAnim.sw) * 0.5;

    handAnim.eat += ((eat.active ? 1 : 0) - handAnim.eat) * Math.min(1, 10 * dt);
    const ea = handAnim.eat;
    const wob = Math.sin(performance.now() / 1000 * 22) * 0.015 * ea;

    handPivot.position.set(
        HAND_BASE.x + Math.cos(bobTimer) * 0.012 - 0.22 * ea,
        HAND_BASE.y + Math.sin(bobTimer * 2) * 0.010 - dip - 0.05 * swing + 0.20 * ea + wob,
        HAND_BASE.z - 0.12 * swing + 0.08 * ea);
    handPivot.rotation.set(0.35 - 0.9 * swing + 0.35 * ea, 0.25 - 0.3 * ea, 0);
}

function updateHeldTorchLight() {
    if (!heldTorchLight || !camera || !world?.water) return;
    const torchSelected = inventory.slots[selectedSlot]?.id === ID.TORCH;
    if (!torchSelected || world.water.headInWater) {
        heldTorchLight.intensity = 0;
        return;
    }
    const time = performance.now() * 0.001;
    heldTorchLight.intensity = 1.05 + 0.12 * Math.sin(time * 8.7) + 0.05 * Math.sin(time * 13.1 + 1.2);
    heldTorchLight.position.set(0.34, -0.25, -0.7);
    camera.localToWorld(heldTorchLight.position);
}

// =====================================================================
// 5D. TELA DE INVENTÁRIO
// =====================================================================
const cursorHeld = { stack: null };
const craftInv = new Inventory(9);
let craftN = 2;

const stackable = (id) => ITEMS[id].maxStack > 1;

function invLeftClick(inv, i, cur) {
    const s = inv.slots[i], c = cur.stack;
    if (!c) { if (s) { cur.stack = s; inv.slots[i] = null; } return; }
    if (!s) { inv.slots[i] = c; cur.stack = null; return; }
    if (s.id === c.id && stackable(s.id)) {
        const n = Math.min(ITEMS[s.id].maxStack - s.count, c.count);
        s.count += n; c.count -= n;
        if (c.count <= 0) cur.stack = null;
        return;
    }
    inv.slots[i] = c; cur.stack = s;
}

function invRightClick(inv, i, cur) {
    const s = inv.slots[i], c = cur.stack;
    if (!c) {
        if (s) {
            const take = Math.ceil(s.count / 2);
            cur.stack = { id: s.id, count: take };
            if (s.damage) cur.stack.damage = s.damage;
            s.count -= take;
            if (s.count <= 0) inv.slots[i] = null;
        }
        return;
    }
    if (!s) {
        const one = { id: c.id, count: 1 };
        if (c.damage) one.damage = c.damage;
        inv.slots[i] = one;
        c.count--;
        if (c.count <= 0) cur.stack = null;
        return;
    }
    if (s.id === c.id && stackable(s.id)) {
        if (s.count < ITEMS[s.id].maxStack) {
            s.count++; c.count--;
            if (c.count <= 0) cur.stack = null;
        }
        return;
    }
    inv.slots[i] = c; cur.stack = s;
}

function invQuickMove(src, i, dst, from, to) {
    const s = src.slots[i];
    if (!s) return;
    const left = dst.add(s.id, s.count, from, to, s.damage || 0);
    if (left === 0) src.slots[i] = null; else s.count = left;
}

function invQuickMoveToCraft(i) {
    const source = inventory.slots[i];
    if (!source) return;
    let left = source.count;
    const end = craftN * craftN;
    for (let slot = 0; slot < end && left > 0; slot++) {
        if (craftInv.slots[slot]) continue;
        craftInv.slots[slot] = { id: source.id, count: 1 };
        if (source.damage) craftInv.slots[slot].damage = source.damage;
        left--;
    }
    if (left > 0 && stackable(source.id)) {
        for (let slot = 0; slot < end && left > 0; slot++) {
            const target = craftInv.slots[slot];
            if (!target || target.id !== source.id || target.count >= ITEMS[source.id].maxStack) continue;
            const moved = Math.min(ITEMS[source.id].maxStack - target.count, left);
            target.count += moved;
            left -= moved;
        }
    }
    if (left === 0) inventory.slots[i] = null;
    else source.count = left;
}

function invCollectSame(inv, cur) {
    const c = cur.stack;
    if (!c || !stackable(c.id)) return;
    const max = ITEMS[c.id].maxStack;
    for (let i = 0; i < inv.slots.length && c.count < max; i++) {
        const s = inv.slots[i];
        if (s && s.id === c.id) {
            const n = Math.min(max - c.count, s.count);
            c.count += n; s.count -= n;
            if (s.count <= 0) inv.slots[i] = null;
        }
    }
}

function invSwapHotbar(inv, i, h) {
    if (i === h) return;
    [inv.slots[i], inv.slots[h]] = [inv.slots[h], inv.slots[i]];
}

function craftConsume() {
    for (let i = 0; i < craftN * craftN; i++) if (craftInv.slots[i]) craftInv.removeOne(i);
}

function handleOutputClick(e) {
    const r = matchRecipe(craftInv, craftN);
    if (!r) return;
    const c = cursorHeld.stack;
    if (e.shiftKey && !c) {
        for (let guard = 0; guard < 64; guard++) {
            const rr = matchRecipe(craftInv, craftN);
            if (!rr || inventory.spaceFor(rr.id) < rr.count) break;
            craftConsume();
            inventory.add(rr.id, rr.count);
        }
        return;
    }
    if (!c) {
        craftConsume();
        cursorHeld.stack = { id: r.id, count: r.count };
    } else if (c.id === r.id && stackable(c.id) && c.count + r.count <= ITEMS[c.id].maxStack) {
        craftConsume();
        c.count += r.count;
    }
}

function furnaceClick(e, i) {
    const f = station.furnace, c = cursorHeld.stack;
    if (e.button !== 0 && e.button !== 2) return;
    if (i === 2) {
        const s = f.inv.slots[2];
        if (!s) return;
        if (e.shiftKey && !c) invQuickMove(f.inv, 2, inventory, 0, 36);
        else if (!c) { if (e.button === 2) invRightClick(f.inv, 2, cursorHeld); else invLeftClick(f.inv, 2, cursorHeld); }
        else if (c.id === s.id && stackable(c.id)) {
            const n = Math.min(ITEMS[c.id].maxStack - c.count, s.count);
            c.count += n; s.count -= n;
            if (s.count <= 0) f.inv.slots[2] = null;
        }
        return;
    }
    if (c && !(i === 0 ? SMELT[c.id] : FUEL[c.id])) return;
    if (e.shiftKey && !c) invQuickMove(f.inv, i, inventory, 0, 36);
    else if (e.button === 2) invRightClick(f.inv, i, cursorHeld);
    else invLeftClick(f.inv, i, cursorHeld);
    if (i === 0) f.cook = 0;
}

function quickToFurnace(i) {
    const s = inventory.slots[i];
    if (!s) return;
    const dst = SMELT[s.id] ? 0 : FUEL[s.id] ? 1 : -1;
    if (dst < 0) return;
    invQuickMove(inventory, i, station.furnace.inv, dst, dst + 1);
    if (dst === 0) station.furnace.cook = 0;
}

let inventoryOpen = false;
let inventoryUnlockPending = false;
let invHover = null;
let invLastClick = { time: 0, key: '' };
const invMouse = { x: 0, y: 0, seen: false };
let invSlotEls = [], craftSlotEls = [], furnaceSlotEls = [], chestSlotEls = [], outSlotEl = null;
let craftResult = null;
const slotHtmlCache = new WeakMap();

function stackHtml(s) {
    if (!s) return '';
    let html = `<div class="slot-icon ico-${s.id}"></div>`;
    if (s.count > 1) html += `<span class="slot-count">${s.count}</span>`;
    const it = ITEMS[s.id];
    if (it.maxDurability && s.damage > 0) {
        const f = Math.max(0, 1 - s.damage / it.maxDurability);
        html += `<div class="dur"><div style="width:${(f * 100).toFixed(0)}%;background:hsl(${(f * 120).toFixed(0)},80%,45%)"></div></div>`;
    }
    return html;
}

function updateSlotElement(el, stack) {
    const html = stackHtml(stack);
    if (slotHtmlCache.get(el) === html) return;
    el.innerHTML = html;
    slotHtmlCache.set(el, html);
}

function throwStack(id, count, damage = 0) {
    camera.getWorldDirection(tmpDir);
    const pos = camera.position.clone().addScaledVector(tmpDir, 0.6);
    pos.y -= 0.2;
    const vel = tmpDir.clone().multiplyScalar(5);
    vel.y += 2;
    spawnItemEntity(id, count, pos, vel, 1.5, damage);
}

function buildInventoryUI() {
    const main = document.getElementById('inv-main');
    const bar = document.getElementById('inv-hotbar');
    const craft = document.getElementById('inv-craft');
    const out = document.getElementById('inv-out');
    invSlotEls = new Array(36);
    craftSlotEls = new Array(9);
    furnaceSlotEls = new Array(3);
    const make = (name, i, parent) => {
        const el = document.createElement('div');
        el.className = 'islot';
        el.dataset.inv = name;
        el.dataset.index = i;
        parent.appendChild(el);
        return el;
    };
    for (let i = 9; i < 36; i++) invSlotEls[i] = make('main', i, main);
    for (let i = 0; i < 9; i++) invSlotEls[i] = make('main', i, bar);
    for (let i = 0; i < 9; i++) craftSlotEls[i] = make('craft', i, craft);
    outSlotEl = make('out', 0, out);
    outSlotEl.classList.add('out');
    furnaceSlotEls[0] = make('furnace', 0, document.getElementById('fur-in'));
    furnaceSlotEls[1] = make('furnace', 1, document.getElementById('fur-fuel'));
    furnaceSlotEls[2] = make('furnace', 2, document.getElementById('fur-out'));
    furnaceSlotEls[2].classList.add('out');
    const chestEl = document.getElementById('inv-chest');
    chestSlotEls = new Array(27);
    for (let i = 0; i < 27; i++) chestSlotEls[i] = make('chest', i, chestEl);

    const overlay = document.getElementById('inventory');
    overlay.addEventListener('mousedown', onInventoryMouseDown);
    overlay.addEventListener('mousemove', onInventoryMouseMove);
}

function buildRecipeList() {
    const nm = (id) => id ? ITEMS[id].name : '·';
    const lines = RECIPES.map(r => {
        if (r.kind === 'shapeless') return `${r.ingredients.map(nm).join(' + ')} → ${r.count}× ${ITEMS[r.result].name} [sem forma]`;
        const big = r.shape.length > 2 || r.shape[0].length > 2;
        return r.shape.map(row => row.map(nm).join(' + ')).join(' / ') +
            ` → ${r.count}× ${ITEMS[r.result].name}` + (big ? ' [bancada]' : '');
    });
    const sm = Object.entries(SMELT).map(([id, r]) => `${ITEMS[id].name} → ${ITEMS[r.result].name} (${r.time}s)`);
    const fu = Object.entries(FUEL).map(([id, t]) => `${ITEMS[id].name} ${t}s`);
    document.getElementById('inv-recipes').innerHTML =
        '<b>Receitas (vale espelhado):</b><br>' + lines.join('<br>') +
        '<br><b>Forno:</b><br>' + sm.join('<br>') + '<br><b>Combustíveis:</b> ' + fu.join(', ');
}

function hoveredStack() {
    if (!invHover) return null;
    if (invHover.inv === 'main') return inventory.slots[invHover.i];
    if (invHover.inv === 'craft') return craftInv.slots[invHover.i];
    if (invHover.inv === 'chest') return station && station.chest ? station.chest.inv.slots[invHover.i] : null;
    if (invHover.inv === 'furnace') return station && station.furnace ? station.furnace.inv.slots[invHover.i] : null;
    return craftResult;
}

function updateInventoryFloaters() {
    const cursorEl = document.getElementById('inv-cursor');
    const tip = document.getElementById('inv-tooltip');
    if (cursorHeld.stack && invMouse.seen) {
        cursorEl.innerHTML = stackHtml(cursorHeld.stack);
        cursorEl.style.left = (invMouse.x - 15) + 'px';
        cursorEl.style.top = (invMouse.y - 15) + 'px';
        cursorEl.style.display = 'block';
    } else {
        cursorEl.style.display = 'none';
    }
    const hovered = hoveredStack();
    if (hovered && !cursorHeld.stack && invMouse.seen) {
        const it = ITEMS[hovered.id];
        let text = it.name + (hovered.count > 1 ? ` (x${hovered.count})` : '');
        if (it.maxDurability) text += `\nDurabilidade: ${it.maxDurability - (hovered.damage || 0)}/${it.maxDurability}`;
        if (it.food) text += `\nRecupera ${it.food.hunger} de fome`;
        if (FUEL[hovered.id]) text += `\nCombustível: ${FUEL[hovered.id]}s`;
        tip.textContent = text;
        tip.style.left = (invMouse.x + 14) + 'px';
        tip.style.top = (invMouse.y + 14) + 'px';
        tip.style.display = 'block';
    } else {
        tip.style.display = 'none';
    }
}

function applyInventoryLayout() {
    const isFurnace = !!station && station.type === 'furnace';
    const isChest = !!station && station.type === 'chest';
    document.getElementById('craft-row').style.display = (isFurnace || isChest) ? 'none' : 'flex';
    document.getElementById('furnace-row').style.display = isFurnace ? 'flex' : 'none';
    document.getElementById('chest-row').style.display = isChest ? 'block' : 'none';
    document.getElementById('inv-title').textContent =
        isFurnace ? 'Forno' : isChest ? 'Baú' : station ? 'Bancada de criação (3×3)' : 'Inventário (criação 2×2)';
    document.getElementById('inv-craft').style.gridTemplateColumns = `repeat(${craftN}, 44px)`;
    craftSlotEls.forEach((el, i) => { el.style.display = i < craftN * craftN ? '' : 'none'; });
}

function renderInventory() {
    for (let i = 0; i < 36; i++) {
        const el = invSlotEls[i];
        updateSlotElement(el, inventory.slots[i]);
        el.classList.toggle('sel', i === selectedSlot);
    }
    if (station && station.type === 'chest') {
        for (let i = 0; i < 27; i++) updateSlotElement(chestSlotEls[i], station.chest.inv.slots[i]);
        craftResult = null;
    } else if (station && station.type === 'furnace') {
        for (let i = 0; i < 3; i++) updateSlotElement(furnaceSlotEls[i], station.furnace.inv.slots[i]);
        craftResult = null;
        updateFurnaceBars();
    } else {
        for (let i = 0; i < craftN * craftN; i++) updateSlotElement(craftSlotEls[i], craftInv.slots[i]);
        craftResult = matchRecipe(craftInv, craftN);
        updateSlotElement(outSlotEl, craftResult);
    }
    updateInventoryFloaters();
    updateHotbarUI();
}

function onInventoryMouseMove(e) {
    invMouse.x = e.clientX; invMouse.y = e.clientY; invMouse.seen = true;
    const el = e.target.closest('.islot');
    invHover = el ? { inv: el.dataset.inv, i: Number(el.dataset.index) } : null;
    updateInventoryFloaters();
}

function onInventoryMouseDown(e) {
    e.preventDefault();
    invMouse.x = e.clientX; invMouse.y = e.clientY; invMouse.seen = true;
    const el = e.target.closest('.islot');

    if (!el) {
        if (e.target.closest('#inv-panel')) return;
        const c = cursorHeld.stack;
        if (c) {
            const dmg = c.damage || 0;
            if (e.button === 0) { throwStack(c.id, c.count, dmg); cursorHeld.stack = null; }
            else if (e.button === 2) { throwStack(c.id, 1, dmg); c.count--; if (c.count <= 0) cursorHeld.stack = null; }
            renderInventory();
        }
        return;
    }

    const name = el.dataset.inv, i = Number(el.dataset.index);
    invHover = { inv: name, i };

    if (name === 'out') {
        if (e.button === 0 || e.button === 2) handleOutputClick(e);
        renderInventory();
        return;
    }
    if (name === 'furnace') {
        if (station && station.furnace) furnaceClick(e, i);
        renderInventory();
        return;
    }

    const target = name === 'craft' ? craftInv : name === 'chest' ? station.chest.inv : inventory;
    const key = name + i;
    if (e.button === 0) {
        const now = performance.now();
        if (e.shiftKey && !cursorHeld.stack) {
            if (name === 'main' && station && station.type === 'furnace') quickToFurnace(i);
            else if (name === 'main' && station && station.type === 'chest') invQuickMove(inventory, i, station.chest.inv, 0, 27);
            else if (name === 'main') invQuickMoveToCraft(i);
            else if (name === 'chest') invQuickMove(station.chest.inv, i, inventory, 0, 36);
            else invQuickMove(craftInv, i, inventory, 0, 36);
        }
        else if (cursorHeld.stack && invLastClick.key === key && now - invLastClick.time < 350) invCollectSame(target, cursorHeld);
        else invLeftClick(target, i, cursorHeld);
        invLastClick = { time: now, key };
    } else if (e.button === 2) {
        invRightClick(target, i, cursorHeld);
    }
    renderInventory();
}

function openInventory(st = null) {
    if (!controls.isLocked || inventoryOpen) return;
    station = st;
    craftN = st && st.type === 'crafting' ? 3 : 2;
    inventoryOpen = true;
    invHover = null;
    invMouse.seen = false;
    invLastClick = { time: 0, key: '' };
    applyInventoryLayout();
    document.getElementById('inventory').style.display = 'flex';
    renderInventory();
    inventoryUnlockPending = true;
    controls.unlock();
    setTimeout(() => { inventoryUnlockPending = false; }, 300);
}

function giveBack(s) {
    if (!s) return;
    const left = inventory.add(s.id, s.count, 0, inventory.slots.length, s.damage || 0);
    if (left > 0) throwStack(s.id, left, s.damage || 0);
}

function closeInventory(relock) {
    if (!inventoryOpen) return;
    inventoryOpen = false;

    giveBack(cursorHeld.stack);
    cursorHeld.stack = null;
    for (let i = 0; i < 9; i++) { giveBack(craftInv.slots[i]); craftInv.slots[i] = null; }
    station = null;
    furnaceDirty = false;
    craftN = 2;

    document.getElementById('inventory').style.display = 'none';
    document.getElementById('inv-cursor').style.display = 'none';
    document.getElementById('inv-tooltip').style.display = 'none';
    updateHotbarUI();
    saveGame(true);

    const menu = document.getElementById('menu');
    if (relock) {
        menu.style.display = 'none';
        requestLock();
    } else {
        menu.style.display = 'flex';
    }
}

function handleInventoryKey(event) {
    if (event.code === 'KeyE') { event.preventDefault(); if (!event.repeat) closeInventory(true); return; }
    if (event.code === 'Escape') { event.preventDefault(); event.stopPropagation(); closeInventory(true); return; }
    if (!invHover || invHover.inv === 'out' || invHover.inv === 'furnace' || cursorHeld.stack) return;
    if (event.code.startsWith('Digit')) {
        const n = parseInt(event.key);
        if (n >= 1 && n <= 9 && invHover.inv === 'main') { invSwapHotbar(inventory, invHover.i, n - 1); renderInventory(); }
        else if (n >= 1 && n <= 9 && invHover.inv === 'chest' && station && station.chest) {
            const cs = station.chest.inv.slots;
            [cs[invHover.i], inventory.slots[n - 1]] = [inventory.slots[n - 1], cs[invHover.i]];
            renderInventory();
        }
    } else if (event.code === 'KeyQ') {
        const inv = invHover.inv === 'main' ? inventory : invHover.inv === 'chest' ? station.chest.inv : craftInv;
        const s = inv.slots[invHover.i];
        if (s) {
            throwStack(s.id, 1, s.damage || 0);
            inv.removeOne(invHover.i);
            renderInventory();
        }
    }
}

// =====================================================================
// 5E. CICLO DE DIA E NOITE
// =====================================================================
let worldTime = START_TIME;
let hemiLight, sunLight, sunMesh, moonMesh, starPoints;
const SKY_DAY = new THREE.Color(SKY_COLOR);
const SKY_NIGHT = new THREE.Color(0x070b1c);
const SKY_DUSK = new THREE.Color(0xf08a4b);
const LIGHT_WARM = new THREE.Color(0xffb070);
const LIGHT_WHITE = new THREE.Color(0xffffff);
const LIGHT_MOON = new THREE.Color(0x8fa6ff);
const _skyCol = new THREE.Color();
const _sunDir = new THREE.Vector3();
const sky = { elevation: 1, day: 1 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function makeSquareMesh(size, color) {
    const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = -1;
    m.frustumCulled = false;
    return m;
}

function createSky() {
    sunMesh = makeSquareMesh(36, 0xfff2a8);
    moonMesh = makeSquareMesh(26, 0xdfe6f5);
    scene.add(sunMesh, moonMesh);

    const rnd = mulberry32(4242);
    const pos = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        pos[i * 3] = Math.cos(a) * r * SKY_DISTANCE;
        pos[i * 3 + 1] = u * SKY_DISTANCE;
        pos[i * 3 + 2] = Math.sin(a) * r * SKY_DISTANCE;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starPoints = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0, depthWrite: false }));
    starPoints.frustumCulled = false;
    scene.add(starPoints);
}

function updateWorldClock(dt) {
    worldTime = (worldTime + dt / DAY_LENGTH) % 1;
}

function updateSky() {
    const a = worldTime * Math.PI * 2;
    _sunDir.set(Math.cos(a), Math.sin(a), 0.3).normalize();
    const e = _sunDir.y;
    const day = smoothstep(-0.12, 0.28, e);
    const warm = clamp01(1 - Math.abs(e) / 0.3) * 0.9;
    sky.elevation = e; sky.day = day;

    _skyCol.copy(SKY_NIGHT).lerp(SKY_DAY, day).lerp(SKY_DUSK, warm * (1 - Math.abs(day - 0.5) * 0.6));
    scene.background.copy(_skyCol);
    scene.fog.color.copy(_skyCol);
    
    // Distância de Fog normal atualizada com a cor do céu
    const viewDist = RENDER_DISTANCE * CHUNK_SIZE;
    scene.fog.near = viewDist * 0.55;
    scene.fog.far = viewDist * 0.95;

    hemiLight.intensity = 0.22 + 0.58 * day;
    if (e >= -0.05) {
        sunLight.position.copy(_sunDir).multiplyScalar(50);
        sunLight.color.copy(LIGHT_WHITE).lerp(LIGHT_WARM, warm);
        sunLight.intensity = 0.62 * smoothstep(-0.05, 0.2, e);
    } else {
        sunLight.position.set(-_sunDir.x * 50, -_sunDir.y * 50, -_sunDir.z * 50);
        sunLight.color.copy(LIGHT_MOON);
        sunLight.intensity = 0.14 * smoothstep(-0.05, -0.25, e);
    }
    handAmbient.intensity = 0.38 + 0.37 * day;

    const cp = camera.position;
    sunMesh.position.copy(cp).addScaledVector(_sunDir, SKY_DISTANCE);
    sunMesh.lookAt(cp);
    moonMesh.position.copy(cp).addScaledVector(_sunDir, -SKY_DISTANCE);
    moonMesh.lookAt(cp);
    sunMesh.visible = e > -0.2;
    moonMesh.visible = e < 0.2;
    starPoints.position.copy(cp);
    starPoints.rotation.z = a;
    starPoints.material.opacity = clamp01((0.35 - day) / 0.35) * 0.9;
    starPoints.visible = starPoints.material.opacity > 0.01;
    updateCloudTint(day, warm);
}

// =====================================================================
// 5F. NUVENS VOXEL
// =====================================================================
let cloudMesh = null, cloudNoise = null;
const cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.88, fog: false });
const cloudState = { scroll: 0, key: '', cells: 0 };
const cloudNoiseCache = new Map();
const CLOUD_NOISE_CACHE_LIMIT = 8192;
const CLOUD_BRIGHT = { top: 1.0, side: 0.84, bottom: 0.68 };
const CLOUD_NIGHT = new THREE.Color(0x232a46), CLOUD_DUSK = new THREE.Color(0xffb690);
const _cloudCol = new THREE.Color();

function createClouds() {
    cloudNoise = new Noise2D(SEED + 555);
    cloudNoiseCache.clear();
    cloudMesh = new THREE.Mesh(new THREE.BufferGeometry(), cloudMat);
    cloudMesh.frustumCulled = false;
    cloudMesh.renderOrder = -0.5;
    scene.add(cloudMesh);
}

function cloudDensityAt(x, z) {
    const key = `${x},${z}`;
    if (cloudNoiseCache.has(key)) {
        const density = cloudNoiseCache.get(key);
        cloudNoiseCache.delete(key);
        cloudNoiseCache.set(key, density);
        return density;
    }
    const density = cloudNoise.fbm(x * CLOUD_SCALE, z * CLOUD_SCALE, 3);
    cloudNoiseCache.set(key, density);
    if (cloudNoiseCache.size > CLOUD_NOISE_CACHE_LIMIT) {
        cloudNoiseCache.delete(cloudNoiseCache.keys().next().value);
    }
    return density;
}

function buildCloudGeometry(camCx, camCz, ci) {
    const G = CLOUD_GRID, half = G / 2;
    const filled = new Uint8Array(G * G);
    let count = 0;
    for (let j = 0; j < G; j++) {
        for (let i = 0; i < G; i++) {
            const di = i - half, dj = j - half;
            if (di * di + dj * dj > half * half) continue;
            const n = cloudDensityAt(di + camCx - ci, dj + camCz);
            if (n > CLOUD_THRESHOLD) { filled[i + j * G] = 1; count++; }
        }
    }
    cloudState.cells = count;
    const has = (i, j) => i >= 0 && j >= 0 && i < G && j < G && filled[i + j * G] === 1;

    const pos = [], nor = [], col = [], ind = [];
    const S = CLOUD_CELL, H = CLOUD_THICK;
    for (let j = 0; j < G; j++) {
        for (let i = 0; i < G; i++) {
            if (!filled[i + j * G]) continue;
            const ox = (i - half) * S, oz = (j - half) * S;
            for (const f of FACES) {
                if (f.dir[1] === 0 && has(i + f.dir[0], j + f.dir[2])) continue;
                const b = f.dir[1] > 0 ? CLOUD_BRIGHT.top : f.dir[1] < 0 ? CLOUD_BRIGHT.bottom : CLOUD_BRIGHT.side;
                const base = pos.length / 3;
                for (const c of f.corners) {
                    pos.push(ox + c.pos[0] * S, c.pos[1] * H, oz + c.pos[2] * S);
                    nor.push(f.dir[0], f.dir[1], f.dir[2]);
                    col.push(b, b, b);
                }
                ind.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
            }
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(ind);
    return geo;
}

function updateClouds(dt) {
    cloudState.scroll += dt * CLOUD_SPEED / CLOUD_CELL;
    const ci = Math.floor(cloudState.scroll), frac = cloudState.scroll - ci;
    const camCx = Math.floor(camera.position.x / CLOUD_CELL), camCz = Math.floor(camera.position.z / CLOUD_CELL);
    const key = camCx + ',' + camCz + ',' + ci;
    if (key !== cloudState.key) {
        cloudState.key = key;
        const old = cloudMesh.geometry;
        cloudMesh.geometry = buildCloudGeometry(camCx, camCz, ci);
        old.dispose();
    }
    cloudMesh.position.set((camCx + frac) * CLOUD_CELL, CLOUD_Y, camCz * CLOUD_CELL);
}

function updateCloudTint(day, warm) {
    _cloudCol.copy(CLOUD_NIGHT).lerp(LIGHT_WHITE, day).lerp(CLOUD_DUSK, warm * 0.55);
    cloudMat.color.copy(_cloudCol);
}

function worldClockText() {
    const h = (worldTime * 24 + 6) % 24;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

// =====================================================================
// 6. ESTADO GERAL
// =====================================================================
let camera, scene, renderer, controls, world, creatureSystem;
let targetMesh;
let currentHit = null;
const tmpDir = new THREE.Vector3();
const yawEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const look = { yaw: 0, pitch: 0, spikes: 0, maxDelta: 0 };
const MAX_EVENT_DELTA = 350;
const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const LOOK_SPEED = 0.002;
const MAX_PITCH = Math.PI / 2 - 0.02;

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let jumpHeld = false, swimStrokeLocked = false, isSprinting = false, wantToCrouch = false, isCrouching = false;

const player = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    onGround: false,
    height: H_STAND,
    eye: EYE_STAND,
    fallDistance: 0,
};
const spawnPoint = new THREE.Vector3();

let bobTimer = 0;

let selectedSlot = 0;
const inventory = new Inventory(36);
let leftHeld = false;

// Status
let health = MAX_HEALTH, hunger = MAX_HUNGER, saturation = 5, exhaustion = 0;
let breath = MAX_BREATH, breathTimer = 0;
let regenTimer = 0, starveTimer = 0, invuln = 0, hurtFlash = 0;
let dead = false;
const eat = { active: false, progress: 0, slot: -1, id: 0 };
const hurtEl = document.getElementById('hurt');
const deathEl = document.getElementById('death');

let prevTime = performance.now();
const perf = { t: 0, frames: 0, sum: 0, worst: 0, avg: 0, worstShown: 0, buildMs: 0, fps: 0, long: 0, lastLong: '—', ctxLost: 0 };
const gfx = { auto: true, max: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO), min: 0.5, scale: 1, slow: 0, fast: 0, lastFps: null, noGain: 0, pending: null };
gfx.scale = gfx.max;

function setRenderScale(v) {
    gfx.scale = Math.max(gfx.min, Math.min(gfx.max, v));
    gfx.pending = gfx.scale;
}

function adaptResolution(fpsNow, cpuMs) {
    if (!gfx.auto || document.hidden) return;
    if (gfx.lastFps !== null) {
        gfx.noGain = fpsNow < gfx.lastFps * 1.1 ? gfx.noGain + 1 : 0;
        gfx.lastFps = null;
        if (gfx.noGain >= 3) {
            gfx.auto = false;
            setRenderScale(gfx.max);
            showToast('FPS não melhora com menos resolução: veja economia de energia / aceleração de hardware');
            return;
        }
    }
    const gpuBound = cpuMs < 0.6 * 1000 / Math.max(fpsNow, 1);
    if (fpsNow < 55 && gfx.scale > gfx.min && gpuBound) {
        gfx.fast = 0;
        if (++gfx.slow >= 3) { gfx.slow = 0; gfx.lastFps = fpsNow; setRenderScale(gfx.scale - 0.15); }
    } else if (fpsNow >= 58 && gfx.scale < gfx.max) {
        gfx.slow = 0;
        if (++gfx.fast >= 8) { gfx.fast = 0; setRenderScale(gfx.scale + 0.1); }
    } else { gfx.slow = 0; gfx.fast = 0; }
}

const QUALITY_MODES = ['auto', 'max', 1, 0.75, 0.5];
let qualityIdx = 0;
function cycleQuality() {
    qualityIdx = (qualityIdx + 1) % QUALITY_MODES.length;
    const m = QUALITY_MODES[qualityIdx];
    gfx.noGain = 0; gfx.lastFps = null; gfx.slow = 0; gfx.fast = 0;
    if (m === 'auto') { gfx.auto = true; setRenderScale(gfx.max); showToast('Qualidade: automática'); }
    else {
        gfx.auto = false;
        setRenderScale(m === 'max' ? gfx.max : m);
        showToast('Qualidade: ' + (m === 'max' ? 'máxima' : Math.round(m * 100) + '%'));
    }
}

// =====================================================================
// 7. HUD E STATUS DE SOBREVIVÊNCIA
// =====================================================================
const uiShown = { h: -1, f: -1, b: -1, breathVisible: null };
const survivalIcons = { hearts: [], food: [], bubbles: [] };

function ensureSurvivalIcons(bar, cache, className) {
    if (cache.length) return;
    for (let i = 0; i < 10; i++) {
        const icon = document.createElement('div');
        icon.className = className;
        bar.appendChild(icon);
        cache.push(icon);
    }
}

function updateSurvivalIcons(cache, kind, value) {
    for (let i = 0; i < 10; i++) {
        const state = value >= (i + 1) * 2 ? '' : value >= i * 2 + 1 ? 'half' : 'empty-stat';
        const className = state ? `${kind} ${state}` : kind;
        if (cache[i].className !== className) cache[i].className = className;
    }
}

function updateBreathUI() {
    const breathBar = document.getElementById('breath-bar');
    if (!breathBar) return;
    const visible = !(breath >= MAX_BREATH && !world.water.headInWater);
    if (uiShown.breathVisible !== visible) {
        breathBar.style.display = visible ? 'flex' : 'none';
        uiShown.breathVisible = visible;
    }
    if (!visible || uiShown.b === breath) return;
    ensureSurvivalIcons(breathBar, survivalIcons.bubbles, 'bubble');
    for (let i = 0; i < 10; i++) {
        const className = breath > i * 2 ? 'bubble' : 'bubble empty-stat';
        if (survivalIcons.bubbles[i].className !== className) survivalIcons.bubbles[i].className = className;
    }
    uiShown.b = breath;
}

function updateSurvivalUI() {
    const healthBar = document.getElementById('health-bar');
    const hungerBar = document.getElementById('hunger-bar');
    if (!healthBar || !hungerBar) return;
    updateBreathUI();
    if (health !== uiShown.h) {
        ensureSurvivalIcons(healthBar, survivalIcons.hearts, 'heart');
        updateSurvivalIcons(survivalIcons.hearts, 'heart', health);
        uiShown.h = health;
    }
    if (hunger !== uiShown.f) {
        ensureSurvivalIcons(hungerBar, survivalIcons.food, 'food');
        updateSurvivalIcons(survivalIcons.food, 'food', hunger);
        uiShown.f = hunger;
    }
}

const hotbarEls = [], hotbarHtml = new Array(9).fill('');
function updateHotbarUI() {
    for (let i = 0; i < 9; i++) {
        const slot = hotbarEls[i] || (hotbarEls[i] = document.getElementById(`slot-${i}`));
        slot.classList.toggle('active', i === selectedSlot);
        const html = `<span class="slot-number">${i + 1}</span>` + stackHtml(inventory.slots[i]);
        if (html !== hotbarHtml[i]) { slot.innerHTML = html; hotbarHtml[i] = html; }
    }
}

function addExhaustion(x) { exhaustion += x; }

function resetStats() {
    health = MAX_HEALTH; hunger = MAX_HUNGER; saturation = 5; exhaustion = 0;
    breath = MAX_BREATH; breathTimer = 0;
    regenTimer = 0; starveTimer = 0; hurtFlash = 0;
    updateSurvivalUI();
}

function takeDamage(amount, source = 'generic') {
    if (dead || amount <= 0) return;
    if (invuln > 0 && source !== 'starve' && source !== 'drown') return;
    health = Math.max(0, health - amount);
    invuln = INVULN_TIME;
    hurtFlash = 1;
    addExhaustion(0.1);
    updateSurvivalUI();
    if (health <= 0) die();
}

function die() {
    if (inventoryOpen) closeInventory(false);
    dead = true;
    cancelEating();
    const dx = Math.floor(player.pos.x), dy = Math.floor(player.pos.y), dz = Math.floor(player.pos.z);
    const origin = new THREE.Vector3(player.pos.x, player.pos.y + 0.8, player.pos.z);
    let lost = 0;
    inventory.slots.forEach((st, i) => {
        if (!st) return;
        inventory.slots[i] = null;
        lost += st.count;
        spawnItemEntity(st.id, st.count, origin,
            new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5),
            1.5, st.damage || 0, { ttl: DEATH_DROP_TTL, noMerge: true });
    });

    resetStats();
    invuln = 2;
    player.pos.copy(spawnPoint);
    world.water.updateSubmersion(world, player);
    player.vel.set(0, 0, 0);
    player.fallDistance = 0;
    world.update(spawnPoint.x, spawnPoint.z);
    camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
    updateHotbarUI();
    updateSurvivalUI();

    document.getElementById('death-info').textContent = lost
        ? `Seus ${lost} itens caíram em X ${dx}, Y ${dy}, Z ${dz}. Volte lá para recuperá-los antes que sumem (10 min).`
        : 'Você não tinha itens.';
    const btn = document.getElementById('btn-respawn');
    btn.disabled = true;
    btn.textContent = 'Preparando...';
    waitForWorldRegion(spawnPoint.x, spawnPoint.z, { driveUpdates: false })
        .then(() => new Promise(resolve => setTimeout(resolve, 1200)))
        .then(() => {
            if (dead) { btn.disabled = false; btn.textContent = 'Renascer'; }
        })
        .catch(error => console.error('Falha ao preparar o respawn:', error));
    deathEl.style.display = 'flex';
    controls.unlock();
    saveGame(true, true);
}

function cancelEating() { eat.active = false; eat.progress = 0; }

function updateEating(dt) {
    if (!eat.active) return;
    const st = inventory.slots[selectedSlot];
    const food = st && ITEMS[st.id].food;
    if (!food || selectedSlot !== eat.slot || st.id !== eat.id || hunger >= MAX_HUNGER) { cancelEating(); return; }
    eat.progress += dt / EAT_TIME;
    if (eat.progress >= 1) {
        hunger = Math.min(MAX_HUNGER, hunger + food.hunger);
        saturation = Math.min(hunger, saturation + food.sat);
        inventory.removeOne(selectedSlot);
        updateHotbarUI();
        updateSurvivalUI();
        cancelEating();
    }
}

function updateSurvival(dt) {
    invuln = Math.max(0, invuln - dt);
    
    // --- Lógica de Fôlego e Afogamento ---
    if (world.water.headInWater) {
        breathTimer += dt;
        if (breathTimer >= 1.5) { // 1.5s por cada bolha consumida
            breathTimer = 0;
            breath--;
            if (breath <= 0) {
                breath = 0;
                takeDamage(1, 'drown');
            }
            updateBreathUI();
        }
    } else if (breath < MAX_BREATH) {
        breathTimer += dt;
        if (breathTimer >= 0.2) { // Recupera rápido fora d'água
            breathTimer = 0;
            breath++;
            updateBreathUI();
        }
    } else {
        if (breathTimer !== 0) {
            breathTimer = 0;
            updateBreathUI();
        }
    }

    if (exhaustion >= 4) {
        exhaustion -= 4;
        if (saturation > 0) saturation = Math.max(0, saturation - 1);
        else if (hunger > 0) { hunger--; updateSurvivalUI(); }
    }
    if (hunger >= 18 && health < MAX_HEALTH) {
        const fast = hunger >= MAX_HUNGER && saturation > 0;
        regenTimer += dt;
        if (regenTimer >= (fast ? 0.5 : 4)) {
            regenTimer = 0;
            health++;
            addExhaustion(fast ? 1.5 : 3);
            updateSurvivalUI();
        }
        starveTimer = 0;
    } else {
        regenTimer = 0;
        if (hunger <= 0) {
            starveTimer += dt;
            if (starveTimer >= 4) { starveTimer = 0; if (health > 1) takeDamage(1, 'starve'); }
        } else starveTimer = 0;
    }
}

const debugEl = document.getElementById('debug');
let debugVisible = false, fpsFrames = 0, fpsTime = 0, fps = 0;
function updateDebug(rawDt) {
    fpsFrames++; fpsTime += rawDt;
    if (fpsTime < 0.25) return;
    fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    if (!debugVisible) return;
    const p = player.pos;
    const target = currentHit
        ? `${BLOCKS[currentHit.type].name} (${currentHit.x}, ${currentHit.y}, ${currentHit.z})`
        : '—';
    const tt = currentHit ? getBreakTime(currentHit.type, inventory.slots[selectedSlot]).toFixed(2) + 's' : '—';
    debugEl.textContent =
`Voxel Sandbox — Parte 11 (Mares)
FPS: ${fps} | Água: ${world.water.headInWater ? 'Mergulhado' : (world.water.feetInWater ? 'Cintura' : 'Não')}
Nuvens: ${cloudState.cells} células (de ${CLOUD_GRID * CLOUD_GRID}) | altura ${CLOUD_Y}
Seed: ${SEED}
XYZ: ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)}
Chunk: ${floorDiv(p.x, CHUNK_SIZE)}, ${floorDiv(p.z, CHUNK_SIZE)}
Chunks: ${world.chunks.size} | fila geração: ${world.genQueue.length} | fila malha: ${world.dirty.size}
No chão: ${player.onGround}
Hora do mundo: ${worldClockText()} (tempo ${worldTime.toFixed(3)}) | sol ${sky.elevation.toFixed(2)} | luz do dia ${sky.day.toFixed(2)}
Alvo: ${target} | tempo p/ quebrar: ${tt}
Mineração: ${Math.round(mining.progress * 100)}% | Drops no mundo: ${itemEntities.length} | Fornos: ${furnaces.size} | Baús: ${chests.size}
Item na mão: ${selectedItemText()}
Vida ${health} | Fome ${hunger} | Fôlego ${breath} | Saturação ${saturation.toFixed(1)} | Exaustão ${exhaustion.toFixed(2)}
CPU/quadro: média ${perf.avg.toFixed(1)} ms | pior ${perf.worstShown.toFixed(1)} ms | malha ${world.lastMeshMs.toFixed(1)} ms | luz ${world.lastLightMs.toFixed(1)} ms | último save: ${perf.buildMs.toFixed(1)} ms
Última pausa >60 ms: ${perf.lastLong}
Desenho: ${renderer.info.render.calls} chamadas | ${(renderer.info.render.triangles / 1000).toFixed(0)}k triângulos | escala de render ${gfx.scale.toFixed(2)} (${gfx.auto ? 'auto' : 'manual'}) · F4 muda`;
}

// =====================================================================
// 8. COLISÃO (AABB x VOXELS)
// =====================================================================
function collides(x, y, z, height) {
    const e = 1e-4;
    const x0 = Math.floor(x - PLAYER_RADIUS + e), x1 = Math.floor(x + PLAYER_RADIUS - e);
    const y0 = Math.floor(y + e),                 y1 = Math.floor(y + height - e);
    const z0 = Math.floor(z - PLAYER_RADIUS + e), z1 = Math.floor(z + PLAYER_RADIUS - e);
    for (let bx = x0; bx <= x1; bx++)
        for (let by = y0; by <= y1; by++)
            for (let bz = z0; bz <= z1; bz++)
                if (world.isSolidForPhysics(bx, by, bz)) return true;
    return false;
}

function moveAxis(axis, amount) {
    if (amount === 0) return false;
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.25));
    const step = amount / steps;
    const lo = axis === 'y' ? 0 : PLAYER_RADIUS;
    const hi = axis === 'y' ? player.height : PLAYER_RADIUS;
    const p = player.pos;
    for (let i = 0; i < steps; i++) {
        p[axis] += step;
        if (collides(p.x, p.y, p.z, player.height)) {
            if (step > 0) p[axis] = Math.floor(p[axis] + hi) - hi - 0.001;
            else          p[axis] = Math.floor(p[axis] - lo) + 1 + lo;
            return true;
        }
    }
    return false;
}

function intersectsPlayer(bx, by, bz) {
    const p = player.pos;
    return (p.x - PLAYER_RADIUS < bx + 1 && p.x + PLAYER_RADIUS > bx) &&
           (p.y < by + 1 && p.y + player.height > by) &&
           (p.z - PLAYER_RADIUS < bz + 1 && p.z + PLAYER_RADIUS > bz);
}

// =====================================================================
// 9. RAYCAST POR VOXELS (DDA)
// =====================================================================
function raycastVoxels(origin, dir, maxDist) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const sx = dir.x > 0 ? 1 : -1, sy = dir.y > 0 ? 1 : -1, sz = dir.z > 0 ? 1 : -1;
    const tdx = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tdy = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tdz = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tmx = dir.x !== 0 ? (dir.x > 0 ? x + 1 - origin.x : origin.x - x) * tdx : Infinity;
    let tmy = dir.y !== 0 ? (dir.y > 0 ? y + 1 - origin.y : origin.y - y) * tdy : Infinity;
    let tmz = dir.z !== 0 ? (dir.z > 0 ? z + 1 - origin.z : origin.z - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;

    for (let i = 0; i < 128 && t <= maxDist; i++) {
        const type = world.getBlock(x, y, z);
        // Permite que o raio ignore blocos de água, possibilitando interagir com blocos submersos
        if (type !== 0 && !WaterSystem.isBlock(type)) return { x, y, z, nx, ny, nz, type, dist: t };
        
        if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
        else if (tmy < tmz)         { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
        else                        { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
}

function updateTarget() {
    camera.getWorldDirection(tmpDir);
    currentHit = raycastVoxels(camera.position, tmpDir, REACH);
    if (currentHit) {
        targetMesh.position.set(currentHit.x + 0.5, currentHit.y + 0.5, currentHit.z + 0.5);
        targetMesh.visible = true;
    } else {
        targetMesh.visible = false;
    }
}

// =====================================================================
// 10. FÍSICA E MOVIMENTAÇÃO (Com Água)
// =====================================================================
function updatePhysics(dt) {
    const p = player.pos;

    world.water.updateSubmersion(world, player);
    const inWater = world.water.headInWater || world.water.feetInWater;
    const atWaterSurface = world.water.feetInWater && !world.water.headInWater;
    const wantsDive = inWater && wantToCrouch;
    const wantsCrouch = !inWater && wantToCrouch;

    if (wantsCrouch && !isCrouching) {
        isCrouching = true;
        player.height = H_CROUCH;
    } else if (!wantsCrouch && isCrouching && !collides(p.x, p.y, p.z, H_STAND)) {
        isCrouching = false;
        player.height = H_STAND;
    }

    const sprintNow = isSprinting && hunger >= SPRINT_MIN_HUNGER;
    // Reduz velocidade geral se estiver na água
    let speed = isCrouching ? CROUCH_SPEED : (sprintNow ? SPRINT_SPEED : WALK_SPEED);
    if (inWater) speed *= 0.5;

    const yaw = look.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw),  rz = -Math.sin(yaw);
    let ix = Number(moveRight) - Number(moveLeft);
    let iz = Number(moveForward) - Number(moveBackward);
    const hasInput = ix !== 0 || iz !== 0;
    if (hasInput) { const len = Math.hypot(ix, iz); ix /= len; iz /= len; }
    const tx = (rx * ix + fx * iz) * speed;
    const tz = (rz * ix + fz * iz) * speed;

    // Atrito/Desaceleração
    if (player.onGround || hasInput || inWater) {
        // Atrito maior na água se não tiver no chão (5) para nadar suavemente, chão normal (14), ar (3)
        const frictionBase = player.onGround ? 14 : (inWater ? 5 : 3);
        const k = 1 - Math.exp(-frictionBase * dt);
        player.vel.x += (tx - player.vel.x) * k;
        player.vel.z += (tz - player.vel.z) * k;
    }

    // Pulo e Gravidade com Natação
    if (inWater) {
        if (wantsDive) {
            player.vel.y = Math.max(player.vel.y - 12.0 * dt, -3.2);
        } else if (atWaterSurface && jumpHeld && !swimStrokeLocked) {
            player.vel.y = Math.max(player.vel.y, 3.2);
            swimStrokeLocked = true;
        } else if (world.water.headInWater && jumpHeld && !swimStrokeLocked) {
            player.vel.y += 15.0 * dt;
            if (player.vel.y > 4.0) player.vel.y = 4.0; // Velocidade terminal subindo
        }
        player.vel.y *= Math.exp(-5.0 * dt); // Arrasto estável mesmo com variação no FPS
        player.vel.y -= (GRAVITY * 0.1) * dt;    // Gravidade muito fraca (simula peso d'água)
    } else {
        if (jumpHeld && !swimStrokeLocked && player.onGround && !isCrouching) {
            player.vel.y = JUMP_SPEED;
            player.onGround = false;
            addExhaustion(sprintNow ? 0.2 : 0.05);
        }
        player.vel.y = Math.max(player.vel.y - GRAVITY * dt, -60);
    }

    const targetFOV = (sprintNow && moveForward && !isCrouching && !inWater) ? 85 : 75;
    if (Math.abs(camera.fov - targetFOV) > 0.1) {
        camera.fov += (targetFOV - camera.fov) * Math.min(1, 10 * dt);
        camera.updateProjectionMatrix();
    }

    if (moveAxis('x', player.vel.x * dt)) player.vel.x = 0;
    if (moveAxis('z', player.vel.z * dt)) player.vel.z = 0;

    const yBefore = p.y;
    const blockedY = moveAxis('y', player.vel.y * dt);
    const dy = p.y - yBefore;
    player.onGround = false;

    // Detecta água atravessada no passo, mesmo se o jogador cair até o chão no mesmo frame.
    let crossedWater = inWater;
    if (!crossedWater && dy < 0) {
        const minX = Math.floor(p.x - PLAYER_RADIUS), maxX = Math.floor(p.x + PLAYER_RADIUS);
        const minZ = Math.floor(p.z - PLAYER_RADIUS), maxZ = Math.floor(p.z + PLAYER_RADIUS);
        const minY = Math.floor(p.y), maxY = Math.floor(yBefore + player.height);
        for (let y = minY; y <= maxY && !crossedWater; y++) {
            for (let x = minX; x <= maxX && !crossedWater; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (WaterSystem.isBlock(world.getBlock(x, y, z))) { crossedWater = true; break; }
                }
            }
        }
    }

    if (crossedWater) {
        player.fallDistance = 0;
    } else if (dy < 0) {
        player.fallDistance += -dy;
    } else if (dy > 0) {
        player.fallDistance = 0;
    }

    if (blockedY) {
        if (player.vel.y < 0) {
            player.onGround = true;
            if (!crossedWater && player.fallDistance > 3) takeDamage(Math.floor(player.fallDistance - 3), 'fall');
            player.fallDistance = 0;
        }
        player.vel.y = 0;
    }

    const targetEye = isCrouching ? EYE_CROUCH : EYE_STAND;
    player.eye += (targetEye - player.eye) * Math.min(1, 15 * dt);
    camera.position.set(p.x, p.y + player.eye, p.z);

    const hzSpeed = Math.hypot(player.vel.x, player.vel.z);
    if ((player.onGround || inWater) && hzSpeed > 0.1 && sprintNow && !isCrouching) {
        addExhaustion(hzSpeed * dt * 0.1);
    }

    if ((player.onGround || inWater) && hzSpeed > 2.0) bobTimer += dt * (hzSpeed * (inWater ? 0.8 : 1.2));
    else bobTimer += (0 - bobTimer) * Math.min(1, 5 * dt);
}

// =====================================================================
// 10B. SALVAMENTO (IndexedDB, um registro por seed)
// =====================================================================
const SAVE_KEY = ACTIVE_WORLD.saveKey;
const SAVE_BACKUP_KEY = SAVE_KEY + '-backup';
const SAVE_LOCK_KEY = SAVE_KEY + '-writer-lock';
const SAVE_VERSION = 1;
const SAVE_LOCK_TTL = 30000;
const SAVE_TAB_ID = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let saveLockOwned = false, saveLockHeartbeat = null;

async function writeSaveIfOwner(data) {
    const db = await dbOpen();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('worlds', 'readwrite');
        const store = tx.objectStore('worlds');
        let wrote = false;
        const request = store.get(SAVE_LOCK_KEY);
        request.onsuccess = () => {
            if (request.result?.id !== SAVE_TAB_ID) return;
            wrote = true;
            store.put(data, SAVE_KEY);
            store.put({ id: SAVE_TAB_ID, heartbeat: Date.now() }, SAVE_LOCK_KEY);
        };
        tx.oncomplete = () => { db.close(); resolve(wrote); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Falha ao gravar o save.')); };
    });
}

async function acquireSaveLock() {
    const db = await dbOpen();
    const acquired = await new Promise((resolve, reject) => {
        const tx = db.transaction('worlds', 'readwrite');
        const store = tx.objectStore('worlds');
        let ownsLock = false;
        const request = store.get(SAVE_LOCK_KEY);
        request.onsuccess = () => {
            const lease = request.result;
            const expired = !lease || !Number.isFinite(lease.heartbeat) || Date.now() - lease.heartbeat > SAVE_LOCK_TTL;
            if (expired || lease.id === SAVE_TAB_ID) {
                ownsLock = true;
                store.put({ id: SAVE_TAB_ID, heartbeat: Date.now() }, SAVE_LOCK_KEY);
            }
        };
        tx.oncomplete = () => { db.close(); resolve(ownsLock); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Não foi possível obter o bloqueio do save.')); };
    });

    saveLockOwned = acquired;
    if (!acquired) return false;
    saveLockHeartbeat = setInterval(async () => {
        try {
            const lease = await dbRun('readwrite', store => {
                const request = store.get(SAVE_LOCK_KEY);
                request.onsuccess = () => {
                    if (request.result?.id === SAVE_TAB_ID) {
                        store.put({ id: SAVE_TAB_ID, heartbeat: Date.now() }, SAVE_LOCK_KEY);
                    }
                };
                return request;
            });
            if (lease?.id !== SAVE_TAB_ID) {
                saveLockOwned = false;
                saveWriteBlocked = true;
                clearInterval(saveLockHeartbeat);
                saveLockHeartbeat = null;
                showToast('Outra aba assumiu o save; salvamento bloqueado aqui');
            }
        } catch (error) {
            saveLockOwned = false;
            saveWriteBlocked = true;
            clearInterval(saveLockHeartbeat);
            saveLockHeartbeat = null;
            console.warn('Não foi possível renovar o bloqueio do save:', error);
        }
    }, 5000);
    return true;
}

function releaseSaveLock() {
    if (!saveLockOwned) return Promise.resolve();
    saveLockOwned = false;
    if (saveLockHeartbeat) clearInterval(saveLockHeartbeat);
    saveLockHeartbeat = null;
    return dbRun('readwrite', store => {
        const request = store.get(SAVE_LOCK_KEY);
        request.onsuccess = () => {
            if (request.result?.id === SAVE_TAB_ID) store.delete(SAVE_LOCK_KEY);
        };
        return request;
    }).catch(error => console.warn('Não foi possível liberar o bloqueio do save:', error));
}

window.addEventListener('pagehide', releaseSaveLock);

const packStack = (s) => s ? { id: s.id, count: s.count, damage: s.damage || 0 } : null;

function buildSave() {
    const edits = [];
    for (const [key, m] of world.edits) {
        let arr = world.editCache.get(key);
        if (!arr) {
            arr = new Uint16Array(m.size * 2);
            let k = 0;
            for (const [i, t] of m) { arr[k++] = i; arr[k++] = t; }
            world.editCache.set(key, arr);
        }
        edits.push([key, arr]);
    }
    return {
        v: SAVE_VERSION, seed: SEED, time: Date.now(),
        worldTime,
        player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, health, hunger, saturation, breath },
        selectedSlot,
        inventory: inventory.slots.map(packStack),
        drops: itemEntities.filter(e => e.age < e.ttl).map(e => ({
            id: e.id, count: e.count, damage: e.damage || 0, x: e.pos.x, y: e.pos.y, z: e.pos.z, age: e.age, ttl: e.ttl,
        })),
        chests: Array.from(chests, ([k, c]) => [k, c.inv.slots.map(packStack)]),
        furnaces: Array.from(furnaces, ([k, f]) => [k, {
            slots: f.inv.slots.map(packStack), burn: f.burn, burnMax: f.burnMax, cook: f.cook,
        }]),
        edits,
    };
}

function sanitizeStack(s) {
    if (!s) return null;
    if (s.id === ID.WATER) return null; // Remove a água dos saves antigos sem invalidar o mundo
    const it = ITEMS[s.id];
    if (!it || !Number.isInteger(s.count) || s.count < 1 || s.count > it.maxStack) {
        console.warn('Pilha inválida descartada durante o carregamento do save:', s);
        return null;
    }
    const st = { id: s.id, count: s.count };
    if (it.maxDurability && s.damage > 0 && s.damage < it.maxDurability) st.damage = s.damage;
    return st;
}

function parseChests(list) {
    const out = new Map();
    if (!Array.isArray(list)) return out;
    for (const entry of list) {
        if (!Array.isArray(entry)) continue;
        const [k, slots] = entry;
        if (typeof k !== 'string' || !/^-?\d+,\d+,-?\d+$/.test(k) || !Array.isArray(slots) || slots.length !== 27) continue;
        const inv = new Inventory(27);
        inv.slots = slots.map(st => { try { return sanitizeStack(st); } catch (e) { return null; } });
        out.set(k, { inv });
    }
    return out;
}

function parseDrops(list) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (const e of list) {
        const it = e && ITEMS[e.id];
        if (!it || !Number.isInteger(e.count) || e.count < 1 || e.count > it.maxStack) continue;
        if (![e.x, e.y, e.z].every(Number.isFinite)) continue;
        const dmg = it.maxDurability && e.damage > 0 && e.damage < it.maxDurability ? e.damage : 0;
        out.push({ id: e.id, count: e.count, damage: dmg, x: e.x, y: e.y, z: e.z,
                   age: Math.max(0, +e.age || 0), ttl: Math.min(DEATH_DROP_TTL, Math.max(1, +e.ttl || 300)) });
    }
    return out;
}

function validateSave(d) {
    try {
        if (!d || d.v !== SAVE_VERSION || d.seed !== SEED) return null;
        const p = d.player;
        if (![p.x, p.y, p.z, p.health, p.hunger].every(Number.isFinite)) return null;
        if (p.breath !== undefined && !Number.isFinite(p.breath)) return null;
        if (!Array.isArray(d.inventory) || d.inventory.length !== inventory.slots.length) return null;
        const inv = d.inventory.map(sanitizeStack);

        const edits = new Map();
        const maxIdx = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;
        for (const [key, list] of d.edits) {
            const flat = Array.isArray(list[0]) ? list.flat() : list;
            if (flat.length % 2) throw new Error('lista de edições inválida');
            const m = new Map();
            for (let k = 0; k < flat.length; k += 2) {
                const i = flat[k], t = flat[k + 1];
                if (!Number.isInteger(i) || i < 0 || i >= maxIdx) throw new Error('índice inválido');
                if (t !== 0 && !BLOCKS[t]) throw new Error('bloco inválido');
                m.set(i, t);
            }
            edits.set(String(key), m);
        }

        const furn = new Map();
        for (const [k, f] of (d.furnaces || [])) {
            if (!/^-?\d+,\d+,-?\d+$/.test(k) || !Array.isArray(f.slots) || f.slots.length !== 3) throw new Error('forno inválido');
            const finv = new Inventory(3);
            finv.slots = f.slots.map(sanitizeStack);
            furn.set(k, { inv: finv, burn: Math.max(0, +f.burn || 0), burnMax: Math.max(0, +f.burnMax || 0), cook: Math.max(0, +f.cook || 0) });
        }

        return {
            player: { x: p.x, y: p.y, z: p.z, health: Math.min(MAX_HEALTH, Math.max(1, p.health)), hunger: Math.min(MAX_HUNGER, Math.max(0, p.hunger)),
                      saturation: Math.min(MAX_HUNGER, Math.max(0, Number.isFinite(p.saturation) ? p.saturation : 5)),
                      breath: Math.min(MAX_BREATH, Math.max(0, Number.isFinite(p.breath) ? p.breath : MAX_BREATH)) },
            selectedSlot: d.selectedSlot >= 0 && d.selectedSlot < 9 ? d.selectedSlot | 0 : 0,
            inventory: inv, edits, furnaces: furn, drops: parseDrops(d.drops), chests: parseChests(d.chests),
            worldTime: Number.isFinite(d.worldTime) ? ((d.worldTime % 1) + 1) % 1 : START_TIME,
        };
    } catch (e) { return null; }
}

let saveWriteBlocked = false;

async function loadGame() {
    try {
        const ownsSave = await acquireSaveLock();
        if (!ownsSave) {
            saveWriteBlocked = true;
            console.warn('Este mundo já está aberto em outra aba; o salvamento foi desativado aqui.');
            showToast('Mundo aberto em outra aba; salvamento desativado neste jogo');
        }
        if (new URLSearchParams(location.search).has('reset')) {
            if (!ownsSave) return null;
            await dbRun('readwrite', s => s.delete(SAVE_KEY));
            return null;
        }
        const data = await dbRun('readonly', s => s.get(SAVE_KEY));
        const ok = validateSave(data);
        if (data && !ok) {
            console.warn('Save inválido ou de outra versão: criando backup antes de continuar.');
            if (ownsSave) {
                saveWriteBlocked = true;
                await dbRun('readwrite', s => s.put(data, SAVE_BACKUP_KEY));
                saveWriteBlocked = false;
                console.warn('Backup do save anterior criado:', SAVE_BACKUP_KEY);
            }
        }
        return ok;
    } catch (e) {
        saveWriteBlocked = true;
        console.warn('Falha ao ler ou proteger o save; gravações bloqueadas para evitar perda de dados:', e);
        return null;
    }
}

const SAVE_DEBOUNCE_MS = 5000;
let saving = false, saveTimer = null, savePending = false;

function saveGame(quiet, immediate = false) {
    if (!world) return;
    if (saveTimer !== null) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    if (!immediate && quiet) {
        saveTimer = setTimeout(() => {
            saveTimer = null;
            performSaveGame(true);
        }, SAVE_DEBOUNCE_MS);
        return;
    }
    performSaveGame(quiet);
}

async function performSaveGame(quiet) {
    if (!world) return false;
    if (saving) { savePending = true; return; }
    if (saveWriteBlocked || !saveLockOwned) {
        if (!quiet) showToast('Salvamento bloqueado para proteger o mundo aberto em outra aba');
        return false;
    }
    saving = true;
    let saved = false;
    try {
        const t0 = performance.now();
        const data = buildSave();
        perf.buildMs = performance.now() - t0;
        const wrote = await writeSaveIfOwner(data);
        if (!wrote) {
            saveLockOwned = false;
            saveWriteBlocked = true;
            if (!quiet) showToast('Outra aba está usando este mundo; salvamento bloqueado');
        } else if (!quiet) showToast('Jogo salvo');
        saved = wrote;
    } catch (e) { console.warn('Falha ao salvar:', e); if (!quiet) showToast('Falha ao salvar'); }
    finally {
        saving = false;
        if (savePending) {
            savePending = false;
            saveGame(true, true);
        }
    }
    return saved;
}

// =====================================================================
// 11. INICIALIZAÇÃO
// =====================================================================
function applyLook() {
    lookEuler.set(look.pitch, look.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(lookEuler);
}

function onLookMove(e) {
    if (!controls || !controls.isLocked) return;
    e.stopImmediatePropagation();
    const mx = e.movementX || 0, my = e.movementY || 0;
    const big = Math.max(Math.abs(mx), Math.abs(my));
    if (big > look.maxDelta) look.maxDelta = big;
    if (big > MAX_EVENT_DELTA) { look.spikes++; return; }
    look.yaw -= mx * LOOK_SPEED;
    look.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, look.pitch - my * LOOK_SPEED));
    applyLook();
}

const lockInfo = { raw: null };
function requestLock() {
    const el = document.body;
    const fallback = () => {
        lockInfo.raw = false;
        const p2 = el.requestPointerLock();
        if (p2 && p2.catch) p2.catch(err => console.warn('Aguardando cooldown do navegador...', err));
    };
    let pr;
    try { pr = el.requestPointerLock({ unadjustedMovement: true }); } catch (e) { fallback(); return; }
    if (pr && pr.then) {
        pr.then(() => { lockInfo.raw = true; })
          .catch(err => {
              if (err && err.name === 'NotSupportedError') fallback();
              else console.warn('Aguardando cooldown do navegador...', err);
          });
    }
}

function getWorldRegionStatus(x, z) {
    const cx = floorDiv(x, CHUNK_SIZE), cz = floorDiv(z, CHUNK_SIZE);
    const total = (RENDER_DISTANCE * 2 + 1) ** 2;
    let loaded = 0, meshed = 0;
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
            const chunk = world.getChunk(cx + dx, cz + dz);
            if (!chunk) continue;
            loaded++;
            if (chunk.mesh) meshed++;
        }
    }
    return { loaded, meshed, total };
}

function setWorldLoadProgress(status) {
    const percent = Math.min(100, Math.floor(status.meshed / status.total * 100));
    document.getElementById('world-loading-title').textContent = `Gerando mundo... ${percent}%`;
    document.getElementById('world-loading-fill').style.width = `${percent}%`;
    document.getElementById('world-loading-detail').textContent = `Áreas prontas: ${status.meshed} de ${status.total}`;
}

function isWorldRegionReady(x, z) {
    const status = getWorldRegionStatus(x, z);
    return status.meshed === status.total;
}

async function waitForWorldRegion(x, z, { driveUpdates = true, onProgress = null } = {}) {
    while (!isWorldRegionReady(x, z)) {
        if (driveUpdates) world.update(x, z);
        const status = getWorldRegionStatus(x, z);
        if (onProgress) onProgress(status);
        await new Promise(resolve => requestAnimationFrame(resolve));
    }
    if (onProgress) onProgress(getWorldRegionStatus(x, z));
}

function showWorldLoadError(error) {
    console.error('Falha ao preparar o mundo:', error);
    document.getElementById('world-loading-title').textContent = 'Não foi possível carregar o mundo';
    document.getElementById('world-loading-detail').textContent = 'Recarregue a página para tentar novamente.';
    const backButton = document.getElementById('btn-load-error-back');
    backButton.hidden = false;
    backButton.addEventListener('click', () => location.reload(), { once: true });
}
async function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_COLOR);
    const viewDist = RENDER_DISTANCE * CHUNK_SIZE;
    scene.fog = new THREE.Fog(SKY_COLOR, viewDist * 0.55, viewDist * 0.95);

    hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
    sunLight.position.set(10, 20, 10);
    scene.add(sunLight);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);
    scene.add(camera);

    createHand();
    createSky();
    createClouds();

    targetMesh = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
        new THREE.LineBasicMaterial({ color: 0x000000 })
    );
    targetMesh.visible = false;
    scene.add(targetMesh);

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: GPU_PREF });
    renderer.autoClear = false;
    renderer.setPixelRatio(gfx.scale);
    renderer.info.autoReset = false;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); perf.ctxLost++; showToast('Contexto WebGL perdido (driver/GPU)'); });
    renderer.domElement.addEventListener('webglcontextrestored', () => showToast('Contexto WebGL restaurado'));
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        handCamera.aspect = window.innerWidth / window.innerHeight;
        handCamera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    world = new World(scene, SEED);
    creatureSystem = new CreatureSystem(world);
    const save = await loadGame();
    if (save) {
        world.edits = save.edits;
        inventory.slots = save.inventory;
        selectedSlot = save.selectedSlot;
        health = save.player.health;
        hunger = save.player.hunger;
        saturation = save.player.saturation;
        breath = save.player.breath;
        worldTime = save.worldTime;
        for (const [k, v] of save.furnaces) furnaces.set(k, v);
        for (const [k, v] of save.chests) chests.set(k, v);
        for (const e of save.drops) {
            spawnItemEntity(e.id, e.count, new THREE.Vector3(e.x, e.y, e.z), new THREE.Vector3(), 0, e.damage,
                { age: e.age, ttl: e.ttl, noMerge: true });
        }
    }
    const sp = findSpawn(world.generator);
    spawnPoint.set(sp.x, sp.y, sp.z);
    const start = save ? save.player : spawnPoint;
    await waitForWorldRegion(start.x, start.z, { driveUpdates: true, onProgress: setWorldLoadProgress });
    player.pos.set(start.x, start.y, start.z);
    for (let guard = 0; guard < 70 && collides(player.pos.x, player.pos.y, player.pos.z, player.height); guard++) player.pos.y += 1;
    camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
    
    initGameplayAssets();
    updateSky();

    document.addEventListener('mousemove', onLookMove, true);
    controls = new PointerLockControls(camera, document.body);
    const menu = document.getElementById('menu');
    const btnPlay = document.getElementById('btn-play');

    btnPlay.addEventListener('click', () => requestLock());
    const btnWorlds = document.getElementById('btn-worlds');
    btnWorlds.addEventListener('click', async () => {
        btnWorlds.disabled = true;
        btnWorlds.textContent = 'Salvando mundo...';
        if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
        while (saving) await new Promise(resolve => setTimeout(resolve, 25));
        const saved = await performSaveGame(false);
        if (!saved) {
            btnWorlds.disabled = false;
            btnWorlds.textContent = 'Voltar à seleção de mundos';
            return;
        }
        await releaseSaveLock();
        location.reload();
    });
    controls.addEventListener('lock', () => { menu.style.display = 'none'; });
    renderer.domElement.addEventListener('click', () => {
        if (!controls.isLocked && !inventoryOpen && !dead && menu.style.display === 'none') requestLock();
    });
    document.getElementById('btn-respawn').addEventListener('click', () => {
        dead = false;
        deathEl.style.display = 'none';
        requestLock();
        setTimeout(() => { if (!controls.isLocked) menu.style.display = 'flex'; }, 400);
    });
    controls.addEventListener('unlock', () => {
        const inventoryExit = inventoryOpen || inventoryUnlockPending;
        inventoryUnlockPending = false;
        if (!inventoryExit && !dead) menu.style.display = 'flex';
        moveForward = moveBackward = moveLeft = moveRight = jumpHeld = swimStrokeLocked = isSprinting = wantToCrouch = false;
        leftHeld = false;
        resetMining();
        cancelEating();
        saveGame(true);
        if (inventoryExit) return;
        btnPlay.disabled = true;
        const originalText = btnPlay.innerText;
        btnPlay.innerText = 'Aguarde...';
        btnPlay.style.background = '#888888';
        btnPlay.style.cursor = 'not-allowed';
        setTimeout(() => {
            btnPlay.disabled = false;
            btnPlay.innerText = originalText;
            btnPlay.style.background = '';
            btnPlay.style.cursor = 'pointer';
        }, 1300);
    });

    document.addEventListener('keydown', (event) => {
        if (inventoryOpen) { handleInventoryKey(event); return; }
        if (!controls.isLocked) return;
        switch (event.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyD': moveRight = true; break;
            case 'Space': jumpHeld = true; break;
            case 'KeyQ': dropSelectedItem(); break;
            case 'KeyE': if (!event.repeat) openInventory(); break;
            case 'ShiftLeft': case 'ShiftRight': isSprinting = true; break;
            case 'KeyC': wantToCrouch = true; break;
            case 'F4': event.preventDefault(); cycleQuality(); break;
            case 'F3':
                event.preventDefault();
                debugVisible = !debugVisible;
                debugEl.style.display = debugVisible ? 'block' : 'none';
                break;
        }
        if (event.code.startsWith('Digit')) {
            const num = parseInt(event.key);
            if (num >= 1 && num <= 9) selectSlot(num - 1);
        }
    });

    document.addEventListener('keyup', (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyD': moveRight = false; break;
            case 'Space': jumpHeld = false; swimStrokeLocked = false; break;
            case 'ShiftLeft': case 'ShiftRight': isSprinting = false; break;
            case 'KeyC': wantToCrouch = false; break;
        }
    });

    document.addEventListener('wheel', (event) => {
        if (!controls.isLocked) return;
        selectSlot((selectedSlot + (event.deltaY > 0 ? 1 : 8)) % 9);
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('mousedown', (event) => {
        if (!controls.isLocked) return;
        if (event.button === 0) { leftHeld = true; return; }
        if (event.button !== 2) return;
        updateTarget();

        const st = currentHit && BLOCKS[currentHit.type].station;
        if (st && !event.shiftKey && !wantToCrouch) { openStation(st, currentHit); return; }

        const held = inventory.slots[selectedSlot];
        const food = held && ITEMS[held.id].food;
        // Comida só é consumida pelo clique direito quando o jogador mira no ar.
        if (food && !currentHit) {
            if (hunger < MAX_HUNGER) { eat.active = true; eat.progress = 0; eat.slot = selectedSlot; eat.id = held.id; }
            else showToast('Você não está com fome');
            return;
        }

        if (!currentHit) return;
        const type = held ? (ITEMS[held.id].block || 0) : 0;
        const { nx, ny, nz } = currentHit;
        if (type === 0 || (nx === 0 && ny === 0 && nz === 0)) return;
        const px = currentHit.x + nx, py = currentHit.y + ny, pz = currentHit.z + nz;
        if (py < 0 || py >= WORLD_HEIGHT) return;
        let placedType = type;
        if (type === ID.TORCH) {
            const supportType = nx !== 0 || nz !== 0 ? world.getBlock(px - nx, py, pz - nz) : world.getBlock(px, py - 1, pz);
            if (!BLOCKS[supportType]?.solid || ny < 0) return;
            if (nx > 0) placedType = ID.TORCH_WALL_XP;
            else if (nx < 0) placedType = ID.TORCH_WALL_XN;
            else if (nz > 0) placedType = ID.TORCH_WALL_ZP;
            else if (nz < 0) placedType = ID.TORCH_WALL_ZN;
        }
        
        // Se a posição para colocar o bloco contiver água, o bloco irá substituí-la normalmente!
        const blockAtTarget = world.getBlock(px, py, pz);
        if (blockAtTarget !== 0 && !WaterSystem.isBlock(blockAtTarget)) return; 
        
        if (intersectsPlayer(px, py, pz)) return;
        if (world.setBlock(px, py, pz, placedType)) {
            inventory.removeOne(selectedSlot);
            updateHotbarUI();
            handAnim.punch = 1;
        }
    });

    document.addEventListener('mouseup', (event) => {
        if (event.button === 0) leftHeld = false;
        if (event.button === 2) cancelEating();
    });

    setInterval(() => { if (controls.isLocked) saveGame(true); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(true, true); });

    if (new URLSearchParams(location.search).has('debug')) {
        window.dbg = {
            damage: (n = 1) => { invuln = 0; takeDamage(n); },
            kill: () => { invuln = 0; takeDamage(999); },
            hunger: (n) => { hunger = n; updateSurvivalUI(); },
            saturation: (n) => { saturation = n; },
            exhaust: (n) => addExhaustion(n),
            give: (id, n = 1) => { inventory.add(id, n); updateHotbarUI(); },
            time: (t) => { worldTime = ((t % 1) + 1) % 1; updateSky(); },
        };
    }

    updateSurvivalUI();
    document.getElementById('btn-play').disabled = false;
    document.getElementById('world-loading').hidden = true;
}

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const rawDt = (now - prevTime) / 1000;
    prevTime = now;
    const dt = Math.min(rawDt, 0.05);
    applyLook();

    if (controls.isLocked) {
        updatePhysics(dt);
        creatureSystem.update(dt, player.pos, true);
        updateTarget();
        updateMining(dt);
        updateEating(dt);
        updateSurvival(dt);
        updateItemEntities(dt);
        updateParticles(dt);
    }
    world.water.updateSubmersion(world, player);
    world.water.update(world, dt, now);

    if (controls.isLocked || inventoryOpen) {
        updateWorldClock(dt);
        updateFurnaces(dt);
        if (inventoryOpen && station && station.type === 'furnace') {
            if (furnaceDirty) { furnaceDirty = false; renderInventory(); }
            else updateFurnaceBars();
        }
    }
    updateSky();
    
    // Override da visão embaixo d'água
    if (world.water.headInWater) {
        scene.fog.color.setHex(0x113366);
        scene.fog.near = 0.1;
        scene.fog.far = 15;
        scene.background.setHex(0x113366); 
    }
    
    if (controls.isLocked || inventoryOpen) updateClouds(dt);
    else updateClouds(0);
    updateHand(dt);
    if (hurtFlash > 0) { hurtFlash = Math.max(0, hurtFlash - dt * 2); hurtEl.style.opacity = hurtFlash; }
    world.update(player.pos.x, player.pos.z);
    updateDebug(rawDt);

    if (gfx.pending !== null) { renderer.setPixelRatio(gfx.pending); gfx.pending = null; }
    renderer.info.reset();
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(handScene, handCamera);

    const cpu = performance.now() - now;
    perf.sum += cpu; perf.frames++; perf.t += rawDt;
    if (cpu > perf.worst) perf.worst = cpu;
    if (rawDt > 0.06) {
        perf.long++;
        perf.lastLong = `${(rawDt * 1000).toFixed(0)} ms (CPU ${cpu.toFixed(0)} ms, chunks gerados ${world.frameGen ?? 0}, malhas ${world.frameMesh ?? 0}, malha ${world.lastMeshMs?.toFixed(1) ?? '0'} ms, luz ${world.lastLightMs?.toFixed(1) ?? '0'} ms, salvando: ${saving ? 'sim' : 'não'})`;
    }
    if (perf.t >= 1) {
        perf.avg = perf.sum / perf.frames; perf.worstShown = perf.worst;
        perf.fps = perf.frames / perf.t;
        adaptResolution(perf.fps, perf.avg);
        perf.t = 0; perf.frames = 0; perf.sum = 0; perf.worst = 0;
    }
}

document.getElementById('world-loading').hidden = false;
init().then(animate).catch(showWorldLoadError);
