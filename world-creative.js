import { ITEMS } from './world-catalog.js';
export const CREATIVE = 'creative', SURVIVAL = 'survival';
export function parseGameMode(value) {
    const v = String(value ?? '').toLowerCase().trim();
    if (['creative','criativo','1'].includes(v)) return CREATIVE;
    if (['survival','sobrevivencia','sobrevivência','0'].includes(v)) return SURVIVAL;
    return null;
}
export function creativeItems(query = '') {
    const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const search = normalize(query).trim();
    return Object.entries(ITEMS).filter(([,item]) => item && item.name && (item.sprite || item.block) && normalize(item.name).includes(search))
        .map(([id]) => Number(id)).sort((a,b) => a-b);
}
export function creativeStack(id, one = false) {
    const item = ITEMS[id];
    return item ? { id: Number(id), count: one ? 1 : item.maxStack } : null;
}
export function flightTap(state, now, creative) {
    if (!creative || !Number.isFinite(now)) return false;
    const toggle = now - state.lastTap >= 0 && now - state.lastTap <= 0.3;
    state.lastTap = toggle ? -Infinity : now;
    if (toggle) state.flying = !state.flying;
    return toggle;
}
