// Parte 3: recortes experimentais para o formato oval e verde natural escolhidos.
// Apenas a transparência muda; os pixels não recortados mantêm o desenho e a cor.
import { LEAF_COLOR_EXAMPLES, naturalLeafUncut } from './proposta-cores-folhas.js';

const reference = LEAF_COLOR_EXAMPLES[0];
const SIZE = 32;
const SHAPES = [
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [1, 2]],
];

function hash(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function makeMask(alt, target) {
    const seed = alt ? 2417 : 1409;
    const mask = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    const cells = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        cells.push({ x, y, order: hash(x, y, seed + 71) });
    }
    cells.sort((a, b) => a.order - b.order);
    let holes = 0;
    for (const { x, y } of cells) {
        const ox = (x * 4 + Math.floor(hash(x, y, seed + 11) * 4)) % SIZE;
        const oy = (y * 4 + Math.floor(hash(x, y, seed + 31) * 4)) % SIZE;
        const shape = SHAPES[Math.floor(hash(x, y, seed + 53) * SHAPES.length)];
        for (const [dx, dy] of shape) {
            if (holes >= target) break;
            const px = (ox + dx) % SIZE, py = (oy + dy) % SIZE;
            if (!mask[py][px]) { mask[py][px] = true; holes++; }
        }
    }
    if (holes !== target) throw new Error('Não foi possível distribuir os recortes da folha');
    return mask;
}

const profiles = [
    {
        id: 'densa', badge: 'Abertura 1 · Discreta', tag: 'Poucos recortes',
        title: '1 — Copa mais fechada',
        description: 'Pequenas aberturas espaçadas: copa mais cheia e menos céu visível através dos blocos.',
        holes: 41,
    },
    {
        id: 'atual', badge: 'Abertura 2 · Referência', tag: 'Recortes da parte 2',
        title: '2 — Abertura atual', recommended: true,
        description: 'Mantém exatamente os recortes usados na escolha do verde natural; serve de referência para as demais opções.',
        holes: null,
    },
    {
        id: 'arejada', badge: 'Abertura 3 · Arejada', tag: 'Mais respiro',
        title: '3 — Copa arejada',
        description: 'Mais pequenos espaços entre as folhas, oferecendo mais vislumbres do céu e do interior da copa.',
        holes: 133,
    },
    {
        id: 'luminosa', badge: 'Abertura 4 · Aberta', tag: 'Aberturas mais frequentes',
        title: '4 — Copa aberta',
        description: 'Recortes mais frequentes para uma copa mais leve; a sobreposição de blocos ainda reduz a visão através dela.',
        holes: 195,
    },
];

export const LEAF_OPENING_EXAMPLES = profiles.map(({ holes, ...profile }) => {
    const masks = holes === null ? null : [makeMask(0, holes), makeMask(1, holes)];
    return {
        ...profile,
        wood: reference.wood,
        woodEnd: reference.woodEnd,
        leaves(x, y, alt = 0) {
            if (!masks) return reference.leaves(x, y, alt);
            return masks[alt ? 1 : 0][y][x] ? [0, 0, 0, 0] : naturalLeafUncut(x, y, alt);
        },
    };
});
