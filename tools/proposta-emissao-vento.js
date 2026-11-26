// Prévia da regra escolhida: emissão discreta em calmaria e mais intensa
// com vento. Os cenários são fixos e ainda não controlam o jogo.
import { createLeafEmissionStyle } from './proposta-emissao-folhas.js';

const clamp = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

// Intensidade simulada de 0 a 1: a transição da calmaria à brisa é
// gradual, e a partir daí permanece entre equilibrada e frequente.
export function leafIntervalForWind(level) {
    const wind = clamp(level);
    if (wind <= 0.2) return lerp(2.8, 1.6, smooth(wind / 0.2));
    return lerp(1.6, 1.0, smooth((wind - 0.2) / 0.8));
}

export const WIND_LEAF_SCENARIOS = [
    {
        id: 'calmo', badge: 'Calmaria', tag: 'Emissão discreta',
        title: 'Sem vento', description: 'Uma folhinha a cada ~2,8 segundos por árvore, em média.',
        wind: 0,
    },
    {
        id: 'brisa', badge: 'Vento leve', tag: 'Emissão equilibrada',
        title: 'Vento leve', description: 'Uma folhinha a cada ~1,6 segundo por árvore, em média.',
        wind: 0.2,
    },
    {
        id: 'forte', badge: 'Vento forte', tag: 'Entre equilibrada e frequente',
        title: 'Vento forte', description: 'Uma folhinha a cada ~1 segundo por árvore, em média.',
        wind: 1,
    },
].map(style => createLeafEmissionStyle({ ...style, interval: leafIntervalForWind(style.wind) }));
