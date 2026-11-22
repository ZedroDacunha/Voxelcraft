import { ITEMS } from './world-catalog.js';
import { ARMOR_SLOTS } from './inventory-armor.js';

// Pontos contam apenas a peça correta em cada espaço e são limitados ao HUD.
export function armorPoints(slots = []) {
    if (!Array.isArray(slots)) return 0;
    return Math.min(20, ARMOR_SLOTS.reduce((total, slot, i) => {
        const stack = slots[i], item = stack && ITEMS[stack.id];
        return total + (stack?.count === 1 && item?.armorSlot === slot ? (item.armorPoints || 0) : 0);
    }, 0));
}

export function armorProtectsFrom(source) {
    return !['fall', 'drown', 'starve', 'kill'].includes(source);
}

// Dureza é somada apenas para peças equipadas no espaço correspondente.
export function armorToughness(slots = []) {
    if (!Array.isArray(slots)) return 0;
    return ARMOR_SLOTS.reduce((total, slot, i) => {
        const stack = slots[i], item = stack && ITEMS[stack.id];
        return total + (stack?.count === 1 && item?.armorSlot === slot ? (item.armorToughness || 0) : 0);
    }, 0);
}

// Fórmula Java: dureza reduz a perda de proteção contra golpes fortes.
// Os outros materiais têm dureza zero, preservando o cálculo anterior.
export function damageAfterArmor(amount, points, source = 'generic', toughness = 0) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    if (!armorProtectsFrom(source)) return amount;
    const armor = Number.isFinite(points) ? Math.max(0, Math.min(20, points)) : 0;
    const hard = Number.isFinite(toughness) ? Math.max(0, toughness) : 0;
    const effective = Math.min(20, Math.max(armor / 5, armor - amount / (2 + hard / 4)));
    return amount * (1 - effective / 25);
}
