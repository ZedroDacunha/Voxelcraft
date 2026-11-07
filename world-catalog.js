// Blocos, itens, ferramentas, receitas e regras de fundição.
import {
    MINERAL_IDS, MINERAL_PRODUCTS, MINERAL_SMELTING, MINERAL_TOOL_MATERIALS,
} from './world-minerals.js';
import { createMineralBlocks } from './world-mineral-blocks.js';
import { MEAT_IDS, MEATS, MEAT_SMELTING } from './world-meats.js';

export const TILE = { GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, WOOD: 4, COBBLE: 5, LEAVES: 6, PLANKS: 7,
               CRAFT_TOP: 8, CRAFT_SIDE: 9, FURNACE_FRONT: 10, FURNACE_TOP: 11, CHEST_TOP: 12, CHEST_SIDE: 13,
               WOOD_END: 14, COAL_ORE: 15, IRON_ORE: 16, GOLD_ORE: 17, DIAMOND_ORE: 18,
               GRASS_TOP_ALT: 19, GRASS_SIDE_ALT: 20, DIRT_ALT: 21, STONE_ALT: 22, LEAVES_ALT: 23,
               SAND: 24, WATER: 25, TORCH_FLAME: 26, COPPER_ORE: 27, CHEST_FRONT: 28,
               FURNACE_FRONT_ON: 29, FURNACE_SIDE: 30, CHEST_FRONT_OPEN: 31,
               WOOD_DOOR_UPPER: 32, WOOD_DOOR_LOWER: 33, MOFIM_LANTERN: 34,
               WOOL_WHITE: 35, WOOL_GRAY: 36, WOOL_BLACK: 37,
               BED_TOP: 38, BED_SIDE: 39, BED_PILLOW_TOP: 40, BED_PILLOW_SIDE: 41 };
export const TILE_PX = 32;

const allFaces = (t) => ({ top: t, side: t, bottom: t });

export const ID = { GRASS: 1, STONE: 2, LOG: 3, DIRT: 4, COBBLE: 5, PLANKS: 6, LEAVES: 7,
             CRAFTING_TABLE: 8, FURNACE: 9, CHEST: 10,
             COAL_ORE: MINERAL_IDS.COAL_ORE, COAL: MINERAL_IDS.COAL, IRON_ORE: MINERAL_IDS.IRON_ORE,
             GOLD_ORE: MINERAL_IDS.GOLD_ORE, DIAMOND_ORE: MINERAL_IDS.DIAMOND_ORE,
             COPPER_ORE: MINERAL_IDS.COPPER_ORE, IRON_INGOT: MINERAL_IDS.IRON_INGOT,
             GOLD_INGOT: MINERAL_IDS.GOLD_INGOT, COPPER_INGOT: MINERAL_IDS.COPPER_INGOT,
             RAW_COPPER: MINERAL_IDS.RAW_COPPER, RAW_IRON: MINERAL_IDS.RAW_IRON,
             RAW_GOLD: MINERAL_IDS.RAW_GOLD,
             WHEAT_SEEDS: 85,
             SAND: 15, WATER: 16, WATER_FLOW_1: 40, WATER_FLOW_2: 41, WATER_FLOW_3: 42,
             WATER_FLOW_4: 43, WATER_FLOW_5: 44, WATER_FLOW_6: 45, WATER_FLOW_7: 46, WATER_FALL: 47,
             TALL_GRASS: 84,
             STICK: 20, TORCH: 60, TORCH_WALL_XP: 61, TORCH_WALL_XN: 62, TORCH_WALL_ZP: 63, TORCH_WALL_ZN: 64, APPLE: 30, CHARCOAL: 31,
             // 65-73 pertencem às ferramentas de ouro/diamante/cobre; a porta
             // usa uma faixa livre para não colidir com esses IDs de item.
             WOOD_DOOR: 86, WOOD_DOOR_BOTTOM: 87, WOOD_DOOR_TOP: 88,
             WOOD_DOOR_BOTTOM_OPEN: 89, WOOD_DOOR_TOP_OPEN: 90,
             // Recurso do Mofim: o pó luminoso que ele solta e a lanterna que
             // se faz com ele (bloco sólido que emite luz).
             MOFIM_DUST: 91, MOFIM_LANTERN: 92,
             // Lã da ovelha: os blocos (93–95) e os fardos de lã que ela solta
             // ao ser tosquiada (96–98). Quatro fardos da mesma cor viram um
             // bloco. 99 fica com a tesoura, que é item puro (não vira bloco).
             WOOL_BLOCK_WHITE: 93, WOOL_BLOCK_GRAY: 94, WOOL_BLOCK_BLACK: 95,
             WOOL_WHITE: 96, WOOL_GRAY: 97, WOOL_BLACK: 98,
             SHEARS: 99,
             // A cama é **um item e dois blocos**: quebrar qualquer metade
             // devolve uma cama só, e o item entra no mundo pela metade dos pés.
             BED: 117, BED_HEAD: 118, BED_FOOT: 119,
             // As carnes moram em `world-meats.js`: 100–116, oito bichos ×
             // duas entradas (crua e assada). Mob novo que solta carne entra
             // lá, não aqui.
             ...MEAT_IDS };

