// Parte 3: propostas para o corte da tora. A casca escolhida e as folhas
// são compartilhadas; o colar externo do topo atual é preservado.
import { BARK_COLOR_EXAMPLES } from './proposta-cores-tronco.js';

const chosen = BARK_COLOR_EXAMPLES[0];
const clamp = n => Math.max(0, Math.min(255, Math.round(n)));

// Octógono aproximado apenas para manter os detalhes longe do colar de casca.
function distance(x, y) {
    const cx = x - 15.5, cy = y - 15.5;
    return Math.max(Math.abs(cx), Math.abs(cy)) * 0.76 + Math.hypot(cx, cy) * 0.28;
}
function mix(a, b, amount) { return a.map((v, i) => i === 3 ? v : clamp(v * (1 - amount) + b[i] * amount)); }

function soften(x, y, color) {
    const d = distance(x, y);
    // A medula e o pequeno veio já existente ficam iguais à referência.
    if (d < 3.5 || d >= 11.9) return color;
    return mix(color, [183, 148, 98, 255], 0.30);
}

function fineRings(x, y, color) {
    const cx = x - 15.5, cy = y - 15.5, d = distance(x, y);
    if (d >= 11.9 || d < 1.7) return color;
    const angle = Math.atan2(cy, cx);
    const organic = d + 0.20 * Math.sin(angle * 3 + d * 0.35);
    const band = ((organic - 1.8) % 2.5 + 2.5) % 2.5;
    if (band < 0.72) return [145, 107, 63, 255];
    return Math.floor((organic - 1.8) / 2.5) % 2 ? [199, 164, 108, 255] : [213, 180, 124, 255];
}

function veins(x, y, color) {
    if (distance(x, y) >= 11.9) return color;
    // Traços radiais curtos sugerem fibras no corte, sem cobrir os anéis.
    const marks = [
        [9, 9], [10, 10], [11, 11], [11, 12],
        [22, 9], [21, 10], [20, 11],
        [22, 20], [21, 19], [20, 18],
        [9, 22], [10, 21], [11, 20],
        [16, 6], [16, 7], [17, 8],
    ];
    if (!marks.some(([mx, my]) => mx === x && my === y)) return color;
    return mix(color, [97, 65, 39, 255], 0.45);
}

function makeExample(info, transform) {
    return {
        ...chosen, ...info,
        woodEnd(x, y) {
            const px = ((x % 32) + 32) % 32, py = ((y % 32) + 32) % 32;
            const color = chosen.woodEnd(px, py);
            return transform ? transform(px, py, color) : color;
        },
    };
}

export const TRUNK_TOP_EXAMPLES = [
    makeExample({ id: 'atual', badge: 'Topo 1 · Anterior', tag: 'Referência anterior', title: '1 — Topo anterior', recommended: false,
        description: 'Mantém o desenho anterior dos anéis e da medula, sem alterar o corte.' }, null),
    makeExample({ id: 'suave', badge: 'Topo 2 · Suave', tag: 'Anéis discretos', title: '2 — Anéis suaves', recommended: true,
        description: 'Suaviza o contraste dos anéis existentes, preservando o desenho e o veio central.' }, soften),
    makeExample({ id: 'finos', badge: 'Topo 3 · Fino', tag: 'Anéis delicados', title: '3 — Anéis finos', recommended: false,
        description: 'Redesenha os anéis com linhas mais finas e uma leve irregularidade orgânica.' }, fineRings),
    makeExample({ id: 'veios', badge: 'Topo 4 · Veios', tag: 'Fibras no corte', title: '4 — Veios discretos', recommended: false,
        description: 'Mantém os anéis atuais e acrescenta pequenos traços radiais na madeira.' }, veins),
];
