// Parte 1: desenhos estáticos de folhinhas, apenas para a prévia.
// A queda, a densidade e o comportamento ainda não fazem parte deste estudo.
export const FALLING_LEAF_PALETTE = {
    '.': [0, 0, 0, 0],
    h: [155, 197, 85, 255],
    l: [127, 176, 74, 255],
    m: [101, 154, 66, 255],
    s: [71, 120, 53, 255],
    d: [47, 87, 40, 255],
};

export const FALLING_LEAF_EXAMPLES = [
    {
        id: 'oval', badge: '1 · Oval', tag: 'Natural · Equilibrada',
        title: '1 — Folhinha oval',
        description: 'Folha oval com borda escalonada e luz suave, parecida com os tufos da árvore aprovada.',
        recommended: true,
        pixels: [
            '............',
            '.....h......',
            '....hlm.....',
            '...hllmm....',
            '..hllmmm....',
            '..hllmmms...',
            '..hlmmmsd...',
            '...mmmssd...',
            '....mssdd...',
            '.....sdd....',
            '......s.....',
            '......s.....',
        ],
    },
    {
        id: 'longa', badge: '2 · Alongada', tag: 'Leve · Delicada',
        title: '2 — Folhinha alongada',
        description: 'Silhueta estreita com ponta comprida e um eixo marcado, para uma leitura mais delicada.',
        pixels: [
            '............',
            '.......h....',
            '......hl....',
            '.....hllm...',
            '....hllm....',
            '...hllms....',
            '...lmmms....',
            '..lmmssd....',
            '..mmssdd....',
            '...ssdd.....',
            '...sd.......',
            '..s.........',
        ],
    },
    {
        id: 'redonda', badge: '3 · Redonda', tag: 'Suave · Cheia',
        title: '3 — Folhinha arredondada',
        description: 'Forma mais larga e redonda, com poucos degraus e uma sombra discreta na parte inferior.',
        pixels: [
            '............',
            '...hhhhh....',
            '..hlllllm...',
            '.hllllmmm...',
            '.hlllmmmm...',
            '.hllmmmms...',
            '.llmmmmss...',
            '..mmmsssd...',
            '...msssdd...',
            '....ssdd....',
            '.....s......',
            '.....s......',
        ],
    },
    {
        id: 'lobada', badge: '4 · Recortada', tag: 'Carvalho · Marcante',
        title: '4 — Folhinha recortada',
        description: 'Pequenos lóbulos nas laterais sugerem uma folha de carvalho, mantendo a paleta verde da copa.',
        pixels: [
            '.....h......',
            '....hlm.....',
            '..h.hlm.h...',
            '.hllhllmm...',
            '..llmmmms...',
            '.hllmmmss...',
            '..lmmmmsd...',
            '...msssd....',
            '..mmsddsd...',
            '...sddd.....',
            '....sd......',
            '....s.......',
        ],
    },
];

export function fallingLeafPixel(example, x, y) {
    return (example.palette || FALLING_LEAF_PALETTE)[example.pixels[y][x]];
}