export const BLOCKS = {
    [ID.GRASS]: { name: 'Grama',      hardness: 0.6, drop: ID.DIRT,   tool: 'shovel', tiles: { top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, bottom: TILE.DIRT } },
    [ID.STONE]: { name: 'Pedra',      hardness: 1.5, drop: ID.COBBLE, tool: 'pickaxe', requiresTool: true, minTier: 1, tiles: allFaces(TILE.STONE) },
    [ID.LOG]: { name: 'Madeira',    hardness: 2.0, drop: ID.LOG,    tool: 'axe',    tiles: { top: TILE.WOOD_END, side: TILE.WOOD, bottom: TILE.WOOD_END } },
    [ID.DIRT]: { name: 'Terra',      hardness: 0.5, drop: ID.DIRT,   tool: 'shovel', tiles: allFaces(TILE.DIRT) },
    [ID.COBBLE]: { name: 'Pedregulho', hardness: 2.0, drop: ID.COBBLE, tool: 'pickaxe', requiresTool: true, minTier: 1, tiles: allFaces(TILE.COBBLE) },
    [ID.PLANKS]: { name: 'Tábuas',     hardness: 2.0, drop: ID.PLANKS, tool: 'axe',    tiles: allFaces(TILE.PLANKS) },
    [ID.LEAVES]: { name: 'Folhas',     hardness: 0.2, drop: ID.APPLE, dropChance: 0.06, tool: null, render: 'cutout', tiles: allFaces(TILE.LEAVES) },
    [ID.CRAFTING_TABLE]: { name: 'Bancada',    hardness: 2.5, drop: ID.CRAFTING_TABLE, tool: 'axe', station: 'crafting',
         tiles: { top: TILE.CRAFT_TOP, side: TILE.CRAFT_SIDE, bottom: TILE.PLANKS } },
    [ID.FURNACE]: { name: 'Forno',      hardness: 3.5, drop: ID.FURNACE, tool: 'pickaxe', requiresTool: true, minTier: 1, station: 'furnace',
         tiles: { top: TILE.FURNACE_TOP, side: TILE.FURNACE_SIDE, front: TILE.FURNACE_FRONT, bottom: TILE.COBBLE } },
    [ID.CHEST]: { name: 'Baú',     hardness: 2.5, drop: ID.CHEST, tool: 'axe', station: 'chest',
          tiles: { top: TILE.CHEST_TOP, side: TILE.CHEST_SIDE, front: TILE.CHEST_FRONT, bottom: TILE.CHEST_TOP } },
    [ID.WOOD_DOOR_BOTTOM]: {
        name: 'Porta de carvalho', hardness: 3, drop: ID.WOOD_DOOR, tool: 'axe', collectible: false,
        render: 'door', solid: true, door: { half: 'bottom', open: false, tile: TILE.WOOD_DOOR_LOWER },
        tiles: { top: TILE.WOOD_END, side: TILE.WOOD, front: TILE.WOOD_DOOR_LOWER, bottom: TILE.WOOD_END },
    },
    [ID.WOOD_DOOR_TOP]: {
        name: 'Porta de carvalho', hardness: 3, drop: ID.WOOD_DOOR, tool: 'axe', collectible: false,
        render: 'door', solid: true, door: { half: 'top', open: false, tile: TILE.WOOD_DOOR_UPPER },
        tiles: { top: TILE.WOOD_END, side: TILE.WOOD, front: TILE.WOOD_DOOR_UPPER, bottom: TILE.WOOD_END },
    },
    [ID.WOOD_DOOR_BOTTOM_OPEN]: {
        name: 'Porta de carvalho aberta', hardness: 3, drop: ID.WOOD_DOOR, tool: 'axe', collectible: false,
        render: 'door', solid: false, door: { half: 'bottom', open: true, tile: TILE.WOOD_DOOR_LOWER },
        tiles: { top: TILE.WOOD_END, side: TILE.WOOD, front: TILE.WOOD_DOOR_LOWER, bottom: TILE.WOOD_END },
    },
    [ID.WOOD_DOOR_TOP_OPEN]: {
        name: 'Porta de carvalho aberta', hardness: 3, drop: ID.WOOD_DOOR, tool: 'axe', collectible: false,
        render: 'door', solid: false, door: { half: 'top', open: true, tile: TILE.WOOD_DOOR_UPPER },
        tiles: { top: TILE.WOOD_END, side: TILE.WOOD, front: TILE.WOOD_DOOR_UPPER, bottom: TILE.WOOD_END },
    },
    ...createMineralBlocks(ID, TILE),
    [ID.SAND]: { name: 'Areia', hardness: 0.5, drop: ID.SAND, tool: 'shovel', tiles: allFaces(TILE.SAND) },
    [ID.TALL_GRASS]: { name: 'Grama alta', hardness: 0, drop: null, collectible: false, tool: null,
        render: 'instanced', solid: false, opaque: false, tiles: allFaces(TILE.GRASS_TOP) },
    [ID.TORCH]: { name: 'Tocha', hardness: 0.3, drop: ID.TORCH, tool: null, light: 14, render: 'torch', solid: false, tiles: allFaces(TILE.TORCH_FLAME) },
    // Lanterna: um bloco sólido que ilumina (o sistema de luz pega qualquer
    // bloco com `light`), feito com o pó que o Mofim solta.
    [ID.MOFIM_LANTERN]: {
        name: 'Lanterna de mofim', hardness: 0.8, drop: ID.MOFIM_LANTERN, tool: null,
        light: 13, tiles: allFaces(TILE.MOFIM_LANTERN),
    },
    // Lã: bloco macio, quebra rápido com a mão e não pede ferramenta. As três
    // cores vêm da ovelha (branca, cinza e preta), cada uma com o seu bloco.
    [ID.WOOL_BLOCK_WHITE]: { name: 'Bloco de lã branca', hardness: 0.6, drop: ID.WOOL_BLOCK_WHITE, tool: null, tiles: allFaces(TILE.WOOL_WHITE) },
    [ID.WOOL_BLOCK_GRAY]: { name: 'Bloco de lã cinza', hardness: 0.6, drop: ID.WOOL_BLOCK_GRAY, tool: null, tiles: allFaces(TILE.WOOL_GRAY) },
    [ID.WOOL_BLOCK_BLACK]: { name: 'Bloco de lã preta', hardness: 0.6, drop: ID.WOOL_BLOCK_BLACK, tool: null, tiles: allFaces(TILE.WOOL_BLACK) },
    // Cama: dois voxels com geometria própria (`world-bed.js`). Ela é `solid`
    // porque o jogador sobe nela — a colisão que vale é a caixa de 9/16 tratada
    // na física — e não é opaca, porque móvel não faz sombra de parede.
    [ID.BED_FOOT]: {
        name: 'Cama', hardness: 0.8, drop: ID.BED, tool: null, collectible: false,
        render: 'bed', solid: true, opaque: false, bed: { part: 'foot' },
        tiles: { top: TILE.BED_TOP, side: TILE.BED_SIDE, bottom: TILE.WOOD_END },
    },
    [ID.BED_HEAD]: {
        name: 'Cama', hardness: 0.8, drop: ID.BED, tool: null, collectible: false,
        render: 'bed', solid: true, opaque: false, bed: { part: 'head' },
        tiles: { top: TILE.BED_TOP, side: TILE.BED_SIDE, bottom: TILE.WOOD_END },
    },
    [ID.WATER]: { name: 'Água',      hardness: 100, drop: null, tool: null, render: 'liquid', solid: false, collectible: false, tiles: allFaces(TILE.WATER) }, // Água só existe no mundo
};

