// Blocos, itens, ferramentas, receitas e regras de fundição.
export const TILE = { GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, WOOD: 4, COBBLE: 5, LEAVES: 6, PLANKS: 7,
               CRAFT_TOP: 8, CRAFT_SIDE: 9, FURNACE_FRONT: 10, FURNACE_TOP: 11, CHEST_TOP: 12, CHEST_SIDE: 13,
               WOOD_END: 14, COAL_ORE: 15, IRON_ORE: 16, GOLD_ORE: 17, DIAMOND_ORE: 18,
               GRASS_TOP_ALT: 19, GRASS_SIDE_ALT: 20, DIRT_ALT: 21, STONE_ALT: 22, LEAVES_ALT: 23,
               SAND: 24, WATER: 25, TORCH_FLAME: 26 }; // Tile da chama da tocha
export const TILE_PX = 32;

const allFaces = (t) => ({ top: t, side: t, bottom: t });

export const ID = { GRASS: 1, STONE: 2, LOG: 3, DIRT: 4, COBBLE: 5, PLANKS: 6, LEAVES: 7,
             CRAFTING_TABLE: 8, FURNACE: 9, CHEST: 10,
             COAL_ORE: 11, IRON_ORE: 12, GOLD_ORE: 13, DIAMOND_ORE: 14,
             SAND: 15, WATER: 16, WATER_FLOW_1: 40, WATER_FLOW_2: 41, WATER_FLOW_3: 42,
             WATER_FLOW_4: 43, WATER_FLOW_5: 44, WATER_FLOW_6: 45, WATER_FLOW_7: 46, WATER_FALL: 47,
             STICK: 20, TORCH: 60, TORCH_WALL_XP: 61, TORCH_WALL_XN: 62, TORCH_WALL_ZP: 63, TORCH_WALL_ZN: 64, APPLE: 30, CHARCOAL: 31 };

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
         icon: TILE.FURNACE_FRONT, tiles: { top: TILE.FURNACE_TOP, side: TILE.FURNACE_FRONT, bottom: TILE.COBBLE } },
    [ID.CHEST]: { name: 'Baú',     hardness: 2.5, drop: ID.CHEST, tool: 'axe', station: 'chest',
          tiles: { top: TILE.CHEST_TOP, side: TILE.CHEST_SIDE, bottom: TILE.CHEST_TOP } },
    [ID.COAL_ORE]: { name: 'Minério de carvão',   hardness: 3.0, drop: ID.COAL_ORE,    tool: 'pickaxe', requiresTool: true, minTier: 1, tiles: allFaces(TILE.COAL_ORE) },
    [ID.IRON_ORE]: { name: 'Minério de ferro',    hardness: 3.5, drop: ID.IRON_ORE,    tool: 'pickaxe', requiresTool: true, minTier: 1, tiles: allFaces(TILE.IRON_ORE) },
    [ID.GOLD_ORE]: { name: 'Minério de ouro',     hardness: 4.0, drop: ID.GOLD_ORE,    tool: 'pickaxe', requiresTool: true, minTier: 2, tiles: allFaces(TILE.GOLD_ORE) },
    [ID.DIAMOND_ORE]: { name: 'Minério de diamante', hardness: 4.5, drop: ID.DIAMOND_ORE, tool: 'pickaxe', requiresTool: true, minTier: 2, tiles: allFaces(TILE.DIAMOND_ORE) },
    [ID.SAND]: { name: 'Areia', hardness: 0.5, drop: ID.SAND, tool: 'shovel', tiles: allFaces(TILE.SAND) },
    [ID.TORCH]: { name: 'Tocha', hardness: 0.3, drop: ID.TORCH, tool: null, light: 14, render: 'torch', solid: false, tiles: allFaces(TILE.TORCH_FLAME) },
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
    block.solid ??= true;
    block.collectible ??= block.drop != null;
}
for (const [id, orientation] of [
    [ID.TORCH_WALL_XP, [1, 0]], [ID.TORCH_WALL_XN, [-1, 0]],
    [ID.TORCH_WALL_ZP, [0, 1]], [ID.TORCH_WALL_ZN, [0, -1]],
]) BLOCKS[id] = { ...BLOCKS[ID.TORCH], collectible: false, orientation };
export const ITEMS = {};
for (const [id, b] of Object.entries(BLOCKS)) {
    if (!b.collectible) continue;
    ITEMS[id] = { name: b.name, maxStack: 64, block: Number(id), iconTile: b.icon ?? b.tiles.top };
}

