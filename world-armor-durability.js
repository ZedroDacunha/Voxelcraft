import { ITEMS } from './world-catalog.js';
import { armorProtectsFrom } from './world-armor-protection.js';

// Perdas próximas ao comportamento clássico: dano direto desgasta cada peça,
// no mínimo 1 ponto, ou o dano dividido por 4 arredondado para baixo. Fontes
// que ignoram armadura não consomem durabilidade.
export function damageEquippedArmor(slots, amount, source = 'generic') {
    if (!Array.isArray(slots) || !Number.isFinite(amount) || amount <= 0 ||
        !armorProtectsFrom(source)) return [];
    const wear = Math.max(1, Math.floor(amount / 4));
    const broken = [];
    for (let i = 0; i < slots.length; i++) {
        const stack = slots[i], item = stack && ITEMS[stack.id];
        if (!item?.armorSlot || !item.maxDurability) continue;
        stack.damage = (stack.damage || 0) + wear;
        if (stack.damage >= item.maxDurability) {
            broken.push(item.name);
            slots[i] = null;
        }
    }
    return broken;
}
