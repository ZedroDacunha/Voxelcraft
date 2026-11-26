// Refinamento da folhinha oval escolhida: altera a arte interna, não o contorno.
import { FALLING_LEAF_EXAMPLES, FALLING_LEAF_PALETTE } from './proposta-folhas-caindo.js';

const oval = FALLING_LEAF_EXAMPLES[0];

function repaint(changes) {
    const rows = oval.pixels.map(row => [...row]);
    for (const [x, y, color] of changes) {
        if (rows[y][x] === '.') throw new Error('O detalhe deve permanecer dentro do contorno oval');
        rows[y][x] = color;
    }
    return rows.map(row => row.join(''));
}

export const FALLING_LEAF_TEXTURE_EXAMPLES = [
    {
        id: 'natural', badge: 'Textura 1 · Natural', tag: 'Equilíbrio com a copa', recommended: true,
        title: '1 — Natural delicada',
        description: 'Verde próximo ao da copa, com uma nervura discreta e pequenos volumes suaves.',
        palette: { ...FALLING_LEAF_PALETTE, h: [148, 190, 82, 255], l: [120, 169, 69, 255], m: [95, 145, 61, 255], s: [65, 110, 48, 255], d: [43, 83, 38, 255] },
        pixels: repaint([[5, 4, 's'], [5, 5, 's'], [6, 6, 's'], [6, 7, 's'], [6, 8, 'd'], [3, 6, 'l']]),
    },
    {
        id: 'nervura', badge: 'Textura 2 · Nervura', tag: 'Veio mais visível',
        title: '2 — Nervura iluminada',
        description: 'Um veio claro e inclinado atravessa a folha, com sombra em volta para dar relevo.',
        palette: { ...FALLING_LEAF_PALETTE, h: [160, 198, 91, 255], l: [123, 171, 73, 255], m: [90, 141, 60, 255], s: [59, 103, 46, 255], d: [41, 80, 37, 255] },
        pixels: repaint([[5, 3, 'h'], [5, 4, 'h'], [5, 5, 'l'], [6, 6, 'l'], [6, 7, 'l'], [6, 8, 'm'], [4, 5, 'm'], [7, 6, 's']]),
    },
    {
        id: 'organica', badge: 'Textura 3 · Orgânica', tag: 'Manchas suaves',
        title: '3 — Verde orgânico',
        description: 'Pequenas áreas de luz e sombra quebram a cor lisa sem usar ruído em cada pixel.',
        palette: { ...FALLING_LEAF_PALETTE, h: [146, 188, 81, 255], l: [117, 168, 68, 255], m: [88, 143, 59, 255], s: [61, 107, 47, 255], d: [40, 79, 37, 255] },
        pixels: repaint([[4, 3, 'h'], [4, 4, 'h'], [5, 4, 'l'], [6, 4, 's'], [6, 5, 's'], [3, 5, 'l'], [4, 6, 'l'], [5, 6, 'm'], [5, 7, 'm']]),
    },
    {
        id: 'suave', badge: 'Textura 4 · Suave', tag: 'Desenho simples',
        title: '4 — Verde ilustrado',
        description: 'Poucos tons e transições mais macias, com uma área clara ampla e sombra limpa.',
        palette: { ...FALLING_LEAF_PALETTE, h: [145, 184, 83, 255], l: [127, 171, 75, 255], m: [104, 151, 67, 255], s: [81, 127, 57, 255], d: [60, 103, 48, 255] },
        pixels: repaint([[5, 3, 'l'], [5, 4, 'l'], [6, 4, 'l'], [4, 5, 'l'], [5, 5, 'l'], [6, 5, 'm'], [3, 6, 'l'], [4, 6, 'l'], [5, 6, 'm'], [4, 7, 'm']]),
    },
];