BLOCKS[ID.WATER].waterLevel = 1;
BLOCKS[ID.WATER].waterSource = true;
for (let level = 1; level <= 7; level++) {
    BLOCKS[ID.WATER_FLOW_1 + level - 1] = {
        name: 'Água corrente', hardness: 100, drop: null, tool: null,
        render: 'liquid', solid: false, collectible: false, flowing: true,
        flowLevel: level, waterLevel: level / 8, tiles: allFaces(TILE.WATER),
    };
}
BLOCKS[ID.WATER_FALL] = {
    name: 'Queda d’água', hardness: 100, drop: null, tool: null,
    render: 'liquid', solid: false, collectible: false, flowing: true, falling: true,
    flowLevel: 8, waterLevel: 1, tiles: allFaces(TILE.WATER),
};

for (const block of Object.values(BLOCKS)) {
    block.render ??= 'opaque';
    block.opaque ??= block.render === 'opaque';
    block.solid ??= true;
    block.collectible ??= block.drop != null;
}
for (const [id, orientation] of [
    [ID.TORCH_WALL_XP, [1, 0]], [ID.TORCH_WALL_XN, [-1, 0]],
    [ID.TORCH_WALL_ZP, [0, 1]], [ID.TORCH_WALL_ZN, [0, -1]],
]) BLOCKS[id] = { ...BLOCKS[ID.TORCH], collectible: false, orientation };

