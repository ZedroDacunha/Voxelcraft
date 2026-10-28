// Progressão dos minérios e dos materiais usados nas ferramentas.
// IDs de minérios existentes são preservados para manter compatibilidade com saves.
export const MINERAL_IDS = Object.freeze({
    COAL_ORE: 11,
    IRON_ORE: 12,
    GOLD_ORE: 13,
    DIAMOND_ORE: 14,
    COPPER_ORE: 17,
    COAL: 83,
    IRON_INGOT: 32,
    GOLD_INGOT: 33,
    COPPER_INGOT: 34,
    RAW_COPPER: 80,
    RAW_IRON: 81,
    RAW_GOLD: 82,
});

export const MINERAL_PRODUCTS = Object.freeze([
    Object.freeze({
        id: MINERAL_IDS.COAL,
        name: 'Carvão',
        sprite: Object.freeze({ kind: 'coal', mat: 'coal' }),
    }),
    Object.freeze({
        id: MINERAL_IDS.RAW_COPPER,
        name: 'Cobre bruto',
        sprite: Object.freeze({ kind: 'raw', mat: 'copper' }),
    }),
    Object.freeze({
        id: MINERAL_IDS.RAW_IRON,
        name: 'Ferro bruto',
        sprite: Object.freeze({ kind: 'raw', mat: 'iron' }),
    }),
    Object.freeze({
        id: MINERAL_IDS.RAW_GOLD,
        name: 'Ouro bruto',
        sprite: Object.freeze({ kind: 'raw', mat: 'gold' }),
    }),
    Object.freeze({
        id: MINERAL_IDS.COPPER_INGOT,
        name: 'Lingote de cobre',
        sprite: Object.freeze({ kind: 'ingot', mat: 'copper' }),
    }),
    Object.freeze({
        id: MINERAL_IDS.IRON_INGOT,
        name: 'Lingote de ferro',
        sprite: Object.freeze({ kind: 'ingot', mat: 'iron' }),
    }),
    Object.freeze({
        id: MINERAL_IDS.GOLD_INGOT,
        name: 'Lingote de ouro',
        sprite: Object.freeze({ kind: 'ingot', mat: 'gold' }),
    }),
    Object.freeze({
        // Reuse the old drop ID so previously saved diamond-ore stacks become usable diamonds.
        id: MINERAL_IDS.DIAMOND_ORE,
        name: 'Diamante',
        sprite: Object.freeze({ kind: 'gem', mat: 'diamond' }),
    }),
]);

export const MINERAL_SMELTING = Object.freeze([
    Object.freeze({ ore: MINERAL_IDS.RAW_COPPER, result: MINERAL_IDS.COPPER_INGOT, time: 10 }),
    Object.freeze({ ore: MINERAL_IDS.RAW_IRON, result: MINERAL_IDS.IRON_INGOT, time: 10 }),
    Object.freeze({ ore: MINERAL_IDS.RAW_GOLD, result: MINERAL_IDS.GOLD_INGOT, time: 10 }),
]);

// Old saves stored broken ore blocks as items; turn those stacks into raw drops when loading.
export const LEGACY_MINERAL_ITEM_MAP = Object.freeze({
    [MINERAL_IDS.COAL_ORE]: MINERAL_IDS.COAL,
    [MINERAL_IDS.COPPER_ORE]: MINERAL_IDS.RAW_COPPER,
    [MINERAL_IDS.IRON_ORE]: MINERAL_IDS.RAW_IRON,
    [MINERAL_IDS.GOLD_ORE]: MINERAL_IDS.RAW_GOLD,
});

export const MINERAL_ORE_DROPS = Object.freeze({
    [MINERAL_IDS.COAL_ORE]: MINERAL_IDS.COAL,
    [MINERAL_IDS.COPPER_ORE]: MINERAL_IDS.RAW_COPPER,
    [MINERAL_IDS.IRON_ORE]: MINERAL_IDS.RAW_IRON,
    [MINERAL_IDS.GOLD_ORE]: MINERAL_IDS.RAW_GOLD,
});

export const MINERAL_TOOL_MATERIALS = Object.freeze([
    Object.freeze({ key: 'copper', label: 'de Cobre', ingredient: MINERAL_IDS.COPPER_INGOT,
        tier: 2, speed: 5, durability: 190, baseId: 71 }),
    Object.freeze({ key: 'iron', label: 'de Ferro', ingredient: MINERAL_IDS.IRON_INGOT,
        tier: 3, speed: 6, durability: 250, baseId: 27 }),
    Object.freeze({ key: 'gold', label: 'de Ouro', ingredient: MINERAL_IDS.GOLD_INGOT,
        tier: 1, speed: 12, durability: 32, baseId: 65 }),
    Object.freeze({ key: 'diamond', label: 'de Diamante', ingredient: MINERAL_IDS.DIAMOND_ORE,
        tier: 4, speed: 8, durability: 1561, baseId: 68 }),
]);

export const MINERAL_TIERS = Object.freeze({
    [MINERAL_IDS.COPPER_ORE]: 2,
    [MINERAL_IDS.IRON_ORE]: 2,
    [MINERAL_IDS.GOLD_ORE]: 3,
    [MINERAL_IDS.DIAMOND_ORE]: 3,
});
