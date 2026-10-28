import { ITEMS } from './world-catalog.js';

const slotHtmlCache = new WeakMap();

export function stackHtml(stack) {
    if (!stack) return '';
    let html = `<div class="slot-icon ico-${stack.id}"></div>`;
    if (stack.count > 1) html += `<span class="slot-count">${stack.count}</span>`;
    const item = ITEMS[stack.id];
    if (item.maxDurability && stack.damage > 0) {
        const remaining = Math.max(0, 1 - stack.damage / item.maxDurability);
        const hue = (remaining * 120).toFixed(0);
        html += `<div class="dur"><div style="width:${(remaining * 100).toFixed(0)}%;background:hsl(${hue},80%,45%)"></div></div>`;
    }
    return html;
}

export function updateSlotElement(element, stack) {
    const html = stackHtml(stack);
    if (slotHtmlCache.get(element) === html) return;
    element.innerHTML = html;
    slotHtmlCache.set(element, html);
}
