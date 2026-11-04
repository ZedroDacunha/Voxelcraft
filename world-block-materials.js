// Família de material de cada bloco, usada por todos os sons que dependem do
// que está sendo pisado, quebrado ou colocado. Um bloco novo aqui rende som de
// passo, de quebra e de colocação de uma vez.
import { ID } from './world-catalog.js';

export const BLOCK_MATERIALS = Object.freeze(['grass', 'dirt', 'stone', 'wood', 'sand']);

const MATERIAL_BY_BLOCK = new Map();

const assign = (material, ids) => {
    for (const id of ids) MATERIAL_BY_BLOCK.set(id, material);
};

assign('grass', [ID.GRASS, ID.TALL_GRASS, ID.LEAVES]);
assign('dirt', [ID.DIRT]);
assign('stone', [ID.STONE, ID.COBBLE, ID.FURNACE, ID.MOFIM_LANTERN,
    ID.COAL_ORE, ID.IRON_ORE, ID.GOLD_ORE, ID.DIAMOND_ORE, ID.COPPER_ORE]);
assign('wood', [ID.LOG, ID.PLANKS, ID.CRAFTING_TABLE, ID.CHEST,
    ID.WOOD_DOOR_BOTTOM, ID.WOOD_DOOR_TOP,
    ID.WOOD_DOOR_BOTTOM_OPEN, ID.WOOD_DOOR_TOP_OPEN]);
assign('sand', [ID.SAND]);

// Material do bloco, ou null quando ele não produz som de material (ar, tocha,
// água — que tem som próprio de fluxo/natação).
export function blockMaterialFor(blockType) {
    return MATERIAL_BY_BLOCK.get(blockType) ?? null;
}

// Nome do efeito no formato `<prefixo>-<material>`, ou null.
export function materialSoundName(blockType, prefix) {
    const material = blockMaterialFor(blockType);
    return material ? `${prefix}-${material}` : null;
}

// Blocos que produzem som de material (útil para testes e documentação).
export function blocksWithMaterial() {
    return [...MATERIAL_BY_BLOCK.keys()].sort((a, b) => a - b);
}
