import { ITEMS } from './world-catalog.js';
export const ARMOR_SLOTS = Object.freeze(['helmet', 'chest', 'legs', 'feet']);
export function canEquipArmor(index, stack) {
    return Number.isInteger(index) && index >= 0 && index < ARMOR_SLOTS.length &&
        !!stack && stack.count === 1 && ITEMS[stack.id]?.armorSlot === ARMOR_SLOTS[index];
}
// Uma troca atômica: itens incompatíveis não entram e nada se perde.
export function armorClick(slots, index, cursor) {
    if (!Number.isInteger(index) || index < 0 || index >= ARMOR_SLOTS.length) return false;
    const held = cursor.stack;
    if (held && !canEquipArmor(index, held)) return false;
    const previous = slots[index];
    if (!held && !previous) return false;
    slots[index] = held || null; cursor.stack = previous || null;
    return true;
}
