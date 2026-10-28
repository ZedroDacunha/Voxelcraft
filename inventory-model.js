import { ITEMS } from './world-catalog.js';

// Estado e operações fundamentais de uma grade de inventário.
export class Inventory {
    constructor(size) {
        this.slots = Array.from({ length: size }, () => null);
    }

    add(id, count, from = 0, to = this.slots.length, damage = 0) {
        const max = ITEMS[id].maxStack;
        for (let i = from; i < to && count > 0; i++) {
            const stack = this.slots[i];
            if (stack && stack.id === id && stack.count < max) {
                const moved = Math.min(max - stack.count, count);
                stack.count += moved;
                count -= moved;
            }
        }
        for (let i = from; i < to && count > 0; i++) {
            if (!this.slots[i]) {
                const moved = Math.min(max, count);
                const stack = { id, count: moved };
                if (damage > 0) stack.damage = damage;
                this.slots[i] = stack;
                count -= moved;
            }
        }
        return count;
    }

    canAdd(id) {
        const max = ITEMS[id].maxStack;
        return this.slots.some(stack => !stack || (stack.id === id && stack.count < max));
    }

    spaceFor(id) {
        const max = ITEMS[id].maxStack;
        let space = 0;
        for (const stack of this.slots) {
            if (!stack) space += max;
            else if (stack.id === id) space += max - stack.count;
        }
        return space;
    }

    removeOne(slotIndex) {
        const stack = this.slots[slotIndex];
        if (!stack) return false;
        stack.count--;
        if (stack.count <= 0) this.slots[slotIndex] = null;
        return true;
    }
}