export const BlockCatalog = Object.fromEntries([
    [0, { id: 0, name: 'Ar', opaque: false }],
    ...Object.entries(BLOCKS).map(([id, block]) => [Number(id), {
        id: Number(id),
        name: block.name,
        opaque: Boolean(block.opaque),
    }]),
]);
BlockCatalog.isOpaque = function isOpaque(blockId) {
    if (blockId == null || blockId === 0) return false;
    return BlockCatalog[blockId]?.opaque === true;
};

export const ITEMS = {};
// Cada ícone de item ocupa a sua própria célula no atlas, a começar depois dos
// tiles do mundo. A contagem começa aqui porque os blocos — logo abaixo — já
// consomem as primeiras células com os ícones em 3D.
let nextTile = Object.keys(TILE).length;
// Bloco na barra/inventário: ícone em 3D. O sprite `block` monta o cubo
// isométrico a partir dos tiles do próprio bloco (world-block-icons.js), então
// cada bloco ganha a sua célula no atlas em vez de reaproveitar a do tile.
for (const [id, b] of Object.entries(BLOCKS)) {
    if (!b.collectible) continue;
    ITEMS[id] = {
        name: b.name,
        maxStack: 64,
        block: Number(id),
        sprite: { kind: 'block', mat: String(Number(id)) },
        iconTile: nextTile++,
    };
}

ITEMS[ID.STICK] = { name: 'Graveto', maxStack: 64, sprite: { kind: 'stick', mat: 'wood' }, iconTile: nextTile++ };
ITEMS[ID.WOOD_DOOR] = {
    name: 'Porta de carvalho', maxStack: 64, block: ID.WOOD_DOOR_BOTTOM,
    sprite: { kind: 'door', mat: 'oak' }, iconTile: nextTile++,
};
ITEMS[ID.WHEAT_SEEDS] = {
    name: 'Sementes de trigo', maxStack: 64,
    sprite: { kind: 'wheat-seeds', mat: 'wheat' }, iconTile: nextTile++,
};
ITEMS[ID.MOFIM_DUST] = {
    name: 'Pó luminoso', maxStack: 64,
    sprite: { kind: 'mofim-dust', mat: 'glow' }, iconTile: nextTile++,
};

// Fardos de lã: um item por cor, que stacka. É o que a ovelha solta.
for (const [key, label, color] of [['WHITE', 'branca', 'white'], ['GRAY', 'cinza', 'gray'], ['BLACK', 'preta', 'black']]) {
    ITEMS[ID['WOOL_' + key]] = {
        name: `Lã ${label}`, maxStack: 64,
        sprite: { kind: 'wool', mat: color }, iconTile: nextTile++,
    };
}

