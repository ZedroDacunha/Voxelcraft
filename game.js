
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
import { keyToSlotAction, nextSlotIndex, slotLabel, statusLabels } from './inventory-a11y.js';
import { pauseMenuDisplay, shouldShowPauseMenu } from './game-pause-menu.js';
import { createPointerLockRequester } from './game-pointer-lock.js';
import { createInventoryAssets } from './inventory-assets.js';
import { createTextureTools } from './world-textures.js';
import { itemRenderMode } from './world-block-icons.js';
import { createWorldSaveCodec, WORLD_SAVE_VERSION } from './world-save-codec.js';
import { createWorldSaveLoader } from './world-save-loader.js';
import { createWorldSaveManager } from './world-save-manager.js';
import { markWorldSaved } from './world-list-store.js';
import { furnaceChunk, stepFurnace } from './world-furnace-rules.js';
import { furnaceDistance, furnaceSoundFor } from './world-furnace-sounds.js';
import { acquireMeshScratch, exactMeshBuffer, storeMeshScratch } from './world-mesh-buffers.js';
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
import { boxOverlapsXZ, woodDoorCollision, woodDoorPart, woodDoorShape, woodDoorType } from './world-door.js';
import { collidesInWorld, movePlayerAxis, playerIntersectsBlock, unstickInWorld } from './player-physics.js';
import { canJumpFrom, createJumpState, updateJumpWindow } from './player-jump.js';
import { ATTACK_COOLDOWN, attackReady, createCreatureSystemClass } from './world-creature.js';
import { creatureInReach } from './world-mob-hit.js';
import { SHEEP_BLEAT_RANGE, SHEEP_WOOL_ITEMS, createSheepSystemClass } from './world-sheep.js';
import { createChatState } from './world-chat.js';
import { COMMAND_PREFIX, runChatCommand } from './world-chat-commands.js';
import { createChatCompleter, visibleSuggestions } from './world-chat-completion.js';
import { DUST_COLOR, dustScaleFor } from './world-creature-dust.js';
import { configureWindSway, updateWindSway, windDirectionFor, windStep, windTargetFor } from './world-wind.js';
import { advanceHandAnimation, countStrikes, createHandAnimation, handSwingAmount, startPunch } from './world-hand-animation.js';
import { STEP_MAX_MOVED, stepDistanceThisFrame, stepPitch, stepSoundFor } from './world-step-sounds.js';
import { advanceGait, createGait, gaitPose } from './world-gait.js';
import { materialSoundName } from './world-block-materials.js';
import { createWaterAudioState, waterSoundFor } from './world-water-sounds.js';
import {
    LIGHT_POOL_RANGE, LIGHT_POOL_SIZE, MOFIM_PULSE_GAIN, creatureEmitterCandidates,
    creatureLightPoint, creatureLightsAllowed, emitterIntensity, heldLightFor, heldLightIntensity,
    pickEmitters,
} from './world-point-lights.js';
import { damageSoundFor } from './world-damage-sounds.js';
import { ambientAvailability, createAmbientState, stepAmbient } from './world-ambient-sounds.js';
import { createWaterfallSoundState, scanWaterfall, updateWaterfallSound, waterfallGain } from './world-waterfall.js';
import {
    TOUCH_HOLD_MS,
    isTouchDevice,
    lookAfterDrag,
    movementFromStick,
    ndcFromPoint,
    stickVector,
    touchGesture,
    touchLookSensitivity,
} from './world-touch-controls.js';
import { getSharedAudio } from './world-audio.js';
import { touchLayoutState, touchStickRadius } from './world-touch-layout.js';
import { canVibrate, createHapticState, hapticPattern, vibrationEnabled } from './world-haptics.js';
import {
    TOUCH_EDIT_EVENT, TOUCH_EDIT_MARGIN, TOUCH_PIECES, TOUCH_RESET_EVENT,
    clampOffsetPx, emptyTouchPositions, loadTouchPositions, offsetPercent, offsetPixels,
    saveTouchPositions,
} from './world-touch-positions.js';
import { renderAspect, renderTarget, resolutionLabel, resolutionSize } from './world-render-resolution.js';
import { rightClickIntent } from './world-interaction-rules.js';
import { loadGameSettings, onGameSettingsChange } from './world-game-settings.js';
import { advanceStarvation, deathTitle, HUNGER_WARNINGS, hungerStage } from './world-survival-rules.js';
import {
    BlockFacingStore, DEFAULT_BLOCK_FACING, facingTowardPlayer, isFrontFace, isHorizontalFacing,
    tileForBlockFace,
} from './world-block-orientation.js';
import {
    TALL_GRASS_VARIANTS, createTallGrassGeometry, createTallGrassMaterial, tallGrassTextureUrl,
} from './world-tall-grass.js';

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
const HELD_TOOL_KINDS = new Set(['pickaxe', 'axe', 'shovel', 'shears']);

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
        // Arrays reaproveitados entre malhas de chunks (ver world-mesh-buffers.js).
        this.meshScratch = {};
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

    // Caixa fina de colisão do painel da porta, fechada ou aberta. Sem isso o
    // jogador parava na borda do voxel (porta fechada) ou atravessava o painel
    // que estava vendo (porta aberta).
    doorCollisionBox(x, y, z, type) {
        const local = woodDoorCollision(woodDoorPart(type), this.getBlockFacing(x, y, z));
        if (!local) return null;
        return {
            minX: x + local.minX, maxX: x + local.maxX,
            minZ: z + local.minZ, maxZ: z + local.maxZ,
        };
    }

    isSolidForPhysics(x, y, z, knownType = null) {
        if (y < 0) return true;
        if (y >= WORLD_HEIGHT) return false;
        const chunk = this.getChunk(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE));
        if (!chunk) return true;
        const type = knownType ?? chunk.data[idx(x - chunk.cx * CHUNK_SIZE, y, z - chunk.cz * CHUNK_SIZE)];
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

        // Buffers de rascunho reaproveitados entre chunks: `growTypedArray` pode
        // trocar as arrays no meio do caminho, e `storeScratch()` devolve a versão
        // final para a próxima malha usar.
        let { positions, normals, uvs, colors, torchInfluence, furnaceFlame, indices, cutoutIndices, waterIndices } =
            acquireMeshScratch(this.meshScratch, CS * CS * 8, CS * CS * 12);
        const storeScratch = () => storeMeshScratch(this.meshScratch, {
            positions, normals, uvs, colors, torchInfluence, furnaceFlame, indices, cutoutIndices, waterIndices,
        });
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

        if (vertexCount === 0) { storeScratch(); return; }

        // Cópia do tamanho exato: a geometria não fica presa ao buffer grande do
        // rascunho (nem é sobrescrita pela próxima malha).
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(exactMeshBuffer(positions, vertexCount * 3), 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(exactMeshBuffer(normals, vertexCount * 3), 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(exactMeshBuffer(uvs, vertexCount * 2), 2));
        geo.setAttribute('color', new THREE.BufferAttribute(exactMeshBuffer(colors, vertexCount * 3), 3));
        geo.setAttribute('torchInfluence', new THREE.BufferAttribute(exactMeshBuffer(torchInfluence, vertexCount), 1));
        geo.setAttribute('furnaceFlame', new THREE.BufferAttribute(exactMeshBuffer(furnaceFlame, vertexCount), 1));

        const totalIndexCount = indexCount + cutoutIndexCount + waterIndexCount;
        const mergedIndices = vertexCount > 65535 ? new Uint32Array(totalIndexCount) : new Uint16Array(totalIndexCount);
        let offset = 0;
        if (indexCount) { mergedIndices.set(indices.subarray(0, indexCount), offset); geo.addGroup(offset, indexCount, 0); offset += indexCount; }
        if (cutoutIndexCount) { mergedIndices.set(cutoutIndices.subarray(0, cutoutIndexCount), offset); geo.addGroup(offset, cutoutIndexCount, 1); offset += cutoutIndexCount; }
        if (waterIndexCount) { mergedIndices.set(waterIndices.subarray(0, waterIndexCount), offset); geo.addGroup(offset, waterIndexCount, 2); }
        geo.setIndex(new THREE.BufferAttribute(mergedIndices, 1));

        storeScratch();

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
// Modelo, spawn, vagar e medo vivem em world-creature.js; aqui só se conectam
// os pedaços do jogo que o módulo não conhece (Three, catálogo, chunk, hash).
const CreatureSystem = createCreatureSystemClass({
    THREE, ID, BLOCKS, CHUNK_SIZE, floorDiv, hash2,
    // O chilreio chega mais fraco com a distância; `startle` (levou golpe ou viu
    // o jogador de perto) sai mais alto e mais agudo que o chamado de passeio.
    onChirp: ({ reason, distance }) => {
        const falloff = clamp01(1 - distance / 16);
        if (falloff < 0.12) return;
        audio.play('mofim-chirp', {
            gainScale: falloff * (reason === 'idle' ? 0.55 : 0.95),
            rate: reason === 'startle' ? 1.22 : (reason === 'panic' ? 1.1 : 1),
        });
    },
    // Pó do rastro: sai de graça na qualidade alta, pela metade em 0,75 e não
    // sai em Baixa (escala 0,5) — partícula é a primeira coisa que se corta.
    dustQuality: () => dustScaleFor(gfx.mode),
    // O pó é soprado pelo mesmo vento que verga o capim: mesma direção (uma por
    // mundo) e mesma intensidade (a fase do ambiente, com rampa).
    wind: () => ({
        x: windDirection.x,
        z: windDirection.z,
        level: windState.level,
        time: windState.time,
    }),
    // Mofim derrubado: o corpo some e deixa pó luminoso no lugar. Um punhado
    // (ou dois, conforme o bicho) — três pós + uma tábua viram uma lanterna.
    onDeath: entity => {
        const count = 1 + (entity.id % 2);
        spawnItemEntity(ID.MOFIM_DUST, count,
            new THREE.Vector3(entity.x, entity.y + 0.35, entity.z),
            new THREE.Vector3(0, 0.45, 0), 0.3);
    },
});

// =====================================================================
// 5A-2. CRIATURAS DE DIA — Ovelha
// =====================================================================
// Modelo, nascimento no pasto e passeio vivem em world-sheep.js; aqui só se
// conectam as peças do jogo que o módulo não conhece (Three, catálogo, chunk).
// Neste primeiro recorte ela só existe e vaga: ainda não foge, não pasta e não
// dá lã.
const SheepSystem = createSheepSystemClass({
    THREE, ID, BLOCKS, CHUNK_SIZE, floorDiv, hash2,
    // Balido: o chamado de passeio sai discreto; o "cheguei perto" sai mais
    // agudo e mais alto. Nos dois casos o volume cai com a distância, e longe
    // demais o som some — três ovelhas balindo juntas já é o bastante.
    onBleat: ({ reason, distance }) => {
        const falloff = clamp01(1 - distance / SHEEP_BLEAT_RANGE);
        if (falloff < 0.08) return;
        const near = reason === 'near';
        audio.play(near ? 'sheep-bleat-near' : 'sheep-bleat', {
            gainScale: falloff * (near ? 0.9 : 0.6),
            rate: near ? 1.12 : 1,
        });
    },
    // Morreu: solta a lã (se ainda tinha velo) e a carne — sempre. O balido sai
    // grave e comprido, como quem não gostou nada do último golpe.
    onDeath: ({ entity, drops }) => {
        const onde = new THREE.Vector3(entity.x, entity.visualY + 0.4, entity.z);
        const impulso = new THREE.Vector3(0, 0.45, 0);
        if (drops?.wool > 0) {
            spawnItemEntity(ID[SHEEP_WOOL_ITEMS[drops.coat]], drops.wool, onde, impulso, 0.3);
        }
        if (drops?.mutton > 0) {
            spawnItemEntity(ID.MUTTON, drops.mutton, onde, impulso, 0.3, 0, { noMerge: true });
        }
        audio.play('sheep-bleat-near', { gainScale: 0.8, rate: 0.82 });
    },
});

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
let optionsStatusTimer = 0;
function showToast(text, ms = 2000) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, ms);
    // A janela de Opções é um <dialog> modal: fica na *top layer* e o #toast
    // apareceria atrás dela — justamente quando o jogador muda uma opção. Com
    // ela aberta, o mesmo aviso vai para a linha de status do diálogo.
    const status = document.getElementById('options-status');
    if (!status) return;
    if (!document.getElementById('options-dialog')?.open) {
        status.textContent = '';
        return;
    }
    status.textContent = text;
    clearTimeout(optionsStatusTimer);
    optionsStatusTimer = setTimeout(() => { status.textContent = ''; }, Math.max(ms, 2600));
}

