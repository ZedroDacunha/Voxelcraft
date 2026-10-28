// Progressão dos minérios e dos materiais usados nas ferramentas.
// IDs de minérios existentes são preservados para manter compatibilidade com saves.
export const MINERAL_IDS = Object.freeze({
    COAL_ORE: 11,
    IRON_ORE: 12,
    GOLD_ORE: 13,
    DIAMOND_ORE: 14,
    IRON_INGOT: 32,
    GOLD_INGOT: 33,
});

export const MINERAL_PRODUCTS = Object.freeze([
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
    Object.freeze({ ore: MINERAL_IDS.IRON_ORE, result: MINERAL_IDS.IRON_INGOT, time: 10 }),
    Object.freeze({ ore: MINERAL_IDS.GOLD_ORE, result: MINERAL_IDS.GOLD_INGOT, time: 10 }),
]);

export const MINERAL_TOOL_MATERIALS = Object.freeze([
    Object.freeze({ key: 'iron', label: 'de Ferro', ingredient: MINERAL_IDS.IRON_INGOT,
        tier: 3, speed: 6, durability: 250, baseId: 27 }),
    Object.freeze({ key: 'gold', label: 'de Ouro', ingredient: MINERAL_IDS.GOLD_INGOT,
        tier: 2, speed: 8, durability: 48, baseId: 65 }),
    Object.freeze({ key: 'diamond', label: 'de Diamante', ingredient: MINERAL_IDS.DIAMOND_ORE,
        tier: 4, speed: 9, durability: 1561, baseId: 68 }),
]);

export const MINERAL_TIERS = Object.freeze({
    [MINERAL_IDS.IRON_ORE]: 1,
    [MINERAL_IDS.GOLD_ORE]: 3,
    [MINERAL_IDS.DIAMOND_ORE]: 3,
});
