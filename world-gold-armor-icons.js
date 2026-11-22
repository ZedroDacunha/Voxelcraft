import { copperArmorSprite } from './world-copper-armor-icons.js';

// Mesma silhueta dos ícones de cobre, com a paleta dourada da prévia.
const colors = new Map(Object.entries({
    '84,41,29': [88, 57, 15], '164,74,42': [163, 111, 24],
    '207,117,74': [218, 163, 39], '223,137,90': [239, 193, 48],
    '241,170,118': [255, 226, 112], '130,57,31': [125, 82, 19],
    '99,51,35': [105, 68, 17], '72,37,28': [68, 45, 16],
    '182,79,42': [192, 132, 27],
}));
const cache = new Map();
export function goldArmorSprite(kind) {
    if (!/^gold-(helmet|chestplate|leggings|boots)$/.test(kind)) return null;
    if (!cache.has(kind)) {
        const sprite = copperArmorSprite(kind.replace(/^gold-/, 'copper-'));
        cache.set(kind, sprite.map(row => row.map(pixel => pixel ? colors.get(pixel.join(',')) : null)));
    }
    return cache.get(kind);
}