// A tesoura não é uma quarta "espécie" de ferramenta: `TOOL_KINDS` define os IDs
// das ferramentas por material (base + índice) e enfiar mais um tipo ali
// renumeraria picareta, machado e pá de todos os materiais — e os saves com
// isso. Ela é item próprio, com `tool.type` para o jogo reconhecer.
// A cama é uma peça só na barra: o ícone sai do modelo (world-textures.js ›
// `spritePixels('bed')`) e o bloco que ela vira é a metade dos pés.
ITEMS[ID.BED] = {
    name: 'Cama', maxStack: 1, block: ID.BED_FOOT,
    sprite: { kind: 'bed', mat: 'red' }, iconTile: nextTile++,
};

ITEMS[ID.SHEARS] = {
    name: 'Tesoura', maxStack: 1, maxDurability: 238,
    tool: { type: 'shears', tier: 1, speed: 1 },
    sprite: { kind: 'shears', mat: 'iron' }, iconTile: nextTile++,
};

const TOOL_MATS = {
    wood:  { label: 'de Madeira', tier: 1, speed: 2, durability: 59,  base: 21, ingredient: ID.PLANKS },
    stone: { label: 'de Pedra',   tier: 2, speed: 4, durability: 131, base: 24, ingredient: ID.COBBLE },
};
const TOOL_KINDS = [['pickaxe', 'Picareta'], ['axe', 'Machado'], ['shovel', 'Pá']];
for (const product of MINERAL_PRODUCTS) {
    ITEMS[product.id] = {
        name: product.name,
        maxStack: 64,
        sprite: product.sprite,
        iconTile: nextTile++,
    };
}

const toolMaterials = [
    ...Object.entries(TOOL_MATS).map(([key, material]) => ({ key, ...material })),
    ...MINERAL_TOOL_MATERIALS.map(({ key, label, tier, speed, durability, baseId, ingredient }) => ({
        key, label, tier, speed, durability, base: baseId, ingredient,
    })),
];
for (const m of toolMaterials) {
    TOOL_KINDS.forEach(([kind, label], k) => {
        const id = m.base + k;
        ITEMS[id] = {
            name: `${label} ${m.label}`,
            maxStack: 1,
            maxDurability: m.durability,
            tool: { type: kind, tier: m.tier, speed: m.speed },
            sprite: { kind, mat: m.key },
            iconTile: nextTile++,
        };
        m['id_' + kind] = id;
    });
}

ITEMS[ID.APPLE]    = { name: 'Maçã', maxStack: 64, food: { hunger: 4, sat: 2.4 }, sprite: { kind: 'apple', mat: 'food' }, iconTile: nextTile++ };
ITEMS[ID.CHARCOAL] = { name: 'Carvão vegetal', maxStack: 64, sprite: { kind: 'charcoal', mat: 'coal' }, iconTile: nextTile++ };
// As carnes — crua e assada, uma dupla por bicho, na ordem da tabela de
// `world-meats.js`. A crua é o que o corpo derruba ao morrer (e come menos que a
// maçã: é carne de bicho magro); a assada sai do forno e alimenta bem mais.
// O `mat` do sprite diz se a arte é a crua ou a tostada.
for (const meat of MEATS) {
    for (const parte of [meat.raw, meat.cooked]) {
        ITEMS[parte.id] = {
            name: parte.name,
            maxStack: 64,
            food: { ...parte.food },
            sprite: { ...parte.sprite },
            iconTile: nextTile++,
        };
    }
}
ITEMS[ID.TORCH].sprite = { kind: 'torch', mat: 'wood' };

