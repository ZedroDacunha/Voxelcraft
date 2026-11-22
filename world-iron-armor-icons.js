import { copperArmorSprite } from './world-copper-armor-icons.js';

// Mesma silhueta aprovada do cobre, recolorida na paleta de ferro aprovada.
const colors = new Map(Object.entries({
    '84,41,29': [65, 72, 77], '164,74,42': [126, 139, 145],
    '207,117,74': [184, 195, 199], '223,137,90': [210, 218, 220],
    '241,170,118': [239, 244, 244], '130,57,31': [96, 106, 111],
    '99,51,35': [78, 87, 91], '72,37,28': [47, 53, 57],
    '182,79,42': [155, 168, 173],
}));
const cache = new Map();
export function ironArmorSprite(kind) {
    if (!/^iron-(helmet|chestplate|leggings|boots)$/.test(kind)) return null;
    if (!cache.has(kind)) {
        const sprite = copperArmorSprite(kind.replace(/^iron-/, 'copper-'));
        cache.set(kind, sprite.map(row => row.map(pixel => pixel ? colors.get(pixel.join(',')) : null)));
    }
    return cache.get(kind);
}
