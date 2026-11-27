// Segunda rodada: variações sutis da textura Natural delicada escolhida.
// Todas conservam a silhueta 12×12 e o movimento da rodada anterior.
import { FALLING_LEAF_TEXTURE_EXAMPLES } from './proposta-textura-folha-caindo.js';

const original = FALLING_LEAF_TEXTURE_EXAMPLES[0];

function paint(changes) {
    const rows = original.pixels.map(row => [...row]);
    for (const [x, y, symbol] of changes) {
        if (rows[y][x] === '.') throw new Error('O refinamento não deve mudar o contorno');
        rows[y][x] = symbol;
    }
    return rows.map(row => row.join(''));
}

export const NATURAL_LEAF_REFINEMENTS = [
    {
        id: 'natural-polida', badge: '1 · Polida', tag: 'Natural equilibrada', recommended: true,
        title: '1 — Natural polida',
        description: 'Suaviza a nervura central e acrescenta uma transição discreta entre luz e sombra.',
        palette: { ...original.palette, v: [80, 128, 54, 255], a: [108, 157, 65, 255] },
        pixels: paint([[5, 4, 'v'], [5, 5, 'v'], [6, 6, 'v'], [6, 7, 'v'], [6, 8, 's'], [4, 6, 'a'], [5, 7, 'a']]),
    },
    {
        id: 'natural-nervura', badge: '2 · Nervura', tag: 'Traço delicado',
        title: '2 — Nervura suave',
        description: 'Um fio verde-claro sugere a nervura central sem virar uma linha muito marcada.',
        palette: { ...original.palette, v: [92, 125, 54, 255], a: [57, 90, 37, 255] },
        pixels: paint([[5, 3, 'v'], [5, 4, 'v'], [5, 5, 'v'], [6, 6, 'v'], [6, 7, 'v'], [6, 8, 'a'], [4, 5, 'm']]),
    },
    {
        id: 'natural-luz', badge: '3 · Luz', tag: 'Luz quente discreta',
        title: '3 — Luz orgânica',
        description: 'Uma área iluminada maior e pequenas variações de verde dão volume à face da folha.',
        palette: { ...original.palette, h: [153, 190, 83, 255], l: [125, 169, 71, 255], v: [110, 159, 66, 255], a: [82, 131, 54, 255] },
        pixels: paint([[4, 3, 'h'], [4, 4, 'h'], [5, 4, 'v'], [5, 5, 'v'], [6, 5, 'v'], [4, 6, 'l'], [5, 6, 'a'], [6, 6, 'a'], [6, 7, 'a']]),
    },
    {
        id: 'natural-profunda', badge: '4 · Volume', tag: 'Sombra suave',
        title: '4 — Volume natural',
        description: 'Borda e parte inferior um pouco mais escuras, com miolo verde preservado.',
        palette: { ...original.palette, h: [148, 189, 82, 255], m: [92, 143, 59, 255], s: [61, 105, 46, 255], d: [40, 78, 36, 255], v: [79, 127, 53, 255] },
        pixels: paint([[5, 4, 'v'], [5, 5, 'v'], [6, 6, 'v'], [5, 7, 'v'], [6, 7, 's'], [6, 8, 's'], [7, 7, 'd']]),
    },
];
