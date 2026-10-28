import { MINERAL_ORE_DROPS, MINERAL_TIERS } from './world-minerals.js';

const allFaces = tile => ({ top: tile, side: tile, bottom: tile });

// Receive catalog IDs and tiles to keep the dependency graph one-way.
export function createMineralBlocks(ID, TILE) {
    return {
        [ID.COAL_ORE]: {
            name: 'Minério de carvão', hardness: 3.0, drop: MINERAL_ORE_DROPS[ID.COAL_ORE],
            tool: 'pickaxe', requiresTool: true, minTier: 1, tiles: allFaces(TILE.COAL_ORE),
        },
        [ID.IRON_ORE]: {
            name: 'Minério de ferro', hardness: 3.5, drop: MINERAL_ORE_DROPS[ID.IRON_ORE],
            tool: 'pickaxe', requiresTool: true, minTier: MINERAL_TIERS[ID.IRON_ORE], tiles: allFaces(TILE.IRON_ORE),
        },
        [ID.GOLD_ORE]: {
            name: 'Minério de ouro', hardness: 4.0, drop: MINERAL_ORE_DROPS[ID.GOLD_ORE],
            tool: 'pickaxe', requiresTool: true, minTier: MINERAL_TIERS[ID.GOLD_ORE], tiles: allFaces(TILE.GOLD_ORE),
        },
        [ID.DIAMOND_ORE]: {
            name: 'Minério de diamante', hardness: 4.5, drop: ID.DIAMOND_ORE,
            tool: 'pickaxe', requiresTool: true, minTier: MINERAL_TIERS[ID.DIAMOND_ORE], tiles: allFaces(TILE.DIAMOND_ORE),
        },
        [ID.COPPER_ORE]: {
            name: 'Minério de cobre', hardness: 3.0, drop: MINERAL_ORE_DROPS[ID.COPPER_ORE],
            tool: 'pickaxe', requiresTool: true, minTier: MINERAL_TIERS[ID.COPPER_ORE], tiles: allFaces(TILE.COPPER_ORE),
        },
    };
}