// O atlas é uma grade fixa, não uma fileira única: com 16 colunas a largura
// fica em 512 px e a altura cresce em linhas de 32 px (65 tiles = 5 linhas =
// 160 px). Assim a textura nunca chega perto do limite garantido de 2048 px em
// WebGL e novos tiles só ocupam a próxima célula livre.
export const ATLAS_COLUMNS = 16;
const ATLAS_TILE_COUNT = [
    ...Object.values(TILE),
    ...Object.values(BLOCKS).flatMap(block => Object.values(block.tiles)),
    ...Object.values(ITEMS).map(item => item.iconTile),
].reduce((count, tile) => Math.max(count, tile + 1), 0);
export const ATLAS_ROWS = Math.max(1, Math.ceil(ATLAS_TILE_COUNT / ATLAS_COLUMNS));
// Afastamento (em pixels do atlas) das bordas de cada célula ao montar as UVs,
// para a filtragem nunca amostrar o tile vizinho.
export const ATLAS_UV_PAD_PX = 0.5;

export function atlasCell(tile) {
    const index = Number.isFinite(tile) ? Math.max(0, Math.floor(tile)) : 0;
    return { col: index % ATLAS_COLUMNS, row: Math.floor(index / ATLAS_COLUMNS) };
}

// Retângulo do tile no canvas do atlas (origem no canto superior esquerdo).
export function atlasTileRect(tile) {
    const { col, row } = atlasCell(tile);
    return { x: col * TILE_PX, y: row * TILE_PX, size: TILE_PX };
}

// Retângulo do tile em coordenadas UV. O canvas é desenhado de cima para
// baixo, mas o three usa flipY: a linha 0 do atlas ocupa o topo da textura, ou
// seja, a faixa de v mais alta. `padPx` afasta a amostragem das bordas da
// célula (em pixels), evitando vazar para o tile vizinho.
//
// `atlasUVInto` escreve em um objeto reaproveitado: o mesher chama isso para
// cada face e não deve alocar um objeto por chamada.
export function atlasUVInto(tile, padPx = 0, out = {}) {
    const index = Number.isFinite(tile) ? Math.max(0, Math.floor(tile)) : 0;
    const col = index % ATLAS_COLUMNS;
    const row = (index - col) / ATLAS_COLUMNS;
    const width = ATLAS_COLUMNS * TILE_PX;
    const height = ATLAS_ROWS * TILE_PX;
    const pad = Math.max(0, Math.min(TILE_PX / 2 - 1, padPx));
    out.u0 = (col * TILE_PX + pad) / width;
    out.v0 = ((ATLAS_ROWS - 1 - row) * TILE_PX + pad) / height;
    out.uWidth = (TILE_PX - 2 * pad) / width;
    out.vHeight = (TILE_PX - 2 * pad) / height;
    return out;
}

export function atlasUV(tile, padPx = 0) {
    return atlasUVInto(tile, padPx, {});
}

export const SMELT = {
    [ID.COBBLE]: { result: ID.STONE, time: 10 },
    [ID.LOG]: { result: ID.CHARCOAL, time: 10 },
    ...Object.fromEntries(MINERAL_SMELTING.map(({ ore, result, time }) => [ore, { result, time }])),
    // Toda carne assa: a tabela vem de `world-meats.js`, então um bicho novo com
    // carne entra no forno, no livro de receitas e na dica do slot sozinho.
    ...Object.fromEntries(MEAT_SMELTING.map(({ raw, cooked, time }) => [raw, { result: cooked, time }])),
};
export const FUEL = { [ID.PLANKS]: 15, [ID.LOG]: 15, [ID.STICK]: 5, [ID.COAL]: 80, [ID.CHARCOAL]: 80 };

export const RECIPES = [];
function trimShape(rows) {
    let r0 = rows.length, r1 = -1, c0 = Infinity, c1 = -1;
    rows.forEach((row, r) => row.forEach((v, c) => {
        if (v) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
    }));
    if (r1 < 0) return null;
    return rows.slice(r0, r1 + 1).map(row => row.slice(c0, c1 + 1));
}
function defRecipe(shape, result, count = 1) { RECIPES.push({ kind: 'shaped', shape: trimShape(shape), result, count }); }
function defShapeless(ingredients, result, count = 1) {
    RECIPES.push({ kind: 'shapeless', ingredients: ingredients.slice(), result, count });
}

