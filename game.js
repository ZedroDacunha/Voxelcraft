
import { openDatabase as dbOpen, storeRequest as dbRun } from './world-storage.js';
import { clamp01, hash2, mulberry32, Noise2D, smoothstep } from './world-math.js';
import {
    ATLAS_UV_PAD_PX, BLOCKS, FUEL, ID, ITEMS, atlasUV, atlasUVInto, matchRecipe, RECIPES, SMELT, TILE, TILE_PX,
} from './world-catalog.js';
import { findSpawn, TerrainGenerator } from './world-terrain.js';
import { createTerrainWorkerSource } from './world-terrain-worker.js';
import { createWaterSystemClass } from './world-water.js';
import { Inventory } from './inventory-model.js';
import { craftConsume, invCollectSame, invFillRecipe, invLeftClick, invQuickMove, invQuickMoveToCraft, invRightClick, invSwapHotbar, stackable } from './inventory-logic.js';
import { stackHtml, updateSlotElement } from './inventory-view.js';
import { createRecipeBook } from './inventory-recipe-book.js';
import { craftGridTemplateColumns } from './inventory-layout.js';
import { pauseMenuDisplay } from './game-pause-menu.js';
import { createPointerLockRequester } from './game-pointer-lock.js';
import { createInventoryAssets } from './inventory-assets.js';
import { createTextureTools } from './world-textures.js';
import { createWorldSaveCodec, WORLD_SAVE_VERSION } from './world-save-codec.js';
import { createWorldSaveLoader } from './world-save-loader.js';
import { createWorldSaveManager } from './world-save-manager.js';
import { createWorldSaveIndicator } from './world-save-indicator.js';
import { createWorldClock } from './world-clock.js';
import { createWorldClouds, WORLD_CLOUD_CONFIG } from './world-clouds.js';
import { createWorldSkySystem } from './world-sky.js';
import { createWorldGraphicsQuality } from './world-graphics-quality.js';
import { raycastVoxels } from './world-raycast.js';
import { createBreakParticleSystem } from './world-break-particles.js';
import { InstancedBlockManager, testInstancedMesh } from './world-instanced-manager.js';
import { chunkKey, floorDiv, idx } from './world-grid.js';
import { buildLightRegions } from './world-light-region.js';
import {
    CHUNK_SIZE, DEATH_DROP_TTL, MAX_BREATH, MAX_HEALTH, MAX_HUNGER,
    PLAYER_INVENTORY_SIZE, START_TIME, WORLD_HEIGHT,
} from './world-save-settings.js';
import { configureTorchFlicker, configureTorchFlameAnimation, updateWorldLightingEffects } from './world-lighting-effects.js';
import { FurnaceSmokeSystem } from './world-furnace-effects.js';
import { canHarvest, damageTool as damageToolStack, getBreakTime } from './world-tool-rules.js';
import { woodDoorCollision, woodDoorPart, woodDoorShape, woodDoorType } from './world-door.js';
import { rightClickIntent } from './world-interaction-rules.js';
import { loadGameSettings } from './world-game-settings.js';
import { advanceStarvation, deathTitle, HUNGER_WARNINGS, hungerStage } from './world-survival-rules.js';
import {
    BlockFacingStore, DEFAULT_BLOCK_FACING, facingTowardPlayer, isFrontFace, isHorizontalFacing,
    tileForBlockFace,
} from './world-block-orientation.js';

