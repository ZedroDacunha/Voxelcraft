// Progressão dos minérios e dos materiais usados nas ferramentas.
// IDs de minérios existentes são preservados para manter compatibilidade com saves.
export const MINERAL_IDS = Object.freeze({
    COAL_ORE: 11,
    IRON_ORE: 12,
    GOLD_ORE: 13,
    DIAMOND_ORE: 14,
    IRON_INGOT: 32,
});

export const MINERAL_PROGRESSIONS = Object.freeze([
    Object.freeze({
        key: 'iron',
        label: 'Ferro',
        ore: MINERAL_IDS.IRON_ORE,
        ingot: MINERAL_IDS.IRON_INGOT,
        smeltTime: 10,
        tool: Object.freeze({
            tier: 3,
            speed: 6,
            durability: 250,
            baseId: 27,
        }),
    }),
]);
