import { ITEMS } from './world-catalog.js';

export const stackable = id => ITEMS[id].maxStack > 1;

export function invLeftClick(inv, index, cursor) {
    const slot = inv.slots[index], held = cursor.stack;
    if (!held) { if (slot) { cursor.stack = slot; inv.slots[index] = null; } return; }
    if (!slot) { inv.slots[index] = held; cursor.stack = null; return; }
    if (slot.id === held.id && stackable(slot.id)) {
        const moved = Math.min(ITEMS[slot.id].maxStack - slot.count, held.count);
        slot.count += moved; held.count -= moved;
        if (held.count <= 0) cursor.stack = null;
        return;
    }
    inv.slots[index] = held; cursor.stack = slot;
}

export function invRightClick(inv, index, cursor) {
    const slot = inv.slots[index], held = cursor.stack;
    if (!held) {
        if (slot) {
            const take = Math.ceil(slot.count / 2);
            cursor.stack = { id: slot.id, count: take };
            if (slot.damage) cursor.stack.damage = slot.damage;
            slot.count -= take;
            if (slot.count <= 0) inv.slots[index] = null;
        }
        return;
    }
    if (!slot) {
        const one = { id: held.id, count: 1 };
        if (held.damage) one.damage = held.damage;
        inv.slots[index] = one;
        held.count--;
        if (held.count <= 0) cursor.stack = null;
        return;
    }
    if (slot.id === held.id && stackable(slot.id)) {
        if (slot.count < ITEMS[slot.id].maxStack) {
            slot.count++; held.count--;
            if (held.count <= 0) cursor.stack = null;
        }
        return;
    }
    inv.slots[index] = held; cursor.stack = slot;
}

// No toque prolongado, a intenção é dividir/colocar uma unidade. Ao contrário
// do botão direito do mouse, não troca pilhas incompatíveis por acidente.
export function invTouchRightClick(inv, index, cursor) {
    const slot = inv.slots[index], held = cursor.stack;
    if (held && slot && (held.id !== slot.id || !stackable(slot.id))) return false;
    invRightClick(inv, index, cursor);
    return true;
}

export function invQuickMove(source, index, destination, from, to) {
    const stack = source.slots[index];
    if (!stack) return;
    const left = destination.add(stack.id, stack.count, from, to, stack.damage || 0);
    if (left === 0) source.slots[index] = null;
    else stack.count = left;
}

export function invQuickMoveToCraft(inventory, craftInv, index, craftN) {
    const source = inventory.slots[index];
    if (!source) return;
    let left = source.count;
    const end = craftN * craftN;
    for (let slot = 0; slot < end && left > 0; slot++) {
        if (craftInv.slots[slot]) continue;
        craftInv.slots[slot] = { id: source.id, count: 1 };
        if (source.damage) craftInv.slots[slot].damage = source.damage;
        left--;
    }
    if (left > 0 && stackable(source.id)) {
        for (let slot = 0; slot < end && left > 0; slot++) {
            const target = craftInv.slots[slot];
            if (!target || target.id !== source.id || target.count >= ITEMS[source.id].maxStack) continue;
            const moved = Math.min(ITEMS[source.id].maxStack - target.count, left);
            target.count += moved;
            left -= moved;
        }
    }
    if (left === 0) inventory.slots[index] = null;
    else source.count = left;
}

export function invCollectSame(inv, cursor) {
    const held = cursor.stack;
    if (!held || !stackable(held.id)) return;
    const max = ITEMS[held.id].maxStack;
    for (let index = 0; index < inv.slots.length && held.count < max; index++) {
        const slot = inv.slots[index];
        if (!slot || slot.id !== held.id) continue;
        const moved = Math.min(max - held.count, slot.count);
        held.count += moved; slot.count -= moved;
        if (slot.count <= 0) inv.slots[index] = null;
    }
}

export function invSwapHotbar(inv, index, hotbarIndex) {
    if (index === hotbarIndex) return;
    [inv.slots[index], inv.slots[hotbarIndex]] = [inv.slots[hotbarIndex], inv.slots[index]];
}

export function craftConsume(craftInv, craftN) {
    for (let index = 0; index < craftN * craftN; index++) {
        if (craftInv.slots[index]) craftInv.removeOne(index);
    }
}

export function invFillRecipe(inventory, craftInv, recipe, craftN) {
    const nextInventory = inventory.slots.map(stack => stack ? { ...stack } : null);
    const nextCraft = Array.from({ length: craftInv.slots.length }, () => null);
    const required = [];

    if (recipe.kind === 'shapeless') {
        if (recipe.ingredients.length > craftN * craftN) return { ok: false, reason: 'requires-table' };
        recipe.ingredients.forEach((id, index) => required.push({ id, index }));
    } else {
        const height = recipe.shape.length;
        const width = recipe.shape[0]?.length ?? 0;
        if (height > craftN || width > craftN) return { ok: false, reason: 'requires-table' };
        const rowOffset = Math.floor((craftN - height) / 2);
        const columnOffset = Math.floor((craftN - width) / 2);
        recipe.shape.forEach((row, r) => row.forEach((id, c) => {
            if (id) required.push({ id, index: (r + rowOffset) * craftN + c + columnOffset });
        }));
    }

    const addStack = stack => {
        let left = stack.count;
        const max = ITEMS[stack.id].maxStack;
        for (let i = 0; i < nextInventory.length && left > 0; i++) {
            const target = nextInventory[i];
            if (!target || target.id !== stack.id || target.count >= max) continue;
            const moved = Math.min(max - target.count, left);
            target.count += moved;
            left -= moved;
        }
        for (let i = 0; i < nextInventory.length && left > 0; i++) {
            if (nextInventory[i]) continue;
            const moved = Math.min(max, left);
            nextInventory[i] = { id: stack.id, count: moved };
            if (stack.damage) nextInventory[i].damage = stack.damage;
            left -= moved;
        }
        return left;
    };

    const requiredByIndex = new Map(required.map(ingredient => [ingredient.index, ingredient]));
    for (let index = 0; index < craftInv.slots.length; index++) {
        const stack = craftInv.slots[index];
        if (!stack) continue;
        const target = requiredByIndex.get(index);
        if (target?.id === stack.id) {
            nextCraft[index] = { ...stack, count: 1 };
            const excess = stack.count - 1;
            if (excess > 0 && addStack({ ...stack, count: excess }) > 0) {
                return { ok: false, reason: 'inventory-full' };
            }
        } else if (addStack(stack) > 0) {
            return { ok: false, reason: 'inventory-full' };
        }
    }

    for (const ingredient of required) {
        if (nextCraft[ingredient.index]) continue;
        const sourceIndex = nextInventory.findIndex(stack => stack?.id === ingredient.id && stack.count > 0);
        if (sourceIndex < 0) return { ok: false, reason: 'missing-items' };
        const source = nextInventory[sourceIndex];
        nextCraft[ingredient.index] = { id: source.id, count: 1 };
        if (source.damage) nextCraft[ingredient.index].damage = source.damage;
        source.count--;
        if (source.count <= 0) nextInventory[sourceIndex] = null;
    }

    inventory.slots = nextInventory;
    craftInv.slots = nextCraft;
    return { ok: true };
}