async function loadThreeModules() {
    // A cópia em vendor/ evita depender de CDN (funciona offline e garante a
    // mesma versão para todos os módulos). Os CDNs continuam como reserva.
    const providers = [
        {
            name: 'cópia local',
            build: './vendor/three/three.module.js',
            controls: './vendor/three/addons/controls/PointerLockControls.js',
        },
        {
            name: 'unpkg',
            build: 'https://unpkg.com/three@0.160.0/build/three.module.js',
            controls: 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js',
        },
        {
            name: 'jsDelivr',
            build: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
            controls: 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/PointerLockControls.js',
        },
    ];
    let lastError = null;
    for (const provider of providers) {
        try {
            const [THREE, controls] = await Promise.all([
                import(provider.build),
                import(provider.controls),
            ]);
            return { THREE, PointerLockControls: controls.PointerLockControls };
        } catch (error) {
            lastError = error;
            console.warn(`Falha ao carregar Three.js por ${provider.name}; tentando a próxima opção.`, error);
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
const { spritePixels, createAtlasTexture, createNoiseTexture } = createTextureTools(THREE);
const inventoryAssets = createInventoryAssets(THREE);

// =====================================================================
// 1. CONFIGURAÇÃO
// =====================================================================
const ACTIVE_FURNACE_LIGHT = 13;
const BLOCK_LIGHT_GAIN = 3.4;
const BLOCK_LIGHT_MAX = 2.5;
// Preferências da tela de opções (localStorage). O menu grava e este módulo
// lê ao ser importado — ou seja, ao entrar em um mundo.
const GAME_SETTINGS = loadGameSettings();
const RENDER_DISTANCE = GAME_SETTINGS.renderDistance;   // em chunks
const START_LOAD_RADIUS = 2;   // chunks prontos antes de liberar o jogador (o resto carrega em jogo)
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
const SPRINT_MIN_HUNGER = 7;
const EAT_TIME = 1.6;
const INVULN_TIME = 0.5;

// Dia, Noite e Nuvens
const DAY_LENGTH = 1200;

// Mão em primeira pessoa
const HAND_BASE = { x: 0.42, y: -0.50, z: -0.25 };
const HELD_TOOL_ROT = [0.3, -0.55, 0.0];
const HELD_BLOCK_ROT = [0.25, 0.7, 0.0];
const HELD_BLOCK_POS = [0.03, 0.07, -0.04];
const HELD = {
    // Local to handPivot: origin remains at the existing grip location.
    position: { x: 0, y: 0, z: -0.50 },
    rotation: { x: 10, y: -30, z: 90 },
    scale: 0.85,
};
const HELD_TOOL_KINDS = new Set(['pickaxe', 'axe', 'shovel']);
const HELD_DEBUG = false;

// =====================================================================
// 2. SISTEMA DE ÁGUA (catálogo em world-catalog.js)
// =====================================================================
const WaterSystem = createWaterSystemClass({
    THREE, BLOCKS, ID, WORLD_HEIGHT, onSubmersionChange: () => updateBreathUI(),
});



// =====================================================================
// 4. CONFIGURAÇÃO DE GERAÇÃO E ÍNDICES DE CHUNK
// =====================================================================
const BIOME = Object.freeze({ PLAINS: 0, FOREST: 1, DESERT: 2, ROCKY: 3 });
const TREE_CHANCE_FOREST = 0.035;
const TREE_CHANCE_PLAINS = 0.008;
const TERRAIN_CONFIG = Object.freeze({
    CHUNK_SIZE, WORLD_HEIGHT, WATER_LEVEL, ID, BIOME, TREE_CHANCE_FOREST, TREE_CHANCE_PLAINS,
});

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
        // Marcado quando algum valor de luz realmente muda, para evitar
        // remalhar os 9 chunks vizinhos a cada bloco editado.
        this.lightChanged = false;
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

function createTallGrassGeometry(variant = 1) {
    // As imagens são arquivos separados e já estão cortadas até o contorno do tufo.
    const variants = [
        { height: 0.28, aspect: 299 / 198 },
        { height: 0.52, aspect: 386 / 368 },
        { height: 0.78, aspect: 315 / 454 },
    ];
    const selected = variants[variant] ?? variants[1];
    const halfWidth = selected.height * selected.aspect / 2, height = selected.height;
    const rootOffset = -0.025;
    const positions = [
        -halfWidth, rootOffset, -halfWidth, halfWidth, rootOffset, halfWidth,
        halfWidth, height + rootOffset, halfWidth, -halfWidth, height + rootOffset, -halfWidth,
        halfWidth, rootOffset, -halfWidth, -halfWidth, rootOffset, halfWidth,
        -halfWidth, height + rootOffset, halfWidth, halfWidth, height + rootOffset, -halfWidth,
    ];
    const uvs = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    geometry.computeVertexNormals();
    return geometry;
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

// A porta ocupa o voxel inteiro em altura, mas é fina no eixo perpendicular
// à frente. O formato é gerado por world-door.js e reaproveita o caminho de
// geometria não cúbica já usado pela tocha.
function doorPartShape(type, facing) {
    const block = BLOCKS[type];
    const { min, max } = woodDoorShape(facing, Boolean(block?.door?.open));
    const faceTile = block?.door?.tile ?? TILE.WOOD_DOOR_LOWER;
    return {
        min, max,
        tiles: { top: TILE.WOOD_END, bottom: TILE.WOOD_END, side: faceTile, front: faceTile },
    };
}
const FACES = [
    { kind: 'side',   dir: [-1, 0, 0], corners: [ { pos: [0,1,0], uv: [0,1] }, { pos: [0,0,0], uv: [0,0] }, { pos: [0,1,1], uv: [1,1] }, { pos: [0,0,1], uv: [1,0] } ] },
    { kind: 'side',   dir: [ 1, 0, 0], corners: [ { pos: [1,1,1], uv: [0,1] }, { pos: [1,0,1], uv: [0,0] }, { pos: [1,1,0], uv: [1,1] }, { pos: [1,0,0], uv: [1,0] } ] },
    { kind: 'bottom', dir: [ 0,-1, 0], corners: [ { pos: [1,0,1], uv: [1,0] }, { pos: [0,0,1], uv: [0,0] }, { pos: [1,0,0], uv: [1,1] }, { pos: [0,0,0], uv: [0,1] } ] },
    { kind: 'top',    dir: [ 0, 1, 0], corners: [ { pos: [0,1,1], uv: [1,1] }, { pos: [1,1,1], uv: [0,1] }, { pos: [0,1,0], uv: [1,0] }, { pos: [1,1,0], uv: [0,0] } ] },
    { kind: 'side',   dir: [ 0, 0,-1], corners: [ { pos: [1,0,0], uv: [0,0] }, { pos: [0,0,0], uv: [1,0] }, { pos: [1,1,0], uv: [0,1] }, { pos: [0,1,0], uv: [1,1] } ] },
    { kind: 'side',   dir: [ 0, 0, 1], corners: [ { pos: [0,0,1], uv: [0,0] }, { pos: [1,0,1], uv: [1,0] }, { pos: [0,1,1], uv: [0,1] }, { pos: [1,1,1], uv: [1,1] } ] },
];
const worldClouds = createWorldClouds({ THREE, Noise2D, faces: FACES });
const worldSky = createWorldSkySystem({
    THREE,
    clamp01,
    smoothstep,
    mulberry32,
    clouds: worldClouds,
    skyColor: SKY_COLOR,
    renderDistance: RENDER_DISTANCE,
    chunkSize: CHUNK_SIZE,
});
const openChests = new Set();

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
    constructor(scene, seed, decorations = null, decorationGeometries = [], decorationMaterials = []) {
        this.scene = scene;
        this.seed = seed;
        this.decorations = decorations;
        this.decorationGeometries = decorationGeometries;
        this.decorationMaterials = decorationMaterials;
        this.decorationsByChunk = new Map();
        this.generator = new TerrainGenerator(seed, TERRAIN_CONFIG);
        this.chunks = new Map();
        this.edits = new Map();
        this.blockFacings = new BlockFacingStore();
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
            map: atlas, alphaTest: 0.5, transparent: false, depthWrite: true, vertexColors: true, side: THREE.DoubleSide,
        });
        
        this.torchFlameMaterial = new THREE.MeshBasicMaterial({ map: createTorchFlameTexture(), transparent: false, alphaTest: 0.5, depthWrite: true, side: THREE.DoubleSide, toneMapped: false });
        this.furnaceSmoke = new FurnaceSmokeSystem(THREE, scene);
        configureTorchFlameAnimation(this.torchFlameMaterial);
        configureTorchFlicker(this.chunkMaterial);
        configureTorchFlicker(this.cutoutMaterial);
        this.water = new WaterSystem(atlas);
    }
    rebuildSkyLightColumn(chunk, lx, lz) {
        let light = 15;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
            const i = idx(lx, y, lz);
            const type = chunk.data[i];
            let value = 0;
            if (type === 0) value = light;
            else if (type === ID.LEAVES || WaterSystem.isBlock(type)) {
                value = light;
                light = Math.max(0, light - 1);
            } else if (BLOCKS[type]?.solid !== false) {
                light = 0;
            }
            if (chunk.skyLight[i] !== value) {
                chunk.skyLight[i] = value;
                chunk.lightChanged = true;
            }
        }
    }

    rebuildSkyLight(chunk) {
        // O alvo continua sendo o anel imediato, mas a luz de blocos usa um halo
        // externo para não perder emissores que ainda alcançam a borda do alvo.
        const { target: region, block: blockRegion } = buildLightRegions({
            cx: chunk.cx,
            cz: chunk.cz,
            radius: 1,
            chunkSize: CHUNK_SIZE,
            maxLight: 15,
            getChunk: (cx, cz) => this.getChunk(cx, cz),
        });
        if (!region.length) return;

        const regionIndex = new Map(region.map((part, i) => [part, i]));
        const blockRegionIndex = new Map(blockRegion.map((part, i) => [part, i]));
        const hasBlockEmitter = blockRegion.some(part => this.lightSourceChunks.has(chunkKey(part.cx, part.cz)));
        const hasExternalBlockEmitter = blockRegion.some(part =>
            !regionIndex.has(part) && this.lightSourceChunks.has(chunkKey(part.cx, part.cz)),
        );
        const blockLightRegion = hasExternalBlockEmitter ? blockRegion : region;
        const blockLightRegionIndex = hasExternalBlockEmitter ? blockRegionIndex : regionIndex;
        for (const part of region) {
            this.lightDirty.delete(part);
            part.lightChanged = false;
            let hadBlockLight = false;
            for (let i = 0; i < part.blockLight.length; i++) {
                if (part.blockLight[i] !== 0) { hadBlockLight = true; break; }
            }
            if (hadBlockLight) {
                part.blockLight.fill(0);
                part.lightChanged = true;
            }
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                for (let lz = 0; lz < CHUNK_SIZE; lz++) this.rebuildSkyLightColumn(part, lx, lz);
            }
        }
        this.propagateLightChannel(region, regionIndex, 'skyLight', false);
        if (hasBlockEmitter) this.propagateLightChannel(blockLightRegion, blockLightRegionIndex, 'blockLight', true);
        for (const part of blockLightRegion) if (part.lightChanged) this.dirty.add(part);
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
                    if (chunk.data[i] === ID.FURNACE) {
                        const y = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE));
                        const lx = i % CHUNK_SIZE;
                        const lz = Math.floor(i / CHUNK_SIZE) % CHUNK_SIZE;
                        const x = chunk.cx * CHUNK_SIZE + lx, z = chunk.cz * CHUNK_SIZE + lz;
                        if (furnaces.get(`${x},${y},${z}`)?.burn > 0) emission = ACTIVE_FURNACE_LIGHT;
                    }
                    if (emission > lightMap[i]) {
                        lightMap[i] = emission;
                        chunk.lightChanged = true;
                    }
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
            const attenuation = type === ID.LEAVES ? 2 : WaterSystem.isBlock(type) ? 2 : 1;
            const candidate = sourceLevel - attenuation, targetLight = target[channel];
            if (candidate <= targetLight[targetIndex]) return;
            targetLight[targetIndex] = candidate;
            target.lightChanged = true;
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
        const workerSource = createTerrainWorkerSource({ CHUNK_SIZE, WORLD_HEIGHT, TERRAIN_CONFIG });

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
        for (let i = 0; i < chunk.data.length; i++) {
            const type = chunk.data[i];
            if (BLOCKS[type]?.light > 0) { this.lightSourceChunks.add(key); return; }
            if (type === ID.FURNACE) {
                const y = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE));
                const lx = i % CHUNK_SIZE;
                const lz = Math.floor(i / CHUNK_SIZE) % CHUNK_SIZE;
                const x = cx * CHUNK_SIZE + lx, z = cz * CHUNK_SIZE + lz;
                if (furnaces.get(`${x},${y},${z}`)?.burn > 0) {
                    this.lightSourceChunks.add(key);
                    return;
                }
            }
        }
        this.lightSourceChunks.delete(key);
    }

    getBlock(x, y, z) {
        if (y < 0 || y >= WORLD_HEIGHT) return 0;
        const chunk = this.getChunk(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE));
        if (!chunk) return 0;
        return chunk.data[idx(x - chunk.cx * CHUNK_SIZE, y, z - chunk.cz * CHUNK_SIZE)];
    }

    getBlockFacing(x, y, z) {
        return this.blockFacings.get(x, y, z);
    }

    // Caixa fina de colisão das portas. Sem isso o jogador parava na borda do
    // voxel e ficava um vão de ~0,44 bloco entre ele e o painel.
    doorCollisionBox(x, y, z, type) {
        const local = woodDoorCollision(woodDoorPart(type), this.getBlockFacing(x, y, z));
        if (!local) return null;
        return {
            minX: x + local.minX, maxX: x + local.maxX,
            minZ: z + local.minZ, maxZ: z + local.maxZ,
        };
    }

    isSolidForPhysics(x, y, z) {
        if (y < 0) return true;
        if (y >= WORLD_HEIGHT) return false;
        const chunk = this.getChunk(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE));
        if (!chunk) return true;
        const type = chunk.data[idx(x - chunk.cx * CHUNK_SIZE, y, z - chunk.cz * CHUNK_SIZE)];
        return type !== 0 && (BLOCKS[type]?.solid ?? true);
    }

    setBlock(x, y, z, type, facing = null) {
        if (y < 0 || y >= WORLD_HEIGHT) return false;
        const cx = floorDiv(x, CHUNK_SIZE), cz = floorDiv(z, CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        if (!chunk) return false;
        const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
        const i = idx(lx, y, lz);
        const oldType = chunk.data[i];
        if (oldType === ID.SAND && type !== ID.SAND) this.cancelFallingSand(x, y, z);
        chunk.data[i] = type;
        if (BLOCKS[type]?.tiles.front !== undefined) {
            const nextFacing = isHorizontalFacing(facing) ? facing : this.blockFacings.get(x, y, z);
            this.blockFacings.set(x, y, z, nextFacing);
        } else this.blockFacings.delete(x, y, z);
        if ((BLOCKS[oldType]?.light ?? 0) !== (BLOCKS[type]?.light ?? 0) || oldType === ID.FURNACE || type === ID.FURNACE) {
            this.refreshLightSourceChunk(cx, cz, chunk);
        }
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
                const y = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE));
                const lx = i % CHUNK_SIZE;
                const lz = Math.floor(i / CHUNK_SIZE) % CHUNK_SIZE;
                const x = chunk.cx * CHUNK_SIZE + lx, z = chunk.cz * CHUNK_SIZE + lz;
                if (BLOCKS[t]?.light > 0 || (t === ID.FURNACE && furnaces.get(`${x},${y},${z}`)?.burn > 0)) {
                    hasEditedLightSource = true;
                }
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
        this.refreshChunkDecorations(chunk);
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
        const isLayeredLeafFace = dir => dir[0] > 0 || dir[1] > 0 || dir[2] > 0;
        const solid = (lx, y, lz, currentType, dir) => {
            const nx = lx + dir[0], ny = y + dir[1], nz = lz + dir[2];
            const nType = blockAt(nx, ny, nz);
            const currentRender = BLOCKS[currentType]?.render;
            const neighborRender = BLOCKS[nType]?.render;
            if (currentRender === 'torch') return false;
            // Portas desenham todas as faces (formato fino); só a face entre as
            // duas metades é omitida para não haver z-fighting.
            if (currentRender === 'door') return neighborRender === 'door';
            if (currentRender === 'liquid') {
                if (nType === 0) return false;
                if (neighborRender !== 'liquid') return true;
                if (dir[1] !== 0) return true;
                const currentHeight = WaterSystem.surfaceHeightFor(currentType, blockAt(lx, y + 1, lz));
                const neighborHeight = WaterSystem.surfaceHeightFor(nType, blockAt(nx, ny + 1, nz));
                return currentHeight <= neighborHeight + 0.0001;
            }
            // Folhas recortadas não devem apagar a face do tronco: ela precisa aparecer nos vãos da textura.
            if (neighborRender === 'cutout') {
                if (currentRender !== 'cutout') return false;
                // Mantém uma face interna por par de folhas para que os vãos revelem outras camadas da copa.
                return !isLayeredLeafFace(dir);
            }
            return nType !== 0 && BLOCKS[nType]?.opaque !== false;
        };

        const ambientOcclusionWeight = type => {
            if (type === 0 || BLOCKS[type]?.render === 'liquid' || BLOCKS[type]?.render === 'torch') return 0;
            const render = BLOCKS[type]?.render;
            return render === 'cutout' || render === 'door' ? 0.35 : 1;
        };
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
            const sideA = ambientOcclusionWeight(sideAType);
            const sideB = ambientOcclusionWeight(sideBType);
            const cornerOcclusion = ambientOcclusionWeight(cornerType);
            const level = includeAO
                ? (sideA === 1 && sideB === 1 ? 0 : Math.max(0, 3 - sideA - sideB - cornerOcclusion))
                : 3;
            const sampleSky = (x, yy, z) => skyLightAt(x, yy, z);
            const sampleBlock = (x, yy, z) => blockLightAt(x, yy, z);
            const sky = (sampleSky(baseX, baseY, baseZ) + sampleSky(baseX + ax, baseY + ay, baseZ + az) +
                sampleSky(baseX + bx, baseY + by, baseZ + bz) + sampleSky(baseX + ax + bx, baseY + ay + by, baseZ + az + bz)) / 60;
            const local = (sampleBlock(baseX, baseY, baseZ) + sampleBlock(baseX + ax, baseY + ay, baseZ + az) +
                sampleBlock(baseX + bx, baseY + by, baseZ + bz) + sampleBlock(baseX + ax + bx, baseY + ay + by, baseZ + az + bz)) / 60;
            const localIllumination = Math.min(BLOCK_LIGHT_MAX, local * BLOCK_LIGHT_GAIN);
            const illumination = Math.max(0.18 + sky * 0.82, 0.18 + localIllumination * 0.82);
            const base = (0.58 + level * 0.14) * illumination;
            const warmth = Math.min(0.3, local * 0.32);
            return [base * (1 + warmth), base, base * (1 - warmth * 0.85), local];
        };

        const initialVertexCapacity = CS * CS * 8;
        const initialIndexCapacity = CS * CS * 12;
        let positions = new Float32Array(initialVertexCapacity * 3);
        let normals = new Float32Array(initialVertexCapacity * 3);
        let uvs = new Float32Array(initialVertexCapacity * 2);
        let colors = new Float32Array(initialVertexCapacity * 3);
        let torchInfluence = new Float32Array(initialVertexCapacity);
        let furnaceFlame = new Float32Array(initialVertexCapacity);
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
        const torchFlameCenters = [];
        const tileUV = { u0: 0, v0: 0, uWidth: 0, vHeight: 0 };

        for (let y = 0; y <= chunk.maxY; y++) {
            for (let lz = 0; lz < CS; lz++) {
                for (let lx = 0; lx < CS; lx++) {
                    const t = data[lx + lz * CS + y * CS2];
                    if (t === 0) continue;
                    if (t === ID.SAND && this.animatedSandTargets.has(`${chunk.cx * CS + lx},${y},${chunk.cz * CS + lz}`)) continue;
                    const block = BLOCKS[t];
                    if (block.render === 'instanced') continue;
                    const tiles = block.tiles;
                    const renderMode = block.render;
                    const aboveType = y + 1 < WORLD_HEIGHT ? data[lx + lz * CS + (y + 1) * CS2] : 0;
                    const blockTop = renderMode === 'liquid' ? WaterSystem.surfaceHeightFor(t, aboveType) : 1;
                    const wx = chunk.cx * CS + lx, wz = chunk.cz * CS + lz;
                    const facing = tiles.front !== undefined ? this.getBlockFacing(wx, y, wz) : DEFAULT_BLOCK_FACING;
                    const doorShape = renderMode === 'door' ? doorPartShape(t, facing) : null;
                    const shapeCount = renderMode === 'torch' ? TORCH_PARTS.length : 1;
                    const orientation = block.orientation || [0, 0];
                    if (renderMode === 'torch') {
                        const lean = block.orientation ? (0.82 * 0.35 - 0.38) : 0;
                        const phase = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453) % (Math.PI * 2);
                        torchFlameCenters.push([lx + 0.5 + orientation[0] * lean, y, lz + 0.5 + orientation[1] * lean, phase]);
                    }
                    for (let shapeIndex = 0; shapeIndex < shapeCount; shapeIndex++) {
                        const shape = renderMode === 'torch' ? TORCH_PARTS[shapeIndex] : doorShape;
                        for (const f of FACES) {
                        const neighborX = lx + f.dir[0], neighborY = y + f.dir[1], neighborZ = lz + f.dir[2];
                        const neighborType = blockAt(neighborX, neighborY, neighborZ);
                        const leafLayerFace = renderMode === 'cutout' && BLOCKS[neighborType]?.render === 'cutout' && isLayeredLeafFace(f.dir);
                        if (renderMode !== 'torch' && solid(lx, y, lz, t, f.dir)) continue;
                        const frontFace = tiles.front !== undefined && isFrontFace(f.dir, facing);
                        let faceTile = tileForBlockFace(tiles, f.kind, f.dir, facing);
                        const furnaceFlameFace = frontFace && t === ID.FURNACE && furnaces.get(`${wx},${y},${wz}`)?.burn > 0;
                        if (furnaceFlameFace) {
                            faceTile = TILE.FURNACE_FRONT_ON;
                        }
                        if (frontFace && t === ID.CHEST && openChests.has(`${wx},${y},${wz}`)) {
                            faceTile = TILE.CHEST_FRONT_OPEN;
                        }
                        const tile = shape ? shape.tiles[f.kind] : variantTile(faceTile, wx, y, wz);
                        atlasUVInto(tile, ATLAS_UV_PAD_PX, tileUV);
                        const ndx = vertexCount;
                        positions = growTypedArray(positions, (vertexCount + 4) * 3);
                        normals = growTypedArray(normals, (vertexCount + 4) * 3);
                        uvs = growTypedArray(uvs, (vertexCount + 4) * 2);
                        colors = growTypedArray(colors, (vertexCount + 4) * 3);
                        torchInfluence = growTypedArray(torchInfluence, vertexCount + 4);
                        furnaceFlame = growTypedArray(furnaceFlame, vertexCount + 4);
                        let target, targetOffset;
                        if (renderMode === 'cutout' || renderMode === 'torch' || renderMode === 'door') {
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
                            const layerInset = leafLayerFace ? 0.008 : 0;
                            positions[p] = lx + (shape ? shape.min[0] + c.pos[0] * (shape.max[0] - shape.min[0]) + orientation[0] * wallOffset : c.pos[0]) - f.dir[0] * layerInset;
                            positions[p + 1] = py - f.dir[1] * layerInset;
                            positions[p + 2] = lz + (shape ? shape.min[2] + c.pos[2] * (shape.max[2] - shape.min[2]) + orientation[1] * wallOffset : c.pos[2]) - f.dir[2] * layerInset;
                            normals[p] = f.dir[0]; normals[p + 1] = f.dir[1]; normals[p + 2] = f.dir[2];
                            uvs[uv] = tileUV.u0 + c.uv[0] * tileUV.uWidth;
                            uvs[uv + 1] = tileUV.v0 + c.uv[1] * tileUV.vHeight;
                            const shade = ambientOcclusionAt(lx, y, lz, f, c, renderMode !== 'liquid');
                            colors[p] = shade[0]; colors[p + 1] = shade[1]; colors[p + 2] = shade[2];
                            torchInfluence[vertex] = shade[3];
                            furnaceFlame[vertex] = furnaceFlameFace ? 1 : 0;
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
        geo.setAttribute('furnaceFlame', new THREE.BufferAttribute(furnaceFlame.subarray(0, vertexCount), 1));

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

    refreshChunkDecorations(chunk) {
        if (!this.decorations) return;
        const key = chunkKey(chunk.cx, chunk.cz);
        for (const { type, id } of this.decorationsByChunk.get(key) ?? []) {
            this.decorations.removeInstance(type, id);
        }

        const instanceIds = [];
        const batchX = floorDiv(chunk.cx, 4), batchZ = floorDiv(chunk.cz, 4);
        const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;
        for (let y = 0; y <= chunk.maxY; y++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                    if (chunk.data[idx(lx, y, lz)] !== ID.TALL_GRASS) continue;
                    const wx = ox + lx, wz = oz + lz;
                    let supportY = y - 1;
                    const hasSolidSupport = level => {
                        const type = level >= 0 ? chunk.data[idx(lx, level, lz)] : 0;
                        return type !== 0 && (BLOCKS[type]?.solid ?? true);
                    };
                    while (supportY >= 0 && y - supportY <= 3 && !hasSolidSupport(supportY)) supportY--;
                    if (supportY < 0 || y - supportY > 3) {
                        // Sem piso próximo, a planta é inválida e não deve ficar suspensa.
                        this.setBlock(wx, y, wz, 0);
                        continue;
                    }
                    const groundedY = supportY + 1;
                    if (groundedY !== y) {
                        // Corrige posições antigas que ficaram até dois blocos acima do piso.
                        const targetType = chunk.data[idx(lx, groundedY, lz)];
                        this.setBlock(wx, y, wz, 0);
                        if (targetType === 0) this.setBlock(wx, groundedY, wz, ID.TALL_GRASS);
                        continue;
                    }
                    const rotation = hash2(wz, wx, this.seed + 907) * Math.PI * 2;
                    const scale = 0.45 + hash2(wx, wz, this.seed + 919) * 0.85;
                    const variant = Math.min(2, Math.floor(hash2(wx, wz, this.seed + 929) * 3));
                    const type = `tall-grass-${variant}@${batchX},${batchZ}`;
                    if (!this.decorations.hasType(type)) {
                        this.decorations.registerType(type, this.decorationGeometries[variant], this.decorationMaterials[variant], { maxCapacity: 256 });
                    }
                    const id = this.decorations.addInstance(
                        type, [wx + 0.5, y, wz + 0.5], [0, rotation, 0], scale,
                    );
                    instanceIds.push({ type, id });
                }
            }
        }
        const batchTypes = new Set(instanceIds.map(({ type }) => type));
        for (const { type } of this.decorationsByChunk.get(key) ?? []) batchTypes.add(type);
        for (const type of batchTypes) {
            if (this.decorations.hasType(type)) this.decorations.computeBounds(type);
        }
        this.decorationsByChunk.set(key, instanceIds);
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
                for (const { type, id } of this.decorationsByChunk.get(key) ?? []) {
                    this.decorations?.removeInstance(type, id);
                    if (this.decorations?.getCount(type) === 0) this.decorations.unregisterType(type);
                }
                this.decorationsByChunk.delete(key);
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
        updateWorldLightingEffects(this.torchFlameMaterial, [this.chunkMaterial, this.cutoutMaterial], torchTime);
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
function damageTool(slotIndex, amount = 1) {
    const result = damageToolStack(inventory.slots[slotIndex], amount);
    if (!result) return;
    if (result.broken) {
        inventory.slots[slotIndex] = null;
        showToast(`${result.name} quebrou!`);
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

const setSaveIndicator = createWorldSaveIndicator(
    document.getElementById('save-indicator'),
    document.getElementById('save-indicator-text'),
);

const furnaces = new Map();
let station = null;
let furnaceDirty = false;

function updateFurnaces(dt) {
    for (const [key, f] of furnaces) {
        const wasBurning = f.burn > 0;
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

        if (wasBurning !== (f.burn > 0)) {
            const [x, , z] = key.split(',').map(Number);
            const chunk = world?.getChunk(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE));
            if (chunk) {
                world.refreshLightSourceChunk(chunk.cx, chunk.cz, chunk);
                world.lightDirty.add(chunk);
                world.dirty.add(chunk);
            }
        }
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
function setChestOpen(key, isOpen) {
    const changed = isOpen ? !openChests.has(key) : openChests.has(key);
    if (!changed) return;
    if (isOpen) openChests.add(key); else openChests.delete(key);
    const [x, , z] = key.split(',').map(Number);
    const chunk = world?.getChunk(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE));
    if (chunk) world.dirty.add(chunk);
}

function spillChest(x, y, z) {
    const key = `${x},${y},${z}`, c = chests.get(key);
    setChestOpen(key, false);
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
        setChestOpen(ckey, true);
        openInventory({ type, chest: c, chestKey: ckey });
        return;
    }
    const key = `${hit.x},${hit.y},${hit.z}`;
    let f = furnaces.get(key);
    if (!f) { f = { inv: new Inventory(3), burn: 0, burnMax: 0, cook: 0 }; furnaces.set(key, f); }
    openInventory({ type, furnace: f });
}

function otherDoorHalf(x, y, z, type) {
    const part = woodDoorPart(type);
    if (!part) return null;
    return { x, y: y + (part.half === 'bottom' ? 1 : -1), z, part };
}

// A porta fechada colide só com o painel; se o jogador estiver no vão, fechar
// deixaria ele preso dentro da geometria.
function doorWouldHitPlayer(x, y, z, type) {
    const box = world.doorCollisionBox(x, y, z, type);
    if (!box) return false;
    const p = player.pos;
    return p.x + PLAYER_RADIUS > box.minX && p.x - PLAYER_RADIUS < box.maxX
        && p.z + PLAYER_RADIUS > box.minZ && p.z - PLAYER_RADIUS < box.maxZ
        && p.y < y + 1 && p.y + player.height > y;
}

function toggleWoodDoor(hit) {
    const type = world.getBlock(hit.x, hit.y, hit.z);
    const part = woodDoorPart(type);
    if (!part) return false;
    const open = !part.open;
    const halves = [{ x: hit.x, y: hit.y, z: hit.z, part }, otherDoorHalf(hit.x, hit.y, hit.z, type)];
    if (!open && halves.some(half => half && doorWouldHitPlayer(
        half.x, half.y, half.z, ID.WOOD_DOOR_BOTTOM))) {
        showToast('Saia do vão da porta para fechá-la');
        return false;
    }
    for (const half of halves) {
        if (!half) continue;
        const current = world.getBlock(half.x, half.y, half.z);
        const currentPart = woodDoorPart(current);
        if (!currentPart) continue;
        world.setBlock(half.x, half.y, half.z, woodDoorType(currentPart.half, open));
    }
    handAnim.punch = 1;
    return true;
}

// Coloca as duas metades da porta (base + topo) de uma vez. A base precisa de
// apoio sólido e as duas células devem estar livres.
function placeWoodDoor(px, py, pz, facing) {
    const topY = py + 1;
    if (py <= 0 || topY >= WORLD_HEIGHT) return false;
    const supportType = world.getBlock(px, py - 1, pz);
    if (!(BLOCKS[supportType]?.solid ?? false) || BLOCKS[supportType]?.render === 'door') return false;
    const topType = world.getBlock(px, topY, pz);
    if (topType !== 0 && BLOCKS[topType]?.solid !== false) return false;
    if (intersectsPlayer(px, py, pz) || intersectsPlayer(px, topY, pz)) return false;
    if (!world.setBlock(px, py, pz, ID.WOOD_DOOR_BOTTOM, facing)) return false;
    if (!world.setBlock(px, topY, pz, ID.WOOD_DOOR_TOP, facing)) {
        world.setBlock(px, py, pz, 0);
        return false;
    }
    return true;
}

function waterImmersionAt(world, x, y, z, halfHeight) {
    const bx = Math.floor(x), by = Math.floor(y - halfHeight + 0.001), bz = Math.floor(z);
    const type = world.getBlock(bx, by, bz);
    if (!WaterSystem.isBlock(type)) return 0;
    const surface = by + WaterSystem.surfaceHeightFor(type, world.getBlock(bx, by + 1, bz));
    return Math.max(0, Math.min(1, (surface - (y - halfHeight)) / (halfHeight * 2)));
}

function buildCubeGeo(tiles, size, facing = DEFAULT_BLOCK_FACING) {
    const positions = [], normals = [], uvs = [], indices = [];
    for (const f of FACES) {
        const tile = tileForBlockFace(tiles, f.kind, f.dir, facing);
        const { u0, v0, uWidth, vHeight } = atlasUV(tile, ATLAS_UV_PAD_PX);
        const ndx = positions.length / 3;
        for (const c of f.corners) {
            positions.push((c.pos[0] - 0.5) * size, (c.pos[1] - 0.5) * size, (c.pos[2] - 0.5) * size);
            normals.push(f.dir[0], f.dir[1], f.dir[2]);
            uvs.push(u0 + c.uv[0] * uWidth, v0 + c.uv[1] * vHeight);
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
    const block = item.block != null ? BLOCKS[item.block] : null;
    const geo = item.sprite
        ? buildSpriteGeo(spritePixels(item.sprite.kind, item.sprite.mat), ITEM_SIZE * 1.6 / 16, ITEM_SIZE * 0.25)
        : block?.render === 'instanced'
            ? createTallGrassGeometry().scale(0.4, 0.4, 0.4)
            : buildCubeGeo(block.tiles, ITEM_SIZE);
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
        (block?.render === 'instanced' ? tallGrassMaterial :
            (block?.render === 'cutout' ? world.cutoutMaterial :
                (block?.render === 'liquid' ? world.water.material : world.material)));
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
                Math.max(0, d - 0.05),
                WORLD_RAYCAST_ACCESS
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
    const drop = type === ID.TALL_GRASS ? ID.WHEAT_SEEDS : BLOCKS[type].drop;
    const dropChance = type === ID.TALL_GRASS ? 0.12 : (BLOCKS[type].dropChance ?? 1);
    if (type === ID.FURNACE) spillFurnace(x, y, z);
    if (type === ID.CHEST) spillChest(x, y, z);
    const doorHalf = otherDoorHalf(x, y, z, type);
    if (doorHalf && woodDoorPart(world.getBlock(doorHalf.x, doorHalf.y, doorHalf.z))) {
        world.setBlock(doorHalf.x, doorHalf.y, doorHalf.z, 0);
    }
    // A célula fica vazia; a água em volta escorre para dentro como fluxo
    // (nunca como fonte). Ver `world-water.js` › `onBlockBroken()`.
    world.water.onBlockBroken(world, x, y, z);
    breakParticles.spawn(x, y, z, type);
    if (harvest && drop && Math.random() < dropChance) {
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

    if (currentHit.type === ID.TALL_GRASS) {
        breakBlock(currentHit.x, currentHit.y, currentHit.z);
        resetMining();
        leftHeld = false;
        return;
    }

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
    inventoryAssets.initialize(world.material.map.image);
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
let handSleeve = null, handBlock = null;
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
    handSleeve = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.40),
        new THREE.MeshLambertMaterial({ map: createNoiseTexture([70, 110, 190], 11) }));
    handSleeve.position.z = -0.20;
    handBlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.13, 0.20),
        new THREE.MeshLambertMaterial({ map: createNoiseTexture([214, 166, 125], 12, 8) }));
    handBlock.position.z = -0.50;
    heldAnchor = new THREE.Group();
    heldAnchor.position.set(0, 0.03, -0.62);
    handPivot.add(handSleeve, handBlock, heldAnchor);
    handScene.add(handCamera);
    handCamera.add(handPivot);
    window.addEventListener('keydown', adjustHeldTransform);
}

function adjustHeldTransform(event) {
    if (!HELD_DEBUG || !controls?.isLocked || heldId < 0 || !HELD_TOOL_KINDS.has(ITEMS[heldId]?.sprite?.kind)) return;
    let changed = false;
    const step = event.shiftKey ? 0.1 : 0.02;
    const angle = event.shiftKey ? 5 : 2;
    switch (event.code) {
        case 'ArrowLeft': HELD.position.x -= step; changed = true; break;
        case 'ArrowRight': HELD.position.x += step; changed = true; break;
        case 'ArrowUp': HELD.position.y += step; changed = true; break;
        case 'ArrowDown': HELD.position.y -= step; changed = true; break;
        case 'KeyQ': HELD.rotation.y -= angle; changed = true; break;
        case 'KeyE': HELD.rotation.y += angle; changed = true; break;
        case 'KeyR': HELD.rotation.z -= angle; changed = true; break;
        case 'KeyF': HELD.rotation.z += angle; changed = true; break;
        case 'KeyZ': HELD.scale = Math.max(0.1, HELD.scale - 0.02); changed = true; break;
        case 'KeyX': HELD.scale += 0.02; changed = true; break;
        default: return;
    }
    event.preventDefault();
    if (changed) console.log('HELD =', JSON.stringify(HELD, null, 2));
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
    handBlock.position.set(0, 0, -0.50);
    handSleeve.position.set(0, 0, -0.20);
    handBlock.scale.set(1, 1, 1);
    handSleeve.scale.set(1, 1, 1);
    heldAnchor.position.set(0, 0.03, -0.62);
    heldAnchor.scale.setScalar(1);
    if (!id) return;
    const item = ITEMS[id];
    if (item.sprite) {
        if (HELD_TOOL_KINDS.has(item.sprite.kind)) {
            heldAnchor.position.set(HELD.position.x, HELD.position.y, HELD.position.z);
            heldAnchor.rotation.set(
                THREE.MathUtils.degToRad(HELD.rotation.x),
                THREE.MathUtils.degToRad(HELD.rotation.y),
                THREE.MathUtils.degToRad(HELD.rotation.z));
            heldAnchor.scale.setScalar(HELD.scale);
        }
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
        if (!HELD_TOOL_KINDS.has(item.sprite.kind)) heldAnchor.rotation.set(...HELD_TOOL_ROT);
    } else {
        const key = 'blk' + id;
        const block = BLOCKS[item.block];
        if (!heldGeoCache[key]) {
            heldGeoCache[key] = block?.render === 'instanced'
                ? createTallGrassGeometry().scale(0.4, 0.4, 0.4)
                : buildCubeGeo(block.tiles, 0.3);
        }
        const mat = block?.render === 'instanced' ? tallGrassMaterial :
            (block?.render === 'cutout' ? world.cutoutMaterial :
                (block?.render === 'liquid' ? world.water.material : world.material));
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
    const heldToolKind = ITEMS[heldId]?.sprite?.kind;
    if (HELD_TOOL_KINDS.has(heldToolKind)) {
        heldAnchor.position.set(HELD.position.x, HELD.position.y, HELD.position.z);
        heldAnchor.rotation.set(
            THREE.MathUtils.degToRad(HELD.rotation.x),
            THREE.MathUtils.degToRad(HELD.rotation.y),
            THREE.MathUtils.degToRad(HELD.rotation.z));
        heldAnchor.scale.setScalar(HELD.scale);
    }

    handAnim.eat += ((eat.active ? 1 : 0) - handAnim.eat) * Math.min(1, 10 * dt);
    const ea = handAnim.eat;
    const wob = Math.sin(performance.now() / 1000 * 22) * 0.015 * ea;

    handPivot.position.set(
        HAND_BASE.x + Math.cos(bobTimer) * 0.012 - 0.22 * ea,
        HAND_BASE.y + Math.sin(bobTimer * 2) * 0.010 - dip - 0.05 * swing + 0.20 * ea + wob,
        HAND_BASE.z - 0.12 * swing + 0.08 * ea);
    handPivot.rotation.set(
        0.35 - 0.9 * swing + 0.35 * ea, 0.25 - 0.3 * ea, 0);
    handPivot.scale.setScalar(1);
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

function handleOutputClick(e) {
    const r = matchRecipe(craftInv, craftN);
    if (!r) return;
    const c = cursorHeld.stack;
    if (e.shiftKey && !c) {
        for (let guard = 0; guard < 64; guard++) {
            const rr = matchRecipe(craftInv, craftN);
            if (!rr || inventory.spaceFor(rr.id) < rr.count) break;
            craftConsume(craftInv, craftN);
            inventory.add(rr.id, rr.count);
        }
        return;
    }
    if (!c) {
        craftConsume(craftInv, craftN);
        cursorHeld.stack = { id: r.id, count: r.count };
    } else if (c.id === r.id && stackable(c.id) && c.count + r.count <= ITEMS[c.id].maxStack) {
        craftConsume(craftInv, craftN);
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
let recipeBook = null;

function syncPauseMenu(overrides = {}) {
    document.getElementById('menu').style.display = pauseMenuDisplay({
        locked: !!controls?.isLocked,
        inventoryOpen,
        dead,
        ...overrides,
    });
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

    document.getElementById('recipe-book-toggle').addEventListener('click', () => {
        setRecipeBookOpen(document.getElementById('recipe-book').hidden === true);
    });
    document.getElementById('recipe-book-close').addEventListener('click', () => setRecipeBookOpen(false));

    const overlay = document.getElementById('inventory');
    overlay.addEventListener('mousedown', onInventoryMouseDown);
    overlay.addEventListener('mousemove', onInventoryMouseMove);
}

function buildRecipeList() {
    recipeBook = createRecipeBook({
        root: document.getElementById('inv-recipes'),
        search: document.getElementById('recipe-search'),
        empty: document.getElementById('recipe-empty'),
        recipes: RECIPES,
        smelting: SMELT,
        fuels: FUEL,
        items: ITEMS,
        getAvailableCount: id => [...inventory.slots, ...craftInv.slots]
            .reduce((total, stack) => total + (stack?.id === id ? stack.count : 0), 0),
        onSelectCrafting: recipe => {
            const result = invFillRecipe(inventory, craftInv, recipe, craftN);
            if (result.ok) {
                renderInventory();
                return { ok: true, message: 'Ingredientes colocados na grade de criação.' };
            }
            const messages = {
                'requires-table': 'Esta receita precisa de uma bancada 3×3.',
                'inventory-full': 'Libere espaço para guardar os itens que já estão na grade.',
                'missing-items': 'Faltam ingredientes no inventário.',
            };
            return { ok: false, message: messages[result.reason] ?? 'Não foi possível preparar esta receita.' };
        },
    });
}

function setRecipeBookOpen(isOpen) {
    const panel = document.getElementById('recipe-book');
    const toggle = document.getElementById('recipe-book-toggle');
    panel.hidden = !isOpen;
    toggle.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) document.getElementById('recipe-search').focus();
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
    document.getElementById('recipe-book-toggle').hidden = isFurnace || isChest;
    document.getElementById('inv-craft').style.gridTemplateColumns = craftGridTemplateColumns(craftN);
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
    recipeBook?.refreshAvailability();
}

function onInventoryMouseMove(e) {
    invMouse.x = e.clientX; invMouse.y = e.clientY; invMouse.seen = true;
    const el = e.target.closest('.islot');
    invHover = el ? { inv: el.dataset.inv, i: Number(el.dataset.index) } : null;
    updateInventoryFloaters();
}

function onInventoryMouseDown(e) {
    if (e.target.closest('button, input, textarea, select')) return;
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
            else if (name === 'main') invQuickMoveToCraft(inventory, craftInv, i, craftN);
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
    setRecipeBookOpen(false);
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
    setRecipeBookOpen(false);

    if (station && station.type === 'chest') setChestOpen(station.chestKey, false);

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

    syncPauseMenu({ locked: false });
    if (relock) {
        requestLock().then(ok => {
            if (!ok) syncPauseMenu({ locked: false });
        });
    }
}

function handleInventoryKey(event) {
    if (event.target.closest('input, textarea, select') && event.code !== 'Escape') return;
    if (event.code === 'Escape' && !document.getElementById('recipe-book').hidden) {
        event.preventDefault(); event.stopPropagation(); setRecipeBookOpen(false); return;
    }
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
const worldClock = createWorldClock({ dayLength: DAY_LENGTH, initialTime: START_TIME });
let hemiLight, sunLight;

function updateWorldClock(dt) {
    worldClock.advance(dt);
}

function updateSky() {
    worldSky.update({ scene, camera, hemiLight, sunLight, handAmbient, worldTime: worldClock.time });
}

// =====================================================================
// 5F. NUVENS VOXEL
// =====================================================================
// =====================================================================
// 6. ESTADO GERAL
// =====================================================================
let camera, scene, renderer, controls, world, creatureSystem, tallGrassMaterial, tallGrassMaterials = [];
const breakParticles = createBreakParticleSystem({
    THREE,
    getScene: () => scene,
    getBlockColor: type => inventoryAssets.blockColors[type],
    getImmersionAt: (x, y, z, halfHeight) => waterImmersionAt(world, x, y, z, halfHeight),
});
const WORLD_RAYCAST_ACCESS = {
    getBlock: (x, y, z) => world.getBlock(x, y, z),
    isIgnoredBlock: type => WaterSystem.isBlock(type),
};
let targetMesh;
let currentHit = null;
const tmpDir = new THREE.Vector3();
const yawEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const look = { yaw: 0, pitch: 0, spikes: 0, maxDelta: 0 };
const MAX_EVENT_DELTA = 350;
const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const LOOK_SPEED = 0.002;
const LOOK_SENSITIVITY = GAME_SETTINGS.sensitivity;
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
const inventory = new Inventory(PLAYER_INVENTORY_SIZE);
let leftHeld = false;

// Status
let health = MAX_HEALTH, hunger = MAX_HUNGER, saturation = 5, exhaustion = 0;
let breath = MAX_BREATH, breathTimer = 0;
let regenTimer = 0, starveTimer = 0, invuln = 0, hurtFlash = 0;
let dead = false;
let hungerStageShown = 'ok';
const eat = { active: false, progress: 0, slot: -1, id: 0 };
const hurtEl = document.getElementById('hurt');
const deathEl = document.getElementById('death');

let prevTime = performance.now();
const perf = { t: 0, frames: 0, sum: 0, worst: 0, avg: 0, worstShown: 0, buildMs: 0, fps: 0, long: 0, lastLong: '—', ctxLost: 0 };
const gfx = createWorldGraphicsQuality({
    max: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
    min: 0.5,
    notify: showToast,
});
const cycleQuality = () => gfx.cycle();

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
    syncHungerWarning();
}

// A barra de fome pulsa (e fica vermelha quando zera) e um aviso aparece na
// primeira vez que a fome entra em cada faixa — antes nada acontecia na tela.
function syncHungerWarning() {
    const stage = hungerStage(hunger);
    const bar = document.getElementById('hunger-bar');
    if (bar) {
        bar.classList.toggle('low', stage === 'low');
        bar.classList.toggle('starving', stage === 'empty');
    }
    if (stage === hungerStageShown) return;
    hungerStageShown = stage;
    if (stage !== 'ok') showToast(HUNGER_WARNINGS[stage]);
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
    hungerStageShown = 'ok';
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
    if (health <= 0) die(source);
}

function die(source = 'generic') {
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

    document.getElementById('death-cause').textContent = deathTitle(source);
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
    syncPauseMenu();
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
        const starve = advanceStarvation({ hunger, timer: starveTimer, dt });
        starveTimer = starve.timer;
        if (starve.damage > 0) takeDamage(starve.damage, 'starve');
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
Nuvens: ${worldClouds.cells} células (de ${WORLD_CLOUD_CONFIG.gridSize * WORLD_CLOUD_CONFIG.gridSize}) | altura ${WORLD_CLOUD_CONFIG.height}
Seed: ${SEED}
XYZ: ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)}
Chunk: ${floorDiv(p.x, CHUNK_SIZE)}, ${floorDiv(p.z, CHUNK_SIZE)}
Chunks: ${world.chunks.size} | fila geração: ${world.genQueue.length} | fila malha: ${world.dirty.size}
No chão: ${player.onGround}
Hora do mundo: ${worldClock.format()} (tempo ${worldClock.time.toFixed(3)}) | sol ${worldSky.elevation.toFixed(2)} | luz do dia ${worldSky.day.toFixed(2)}
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
    const pMinX = x - PLAYER_RADIUS, pMaxX = x + PLAYER_RADIUS;
    const pMinZ = z - PLAYER_RADIUS, pMaxZ = z + PLAYER_RADIUS;
    for (let bx = x0; bx <= x1; bx++)
        for (let by = y0; by <= y1; by++)
            for (let bz = z0; bz <= z1; bz++) {
                if (!world.isSolidForPhysics(bx, by, bz)) continue;
                const type = world.getBlock(bx, by, bz);
                if (!woodDoorPart(type)) return true;
                // Porta: colide só com o painel (fechada). Aberta é passável.
                const box = world.doorCollisionBox(bx, by, bz, type);
                if (!box) continue;
                if (pMaxX > box.minX && pMinX < box.maxX && pMaxZ > box.minZ && pMinZ < box.maxZ) return true;
            }
    return false;
}

function moveAxis(axis, amount) {
    if (amount === 0) return false;
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.25));
    const step = amount / steps;
    const p = player.pos;
    for (let i = 0; i < steps; i++) {
        const from = p[axis];
        p[axis] = from + step;
        if (!collides(p.x, p.y, p.z, player.height)) continue;
        // Encostou em algo: aproxima o máximo possível da superfície em vez de
        // voltar para a borda do voxel. Blocos comuns param no mesmo ponto de
        // antes; a porta fina deixa o jogador encostar no painel.
        let free = from, blocked = p[axis];
        for (let k = 0; k < 6; k++) {
            const mid = (free + blocked) / 2;
            p[axis] = mid;
            if (collides(p.x, p.y, p.z, player.height)) blocked = mid;
            else free = mid;
        }
        p[axis] = free;
        return true;
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
function updateTarget() {
    camera.getWorldDirection(tmpDir);
    currentHit = raycastVoxels(camera.position, tmpDir, REACH, WORLD_RAYCAST_ACCESS);
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

    const sprintFov = sprintNow && moveForward && !isCrouching && !inWater;
    const targetFOV = GAME_SETTINGS.fov + (sprintFov ? 10 : 0);
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
const saveCodec = createWorldSaveCodec({ version: WORLD_SAVE_VERSION });

function buildSave() {
    return saveCodec.build({
        seed: SEED,
        worldTime: worldClock.time,
        world,
        player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, health, hunger, saturation, breath },
        selectedSlot,
        inventory: inventory.slots,
        drops: itemEntities,
        chests,
        furnaces,
    });
}

const saveManager = createWorldSaveManager({
    openDatabase: dbOpen,
    storeRequest: dbRun,
    saveKey: SAVE_KEY,
    tabId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    seed: SEED,
    codec: saveCodec,
    buildSave,
    hasWorld: () => Boolean(world),
    onToast: showToast,
    onSaveState: setSaveIndicator,
    onBuildDuration: duration => { perf.buildMs = duration; },
    onError: error => console.warn('Falha ao salvar:', error),
});

function saveGame(quiet, immediate = false) {
    saveManager.requestSave(quiet, immediate);
}

const loadGame = createWorldSaveLoader({
    saveManager,
    world: ACTIVE_WORLD,
    getHref: () => window.location.href,
    replaceUrl: url => window.history.replaceState(window.history.state, '', url),
    confirmReset: message => window.confirm(message),
    onError: error => console.warn('Reset de save bloqueado para proteger o mundo:', error),
});

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
    look.yaw -= mx * LOOK_SPEED * LOOK_SENSITIVITY;
    look.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, look.pitch - my * LOOK_SPEED * LOOK_SENSITIVITY));
    applyLook();
}

let pointerLockRequester = null;
let pendingLockRequest = null;
function requestLock() {
    if (pendingLockRequest) return pendingLockRequest;
    pointerLockRequester ??= createPointerLockRequester({
        element: document.body,
        doc: document,
        warn: (...args) => console.warn(...args),
    });
    pendingLockRequest = pointerLockRequester().finally(() => {
        pendingLockRequest = null;
    });
    return pendingLockRequest;
}

function getWorldRegionStatus(x, z, radius = RENDER_DISTANCE) {
    const cx = floorDiv(x, CHUNK_SIZE), cz = floorDiv(z, CHUNK_SIZE);
    const total = (radius * 2 + 1) ** 2;
    let loaded = 0, meshed = 0;
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
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
    document.getElementById('world-loading-detail').textContent = `Preparando as áreas próximas: ${status.meshed} de ${status.total}. O restante continua carregando durante o jogo.`;
}

function isWorldRegionReady(x, z, radius = RENDER_DISTANCE) {
    const status = getWorldRegionStatus(x, z, radius);
    return status.meshed === status.total;
}

// radius menor no início: entrega os chunks próximos ao jogador e deixa o
// restante do raio de renderização terminar de chegar em segundo plano.
async function waitForWorldRegion(x, z, { driveUpdates = true, onProgress = null, radius = RENDER_DISTANCE } = {}) {
    while (!isWorldRegionReady(x, z, radius)) {
        if (driveUpdates) world.update(x, z);
        const status = getWorldRegionStatus(x, z, radius);
        if (onProgress) onProgress(status);
        await new Promise(resolve => requestAnimationFrame(resolve));
    }
    if (onProgress) onProgress(getWorldRegionStatus(x, z, radius));
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

    camera = new THREE.PerspectiveCamera(GAME_SETTINGS.fov, window.innerWidth / window.innerHeight, 0.05, 300);
    scene.add(camera);

    createHand();
    worldSky.create(scene);
    worldClouds.create(scene, SEED);

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

    const decorations = new InstancedBlockManager(THREE, scene, { maxCapacity: 2000 });
    const grassTextureFiles = [
        './assets/tall-grass-short-v2.png',
        './assets/tall-grass-medium-v2.png',
        './assets/tall-grass-tall-v2.png',
    ];
    const grassTextureVersion = '20261029-5';
    const grassTextures = await Promise.all(grassTextureFiles.map(file =>
        new THREE.TextureLoader().loadAsync(new URL(`${file}?v=${grassTextureVersion}`, import.meta.url).href),
    ));
    tallGrassMaterials = grassTextures.map(texture => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshLambertMaterial({
            map: texture, alphaTest: 0.35, transparent: false,
            depthWrite: true, side: THREE.DoubleSide,
        });
    });
    tallGrassMaterial = tallGrassMaterials[1];
    const grassGeometries = Array.from({ length: 3 }, (_, variant) => createTallGrassGeometry(variant));
    window.testInstancedMesh = () => testInstancedMesh(THREE, renderer);

    world = new World(scene, SEED, decorations, grassGeometries, tallGrassMaterials);
    creatureSystem = new CreatureSystem(world);
    const save = await loadGame();
    if (save) {
        world.edits = save.edits;
        world.blockFacings = new BlockFacingStore(save.blockFacings);
        inventory.slots = save.inventory;
        selectedSlot = save.selectedSlot;
        health = save.player.health;
        hunger = save.player.hunger;
        saturation = save.player.saturation;
        breath = save.player.breath;
        worldClock.time = save.worldTime;
        for (const [key, furnace] of save.furnaces) {
            const inv = new Inventory(3);
            inv.slots = furnace.slots;
            furnaces.set(key, { ...furnace, inv });
        }
        for (const [key, chest] of save.chests) {
            const inv = new Inventory(27);
            inv.slots = chest.slots;
            chests.set(key, { inv });
        }
        for (const e of save.drops) {
            spawnItemEntity(e.id, e.count, new THREE.Vector3(e.x, e.y, e.z), new THREE.Vector3(), 0, e.damage,
                { age: e.age, ttl: e.ttl, noMerge: true });
        }
    }
    const sp = findSpawn(world.generator, TERRAIN_CONFIG);
    spawnPoint.set(sp.x, sp.y, sp.z);
    const savedPositionIsInWorld = save && save.player.y >= 0 && save.player.y < WORLD_HEIGHT + 4;
    const recoveredSavedPosition = !!save && !savedPositionIsInWorld;
    if (recoveredSavedPosition) console.warn('Posição do jogador fora do mundo; mantendo o restante do save e recuperando no ponto inicial.');
    const start = savedPositionIsInWorld ? save.player : spawnPoint;
    await waitForWorldRegion(start.x, start.z, { driveUpdates: true, onProgress: setWorldLoadProgress, radius: START_LOAD_RADIUS });
    player.pos.set(start.x, start.y, start.z);
    for (let guard = 0; guard < 70 && collides(player.pos.x, player.pos.y, player.pos.z, player.height); guard++) player.pos.y += 1;
    camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
    
    initGameplayAssets();
    updateSky();

    document.addEventListener('mousemove', onLookMove, true);
    controls = new PointerLockControls(camera, document.body);
    const menu = document.getElementById('menu');
    const btnPlay = document.getElementById('btn-play');

    btnPlay.addEventListener('click', () => {
        requestLock().then(ok => {
            if (!ok) syncPauseMenu();
        });
    });
    const btnWorlds = document.getElementById('btn-worlds');
    btnWorlds.addEventListener('click', async () => {
        btnWorlds.disabled = true;
        btnWorlds.textContent = 'Salvando mundo...';
        const saved = await saveManager.flushAndRelease(false);
        if (!saved) {
            const leaveWithoutSaving = confirm(
                'Não foi possível salvar este mundo. Se sair agora, as alterações desde o último save serão perdidas. Deseja sair sem salvar?'
            );
            if (leaveWithoutSaving) {
                await saveManager.release();
                location.reload();
                return;
            }
            btnWorlds.disabled = false;
            btnWorlds.textContent = 'Voltar à seleção de mundos';
            return;
        }
        location.reload();
    });
    controls.addEventListener('lock', () => syncPauseMenu({ locked: true }));
    renderer.domElement.addEventListener('click', () => {
        if (!controls.isLocked && !inventoryOpen && !dead && menu.style.display === 'none') {
            requestLock().then(ok => {
                if (!ok) syncPauseMenu();
            });
        }
    });
    document.getElementById('btn-respawn').addEventListener('click', () => {
        dead = false;
        deathEl.style.display = 'none';
        syncPauseMenu();
        requestLock().then(ok => {
            if (!ok) syncPauseMenu();
        });
    });
    controls.addEventListener('unlock', () => {
        const inventoryExit = inventoryOpen || inventoryUnlockPending;
        inventoryUnlockPending = false;
        syncPauseMenu({ locked: false });
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
                document.body.classList.toggle('debug-visible', debugVisible);
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

        const held = inventory.slots[selectedSlot];
        const station = currentHit && BLOCKS[currentHit.type].station;
        const door = Boolean(currentHit && woodDoorPart(currentHit.type));
        const food = Boolean(held && ITEMS[held.id].food);
        const intent = rightClickIntent({ sneaking: event.shiftKey || wantToCrouch, station, door, food });

        if (intent === 'station') { openStation(station, currentHit); return; }
        if (intent === 'door') { toggleWoodDoor(currentHit); return; }
        // Comer funciona mirando para qualquer lugar (inclusive um bloco).
        if (intent === 'eat') {
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
        if (blockAtTarget !== 0 && !WaterSystem.isBlock(blockAtTarget) && BLOCKS[blockAtTarget]?.solid !== false) return;
        
        if (intersectsPlayer(px, py, pz)) return;
        const facing = BLOCKS[placedType]?.tiles.front !== undefined
            ? facingTowardPlayer(px + 0.5, pz + 0.5, player.pos.x, player.pos.z)
            : null;
        const placed = placedType === ID.WOOD_DOOR_BOTTOM
            ? placeWoodDoor(px, py, pz, facing)
            : world.setBlock(px, py, pz, placedType, facing);
        if (placed) {
            inventory.removeOne(selectedSlot);
            updateHotbarUI();
            handAnim.punch = 1;
        } else if (placedType === ID.WOOD_DOOR_BOTTOM) {
            showToast('A porta precisa de apoio sólido e de dois blocos livres');
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
            time: (t) => { worldClock.time = t; updateSky(); },
            // Ajuda a testar portas e blocos sem precisar mirar com o mouse.
            blockAt: (x, y, z) => world.getBlock(x, y, z),
            lightAt: (x, y, z) => {
                const chunk = world.getChunk(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE));
                if (!chunk || y < 0 || y >= WORLD_HEIGHT) return null;
                const i = idx(x - chunk.cx * CHUNK_SIZE, y, z - chunk.cz * CHUNK_SIZE);
                return { sky: chunk.skyLight[i], block: chunk.blockLight[i] };
            },
            rebuildLight: (cx, cz) => {
                const chunk = world.getChunk(cx, cz);
                if (!chunk) return false;
                world.rebuildSkyLight(chunk);
                return true;
            },
            setBlock: (id, x, y, z) => world.setBlock(x, y, z, id),
            toggleDoor: (x, y, z) => toggleWoodDoor({ x, y, z }),
            placeDoorAt: (x, y, z, facing = 'south') =>
                placeWoodDoor(x, y, z, facing) ? world.getBlock(x, y, z) : 0,
        };
    }

    updateSurvivalUI();
    document.getElementById('btn-play').disabled = false;
    document.getElementById('world-loading').hidden = true;
    if (recoveredSavedPosition) showToast('Posição recuperada no ponto inicial; seu mundo foi preservado.');
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
        breakParticles.update(dt);
    }
    world.water.updateSubmersion(world, player);
    world.water.update(world, dt, now);

    if (controls.isLocked || inventoryOpen) {
        updateWorldClock(dt);
        updateFurnaces(dt);
        world.furnaceSmoke.update(dt, furnaces, world, player.pos);
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
    
    if (controls.isLocked || inventoryOpen) worldClouds.update(dt, camera);
    else worldClouds.update(0, camera);
    updateHand(dt);
    if (hurtFlash > 0) { hurtFlash = Math.max(0, hurtFlash - dt * 2); hurtEl.style.opacity = hurtFlash; }
    world.update(player.pos.x, player.pos.z);
    updateDebug(rawDt);

    const pendingScale = gfx.consumePending();
    if (pendingScale !== null) renderer.setPixelRatio(pendingScale);
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
        perf.lastLong = `${(rawDt * 1000).toFixed(0)} ms (CPU ${cpu.toFixed(0)} ms, chunks gerados ${world.frameGen ?? 0}, malhas ${world.frameMesh ?? 0}, malha ${world.lastMeshMs?.toFixed(1) ?? '0'} ms, luz ${world.lastLightMs?.toFixed(1) ?? '0'} ms, salvando: ${saveManager.isSaving ? 'sim' : 'não'})`;
    }
    if (perf.t >= 1) {
        perf.avg = perf.sum / perf.frames; perf.worstShown = perf.worst;
        perf.fps = perf.frames / perf.t;
        gfx.adapt(perf.fps, perf.avg, document.hidden);
        perf.t = 0; perf.frames = 0; perf.sum = 0; perf.worst = 0;
    }
}

document.getElementById('world-loading').hidden = false;
init().then(animate).catch(showWorldLoadError);
