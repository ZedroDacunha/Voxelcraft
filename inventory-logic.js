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