defShapeless([ID.LOG], ID.PLANKS, 4);
defRecipe([[ID.COAL], [ID.STICK]], ID.TORCH, 4);
defRecipe([[ID.CHARCOAL], [ID.STICK]], ID.TORCH, 4);
defRecipe([[ID.PLANKS], [ID.PLANKS]], ID.STICK, 4);
for (const m of toolMaterials) {
    const M = m.ingredient, S = ID.STICK;
    defRecipe([[M, M, M], [null, S, null], [null, S, null]], m.id_pickaxe);
    defRecipe([[M, M], [M, S], [null, S]], m.id_axe);
    defRecipe([[M], [S], [S]], m.id_shovel);
}
defRecipe([[ID.PLANKS, ID.PLANKS], [ID.PLANKS, ID.PLANKS]], ID.CRAFTING_TABLE);
defRecipe([[ID.COBBLE, ID.COBBLE, ID.COBBLE], [ID.COBBLE, null, ID.COBBLE], [ID.COBBLE, ID.COBBLE, ID.COBBLE]], ID.FURNACE);
defRecipe([[ID.PLANKS, ID.PLANKS, ID.PLANKS], [ID.PLANKS, null, ID.PLANKS], [ID.PLANKS, ID.PLANKS, ID.PLANKS]], ID.CHEST);
defRecipe([[ID.PLANKS, ID.PLANKS], [ID.PLANKS, ID.PLANKS], [ID.PLANKS, ID.PLANKS]], ID.WOOD_DOOR, 3);
// Pó luminoso + tábuas: a lanterna do Mofim. Três pós por lanterna é o que faz
// valer a pena caçar (cada bicho solta um ou dois).
defRecipe([[ID.MOFIM_DUST, ID.MOFIM_DUST], [ID.MOFIM_DUST, ID.PLANKS]], ID.MOFIM_LANTERN);
// Tesoura: duas barras de ferro na diagonal (como no Minecraft — reconhecível
// sem tutorial). Ela não mina mais rápido nada: serve para tosquiar.
defRecipe([[ID.IRON_INGOT, null], [null, ID.IRON_INGOT]], ID.SHEARS);
// Quatro fardos da mesma cor viram o bloco daquela cor. Sem mistura: lã cinza
// não entra na receita da branca.
defRecipe([[ID.WOOL_WHITE, ID.WOOL_WHITE], [ID.WOOL_WHITE, ID.WOOL_WHITE]], ID.WOOL_BLOCK_WHITE);
defRecipe([[ID.WOOL_GRAY, ID.WOOL_GRAY], [ID.WOOL_GRAY, ID.WOOL_GRAY]], ID.WOOL_BLOCK_GRAY);
defRecipe([[ID.WOOL_BLACK, ID.WOOL_BLACK], [ID.WOOL_BLACK, ID.WOOL_BLACK]], ID.WOOL_BLOCK_BLACK);
// Cama: três fardos de lã em cima, três tábuas embaixo — a mesma silhueta da
// receita clássica, que se reconhece sem tutorial. Sai uma cama por vez.
defRecipe([[ID.WOOL_WHITE, ID.WOOL_WHITE, ID.WOOL_WHITE], [ID.PLANKS, ID.PLANKS, ID.PLANKS]], ID.BED);

function shapesEqual(a, b) {
    if (a.length !== b.length || a[0].length !== b[0].length) return false;
    return a.every((row, r) => row.every((v, c) => v === b[r][c]));
}
export function matchRecipe(inv, craftN) {
    const n = craftN, s = inv.slots, rows = [];
    for (let r = 0; r < n; r++) {
        const row = [];
        for (let c = 0; c < n; c++) row.push(s[r * n + c]?.id ?? null);
        rows.push(row);
    }
    const grid = trimShape(rows);
    if (!grid) return null;
    const mirrored = grid.map(row => row.slice().reverse());
    const ingredients = s.slice(0, n * n).filter(Boolean).map(stack => stack.id).sort((a, b) => a - b);
    for (const r of RECIPES) {
        if (r.kind === 'shapeless') {
            const required = r.ingredients.slice().sort((a, b) => a - b);
            if (ingredients.length === required.length && ingredients.every((id, i) => id === required[i])) {
                return { id: r.result, count: r.count };
            }
            continue;
        }
        if (shapesEqual(r.shape, grid) || shapesEqual(r.shape, mirrored)) return { id: r.result, count: r.count };
    }
    return null;
}

