// Acessibilidade do inventário e da HUD.
//
// O inventário era uma grade de `div` operável só com mouse: nenhum slot tinha
// nome acessível, foco ou forma de ativar pelo teclado, e as barras de vida,
// fome e fôlego eram só ícones. Este módulo concentra o que dá para decidir sem
// DOM — rótulos em texto, navegação entre slots e mapeamento de teclas — para o
// `game.js` apenas aplicar no documento.
import { ITEMS } from './world-catalog.js';
import { hungerStage } from './world-survival-rules.js';

/** Nome acessível de um slot ("Vazio", "Maçã, 3 unidades", "Picareta, 62% de durabilidade"). */
export function slotLabel(stack, items = ITEMS) {
    if (!stack || !stack.count) return 'Vazio';
    const item = items[stack.id];
    const name = item?.name ?? 'Item';
    let label = stack.count > 1 ? `${name}, ${stack.count} unidades` : name;
    if (item?.maxDurability && stack.damage > 0) {
        const remaining = Math.max(0, Math.min(100, Math.round((1 - stack.damage / item.maxDurability) * 100)));
        label += `, ${remaining}% de durabilidade`;
    }
    return label;
}

/**
 * Próxima posição de foco dentro de uma grade, ou `null` quando o movimento não
 * sai do lugar (borda) — nesse caso o foco fica onde está.
 *
 * `index`/`total` são posições na ordem visual da grade, não os índices do
 * inventário (a hotbar e a grade principal compartilham os mesmos slots).
 */
export function nextSlotIndex({ index, total, columns = 1, key } = {}) {
    if (!Number.isInteger(index) || !Number.isInteger(total) || total <= 0) return null;
    if (index < 0 || index >= total) return null;
    const cols = Math.max(1, Math.min(Number(columns) || 1, total));
    const rows = Math.ceil(total / cols);
    const row = Math.floor(index / cols);
    const col = index % cols;
    switch (key) {
        case 'ArrowRight':
            return col + 1 < cols && index + 1 < total ? index + 1 : null;
        case 'ArrowLeft':
            return col > 0 ? index - 1 : null;
        case 'ArrowDown': {
            const next = index + cols;
            return row + 1 < rows && next < total ? next : null;
        }
        case 'ArrowUp':
            return row > 0 ? index - cols : null;
        case 'Home':
            return index === 0 ? null : 0;
        case 'End':
            return index === total - 1 ? null : total - 1;
        default:
            return null;
    }
}

/**
 * Teclas que equivalem a um clique no slot.
 *
 * - `Enter` → clique esquerdo (pega/cola a pilha inteira)
 * - `Espaço` → clique direito (pega/cola um item, divide a pilha)
 * - `Enter` ou `Espaço` com Shift → mover rápido para o outro lado
 */
export function keyToSlotAction(key, { shiftKey = false } = {}) {
    if (key === 'Enter') return { button: 0, shiftKey };
    if (key === ' ' || key === 'Spacebar') return shiftKey ? { button: 0, shiftKey: true } : { button: 2, shiftKey: false };
    return null;
}

const clampInt = (value, max) => Math.max(0, Math.min(max, Math.round(Number(value) || 0)));

/** Textos das três barras da HUD, para `aria-label`/região viva. */
export function statusLabels({ health = 0, hunger = 0, breath = 0, maxHealth = 20, maxHunger = 20, maxBreath = 20 } = {}) {
    const h = clampInt(health, maxHealth);
    const f = clampInt(hunger, maxHunger);
    const b = clampInt(breath, maxBreath);
    const stage = hungerStage(f);
    const hungerNote = stage === 'empty' ? ' (fome zerada, você está perdendo vida)'
        : stage === 'low' ? ' (fome baixa)' : '';
    return {
        health: `Vida: ${h} de ${maxHealth}`,
        hunger: `Fome: ${f} de ${maxHunger}${hungerNote}`,
        breath: `Fôlego: ${b} de ${maxBreath}`,
        summary: `Vida ${h} de ${maxHealth}. Fome ${f} de ${maxHunger}${hungerNote}. Fôlego ${b} de ${maxBreath}.`,
    };
}
