import { ITEMS } from './world-catalog.js';
import { invTouchRightClick } from './inventory-logic.js';

// Botão direito: cada espaço de criação recebe no máximo uma unidade por
// gesto. Esta regra nunca troca pilhas incompatíveis durante o arraste.
export function createCraftRightDrag({ craftInv, cursor, gridSize }) {
    let held = null;
    const visited = new Set();

    function cancel() { held = null; visited.clear(); }
    function validIndex(index) {
        const n = gridSize();
        return Number.isInteger(index) && index >= 0 && index < n * n && index < craftInv.slots.length;
    }
    function compatible(index, stack) {
        const target = craftInv.slots[index];
        return !target || (target.id === stack.id && ITEMS[stack.id]?.maxStack > 1);
    }
    function visit(index) {
        if (!held || cursor.stack !== held || !(held.count > 0) || !validIndex(index) || visited.has(index)) return false;
        visited.add(index);
        if (!compatible(index, held)) return false;
        const target = craftInv.slots[index];
        if (target && target.count >= ITEMS[held.id].maxStack) return false;
        invTouchRightClick(craftInv, index, cursor);
        return true;
    }
    // Um clique isolado em pilha incompatível continua usando o clique direito
    // normal (troca); somente gestos que começam num destino válido são nossos.
    function start(index = null) {
        cancel();
        const stack = cursor.stack;
        if (!stack || !(stack.count > 0) || !ITEMS[stack.id]) return false;
        if (index !== null && (!validIndex(index) || !compatible(index, stack))) return false;
        held = stack;
        if (index !== null) visit(index);
        return true;
    }
    return { start, visit, cancel, get active() { return held !== null; } };
}

// Detecta também os espaços que o mouse atravessou entre dois eventos, para
// não pular slots quando o usuário arrasta rápido. A ordenação segue o percurso.
export function craftSlotsAlongSegment(from, to, slots) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const hits = [];
    for (const slot of slots) {
        let enter = 0, exit = 1;
        for (const [origin, delta, min, max] of [
            [from.x, dx, slot.left, slot.right], [from.y, dy, slot.top, slot.bottom],
        ]) {
            if (delta === 0) {
                if (origin < min || origin > max) { enter = 2; break; }
            } else {
                const a = (min - origin) / delta, b = (max - origin) / delta;
                enter = Math.max(enter, Math.min(a, b));
                exit = Math.min(exit, Math.max(a, b));
                if (enter > exit) break;
            }
        }
        if (enter <= exit && enter <= 1 && exit >= 0) hits.push({ index: slot.index, enter });
    }
    hits.sort((a, b) => a.enter - b.enter || a.index - b.index);
    return hits.map(hit => hit.index);
}