const setSaveIndicator = createWorldSaveIndicator(
    document.getElementById('save-indicator'),
    document.getElementById('save-indicator-text'),
);

const furnaces = new Map();
let station = null;
let furnaceDirty = false;

// Fornos em chunks carregados são simulados; os que ficaram para trás ficam
// congelados (combustível e preparo param), como no Minecraft. Assim o custo
// por quadro acompanha o que está perto do jogador, não o total do save.
function updateFurnaces(dt) {
    for (const [key, f] of furnaces) {
        const coords = furnaceChunk(f, key, CHUNK_SIZE);
        const chunk = coords ? world?.getChunk(coords.cx, coords.cz) : null;
        if (!chunk) continue;

        const { changed, litChanged, smelted } = stepFurnace(f, dt);
        if (changed && station && station.furnace === f) furnaceDirty = true;
        if (litChanged || smelted) {
            const sound = furnaceSoundFor({
                lit: f.burn > 0,
                litChanged,
                smelted,
                distance: furnaceDistance(key, player.pos),
            });
            if (sound) audio.play(sound.name, { gainScale: sound.gainScale });
        }
        if (litChanged) {
            world.refreshLightSourceChunk(chunk.cx, chunk.cz, chunk);
            world.lightDirty.add(chunk);
            world.dirty.add(chunk);
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

// O painel colide nos dois estados; se o jogador estiver onde o painel vai
// ficar, a porta não muda de estado para não prender ninguém dentro dela.
function doorWouldHitPlayer(x, y, z, type) {
    const box = world.doorCollisionBox(x, y, z, type);
    if (!box) return false;
    const p = player.pos;
    return boxOverlapsXZ(box, p.x - PLAYER_RADIUS, p.x + PLAYER_RADIUS, p.z - PLAYER_RADIUS, p.z + PLAYER_RADIUS)
        && p.y < y + 1 && p.y + player.height > y;
}

function toggleWoodDoor(hit) {
    const type = world.getBlock(hit.x, hit.y, hit.z);
    const part = woodDoorPart(type);
    if (!part) return false;
    const open = !part.open;
    const halves = [{ x: hit.x, y: hit.y, z: hit.z, part }, otherDoorHalf(hit.x, hit.y, hit.z, type)];
    const targetType = woodDoorType('bottom', open);
    if (halves.some(half => half && doorWouldHitPlayer(half.x, half.y, half.z, targetType))) {
        showToast(open ? 'Saia do vão da porta para abri-la' : 'Saia do vão da porta para fechá-la');
        return false;
    }
    for (const half of halves) {
        if (!half) continue;
        const current = world.getBlock(half.x, half.y, half.z);
        const currentPart = woodDoorPart(current);
        if (!currentPart) continue;
        world.setBlock(half.x, half.y, half.z, woodDoorType(currentPart.half, open));
    }
    // Só chega aqui se a porta realmente mudou de estado (as recusas saem antes).
    audio.play(open ? 'door-open' : 'door-close', { rate: stepPitch() });
    startPunch(handAnim);
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
    // O lado vem da própria arte: o ícone de bloco é 32×32 e os itens, 16×16.
    // Fixar 16 cortava a arte maior e esticava o pedaço que sobrava.
    const n = pix.length, meio = n / 2;
    const filled = (cx, cy) => cx >= 0 && cx < n && cy >= 0 && cy < n && pix[cy][cx];
    const tmp = new THREE.Color();
    for (let cy = 0; cy < n; cy++) {
        for (let cx = 0; cx < n; cx++) {
            const c = pix[cy][cx];
            if (!c) continue;
            tmp.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
            const gy = n - 1 - cy;
            for (const f of FACES) {
                if (f.dir[2] === 0 && filled(cx + f.dir[0], cy - f.dir[1])) continue;
                const base = pos.length / 3;
                for (const k of f.corners) {
                    pos.push((cx - meio + k.pos[0]) * px, (gy - meio + k.pos[1]) * px, (k.pos[2] - 0.5) * depth);
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
    const geo = itemRenderMode(item) === 'sprite'
        ? buildSpriteGeo(spritePixels(item.sprite.kind, item.sprite.mat), ITEM_SIZE * 1.6 / 16, ITEM_SIZE * 0.25)
        : block?.render === 'instanced'
            ? createTallGrassGeometry({ THREE }).scale(0.4, 0.4, 0.4)
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
    const mat = itemRenderMode(ITEMS[id]) === 'sprite' ? spriteMaterial :
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
    if (!playing()) return;
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
// Quando o braço deu o último golpe em bicho (segundos). É a cadência **do
// jogador**, e não de cada bicho: um swing, um golpe.
let lastAttackAt = -Infinity;

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
    // Quebra instantânea (grama alta) dura um quadro: o laço de mineração não
    // chega a aparecer, então o golpe é o que mostra o braço batendo.
    startPunch(handAnim);
    // Tom variando a cada golpe (mesma faixa dos passos): sem isso dois blocos
    // iguais seguidos soam como um clique repetido.
    const breakSound = materialSoundName(type, 'break');
    if (breakSound) audio.play(breakSound, { rate: stepPitch() });
    haptic('break');
}

/**
 * Folga do bloco na mira para o golpe em bicho.
 *
 * O limite continua valendo (não dá para bater em quem está atrás de uma
 * parede), mas com um dedo de folga: mirando no lombo do bicho a linha segue e
 * encontra o chão logo **atrás** dele, e sem folga o bloco "na frente" comia o
 * clique — era por isso que o golpe parecia não fazer nada.
 */
const MOB_HIT_BLOCK_SLACK = 0.75;

/**
 * Lascas no ponto do golpe: a cor do bicho (a lã da ovelha, o pó do Mofim) e um
 * estouro mais junto e mais curto que o de um bloco quebrado.
 */
function mobHitPuff(entity, count = 6) {
    if (!entity) return;
    const color = entity.woolMaterial?.color?.getHex?.() ?? DUST_COLOR;
    const y = (Number.isFinite(entity.visualY) ? entity.visualY : entity.y)
        + (Number.isFinite(entity.bodyOffset) ? entity.bodyOffset : 0.45);
    breakParticles.spawn(entity.x, y, entity.z, null, { color, count, spread: 0.35, speed: 0.65 });
}

// Golpe em bicho. A mira é a da câmera e o alcance é curto: se acertou, o bicho
// se assusta e o bloco que estava atrás dele não é minerado neste quadro (senão
// o golpe viraria uma mineração silenciosa do cenário).
function strikeCreature() {
    if (!leftHeld) return false;
    // Com o dedo na tela a mira é o dedo, não a cruz: o golpe segue a mesma
    // linha que escolheu o bloco.
    if (touchAim.on) creatureAim.copy(touchAim.dir);
    else camera.getWorldDirection(creatureAim);
    // O bloco na mira limita o alcance do golpe — com a folga de
    // `MOB_HIT_BLOCK_SLACK`, para o bicho encostado no chão não perder o clique.
    const aim = { maxDistance: currentHit ? currentHit.dist + MOB_HIT_BLOCK_SLACK : Infinity };
    // Cadência **do braço**: um golpe a cada `ATTACK_COOLDOWN`, com qualquer
    // bicho. Enquanto o braço não volta, o quadro continua sendo do combate —
    // apontar para um bicho nunca vira mineração do bloco atrás dele.
    const agora = performance.now() * 0.001;
    const bichoNaMira = Boolean(
        creatureInReach(sheepSystem.entities, camera.position, creatureAim, aim)
        || creatureInReach(creatureSystem.entities, camera.position, creatureAim, aim),
    );
    if (bichoNaMira && !attackReady(lastAttackAt, agora)) return true;
    // Tesoura na mão: o clique **tosquia** a ovelha em vez de bater. Sem ovelha
    // com lã na mira, o clique segue o caminho normal (o golpe, ou minerar).
    if (ITEMS[inventory.slots[selectedSlot]?.id]?.tool?.type === 'shears') {
        const shorn = sheepSystem.shearAt(camera.position, creatureAim, aim);
        if (shorn) {
            const woolId = ID[SHEEP_WOOL_ITEMS[shorn.coat]];
            spawnItemEntity(woolId, shorn.count,
                new THREE.Vector3(shorn.entity.x, shorn.entity.visualY + 0.55, shorn.entity.z),
                new THREE.Vector3(0, 0.5, 0), 0.25);
            // Tosquiar gasta a tesoura, mas não cansa o jogador como minerar.
            damageTool(selectedSlot, 1);
            audio.play('shear', { gainScale: 0.9, rate: stepPitch() });
            startPunch(handAnim);
            resetMining();
            haptic('punch');
            return true;
        }
    }
    // Golpe na ovelha: tira um de vida, pisca o corpo, empurra e ela corre para
    // longe levando o bando. O quarto golpe derruba (o `onDeath` solta a lã e a
    // carne).
    const golpe = sheepSystem.hitAt(camera.position, creatureAim, aim);
    if (golpe) {
        lastAttackAt = agora;
        mobHitPuff(golpe.entity, golpe.killed ? 12 : 6);
        audio.play('mob-hit', { gainScale: 0.85, rate: golpe.killed ? 0.78 : 1 });
        if (!golpe.killed) {
            // Balido de susto: o mesmo som de perto, mais agudo e mais baixo.
            audio.play('sheep-bleat-near', { gainScale: 0.55, rate: 1.24 });
        }
        startPunch(handAnim);
        resetMining();
        haptic('punch');
        return true;
    }
    if (!creatureInReach(creatureSystem.entities, camera.position, creatureAim, aim)) return false;
    // Só rouba o quadro da mineração quando o golpe realmente acontece; no
    // cooldown, minerar continua normalmente.
    const mofim = creatureSystem.hitFrom(camera.position, creatureAim, aim);
    if (!mofim) return false;
    lastAttackAt = agora;
    // Impacto do golpe: lascas na cor do pó dele e o baque que faltava no som.
    mobHitPuff(mofim.entity, mofim.killed ? 12 : 6);
    audio.play('mob-hit', { gainScale: 0.85, rate: mofim.killed ? 0.78 : 1 });
    startPunch(handAnim);
    resetMining();
    haptic('punch');
    return true;
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
        // Mesmo intervalo de uma quebra normal: segurando o botão a grama cai
        // no ritmo do braço (antes o botão era solto e o braço parava na hora).
        mining.cooldown = 0.2;
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
const handAnim = createHandAnimation();
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
    if (itemRenderMode(item) === 'sprite') {
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
                ? createTallGrassGeometry({ THREE }).scale(0.4, 0.4, 0.4)
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
    const miningNow = Boolean(leftHeld && currentHit && currentHit.y !== 0);
    const phaseBefore = handAnim.phase;
    advanceHandAnimation(handAnim, dt, { mining: miningNow });
    if (miningNow) playMiningHits(countStrikes(phaseBefore, handAnim.phase));
    const { swing, dip } = handSwingAmount(handAnim);
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

    // O braço lê a **mesma fase** do som e da câmera: no passo ele desce junto
    // com o corpo e vai e vem de lado no mesmo compasso. Antes era um cronômetro
    // à parte, que podia sair fora de fase do barulho dos pés.
    const gaitNow = gaitPose(gait);
    const ba = gaitNow.amplitude;
    handPivot.position.set(
        HAND_BASE.x + gaitNow.handX * 0.012 * ba - 0.22 * ea,
        HAND_BASE.y + gaitNow.handY * 0.010 * ba - dip - 0.05 * swing + 0.20 * ea + wob,
        HAND_BASE.z - 0.12 * swing + 0.08 * ea);
    handPivot.rotation.set(
        0.35 - 0.9 * swing + 0.35 * ea + gaitNow.handX * 0.02 * ba, 0.25 - 0.3 * ea, 0);
    handPivot.scale.setScalar(1);
}

function updateHeldTorchLight() {
    if (!heldTorchLight || !camera || !world?.water) return;
    // Tocha e lanterna iluminam na mão; cada uma com sua cor, alcance e tremor
    // (a chama tremula, o pó do Mofim é firme). Debaixo d'água, nenhuma das duas.
    const spec = heldLightFor(inventory.slots[selectedSlot]?.id);
    if (!spec || world.water.headInWater) {
        heldTorchLight.intensity = 0;
        return;
    }
    heldTorchLight.color.setHex(spec.color);
    heldTorchLight.distance = spec.distance;
    heldTorchLight.intensity = heldLightIntensity(spec, performance.now() * 0.001);
    heldTorchLight.position.set(spec.offset.x, spec.offset.y, spec.offset.z);
    camera.localToWorld(heldTorchLight.position);
}

// Fontes de luz reais em volta do jogador: a luz assada por voxel dá o degradê
// do cômodo, mas não ilumina o Mofim nem os itens no chão. Aqui as duas fontes
// mais próximas ganham uma PointLight de verdade.
const emitterCandidates = [];
function scanNearbyEmitters(center) {
    emitterCandidates.length = 0;
    const cx = Math.floor(center.x), cy = Math.floor(center.y), cz = Math.floor(center.z);
    const yFrom = Math.max(0, cy - 10), yTo = Math.min(WORLD_HEIGHT - 1, cy + 10);
    for (let x = cx - LIGHT_POOL_RANGE; x <= cx + LIGHT_POOL_RANGE; x++) {
        for (let z = cz - LIGHT_POOL_RANGE; z <= cz + LIGHT_POOL_RANGE; z++) {
            for (let y = yFrom; y <= yTo; y++) {
                const type = world.getBlock(x, y, z);
                if (!type) continue;
                const level = BLOCKS[type]?.light ?? 0;
                if (level > 0) emitterCandidates.push({ x, y, z, level, type });
            }
        }
    }
    return emitterCandidates;
}

function updateEmitterLights(now) {
    if (!emitterLights.length || !camera || !world) return;
    // A busca em caixa custa ~15 mil leituras de bloco; quatro vezes por segundo
    // é imperceptível na luz e cabe folgado no quadro.
    if (now >= emitterScanAt) {
        emitterScanAt = now + 0.25;
        activeEmitters = pickEmitters([
            ...scanNearbyEmitters(camera.position),
            // O Mofim também é fonte de verdade: a luzinha da antena disputa as
            // mesmas duas vagas que tochas e fornalhas (nenhuma luz nova na cena).
            ...creatureEmitterCandidates(
                creatureSystem?.entities ?? [],
                { allowed: creatureLightsAllowed(gfx.mode) },
            ),
        ], { origin: camera.position });
    }
    for (let i = 0; i < emitterLights.length; i++) {
        const light = emitterLights[i];
        const emitter = activeEmitters[i];
        if (!emitter) {
            light.intensity = 0;
            continue;
        }
        light.color.setHex(emitter.color);
        // A criatura anda entre varreduras: seguir a posição dela a cada quadro
        // evita a luz arrastando 250 ms atrás (1,6 bloco no voo de travessia).
        const ponto = emitter.creature ? creatureLightPoint(emitter.entity) : null;
        const px = ponto ? ponto.x : emitter.x;
        const py = ponto ? ponto.y : emitter.y;
        const pz = ponto ? ponto.z : emitter.z;
        light.position.set(px, py, pz);
        // Tremor leve e fora de fase entre as fontes: duas tochas iguais piscando
        // no mesmo ritmo parecem um só fogo.
        const tremor = 0.93 + 0.07 * Math.sin(now * 6.7 + i * 2.3);
        // Criatura: o chilreio incha a luz, e isso tem de aparecer no quadro — a
        // varredura roda a 4 Hz, então o pulso é recalculado aqui.
        light.intensity = emitter.creature
            ? emitterIntensity(
                emitter.level * (1 + MOFIM_PULSE_GAIN * (emitter.entity?.lightPulse ?? 0)),
                Math.hypot(px - camera.position.x, py - camera.position.y, pz - camera.position.z),
            ) * tremor
            : emitter.intensity * tremor;
    }
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

let pauseMenuShown = false;

// =====================================================================
// 4B. CHAT (tecla T)
// =====================================================================
// O estado (log, rascunho, histórico do ↑) vive em world-chat.js e os comandos
// em world-chat-commands.js; aqui ficam o DOM, o teclado e o que cada comando
// faz no jogo. Texto sem barra é fala; com barra, comando.
const chat = createChatState();
// Abrir o chat solta o mouse para digitar. Esse `unlock` não é pausa — mesma
// ideia do `inventoryUnlockPending`, com o mesmo prazo de carência.
let chatUnlockPending = false;
let chatRenderSignature = '';
// Tab: a lista de candidatos vem do catálogo de verdade (itens, blocos, ids).
const chatCompleter = createChatCompleter({ catalog: { ITEMS, BLOCKS, ID } });

function chatNow() {
    return performance.now() * 0.001;
}

function chatInputElement() {
    return document.getElementById('chat-input');
}

/**
 * Abre o chat. `text` já vem preenchido com `/` quando o jogador aperta a barra
 * — é o atalho do Minecraft para comando.
 */
function openChat(text = '') {
    if (chat.open || inventoryOpen || dead || !playing()) return;
    const draft = chat.openChat({ text });
    const form = document.getElementById('chat-form');
    const input = chatInputElement();
    if (form) form.hidden = false;
    if (input) {
        input.value = draft;
        // Foco é o que abre o teclado virtual do celular.
        input.focus({ preventScroll: true });
        try { input.setSelectionRange(draft.length, draft.length); } catch { /* input sem seleção */ }
    }
    if (!touchMode) {
        chatUnlockPending = true;
        controls.unlock();
        setTimeout(() => { chatUnlockPending = false; }, 300);
    }
    resetInputFlags();
    chatCompleter.reset();
    syncPauseMenu();
    renderChat();
    renderChatSuggest();
}

function closeChat({ relock = true } = {}) {
    if (!chat.open) return;
    chat.close();
    const form = document.getElementById('chat-form');
    const input = chatInputElement();
    if (form) form.hidden = true;
    if (input) {
        input.value = '';
        input.blur();
    }
    chatCompleter.reset();
    renderChatSuggest();
    renderChat();
    if (!touchMode && relock) {
        startPlay({ preferMouse: lastPointerKind === 'mouse' });
        return;
    }
    syncPauseMenu();
}

/**
 * O que cada comando pode fazer no jogo. É a única ponte entre o módulo de
 * comandos (puro) e o mundo de verdade.
 */
function chatCommandContext() {
    return {
        getPosition: () => ({ x: player.pos.x, y: player.pos.y, z: player.pos.z }),
        teleport(x, y, z) {
            if (![x, y, z].every(value => Number.isFinite(value))) return false;
            if (y < 0 || y > WORLD_HEIGHT - 2) return false;
            player.pos.set(x, y, z);
            player.vel.set(0, 0, 0);
            player.fallDistance = 0;
            camera.position.set(x, y + player.eye, z);
            return true;
        },
        setTime(fraction) {
            worldClock.time = fraction;
            updateSky();
            return worldClock.time;
        },
        // "minutos" é do relógio do jogo: um dia inteiro são 1440 minutos.
        addTime(minutes) {
            worldClock.advance((minutes * DAY_LENGTH) / 1440);
            updateSky();
            return worldClock.time;
        },
        giveItem(id, count) {
            const leftover = inventory.add(id, count, 0, inventory.slots.length);
            updateHotbarUI();
            return count - Math.max(0, leftover || 0);
        },
        clearInventory() {
            let removed = 0;
            for (let i = 0; i < inventory.slots.length; i++) {
                if (!inventory.slots[i]) continue;
                inventory.slots[i] = null;
                removed++;
            }
            updateHotbarUI();
            return removed;
        },
        killPlayer() {
            invuln = 0;
            takeDamage(999);
        },
        getSeed: () => world.seed,
    };
}

/** Enter: manda a linha (fala ou comando) e fecha o chat. */
function submitChat() {
    const text = chat.send();
    const input = chatInputElement();
    if (input) input.value = '';
    if (!text) { closeChat(); return; }
    const at = chatNow();
    if (text.startsWith(COMMAND_PREFIX)) {
        // O comando digitado fica no log, como no Minecraft: sem isso o jogador
        // não tem como reler o que pediu.
        chat.add(text, { kind: 'input', at });
        const result = runChatCommand(text, chatCommandContext(), { ITEMS, BLOCKS, ID });
        for (const line of result.messages) chat.add(line, { kind: result.ok ? 'system' : 'error', at });
    } else {
        chat.add(`Jogador: ${text}`, { kind: 'say', at });
    }
    chatRenderSignature = '';
    closeChat();
}

/**
 * Desenha o log. Chamado todo quadro: mexer no DOM só quando o texto visível
 * muda (ou quando a linha mais velha apaga) é o que mantém isso barato.
 */
function renderChat() {
    const log = document.getElementById('chat-log');
    if (!log) return;
    const lines = chat.visible(chatNow());
    const signature = `${chat.open ? '1' : '0'}|${lines.map(line => `${line.kind}#${line.text}`).join('\n')}`;
    if (signature === chatRenderSignature) return;
    chatRenderSignature = signature;
    const items = lines.map(line => {
        const item = document.createElement('li');
        item.className = `chat-line ${line.kind}`;
        item.textContent = line.text;
        return item;
    });
    log.replaceChildren(...items);
}

/**
 * A lista de pré-seleção: os candidatos do Tab para o pedaço que está sendo
 * digitado, com o escolhido destacado. Some sozinha quando não há o que sugerir.
 */
function renderChatSuggest() {
    const list = document.getElementById('chat-suggest');
    const input = chatInputElement();
    if (!list || !input) return;
    if (!chat.open) {
        list.hidden = true;
        list.replaceChildren();
        return;
    }
    const state = chatCompleter.suggest(input.value);
    const windowed = visibleSuggestions(state.matches, state.activeIndex);
    if (!windowed.items.length) {
        list.hidden = true;
        list.replaceChildren();
        return;
    }
    const items = windowed.items.map((match, offset) => {
        const index = windowed.offset + offset;
        const item = document.createElement('li');
        item.className = index === state.activeIndex ? 'chat-suggestion active' : 'chat-suggestion';
        item.dataset.index = String(index);
        const value = document.createElement('span');
        value.className = 'chat-suggestion-value';
        value.textContent = match.value;
        item.append(value);
        if (match.hint) {
            const hint = document.createElement('span');
            hint.className = 'chat-suggestion-hint';
            hint.textContent = match.hint;
            item.append(hint);
        }
        return item;
    });
    const restantes = windowed.total - windowed.items.length;
    if (restantes > 0) {
        const more = document.createElement('li');
        more.className = 'chat-suggestion-more';
        more.textContent = `+${restantes} — Tab percorre todas`;
        items.push(more);
    }
    list.hidden = false;
    list.replaceChildren(...items);
}

/** Tab (ou Shift+Tab): põe o próximo candidato na linha, no lugar do pedaço. */
function completeChat(backwards = false) {
    const input = chatInputElement();
    if (!input) return;
    const result = chatCompleter.complete(input.value, { backwards });
    if (result.text !== input.value) {
        input.value = result.text;
        chat.setDraft(result.text);
    }
    try { input.setSelectionRange(input.value.length, input.value.length); } catch { /* sem seleção */ }
    renderChatSuggest();
}

/** Tocar/clicar num nome da lista insere aquele candidato. */
function pickChatSuggestion(index) {
    const input = chatInputElement();
    if (!input) return;
    const state = chatCompleter.suggest(input.value);
    const match = state.matches[index];
    if (!match) return;
    const next = state.base + match.insert;
    input.value = next;
    chat.setDraft(next);
    chatCompleter.reset();
    try { input.setSelectionRange(next.length, next.length); } catch { /* sem seleção */ }
    renderChatSuggest();
}

function syncPauseMenu(overrides = {}) {
    syncTouchUi();
    const state = { locked: playing(), inventoryOpen, dead, chatOpen: chat.open, ...overrides };
    pauseMenuShown = shouldShowPauseMenu(state);
    document.getElementById('menu').style.display = pauseMenuDisplay(state);
    // Pausa de verdade (nem inventário, nem tela de morte): o mundo continua
    // atrás, borrado pelo CSS, e o HUD sai da frente como no Minecraft.
    document.body.classList.toggle('is-paused', pauseMenuShown);
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
        // Acessibilidade: cada slot é uma célula de grade com nome em texto e
        // alcançável pelo teclado (um slot por grade fica no Tab, os demais são
        // alcançados com as setas).
        el.setAttribute('role', 'gridcell');
        el.setAttribute('aria-label', 'Vazio');
        el.tabIndex = -1;
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

    const markGrid = (el, columns, label) => {
        if (!el) return;
        el.setAttribute('role', 'grid');
        el.setAttribute('aria-label', label);
        el.dataset.columns = String(columns);
    };
    markGrid(main, 9, 'Inventário');
    markGrid(bar, 9, 'Barra rápida');
    markGrid(craft, 2, 'Grade de criação');
    markGrid(out, 1, 'Resultado da criação');
    markGrid(chestEl, 9, 'Baú');
    markGrid(document.getElementById('fur-in'), 1, 'Forno: entrada');
    markGrid(document.getElementById('fur-fuel'), 1, 'Forno: combustível');
    markGrid(document.getElementById('fur-out'), 1, 'Forno: resultado');
    // HUD: a hotbar continua sem foco (o mouse está travado no jogo), mas cada
    // casinha ganha nome para leitores de tela.
    for (let i = 0; i < 9; i++) document.getElementById(`slot-${i}`)?.setAttribute('role', 'img');
    resetRovingTabIndex();

    const overlay = document.getElementById('inventory');
    overlay.addEventListener('mousedown', onInventoryMouseDown);
    overlay.addEventListener('mousemove', onInventoryMouseMove);
    overlay.addEventListener('keydown', onInventoryKeyDown);
}

/** Um único slot de cada grade fica no Tab; os outros são alcançados com setas. */
function resetRovingTabIndex() {
    for (const gridEl of document.querySelectorAll('#inventory [role="grid"]')) {
        focusableSlots(gridEl).forEach((slot, i) => { slot.tabIndex = i === 0 ? 0 : -1; });
    }
}

function focusableSlots(gridEl) {
    return [...gridEl.querySelectorAll('.islot')].filter(slot => slot.style.display !== 'none');
}

function focusSlot(el) {
    const gridEl = el.closest('[role="grid"]');
    if (gridEl) for (const slot of gridEl.querySelectorAll('.islot')) slot.tabIndex = -1;
    el.tabIndex = 0;
    el.focus();
}

function onInventoryKeyDown(event) {
    if (event.target.closest?.('button, input, textarea, select')) return;
    const el = event.target.closest?.('.islot');
    if (!el) return;
    const gridEl = el.closest('[role="grid"]');
    const slots = gridEl ? focusableSlots(gridEl) : [el];
    const target = nextSlotIndex({
        index: slots.indexOf(el),
        total: slots.length,
        columns: Number(gridEl?.dataset.columns) || 1,
        key: event.key,
    });
    if (target !== null) {
        event.preventDefault();
        focusSlot(slots[target]);
        return;
    }
    const action = keyToSlotAction(event.key, { shiftKey: event.shiftKey });
    if (!action) return;
    event.preventDefault();
    // Feedback visual para quem usa teclado: a pilha segurada e a dica do item
    // aparecem ao lado do slot focado, como se o mouse estivesse em cima dele.
    const rect = el.getBoundingClientRect();
    invMouse.x = rect.left + rect.width / 2;
    invMouse.y = rect.top + rect.height / 2;
    invMouse.seen = true;
    activateSlot(el, action);
    focusSlot(el);
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
    document.getElementById('inv-craft').dataset.columns = String(craftN);
    resetRovingTabIndex();
}

// Conteúdo visual + nome acessível do slot (o rótulo só é regravado quando
// muda, para não acordar leitores de tela à toa).
function refreshSlot(el, stack) {
    updateSlotElement(el, stack);
    const label = slotLabel(stack);
    if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
}

function renderInventory() {
    for (let i = 0; i < 36; i++) {
        const el = invSlotEls[i];
        refreshSlot(el, inventory.slots[i]);
        el.classList.toggle('sel', i === selectedSlot);
    }
    if (station && station.type === 'chest') {
        for (let i = 0; i < 27; i++) refreshSlot(chestSlotEls[i], station.chest.inv.slots[i]);
        craftResult = null;
    } else if (station && station.type === 'furnace') {
        for (let i = 0; i < 3; i++) refreshSlot(furnaceSlotEls[i], station.furnace.inv.slots[i]);
        craftResult = null;
        updateFurnaceBars();
    } else {
        for (let i = 0; i < craftN * craftN; i++) refreshSlot(craftSlotEls[i], craftInv.slots[i]);
        craftResult = matchRecipe(craftInv, craftN);
        refreshSlot(outSlotEl, craftResult);
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

    activateSlot(el, { button: e.button, shiftKey: e.shiftKey });
}

// Uma ativação de slot — vem do mouse ou da tecla Enter/Espaço (ver
// `onInventoryKeyDown`). Recebe só `button`/`shiftKey` para não depender de um
// evento de ponteiro.
function activateSlot(el, { button = 0, shiftKey = false } = {}) {
    const name = el.dataset.inv, i = Number(el.dataset.index);
    invHover = { inv: name, i };

    if (name === 'out') {
        if (button === 0 || button === 2) handleOutputClick({ button, shiftKey });
        renderInventory();
        return;
    }
    if (name === 'furnace') {
        if (station && station.furnace) furnaceClick({ button, shiftKey }, i);
        renderInventory();
        return;
    }

    const target = name === 'craft' ? craftInv : name === 'chest' ? station.chest.inv : inventory;
    const key = name + i;
    if (button === 0) {
        const now = performance.now();
        if (shiftKey && !cursorHeld.stack) {
            if (name === 'main' && station && station.type === 'furnace') quickToFurnace(i);
            else if (name === 'main' && station && station.type === 'chest') invQuickMove(inventory, i, station.chest.inv, 0, 27);
            else if (name === 'main') invQuickMoveToCraft(inventory, craftInv, i, craftN);
            else if (name === 'chest') invQuickMove(station.chest.inv, i, inventory, 0, 36);
            else invQuickMove(craftInv, i, inventory, 0, 36);
        }
        else if (cursorHeld.stack && invLastClick.key === key && now - invLastClick.time < 350) invCollectSame(target, cursorHeld);
        else invLeftClick(target, i, cursorHeld);
        invLastClick = { time: now, key };
    } else if (button === 2) {
        invRightClick(target, i, cursorHeld);
    }
    renderInventory();
}

function openInventory(st = null, { focusFirst = false } = {}) {
    if (!playing() || inventoryOpen) return;
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
    // Aberto pelo teclado: o foco entra direto no primeiro slot do inventário,
    // em vez de começar fora da grade.
    if (focusFirst) {
        const first = document.querySelector('#inv-main .islot');
        if (first) focusSlot(first);
    }
    inventoryUnlockPending = true;
    controls.unlock();
    setTimeout(() => { inventoryUnlockPending = false; }, 300);
    syncTouchUi();
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

    syncTouchUi();
    // No toque não há lock para reaver: o menu já fica escondido por playing().
    if (touchMode) {
        syncPauseMenu();
        return;
    }
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
// Luz real (PointLight) das fontes próximas: pool fixo, ver updateEmitterLights.
let emitterLights = [];
let activeEmitters = [];
let emitterScanAt = 0;

function updateWorldClock(dt) {
    worldClock.advance(dt);
}

function updateSky() {
    worldSky.update({ scene, camera, hemiLight, sunLight, handAmbient, worldTime: worldClock.time });
}

// =====================================================================
// 5E2. AMBIENTE (VENTO E GRILOS)
// =====================================================================
// O ambiente não é trilha: são fases curtas e espaçadas (silêncio, vento,
// grilos, às vezes os dois). Quem decide a fase é world-ambient-sounds.js; aqui
// só se descobre o que existe no lugar/hora e se aplica o resultado com fade.
const ambientState = createAmbientState();
let ambientApplied = { wind: 0, crickets: 0 };

function applyAmbientLevels(levels) {
    // evita reescrever o grafo de áudio a cada quadro: só quando muda de verdade
    if (Math.abs(levels.wind - ambientApplied.wind) < 0.01
        && Math.abs(levels.crickets - ambientApplied.crickets) < 0.01) return;
    ambientApplied = { wind: levels.wind, crickets: levels.crickets };
    audio.setAmbientLevels(ambientApplied);
}

function updateAmbient(dt) {
    // menu, pausa, morte e aba escondida: silêncio. A fase congela, então voltar
    // não recomeça o sorteio do zero.
    if (!playing() || dead || document.hidden) {
        applyAmbientLevels({ wind: 0, crickets: 0 });
        return;
    }
    const availability = ambientAvailability({
        height: player.pos.y,
        night: worldSky.day < 0.35,
        seaLevel: WATER_LEVEL,
    });
    applyAmbientLevels(stepAmbient(ambientState, dt, { availability }));
}

// ---------------------------------------------------------------------
// Vento visível: o capim balança com o mesmo vento que se ouve.
// A intensidade vem da fase do ambiente (já multiplicada pela altitude), com
// rampa — sem isso o capim pararia de um quadro para o outro no fim da fase.
// Pausa, menu e aba escondida congelam o vento em vez de zerá-lo.
const windState = { time: 0, level: 0 };
// Direção do vento do mundo; preenchida em init() (o pó e o capim leem daqui).
let windDirection = { x: 1, z: 0 };

function updateGrassWind(dt) {
    if (!playing() || dead || document.hidden) return;
    windState.time += dt;
    windState.level = windStep(windState.level, windTargetFor(ambientApplied), dt);
    updateWindSway(tallGrassMaterials, windState.time, windState.level);
}

// =====================================================================
// 5E3. CACHOEIRA (O ÚNICO LAÇO QUE DEPENDE DO LUGAR)
// =====================================================================
// Vento e grilos são fases sorteadas; cachoeira é geografia: existe onde há
// água caindo e o volume é a distância. A busca em volta do jogador roda ~3x por
// segundo (alguns milhares de leituras de bloco) e o ganho entra por fade, com
// histerese para não piscar quando o jogador anda na borda do alcance.
const waterfallState = createWaterfallSoundState();
let waterfallTarget = 0;
let waterfallApplied = 0;
let waterfallScanAt = 0;

function updateWaterfall(dt) {
    if (!world || !playing() || dead || document.hidden) {
        waterfallTarget = 0;
    } else {
        const now = performance.now() * 0.001;
        if (now >= waterfallScanAt) {
            waterfallScanAt = now + 0.35;
            waterfallTarget = waterfallGain(scanWaterfall(world, player.pos));
        }
    }
    const step = updateWaterfallSound(waterfallState, waterfallTarget, dt);
    // Mesma economia do ambiente: só reescreve o grafo quando o ganho muda de
    // verdade (um `setTargetAtTime` por quadro reiniciaria o fade sem parar).
    if (step.action === 'stop' || Math.abs(step.gain - waterfallApplied) >= 0.01) {
        waterfallApplied = step.gain;
        audio.setWaterfallLevel(step.gain);
    }
}

// =====================================================================
// 5F. NUVENS VOXEL
// =====================================================================
// =====================================================================
// 6. ESTADO GERAL
// =====================================================================
let camera, scene, renderer, controls, world, creatureSystem, sheepSystem, tallGrassMaterial, tallGrassMaterials = [];
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
const creatureAim = new THREE.Vector3();
const yawEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const look = { yaw: 0, pitch: 0, spikes: 0, maxDelta: 0 };

// =====================================================================
// 4F. TOQUE (SEM POINTER LOCK)
// =====================================================================
// No desktop o jogo começa quando o mouse é capturado; no toque não existe
// pointer lock, então `touchActive` faz o papel de "estou jogando". Um único
// `playing()` decide o que antes era `controls.isLocked`, para não haver duas
// verdades espalhadas pelo arquivo.
const urlParams = new URLSearchParams(location.search);
const touchMode = urlParams.has('touch')
    ? urlParams.get('touch') !== '0'
    : isTouchDevice({
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
        coarsePointer: matchMedia('(pointer: coarse)').matches,
        touchEvent: 'ontouchstart' in window,
    });
let touchActive = false;
// Último tipo de ponteiro usado: decide se "Jogar" pede lock ou vira toque.
let lastPointerKind = 'touch';
if (touchMode) {
    document.body.classList.add('touch-mode');
    const touchHint = document.getElementById('menu-touch-hint');
    if (touchHint) touchHint.style.display = 'block';
}
// Estado do joystick: onde o dedo começou e onde está agora.
const touchStick = { pointerId: null, centerX: 0, centerY: 0, x: 0, y: 0 };
// Arrasto de olhar: um dedo na tela (fora dos controles) gira a câmera. O mesmo
// dedo, se ficar parado, vira toque curto (usar) ou segurar (cavar) — ver
// `touchGesture()` em world-touch-controls.js.
const touchLook = {
    pointerId: null,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    startedAt: 0,
    mode: 'wait',
    holdTimer: 0,
};
// Mira do dedo: quando o jogador toca na tela, o bloco escolhido é o que está
// embaixo do dedo, não o da cruz do centro. Enquanto `touchAim.on` estiver
// ligado, `updateTarget()` mira pela direção do dedo; soltar devolve a mira
// para a câmera.
const touchAim = { on: false, hit: null, dir: new THREE.Vector3() };
// Layout de toque vindo das opções: multiplicador de tamanho (CSS
// `--touch-scale`, que o joystick, os botões e a hotbar leem) e o lado em que
// ficam os controles. É aplicado em `applyGameSettings`, que roda no começo e a
// cada mudança — mexer no ESC muda na hora.
let touchScale = 1;

// Quanto o dedo gira por pixel arrastado: a base de world-touch-controls.js
// multiplicada pela opção "Sensibilidade do olhar" (80% de fábrica). É lida a
// cada mudança de opção, então mexer no ESC gira na hora, sem recarregar.
let touchLookScale = touchLookSensitivity(GAME_SETTINGS);

// Vibração: só no modo toque, só com a opção ligada e só onde o aparelho sabe
// vibrar (o Safari do iPhone não sabe). Padrão e folga mínima vêm de
// world-haptics.js; aqui só se chama `navigator.vibrate`.
const hapticState = createHapticState();
let hapticOn = vibrationEnabled(GAME_SETTINGS);

function haptic(event) {
    if (!touchMode || !hapticOn || !canVibrate(navigator)) return;
    const pattern = hapticPattern(event, hapticState, { now: performance.now() });
    if (pattern) navigator.vibrate(pattern);
}

// Cancelar é diferente de "não vibrar": um padrão longo (dano) pode estar no
// meio quando o jogador pausa ou morre, e ele não pode continuar no bolso.
function stopHaptics() {
    if (canVibrate(navigator)) navigator.vibrate(0);
}

// --- posição livre dos controles ------------------------------------------
// Cada peça guarda um deslocamento em % da tela (world-touch-positions.js). O
// CSS recebe o deslocamento em `--touch-dx/--touch-dy`, somado ao lugar natural
// da grade: quem nunca arrastou nada vê o layout de sempre.
let touchPositions = loadTouchPositions();
let touchEditing = false;

function touchPieceElement(piece) {
    return piece === 'stick'
        ? document.getElementById('touch-stick')
        : document.querySelector(`#touch-ui [data-touch="${piece}"]`);
}

function viewportSize() {
    return { width: window.innerWidth, height: window.innerHeight };
}

function applyTouchPositions() {
    const viewport = viewportSize();
    for (const piece of TOUCH_PIECES) {
        const el = touchPieceElement(piece);
        if (!el) continue;
        const offset = offsetPixels(touchPositions[piece], viewport);
        el.style.setProperty('--touch-dx', `${offset.x.toFixed(1)}px`);
        el.style.setProperty('--touch-dy', `${offset.y.toFixed(1)}px`);
    }
}

// Arrasto de uma peça no modo de edição. O retângulo "natural" (sem
// deslocamento) é medido uma vez no começo: é a partir dele que o clamp sabe
// quanto a peça ainda pode andar antes de sair da tela.
const touchDrag = { pointerId: null, piece: null, el: null, rect: null, natural: null, start: null, offset: null };

function beginPieceDrag(event, piece, el) {
    if (!touchEditing) return false;
    event.preventDefault();
    event.stopPropagation();
    const offset = offsetPixels(touchPositions[piece], viewportSize());
    const rect = el.getBoundingClientRect();
    touchDrag.pointerId = event.pointerId;
    touchDrag.piece = piece;
    touchDrag.el = el;
    touchDrag.rect = { width: rect.width, height: rect.height };
    touchDrag.natural = { left: rect.left - offset.x, top: rect.top - offset.y };
    touchDrag.start = { x: event.clientX, y: event.clientY };
    touchDrag.offset = offset;
    el.classList.add('dragging');
    el.setPointerCapture?.(event.pointerId);
    return true;
}

function movePieceDrag(event) {
    if (touchDrag.pointerId === null || event.pointerId !== touchDrag.pointerId) return;
    event.preventDefault();
    const viewport = viewportSize();
    const next = clampOffsetPx({
        naturalLeft: touchDrag.natural.left,
        naturalTop: touchDrag.natural.top,
        width: touchDrag.rect.width,
        height: touchDrag.rect.height,
        offsetX: touchDrag.offset.x + (event.clientX - touchDrag.start.x),
        offsetY: touchDrag.offset.y + (event.clientY - touchDrag.start.y),
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        margin: TOUCH_EDIT_MARGIN,
    });
    touchPositions[touchDrag.piece] = offsetPercent(next, viewport);
    touchDrag.el?.style.setProperty('--touch-dx', `${next.x.toFixed(1)}px`);
    touchDrag.el?.style.setProperty('--touch-dy', `${next.y.toFixed(1)}px`);
}

function endPieceDrag(event) {
    if (touchDrag.pointerId === null) return;
    if (event && event.pointerId !== touchDrag.pointerId) return;
    touchDrag.el?.classList.remove('dragging');
    touchDrag.pointerId = null;
    touchDrag.piece = null;
    touchDrag.el = null;
    // grava a cada solta: se o navegador fechar, o que ficou arrastado ficou
    touchPositions = saveTouchPositions(touchPositions);
}

// Modo de edição: o mundo fica pausado atrás (borrado), a hotbar sai da frente e
// os controles viram peças arrastáveis. Quem entra é a tela de opções, pelo
// evento TOUCH_EDIT_EVENT.
function setTouchEditing(on) {
    if (!touchMode || touchEditing === on) return;
    // O modo de edição é da pausa: entrar com o mundo correndo deixaria o jogo
    // rodando atrás de peças arrastáveis (e o jogador parado sem saber por quê).
    if (on && playing()) return;
    touchEditing = on;
    document.body.classList.toggle('touch-editing', on);
    endPieceDrag();
    resetInputFlags();
    if (on) applyTouchPositions();
    syncPauseMenu();
}

function applyTouchLayout(settings = GAME_SETTINGS) {
    const state = touchLayoutState(settings);
    touchScale = state.size;
    document.body.classList.toggle('touch-left', state.lefty);
    document.body.classList.toggle('touch-right', !state.lefty);
    document.body.style.setProperty('--touch-scale', String(state.size));
    hapticOn = vibrationEnabled(settings);
    touchLookScale = touchLookSensitivity(settings);
}

function playing() {
    return Boolean(controls?.isLocked) || touchActive;
}

// Zera os mesmos botões lógicos que o teclado controla. Usado ao sair do jogo,
// pausar, abrir inventário e morrer — em qualquer caminho ninguém fica andando
// sozinho com um dedo que já saiu da tela.
function resetInputFlags() {
    moveForward = moveBackward = moveLeft = moveRight = false;
    jumpHeld = swimStrokeLocked = isSprinting = wantToCrouch = false;
    leftHeld = false;
    touchStick.pointerId = null;
    touchStick.x = touchStick.y = 0;
    stopTouchGesture();
    stopHaptics();
    resetMining();
    cancelEating();
    resetTouchStickVisual();
    // Nenhum botão de toque pode ficar desenhado como apertado depois que o
    // dedo saiu, mesmo que a saída tenha vindo de pausa, morte ou inventário.
    for (const button of document.querySelectorAll('.touch-btn.pressed')) {
        button.classList.remove('pressed');
        button.setAttribute('aria-pressed', 'false');
    }
}

function clearTouchAim() {
    touchAim.on = false;
    touchAim.hit = null;
    touchAim.dir.set(0, 0, 0);
}

function stopTouchGesture() {
    if (touchLook.holdTimer) { clearTimeout(touchLook.holdTimer); touchLook.holdTimer = 0; }
    touchLook.pointerId = null;
    touchLook.mode = 'wait';
    clearTouchAim();
}

function resetTouchStickVisual() {
    const knob = document.getElementById('touch-stick-knob');
    if (knob) knob.style.transform = '';
}

// A UI de toque só aparece quando o jogador está de fato jogando por toque —
// menu de pausa, inventário e tela de morte continuam sendo telas de dedo, mas
// sem joystick por cima.
function syncTouchUi() {
    const ui = document.getElementById('touch-ui');
    if (!ui) return;
    const visible = touchMode && (touchActive || touchEditing) && !inventoryOpen && !dead;
    if (ui.hidden !== !visible) ui.hidden = !visible;
    const editBar = document.getElementById('touch-edit-bar');
    if (editBar) editBar.hidden = !touchEditing;
    if (!visible) return;
    // editando, a dica de jogar sai da frente: ali o dedo arrasta peças
    if (touchEditing) return;
    if (ui.dataset.hintShown) return;
    ui.dataset.hintShown = '1';
    setTimeout(() => ui.classList.add('hint-hidden'), 7000);
}
const MAX_EVENT_DELTA = 350;
const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const LOOK_SPEED = 0.002;
// A sensibilidade é lida a cada movimento (a tela de opções pode mudá-la com o
// jogo rodando), então fica numa variável, não numa constante.
let LOOK_SENSITIVITY = GAME_SETTINGS.sensitivity;
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

// A passada: uma fase só para o som do passo, o braço e o balanço da visão.
const gait = createGait();
const cameraRight = new THREE.Vector3();
// Janela do pulo tardio (coyote time): ver player-jump.js.
const jumpState = createJumpState();
const waterAudio = createWaterAudioState();
const audio = getSharedAudio();

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

// Resolução de renderização (world-render-resolution.js). "Janela (nativa)"
// devolve o canvas ao tamanho da tela com a escala de qualidade; uma resolução
// fixa desenha exatamente aqueles pixels e o CSS estica a imagem para a tela
// toda. O navegador não deixa a página mudar a resolução do sistema — o que dá
// para escolher é onde o jogo desenha.
let resolutionMode = GAME_SETTINGS.resolution;
// Tela cheia pedida pela resolução (e não pelo jogador): só saímos dela quando
// formos nós que entramos, para não derrubar um F11 escolhido à mão.
let resolutionFullscreen = false;
// O pedido de tela cheia é assíncrono; arrastar a barra dispara um por degrau,
// e sem esta trava cada passo empilharia outro pedido.
let resolutionFullscreenPending = false;

// A tela de opções grava em world-game-settings e avisa; aqui só se aplica o
// que dá para aplicar sem recarregar o mundo. A distância de render fica de
// fora de propósito: mudar chunks ao vivo é outro assunto (vale no próximo).
const QUALITY_FROM_SETTING = { auto: 'auto', max: 'max', 0.75: 0.75, 0.5: 0.5 };

// Aplica a resolução escolhida no renderer. Em "Janela" é o caminho de sempre
// (tamanho da tela × escala de qualidade); numa resolução fixa o buffer tem
// exatamente aqueles pixels, `pixelRatio` 1, e o CSS estica para a tela toda —
// o mesmo que trocar a resolução num jogo de PC, só que dentro do canvas.
// Maior buffer que a GPU do aparelho aceita. Pedir mais não deixa a imagem
// melhor: o navegador recusa e o resultado fica indefinido.
function deviceRenderLimit() {
    const max = Number(renderer?.capabilities?.maxTextureSize);
    return max > 0 ? max : undefined;
}

function applyRenderResolution({ buffer = true } = {}) {
    if (!renderer) return;
    const target = renderTarget(resolutionMode, {
        width: window.innerWidth,
        height: window.innerHeight,
        scale: gfx.scale,
        limit: deviceRenderLimit(),
    });
    const canvasEl = renderer.domElement;
    if (buffer) renderer.setPixelRatio(target.pixelRatio);
    if (target.auto) {
        canvasEl.style.removeProperty('display');
        if (buffer) renderer.setSize(target.width, target.height);
    } else {
        // `updateStyle = false`: o tamanho do buffer é nosso, o CSS também
        if (buffer) renderer.setSize(target.width, target.height, false);
        canvasEl.style.display = 'block';
        canvasEl.style.width = `${window.innerWidth}px`;
        canvasEl.style.height = `${window.innerHeight}px`;
    }
    // a câmera enxerga a proporção do buffer; o esticamento vem depois, no CSS
    const aspect = renderAspect(target);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // a mão é desenhada noutra cena; ela precisa da mesma proporção
    if (handCamera) {
        handCamera.aspect = aspect;
        handCamera.updateProjectionMatrix();
    }
}

// O navegador não muda a resolução da janela, mas deixa a página ocupar a tela
// toda — então escolher uma resolução fixa pede tela cheia. Só aqui, num clique
// do jogador (o navegador exige gesto) e só quando a escolha muda de verdade.
function requestResolutionFullscreen(value) {
    const fixed = resolutionSize(value) !== null;
    try {
        if (fixed && !document.fullscreenElement && !resolutionFullscreenPending) {
            resolutionFullscreen = true;
            resolutionFullscreenPending = true;
            const request = document.documentElement.requestFullscreen?.();
            if (request && typeof request.then === 'function') {
                request.then(
                    () => { resolutionFullscreenPending = false; },
                    () => { resolutionFullscreenPending = false; resolutionFullscreen = false; },
                );
            } else {
                resolutionFullscreenPending = false;
            }
        } else if (!fixed && resolutionFullscreen && document.fullscreenElement) {
            resolutionFullscreen = false;
            document.exitFullscreen?.()?.catch?.(() => {});
        }
    } catch {
        // Safari de iPhone não tem requestFullscreen: a resolução vale, a tela cheia não
        resolutionFullscreen = false;
    }
}

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) resolutionFullscreen = false;
});

// O aviso diz o tamanho que foi aplicado de verdade: num aparelho que não
// aceita 4K, o jogo desenha no teto da GPU e a mensagem conta isso.
function resolutionMessage(value) {
    if (resolutionSize(value) === null) return `Resolução: ${resolutionLabel(value)}`;
    const target = renderTarget(value, { limit: deviceRenderLimit() });
    const applied = `${target.width}×${target.height}`;
    return target.clamped ? `Resolução: ${applied} (limite do aparelho)` : `Resolução: ${applied}`;
}

let appliedRenderDistance = GAME_SETTINGS.renderDistance;
function applyGameSettings(settings, { quiet = false } = {}) {
    GAME_SETTINGS.sensitivity = settings.sensitivity;
    GAME_SETTINGS.fov = settings.fov;
    GAME_SETTINGS.volume = settings.volume;
    // Toque: lado e tamanho dos controles valem na hora, inclusive com o dedo
    // já no joystick (o raio é lido a cada movimento).
    applyTouchLayout(settings);
    LOOK_SENSITIVITY = settings.sensitivity;
    audio.setVolume?.(settings.volume);
    const mode = QUALITY_FROM_SETTING[settings.graphics];
    if (mode !== undefined && gfx.mode !== mode) gfx.setMode(mode, { quiet });
    // Resolução de renderização: vale na hora, e numa resolução fixa pede tela
    // cheia (esticar para a janela pequena não é o que o jogador escolheu).
    const resolutionChanged = settings.resolution !== resolutionMode;
    resolutionMode = settings.resolution;
    GAME_SETTINGS.resolution = settings.resolution;
    applyRenderResolution();
    if (resolutionChanged) {
        requestResolutionFullscreen(resolutionMode);
        if (!quiet) showToast(resolutionMessage(resolutionMode), 3000);
    }
    // A distância de render é a única que não muda com o mundo rodando. Em vez
    // de escrever isso na tela o tempo todo, avisa no momento em que muda.
    if (settings.renderDistance !== appliedRenderDistance) {
        appliedRenderDistance = settings.renderDistance;
        if (!quiet) showToast('Distância de render vale ao entrar no próximo mundo');
    }
}
applyGameSettings(GAME_SETTINGS, { quiet: true });
onGameSettingsChange(settings => applyGameSettings(settings));
applyTouchPositions();

// A tela de opções mora em outro módulo (world-menu.js): o pedido de edição e o
// "Restaurar padrões" chegam aqui por evento no documento.
document.addEventListener(TOUCH_EDIT_EVENT, () => setTouchEditing(true));
document.addEventListener(TOUCH_RESET_EVENT, () => {
    touchPositions = loadTouchPositions();
    applyTouchPositions();
});
// Girar o celular muda a relação % ↔ px: reaplica em vez de deixar a peça torta.
window.addEventListener('resize', applyTouchPositions);

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
    setAriaLabel(breathBar, statusLabels({
        health, hunger, breath, maxHealth: MAX_HEALTH, maxHunger: MAX_HUNGER, maxBreath: MAX_BREATH,
    }).breath);
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
    const labels = statusLabels({
        health, hunger, breath, maxHealth: MAX_HEALTH, maxHunger: MAX_HUNGER, maxBreath: MAX_BREATH,
    });
    setAriaLabel(healthBar, labels.health);
    setAriaLabel(hungerBar, labels.hunger);
    syncHungerWarning();
}

// As barras são só ícones na tela; o rótulo em texto é o que chega ao leitor de
// tela (e serve de legenda para quem usa zoom alto).
function setAriaLabel(el, label) {
    if (el && el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
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
        setAriaLabel(slot, `${i + 1}: ${slotLabel(inventory.slots[i])}${i === selectedSlot ? ' (selecionado)' : ''}`);
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
    // Som único para ferimento, queda, fome e afogamento; a morte tem o seu.
    // Dano bloqueado por invulnerabilidade sai antes, sem som.
    const sound = damageSoundFor({ damage: amount, dead: health <= 0 });
    if (sound) audio.play(sound.name, { gainScale: sound.gainScale, rate: stepPitch() });
    haptic('hurt');
    if (health <= 0) die(source);
}

function die(source = 'generic') {
    if (inventoryOpen) closeInventory(false);
    if (chat.open) closeChat({ relock: false });
    dead = true;
    touchActive = false;
    resetInputFlags();
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
            if (dead) {
                btn.disabled = false; btn.textContent = 'Renascer';
                // Só leva o foco para o botão se o jogador ainda estiver na tela
                // de morte (não rouba o foco de quem já navegou para outro lugar).
                if (deathEl.contains(document.activeElement) || document.activeElement === document.body) btn.focus();
            }
        })
        .catch(error => console.error('Falha ao preparar o respawn:', error));
    deathEl.style.display = 'flex';
    deathEl.focus();
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
Desenho: ${renderer.info.render.calls} chamadas | ${(renderer.info.render.triangles / 1000).toFixed(0)}k triângulos | escala de render ${gfx.scale.toFixed(2)} (${gfx.auto ? 'auto' : 'manual'}) · resolução ${resolutionLabel(resolutionMode)} · F4 muda`;
}

// =====================================================================
// 8. COLISÃO (AABB x VOXELS)
// =====================================================================
// O corpo do jogador é sempre o mesmo raio/altura: os wrappers abaixo só
// completam os argumentos que a simulação carrega junto (mundo e estado atual).
function collides(x, y, z, height) {
    return collidesInWorld(world, x, y, z, height, PLAYER_RADIUS);
}

function unstickPlayer() {
    return unstickInWorld(world, player.pos, player.height, PLAYER_RADIUS);
}

function moveAxis(axis, amount, keepOnGround = false) {
    return movePlayerAxis(world, player.pos, axis, amount, player.height, PLAYER_RADIUS, { keepOnGround });
}

function intersectsPlayer(bx, by, bz) {
    return playerIntersectsBlock(player.pos, player.height, bx, by, bz, PLAYER_RADIUS);
}

// =====================================================================
// 9. RAYCAST POR VOXELS (DDA)
// =====================================================================
const touchRaycaster = new THREE.Raycaster();
const touchNdc = new THREE.Vector2();

// Mira do dedo: o bloco escolhido é o que está embaixo do toque, e não o da
// cruz do centro. Guarda também a direção para o golpe no Mofim usar a mesma
// linha — senão o bicho apanharia sem estar na frente do dedo.
function aimAtScreen(clientX, clientY) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const ndc = ndcFromPoint(clientX, clientY, width, height);
    touchNdc.set(ndc.x, ndc.y);
    touchRaycaster.setFromCamera(touchNdc, camera);
    touchAim.on = true;
    touchAim.dir.copy(touchRaycaster.ray.direction);
    updateTarget();
}

function updateTarget() {
    if (touchAim.on) {
        // A mira do dedo é uma direção, não um bloco congelado: quebrar um bloco
        // não pode deixar o alvo apontando para o buraco que ficou no lugar.
        currentHit = raycastVoxels(camera.position, touchAim.dir, REACH, WORLD_RAYCAST_ACCESS);
        touchAim.hit = currentHit;
    } else {
        camera.getWorldDirection(tmpDir);
        currentHit = raycastVoxels(camera.position, tmpDir, REACH, WORLD_RAYCAST_ACCESS);
    }
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
    // Splash/saída/mergulho: só a transição soa, sem laço contínuo de água.
    const waterSound = waterSoundFor(waterAudio, {
        inWater,
        headInWater: world.water.headInWater,
        fallSpeed: player.vel.y,
    });
    if (waterSound) audio.play(waterSound.name, { gainScale: waterSound.gainScale, rate: stepPitch() });
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
    let jumpedNow = false;
    if (inWater) {
        if (wantsDive) {
            player.vel.y = Math.max(player.vel.y - 12.0 * dt, -3.2);
        } else if (atWaterSurface && jumpHeld && !swimStrokeLocked) {
            player.vel.y = Math.max(player.vel.y, 3.2);
            swimStrokeLocked = true;
            audio.play('swim-stroke', { rate: stepPitch() });
        } else if (world.water.headInWater && jumpHeld && !swimStrokeLocked) {
            player.vel.y += 15.0 * dt;
            if (player.vel.y > 4.0) player.vel.y = 4.0; // Velocidade terminal subindo
            audio.play('swim-stroke', { rate: stepPitch() });
        }
        player.vel.y *= Math.exp(-5.0 * dt); // Arrasto estável mesmo com variação no FPS
        player.vel.y -= (GRAVITY * 0.1) * dt;    // Gravidade muito fraca (simula peso d'água)
    } else {
        // `onGround` aqui é o apoio do quadro anterior: por isso a janela do
        // pulo tardio também vale (sair da borda e apertar logo depois).
        if (jumpHeld && !swimStrokeLocked && !isCrouching && canJumpFrom(jumpState, { onGround: player.onGround })) {
            player.vel.y = JUMP_SPEED;
            player.onGround = false;
            jumpedNow = true;
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

    // Agachado e apoiado no chão, o corpo não sai andando pelo vazio: dá para
    // espiar a beirada (e chegar perto do Mofim sem assustar) sem cair.
    const guardEdge = isCrouching && player.onGround && !inWater;
    if (moveAxis('x', player.vel.x * dt, guardEdge)) player.vel.x = 0;
    if (moveAxis('z', player.vel.z * dt, guardEdge)) player.vel.z = 0;

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

    // Com o apoio do quadro já resolvido, a janela do pulo tardio é recarregada
    // (no chão), fechada (pulou / nadando) ou escorrida (no ar).
    updateJumpWindow(jumpState, { dt, onGround: player.onGround, jumped: jumpedNow, inWater });

    // A passada anda primeiro: o balanço deste quadro é o mesmo que decide se o
    // passo soa agora.
    const passos = updateGait(dt, inWater);

    const targetEye = isCrouching ? EYE_CROUCH : EYE_STAND;
    player.eye += (targetEye - player.eye) * Math.min(1, 15 * dt);
    const pose = gaitPose(gait);
    camera.position.set(p.x, p.y + player.eye, p.z);
    if (pose.amplitude > 0) {
        // O vai e vem é para os **lados da câmera**, não para os lados do mundo:
        // olhando para o norte, o corpo continua balançando nas laterais de quem
        // anda.
        cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        camera.position.addScaledVector(cameraRight, pose.sway);
        camera.position.y += pose.bobY;
    }
    // A rolagem do balanço é do olhar: reaplica o quatérnio com ela.
    applyLook();

    const hzSpeed = Math.hypot(player.vel.x, player.vel.z);
    if ((player.onGround || inWater) && hzSpeed > 0.1 && sprintNow && !isCrouching) {
        addExhaustion(hzSpeed * dt * 0.1);
    }

    playFootsteps(passos);
}

// Batida de cada golpe enquanto o bloco não cai. A cadência vem da fase do
// braço (countStrikes), então o som casa com o movimento sem cronômetro extra.
function playMiningHits(strikes) {
    if (!strikes || !currentHit) return;
    // Grama alta cai no primeiro quadro: a batida só atrapalharia o som de quebra.
    if (currentHit.type === ID.TALL_GRASS) return;
    const sound = materialSoundName(currentHit.type, 'hit');
    if (!sound) return;
    for (let i = 0; i < strikes; i++) audio.play(sound, { rate: stepPitch() });
}

// Onde os pés estão agora, para medir quanto se andou no quadro.
const footPos = { x: null, z: null };

// Avança a passada (fase, amplitude e passos) a partir do deslocamento real e
// devolve quantos passos **soam** neste quadro. O balanço da visão vale também
// nadando; o som do passo não — a água tem som próprio.
function updateGait(dt, inWater) {
    const p = player.pos;
    if (footPos.x === null) {
        footPos.x = p.x;
        footPos.z = p.z;
        return 0;
    }
    // Distância percorrida neste quadro (não a velocidade: empurrar uma parede
    // mantém a velocidade alta com o corpo parado).
    const raw = Math.hypot(p.x - footPos.x, p.z - footPos.z);
    footPos.x = p.x;
    footPos.z = p.z;
    // Respawn e carregamento são teleporte, não caminhada.
    const moved = raw <= STEP_MAX_MOVED ? raw : 0;
    const passos = advanceGait(gait, {
        distance: moved,
        dt,
        onGround: player.onGround,
        inWater,
        sprinting: isSprinting,
        crouching: isCrouching,
    });
    const pisa = stepDistanceThisFrame({ moved, dt, onGround: player.onGround, inWater });
    return pisa > 0 ? passos : 0;
}

// Passos: o som vem do bloco sob os pés; a cadência já veio da passada.
function playFootsteps(steps) {
    if (!steps) return;
    const type = world.getBlock(
        Math.floor(player.pos.x), Math.floor(player.pos.y - 0.05), Math.floor(player.pos.z));
    const sound = stepSoundFor(type);
    if (!sound) return;
    for (let i = 0; i < steps; i++) {
        audio.play(sound, {
            gainScale: isSprinting ? 1.15 : (isCrouching ? 0.6 : 1),
            rate: stepPitch(),
        });
    }
    haptic('step');
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
    // Mantém a data do último save nos metadados do mundo: a lista do menu passa
    // a mostrá-la sem abrir o save inteiro.
    onSaved: data => markWorldSaved(ACTIVE_WORLD.id, data?.time)
        .catch(error => console.warn('Falha ao atualizar a data do save nos metadados:', error)),
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
    // A microinclinação da passada entra junto do olhar: no passo o horizonte
    // joga ~0,3° para um lado e para o outro. Como é rolagem em torno do eixo
    // da frente, o ponto para onde se aponta continua o mesmo.
    lookEuler.set(look.pitch, look.yaw, gaitPose(gait).roll, 'YXZ');
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
function beginTouchPlay() {
    touchActive = true;
    document.body.classList.add('touch-mode');
    syncPauseMenu();
}

// Caminho único de "começar a jogar": toque entra direto, mouse pede lock.
//
// `preferMouse` existe para o notebook com tela de toque: se o jogador apertou
// Jogar com o mouse, ele quer o mouse capturado; se tocou com o dedo, quer o
// joystick. Se o lock falhar mesmo assim, cai no toque em vez de ficar parado.
function startPlay({ preferMouse = false } = {}) {
    if (!touchMode || preferMouse) {
        return requestLock().then(ok => {
            if (ok) return true;
            if (touchMode) { beginTouchPlay(); return true; }
            syncPauseMenu();
            return false;
        });
    }
    beginTouchPlay();
    return Promise.resolve(true);
}

function pauseTouchPlay() {
    if (!touchActive) return;
    touchActive = false;
    resetInputFlags();
    syncPauseMenu();
    saveGame(true);
}

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

    // Luz de verdade das tochas/lanternas próximas. O pool é fixo e entra na
    // cena **antes** de qualquer material ser compilado: mudar a quantidade de
    // luzes depois faria o Three recompilar tudo a cada tocha acesa (engasgo).
    emitterLights = [];
    for (let i = 0; i < LIGHT_POOL_SIZE; i++) {
        const light = new THREE.PointLight(0xffc07a, 0, LIGHT_POOL_RANGE, 2);
        light.castShadow = false;
        scene.add(light);
        emitterLights.push(light);
    }

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
    renderer.info.autoReset = false;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    // já nasce com a resolução escolhida nas opções (Janela = tamanho da tela)
    applyRenderResolution();
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); perf.ctxLost++; showToast('Contexto WebGL perdido (driver/GPU)'); });
    renderer.domElement.addEventListener('webglcontextrestored', () => showToast('Contexto WebGL restaurado'));
    window.addEventListener('resize', () => {
        // Resolução fixa: o buffer continua do mesmo tamanho, só a imagem
        // esticada acompanha a janela (e a tela cheia entra/sai por aqui).
        if (resolutionSize(resolutionMode)) {
            // o buffer continua do mesmo tamanho; só a imagem esticada muda
            applyRenderResolution({ buffer: false });
            return;
        }
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        handCamera.aspect = camera.aspect;
        handCamera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const decorations = new InstancedBlockManager(THREE, scene, { maxCapacity: 2000 });
    // O capim usa PNGs de verdade (não o atlas). A versão na URL é o hash do
    // próprio arquivo, carimbado por `npm run stamp` — trocar a arte muda a URL
    // e nenhum cache consegue devolver o desenho antigo.
    const grassTextureOptions = {
        maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
        mipmaps: renderer.capabilities.isWebGL2,
    };
    const grassTextures = await Promise.all(TALL_GRASS_VARIANTS.map(variant =>
        new THREE.TextureLoader().loadAsync(tallGrassTextureUrl(variant.file)),
    ));
    tallGrassMaterials = grassTextures.map(texture => createTallGrassMaterial(THREE, texture, grassTextureOptions));
    // Vento: uma direção por mundo, sortida da semente. O capim balança com o
    // que se ouve — a intensidade é atualizada todo quadro em updateGrassWind.
    windDirection = windDirectionFor(SEED);
    for (const material of tallGrassMaterials) configureWindSway(material, { direction: windDirection });
    tallGrassMaterial = tallGrassMaterials[1];
    const grassGeometries = TALL_GRASS_VARIANTS.map((_, variant) => createTallGrassGeometry({ THREE, variant }));
    window.testInstancedMesh = () => testInstancedMesh(THREE, renderer);

    world = new World(scene, SEED, decorations, grassGeometries, tallGrassMaterials);
    creatureSystem = new CreatureSystem(world);
    sheepSystem = new SheepSystem(world);
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
    if (!unstickPlayer()) {
        for (let guard = 0; guard < 70 && collides(player.pos.x, player.pos.y, player.pos.z, player.height); guard++) player.pos.y += 1;
    }
    camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
    
    initGameplayAssets();
    updateSky();

    document.addEventListener('mousemove', onLookMove, true);
    controls = new PointerLockControls(camera, document.body);
    const menu = document.getElementById('menu');
    const btnPlay = document.getElementById('btn-play');

    btnPlay.addEventListener('click', () => {
        startPlay({ preferMouse: lastPointerKind === 'mouse' });
    });
    // "Opções…" abre a mesma tela do menu de fora, agora com o jogo pausado
    // atrás. O que dá para aplicar na hora (sensibilidade, visão, volume e
    // gráficos) muda na hora; a distância de render vale no próximo mundo.
    const optionsDialog = document.getElementById('options-dialog');
    document.getElementById('btn-menu-options')?.addEventListener('click', () => {
        if (!optionsDialog) return;
        // o cartão de pausa sai de cena enquanto as opções estão abertas: duas
        // janelas empilhadas pareciam uma atravessando a outra
        document.body.classList.add('options-open');
        optionsDialog.showModal();
    });
    optionsDialog?.addEventListener('close', () => {
        document.body.classList.remove('options-open');
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
    // Chat: Enter envia, Esc fecha sem enviar, ↑/↓ voltam o que já foi enviado.
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    if (chatForm && chatInput) {
        chatForm.addEventListener('submit', (event) => {
            event.preventDefault();
            submitChat();
        });
        chatInput.addEventListener('input', () => {
            chat.setDraft(chatInput.value);
            // Digitou: a volta do Tab recomeça do primeiro candidato.
            chatCompleter.reset();
            renderChatSuggest();
        });
        // A lista é clicável (e tocável no celular). `mousedown` com
        // preventDefault mantém o foco na linha em vez de roubá-lo para a lista.
        document.getElementById('chat-suggest')?.addEventListener('mousedown', (event) => {
            const item = event.target.closest?.('.chat-suggestion');
            if (!item) return;
            event.preventDefault();
            pickChatSuggestion(Number(item.dataset.index));
        });
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                event.preventDefault();
                completeChat(event.shiftKey);
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                closeChat();
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                submitChat();
                return;
            }
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                chatInput.value = chat.recall(event.key === 'ArrowUp' ? -1 : 1);
                chat.setDraft(chatInput.value);
                try { chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length); } catch { /* sem seleção */ }
            }
        });
    }

    controls.addEventListener('lock', () => syncPauseMenu({ locked: true }));
    renderer.domElement.addEventListener('click', () => {
        // Com o chat aberto, clicar na tela não pode recapturar o mouse no meio
        // da digitação.
        if (!playing() && !inventoryOpen && !dead && !chat.open && menu.style.display === 'none') {
            startPlay({ preferMouse: lastPointerKind === 'mouse' });
        }
    });
    document.getElementById('btn-respawn').addEventListener('click', () => {
        dead = false;
        deathEl.style.display = 'none';
        syncPauseMenu();
        startPlay();
    });
    controls.addEventListener('unlock', () => {
        const inventoryExit = inventoryOpen || inventoryUnlockPending;
        inventoryUnlockPending = false;
        syncPauseMenu({ locked: false });
        resetInputFlags();
        saveGame(true);
        if (inventoryExit) return;
        // Soltar o mouse para digitar no chat também não é pausa: o mundo segue.
        if (chat.open || chatUnlockPending) return;
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
        // Com o chat aberto, o teclado é dele (inclusive o T que abriu).
        if (chat.open) return;
        if (inventoryOpen) { handleInventoryKey(event); return; }
        if (!controls.isLocked) return;
        switch (event.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyD': moveRight = true; break;
            case 'Space': jumpHeld = true; break;
            case 'KeyQ': dropSelectedItem(); break;
            case 'KeyE': if (!event.repeat) openInventory(null, { focusFirst: true }); break;
            // T abre o chat vazio; a barra abre já com o `/`, para comando.
            case 'KeyT': if (!event.repeat) { event.preventDefault(); openChat(); } break;
            case 'Slash': if (!event.repeat) { event.preventDefault(); openChat(COMMAND_PREFIX); } break;
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

    document.addEventListener('pointerdown', (event) => {
        lastPointerKind = event.pointerType || 'mouse';
    }, true);

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Ação do "usar": o botão direito do mouse e o botão Usar do toque precisam
    // fazer exatamente a mesma coisa — estação, porta, comida ou colocar bloco.
    function useHeldItem({ sneaking = false } = {}) {
        updateTarget();

        const held = inventory.slots[selectedSlot];
        const station = currentHit && BLOCKS[currentHit.type].station;
        const door = Boolean(currentHit && woodDoorPart(currentHit.type));
        const food = Boolean(held && ITEMS[held.id].food);
        const intent = rightClickIntent({ sneaking, station, door, food });

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
            startPunch(handAnim);
            const placeSound = materialSoundName(placedType, 'place');
            if (placeSound) audio.play(placeSound, { rate: stepPitch() });
            haptic('place');
        } else if (placedType === ID.WOOD_DOOR_BOTTOM) {
            showToast('A porta precisa de apoio sólido e de dois blocos livres');
        }
    }

    document.addEventListener('mousedown', (event) => {
        if (!playing()) return;
        if (event.button === 0) { leftHeld = true; return; }
        if (event.button !== 2) return;
        useHeldItem({ sneaking: event.shiftKey || wantToCrouch });
    });

    document.addEventListener('mouseup', (event) => {
        if (event.button === 0) leftHeld = false;
        if (event.button === 2) cancelEating();
    });

    // --- controles de toque ---------------------------------------------
    // Um dedo no joystick move (mesmos botões do WASD), um dedo arrastando na
    // tela olha (mesmo `look` do mouse) e os botões da direita fazem o resto.
    function setupTouchControls() {
        const ui = document.getElementById('touch-ui');
        const stick = document.getElementById('touch-stick');
        const knob = document.getElementById('touch-stick-knob');
        const canvas = renderer.domElement;
        if (!ui || !stick || !knob) return;

        function applyStick(dx, dy) {
            // O raio cresce com o tamanho escolhido nas opções: empurrar "até o
            // fim" tem de ser o mesmo gesto proporcional no joystick pequeno e
            // no grande.
            const radius = touchStickRadius(touchScale);
            const vector = stickVector(dx, dy, radius);
            touchStick.x = vector.x;
            touchStick.y = vector.y;
            const move = movementFromStick(vector);
            moveForward = move.forward;
            moveBackward = move.backward;
            moveLeft = move.left;
            moveRight = move.right;
            isSprinting = move.sprint;
            knob.style.transform =
                `translate(${(vector.x * radius).toFixed(1)}px, ${(vector.y * radius).toFixed(1)}px)`;
        }

        function releaseStick() {
            touchStick.pointerId = null;
            touchStick.x = touchStick.y = 0;
            moveForward = moveBackward = moveLeft = moveRight = isSprinting = false;
            resetTouchStickVisual();
        }

        stick.addEventListener('pointerdown', (event) => {
            if (touchEditing) return; // editando, o dedo move a peça, não o jogador
            if (!playing() || inventoryOpen || touchStick.pointerId !== null) return;
            event.preventDefault();
            touchStick.pointerId = event.pointerId;
            // o centro é onde o dedo encostou: um toque no meio do disco não anda
            touchStick.centerX = event.clientX;
            touchStick.centerY = event.clientY;
            stick.setPointerCapture?.(event.pointerId);
            applyStick(0, 0);
        });
        stick.addEventListener('pointermove', (event) => {
            if (event.pointerId !== touchStick.pointerId) return;
            event.preventDefault();
            applyStick(event.clientX - touchStick.centerX, event.clientY - touchStick.centerY);
        });
        for (const type of ['pointerup', 'pointercancel']) {
            stick.addEventListener(type, (event) => {
                if (event.pointerId !== touchStick.pointerId) return;
                releaseStick();
            });
        }

        // Dedo na tela, em qualquer ponto livre (os controles têm
        // `pointer-events: auto` e consomem o próprio dedo). Três gestos saem do
        // mesmo dedo, como no Minecraft de celular:
        //   - arrastar  → olhar em volta (o mesmo `look` do mouse);
        //   - toque curto parado → usar/colocar no bloco sob o dedo;
        //   - segurar parado → cavar o bloco sob o dedo.
        // A mira é o ponto tocado, não a cruz do centro: o dedo é a mira.
        function gestureAt(event, released = false) {
            return touchGesture({
                dx: event.clientX - touchLook.startX,
                dy: event.clientY - touchLook.startY,
                elapsed: performance.now() - touchLook.startedAt,
                released,
            });
        }

        function startBreaking() {
            touchLook.mode = 'hold';
            aimAtScreen(touchLook.startX, touchLook.startY);
            leftHeld = true;
            pressButton('break', true);
        }

        function endGesture() {
            if (touchLook.holdTimer) { clearTimeout(touchLook.holdTimer); touchLook.holdTimer = 0; }
            if (touchLook.mode === 'hold') {
                leftHeld = false;
                pressButton('break', false);
            }
            touchLook.pointerId = null;
            touchLook.mode = 'wait';
            clearTouchAim();
            updateTarget();
        }

        canvas.addEventListener('pointerdown', (event) => {
            if (touchEditing) return; // o fundo não faz nada enquanto se arrasta peças
            if (!playing() || event.pointerType === 'mouse' || touchLook.pointerId !== null) return;
            event.preventDefault();
            touchLook.pointerId = event.pointerId;
            touchLook.lastX = touchLook.startX = event.clientX;
            touchLook.lastY = touchLook.startY = event.clientY;
            touchLook.startedAt = performance.now();
            touchLook.mode = 'wait';
            canvas.setPointerCapture?.(event.pointerId);
            // O relógio não pode depender de `pointermove`: um dedo parado não
            // gera evento nenhum, e sem este timer segurar nunca viraria cavar.
            touchLook.holdTimer = setTimeout(() => {
                if (playing() && touchLook.pointerId === event.pointerId && touchLook.mode === 'wait') startBreaking();
            }, TOUCH_HOLD_MS);
        });
        canvas.addEventListener('pointermove', (event) => {
            if (event.pointerId !== touchLook.pointerId) return;
            event.preventDefault();
            if (touchLook.mode === 'hold') {
                // Segurando, o dedo anda e a mira acompanha: cavar uma fileira.
                aimAtScreen(event.clientX, event.clientY);
                touchLook.lastX = event.clientX;
                touchLook.lastY = event.clientY;
                return;
            }
            if (gestureAt(event) === 'look') touchLook.mode = 'look';
            if (touchLook.mode !== 'look') return;
            const next = lookAfterDrag(look, event.clientX - touchLook.lastX, event.clientY - touchLook.lastY, {
                sensitivity: touchLookScale,
                maxPitch: MAX_PITCH,
            });
            touchLook.lastX = event.clientX;
            touchLook.lastY = event.clientY;
            look.yaw = next.yaw;
            look.pitch = next.pitch;
            applyLook();
        });
        canvas.addEventListener('pointerup', (event) => {
            if (event.pointerId !== touchLook.pointerId) return;
            const gesture = gestureAt(event, true);
            if (gesture === 'tap') {
                // Toque curto: o mesmo "usar" do botão direito do mouse, só que
                // no bloco que o dedo escolheu.
                aimAtScreen(event.clientX, event.clientY);
                useHeldItem({ sneaking: wantToCrouch });
            }
            endGesture();
        });
        canvas.addEventListener('pointercancel', (event) => {
            if (event.pointerId === touchLook.pointerId) endGesture();
        });

        // Botões de ação.
        function pressButton(id, pressed) {
            const button = ui.querySelector(`[data-touch="${id}"]`);
            if (!button) return;
            button.classList.toggle('pressed', pressed);
            button.setAttribute('aria-pressed', String(pressed));
        }
        for (const button of ui.querySelectorAll('[data-touch]')) {
            const id = button.dataset.touch;
            const hold = id === 'jump' || id === 'break';
            button.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                if (touchEditing) return; // editando, o botão é peça e não ação
                if (!playing()) return;
                haptic('button');
                button.setPointerCapture?.(event.pointerId);
                if (id === 'jump') { jumpHeld = true; pressButton(id, true); return; }
                if (id === 'break') { leftHeld = true; pressButton(id, true); return; }
                if (id === 'use') useHeldItem({ sneaking: wantToCrouch });
                else if (id === 'crouch') {
                    wantToCrouch = !wantToCrouch;
                    pressButton(id, wantToCrouch);
                } else if (id === 'inventory') openInventory(null);
                else if (id === 'chat') openChat();
                else if (id === 'pause') pauseTouchPlay();
            });
            if (!hold) continue;
            for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
                button.addEventListener(type, () => {
                    if (id === 'jump') { jumpHeld = false; swimStrokeLocked = false; }
                    else leftHeld = false;
                    pressButton(id, false);
                });
            }
        }

        // --- modo de edição: cada peça arrasta para onde o jogador quiser ---
        // Fora do modo de edição `beginPieceDrag` devolve false na hora: os
        // mesmos elementos continuam sendo joystick e botões de ação.
        for (const piece of TOUCH_PIECES) {
            const el = touchPieceElement(piece);
            if (!el) continue;
            el.addEventListener('pointerdown', (event) => beginPieceDrag(event, piece, el));
        }
        document.addEventListener('pointermove', movePieceDrag, { passive: false });
        document.addEventListener('pointerup', endPieceDrag);
        document.addEventListener('pointercancel', endPieceDrag);

        document.getElementById('btn-touch-positions-done')?.addEventListener('click', () => setTouchEditing(false));
        document.getElementById('btn-touch-positions-reset')?.addEventListener('click', () => {
            touchPositions = emptyTouchPositions();
            touchPositions = saveTouchPositions(touchPositions);
            applyTouchPositions();
        });

        // Hotbar: no toque não existe roda do mouse, então cada casa é um botão.
        for (let i = 0; i < 9; i++) {
            const slot = document.getElementById(`slot-${i}`);
            slot?.addEventListener('pointerdown', (event) => {
                if (!playing() || inventoryOpen) return;
                event.preventDefault();
                selectSlot(i);
            });
        }
    }

    if (touchMode) setupTouchControls();

    setInterval(() => { if (playing()) saveGame(true); }, 30000);
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

    // Com o chat aberto o mundo continua rodando (como no Minecraft): o sol
    // anda, a água corre, os bichos vivem. Só o jogador é que fica parado,
    // porque o mouse está solto e as teclas vão para a linha de digitação.
    const worldRunning = playing() || chat.open;
    if (worldRunning) {
        updatePhysics(dt);
        // O Mofim é bicho de noite: o céu diz a hora (1 = noite fechada) e ele
        // aparece ao anoitecer / vai embora ao amanhecer.
        creatureSystem.update(dt, { pos: player.pos, vel: player.vel, crouching: isCrouching }, true,
            { night: 1 - worldSky.day });
        // A ovelha é o contrário: de dia ela está no pasto (`worldSky.day` perto
        // de 1). Mansa, mas desconfiada: o jogador chegando rápido (e não
        // agachado) faz o bando parar e encarar.
        sheepSystem.update(dt, { pos: player.pos, vel: player.vel, crouching: isCrouching }, true,
            { day: worldSky.day });
        updateSurvival(dt);
        updateItemEntities(dt);
        breakParticles.update(dt);
    }
    // Mirar, cavar e comer são do mouse: com o chat aberto não há mouse no jogo.
    if (playing()) {
        updateTarget();
        if (!strikeCreature()) updateMining(dt);
        updateEating(dt);
    }
    world.water.updateSubmersion(world, player);
    world.water.update(world, dt, now);

    if (worldRunning || inventoryOpen) {
        updateWorldClock(dt);
        updateFurnaces(dt);
        world.furnaceSmoke.update(dt, furnaces, world, player.pos);
        if (inventoryOpen && station && station.type === 'furnace') {
            if (furnaceDirty) { furnaceDirty = false; renderInventory(); }
            else updateFurnaceBars();
        }
    }
    updateSky();
    updateEmitterLights(now * 0.001);
    
    // Override da visão embaixo d'água
    if (world.water.headInWater) {
        scene.fog.color.setHex(0x113366);
        scene.fog.near = 0.1;
        scene.fog.far = 15;
        scene.background.setHex(0x113366); 
    }
    
    if (worldRunning || inventoryOpen) worldClouds.update(dt, camera);
    else worldClouds.update(0, camera);
    // O chat desenha todo quadro, mas só mexe no DOM quando o texto muda (o que
    // inclui a linha que apaga sozinha).
    renderChat();
    updateHand(dt);
    updateAmbient(dt);
    updateGrassWind(dt);
    updateWaterfall(dt);
    if (hurtFlash > 0) { hurtFlash = Math.max(0, hurtFlash - dt * 2); hurtEl.style.opacity = hurtFlash; }
    world.update(player.pos.x, player.pos.z);
    updateDebug(rawDt);

    // Com resolução fixa quem manda é ela: a escala automática fica guardada
    // para quando o jogador voltar para "Janela (nativa)".
    const pendingScale = gfx.consumePending();
    if (pendingScale !== null && !resolutionSize(resolutionMode)) renderer.setPixelRatio(pendingScale);
    renderer.info.reset();
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    // Pausado, a mão sai do quadro: o fundo do menu é o mundo, sem um braço
    // atravessado na frente.
    if (!pauseMenuShown) renderer.render(handScene, handCamera);

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
