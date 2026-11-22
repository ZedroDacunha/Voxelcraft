import { copperArmorSprite } from './world-copper-armor-icons.js';

// Mesma silhueta dos ícones de cobre, com a paleta azul-ciano aprovada.
const colors = new Map(Object.entries({
    '84,41,29': [24, 88, 112], '164,74,42': [48, 152, 176],
    '207,117,74': [80, 196, 216], '223,137,90': [136, 232, 240],
    '241,170,118': [216, 253, 255], '130,57,31': [32, 119, 145],
    '99,51,35': [25, 101, 125], '72,37,28': [16, 67, 89],
    '182,79,42': [62, 174, 197],
}));
const cache = new Map();
export function diamondArmorSprite(kind) {
    if (!/^diamond-(helmet|chestplate|leggings|boots)$/.test(kind)) return null;
    if (!cache.has(kind)) {
        const sprite = copperArmorSprite(kind.replace(/^diamond-/, 'copper-'));
        cache.set(kind, sprite.map(row => row.map(pixel => pixel ? colors.get(pixel.join(',')) : null)));
    }
    return cache.get(kind);
}
