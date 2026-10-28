import { BLOCKS, ITEMS } from './world-catalog.js';

function toolInfo(stack) {
    const item = stack && ITEMS[stack.id];
    return item?.tool || null;
}

export function canHarvest(blockType, stack) {
    const block = BLOCKS[blockType];
    if (!block.requiresTool) return true;
    const tool = toolInfo(stack);
    return Boolean(tool && tool.type === block.tool && tool.tier >= (block.minTier || 0));
}

export function getBreakTime(blockType, stack) {
    const block = BLOCKS[blockType];
    const baseTime = block.hardness * 1.5;
    if (!canHarvest(blockType, stack)) return block.hardness * 5;
    const tool = toolInfo(stack);
    const speed = tool?.type === block.tool ? tool.speed : 1;
    return baseTime / speed;
}

export function damageTool(stack, amount = 1) {
    const item = stack && ITEMS[stack.id];
    if (!item?.maxDurability) return null;
    stack.damage = (stack.damage || 0) + amount;
    return {
        broken: stack.damage >= item.maxDurability,
        name: item.name,
    };
}