let nextTile = Object.keys(TILE).length;
ITEMS[ID.STICK] = { name: 'Graveto', maxStack: 64, sprite: { kind: 'stick', mat: 'wood' }, iconTile: nextTile++ };

const TOOL_MATS = {
    wood:  { label: 'de Madeira', tier: 1, speed: 2, durability: 59,  base: 21, ingredient: ID.PLANKS },
    stone: { label: 'de Pedra',   tier: 2, speed: 4, durability: 131, base: 24, ingredient: ID.COBBLE },
};
const TOOL_KINDS = [['pickaxe', 'Picareta'], ['axe', 'Machado'], ['shovel', 'Pá']];
for (const [matKey, m] of Object.entries(TOOL_MATS)) {
    TOOL_KINDS.forEach(([kind, label], k) => {
        const id = m.base + k;
        ITEMS[id] = {
            name: `${label} ${m.label}`, maxStack: 1, maxDurability: m.durability,
            tool: { type: kind, tier: m.tier, speed: m.speed },
            sprite: { kind, mat: matKey }, iconTile: nextTile++,
        };
        m['id_' + kind] = id;
    });
}

ITEMS[ID.APPLE]    = { name: 'Maçã', maxStack: 64, food: { hunger: 4, sat: 2.4 }, sprite: { kind: 'apple', mat: 'food' }, iconTile: nextTile++ };
ITEMS[ID.CHARCOAL] = { name: 'Carvão vegetal', maxStack: 64, sprite: { kind: 'charcoal', mat: 'coal' }, iconTile: nextTile++ };
ITEMS[ID.TORCH].sprite = { kind: 'torch', mat: 'wood' };

export const ATLAS_COLUMNS = [
    ...Object.values(TILE),
    ...Object.values(BLOCKS).flatMap(block => Object.values(block.tiles)),
    ...Object.values(ITEMS).map(item => item.iconTile),
].reduce((columns, tile) => Math.max(columns, tile + 1), 0);

export const SMELT = { [ID.COBBLE]: { result: ID.STONE, time: 10 }, [ID.LOG]: { result: ID.CHARCOAL, time: 10 } };
export const FUEL = { [ID.PLANKS]: 15, [ID.LOG]: 15, [ID.STICK]: 5, [ID.CHARCOAL]: 80 };

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
defRecipe([[ID.CHARCOAL], [ID.STICK]], ID.TORCH, 4);
defRecipe([[ID.PLANKS], [ID.PLANKS]], ID.STICK, 4);
for (const m of Object.values(TOOL_MATS)) {
    const M = m.ingredient, S = ID.STICK;
    defRecipe([[M, M], [null, S]], m.id_pickaxe);
    defRecipe([[M, M], [M, S]],    m.id_axe);
    defRecipe([[M], [S]],          m.id_shovel);
}
defRecipe([[ID.PLANKS, ID.PLANKS], [ID.PLANKS, ID.PLANKS]], ID.CRAFTING_TABLE);
defRecipe([[ID.COBBLE, ID.COBBLE, ID.COBBLE], [ID.COBBLE, null, ID.COBBLE], [ID.COBBLE, ID.COBBLE, ID.COBBLE]], ID.FURNACE);
defRecipe([[ID.PLANKS, ID.PLANKS, ID.PLANKS], [ID.PLANKS, null, ID.PLANKS], [ID.PLANKS, ID.PLANKS, ID.PLANKS]], ID.CHEST);

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

