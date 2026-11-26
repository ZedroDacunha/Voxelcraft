// Parte 2: estudos de cor e contraste sobre o formato 1 escolhido.
// Não altera o jogo nem o desenho ou os recortes escolhidos na parte anterior.
import { LEAF_SHAPE_EXAMPLES, chosenLeafUncut } from './proposta-formatos-folhas.js';

const chosen = LEAF_SHAPE_EXAMPLES[0];
const clamp = value => Math.max(0, Math.min(255, Math.round(value)));

const profiles = [
    {
        id: 'natural', badge: 'Cor 1 · Natural', tag: 'Equilíbrio com a grama',
        title: '1 — Verde natural', recommended: true,
        description: 'Verde equilibrado com leve ganho de luz, preservando o contraste entre as folhas e as sombras.',
        color: ([r, g, b]) => [r * 1.08 + 2, g * 1.08 + 3, b * 1.08 + 1],
    },
    {
        id: 'solar', badge: 'Cor 2 · Solar', tag: 'Luz mais quente',
        title: '2 — Verde solar',
        description: 'Luzes mais quentes e vivas, com um toque oliva nas áreas iluminadas e sombras ainda legíveis.',
        color: ([r, g, b]) => [r * 1.16 + 3, g * 1.12 + 7, b * 1.02 + 1],
    },
    {
        id: 'floresta', badge: 'Cor 3 · Floresta', tag: 'Sombra fresca',
        title: '3 — Verde de floresta',
        description: 'Verde mais frio e profundo, com sombras discretamente azuladas e folhas mais sóbrias.',
        color: ([r, g, b]) => [r * 0.87 + 1, g * 1.02 + 2, b * 1.14 + 2],
    },
    {
        id: 'suave', badge: 'Cor 4 · Suave', tag: 'Contraste macio',
        title: '4 — Verde suave',
        description: 'Tons médios mais próximos e sombras mais abertas, para uma copa de aparência macia.',
        color: ([r, g, b]) => [r * 0.78 + 18, g * 0.78 + 27, b * 0.78 + 12],
    },
];

// A mesma cor escolhida, inclusive sob os recortes da parte 2.
export function naturalLeafUncut(x, y, alt = 0) {
    return [...profiles[0].color(chosenLeafUncut(x, y, alt)).map(clamp), 255];
}

export const LEAF_COLOR_EXAMPLES = profiles.map(({ color, ...profile }) => {
    const grids = [0, 1].map(alt => Array.from({ length: 32 }, (_, y) =>
        Array.from({ length: 32 }, (_, x) => {
            const pixel = chosen.leaves(x, y, alt);
            return pixel[3] === 0 ? [0, 0, 0, 0] : [...color(pixel).map(clamp), 255];
        })
    ));
    return {
        ...profile,
        wood: chosen.wood,
        woodEnd: chosen.woodEnd,
        leaves: (x, y, alt = 0) => grids[alt ? 1 : 0][y][x],
    };
});
