// Parte 2: cor/contraste da casca mantendo a mesma arte de fibras escolhida.
import { BARK_DETAIL_EXAMPLES } from './proposta-detalhes-tronco.js';

const fibers = BARK_DETAIL_EXAMPLES[0];
const anchor = [90, 62, 39];
const clamp = value => Math.max(0, Math.min(255, Math.round(value)));

function makeColor(info, gain, shift) {
    return {
        ...fibers, ...info,
        wood(x, y) {
            const original = fibers.wood(x, y);
            return [
                ...original.slice(0, 3).map((channel, index) => clamp((channel - anchor[index]) * gain + anchor[index] + shift[index])),
                original[3],
            ];
        },
    };
}

export const BARK_COLOR_EXAMPLES = [
    makeColor({ id: 'natural', badge: 'Cor 1 · Natural', tag: 'Fibras com tons originais', title: '1 — Castanho natural', recommended: true,
        description: 'Mantém o castanho original da casca, agora com as fibras delicadas escolhidas.' }, 1, [0, 0, 0]),
    makeColor({ id: 'quente', badge: 'Cor 2 · Quente', tag: 'Madeira mais quente', title: '2 — Castanho quente', recommended: false,
        description: 'Aproxima os marrons de tons quentes de madeira, sem aumentar muito o contraste.' }, 1, [12, 3, -3]),
    makeColor({ id: 'profundo', badge: 'Cor 3 · Profundo', tag: 'Sombras mais presentes', title: '3 — Castanho profundo', recommended: false,
        description: 'Aumenta o contraste entre fissuras e relevos, com uma sombra um pouco mais escura.' }, 1.15, [-3, -2, -1]),
    makeColor({ id: 'claro', badge: 'Cor 4 · Claro', tag: 'Relevo suave', title: '4 — Castanho claro', recommended: false,
        description: 'Clareia a casca e suaviza o contraste para deixar as fibras mais leves.' }, 0.90, [13, 10, 6]),
];
