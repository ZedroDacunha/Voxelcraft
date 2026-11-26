// Parte 1: detalhes pixelados sobre a casca atual. Só a lateral é alterada;
// topo, folhagem e paleta da árvore permanecem como no jogo.
import { createCurrentTreeTextures } from './proposta-texturas-arvore.js';
import { BALANCED_TREE_TEXTURES } from '../world-tree-textures.js';

// Congela a casca e o topo anteriores, para que as comparações não mudem
// depois da aplicação no jogo. As folhas continuam sendo as atuais.
export function createPreviousTrunkTextures() {
    return { ...createCurrentTreeTextures(), wood: BALANCED_TREE_TEXTURES.wood, woodEnd: BALANCED_TREE_TEXTURES.woodEnd };
}
const base = createPreviousTrunkTextures();
const size = 32;
const mod = n => ((n % size) + size) % size;
const clamp = n => Math.max(0, Math.min(255, Math.round(n)));

function createOverlay() {
    const grid = Array.from({ length: size }, () => Array(size).fill(0));
    return {
        grid,
        pixel(x, y, amount) {
            const px = mod(x), py = mod(y);
            grid[py][px] = Math.max(-44, Math.min(44, grid[py][px] + amount));
        },
        stroke(x, y, offsets, amount) {
            for (let i = 0; i < offsets.length; i++) this.pixel(x + offsets[i], y + i, amount);
        },
    };
}

function fibers() {
    const o = createOverlay();
    const lines = [
        [2, 1, 5], [7, 8, 6], [12, 18, 5], [18, 4, 7], [25, 12, 6], [29, 24, 7],
        [3, 21, 6], [10, 29, 5], [16, 15, 5], [22, 25, 5], [27, 2, 4],
        [6, 16, 5], [14, 27, 6], [20, 13, 5], [30, 7, 6],
    ];
    for (const [x, y, length] of lines) {
        o.stroke(x, y, Array.from({ length }, (_, i) => i >= 4 ? 1 : 0), 28);
        o.stroke(x + 1, y + 1, Array.from({ length: length - 2 }, (_, i) => i >= 3 ? 1 : 0), -15);
    }
    return o.grid;
}

function fissures() {
    const o = createOverlay();
    const cuts = [[3, 2], [10, 12], [17, 23], [23, 5], [29, 16], [6, 26], [15, 4], [25, 28], [1, 17], [19, 13]];
    for (const [x, y] of cuts) {
        const path = [0, 0, 1, 1, 0, 0, -1, -1];
        o.stroke(x, y, path, -37);
        o.stroke(x + 1, y + 1, path.slice(0, -2), 22);
        o.pixel(x + 2, y + 3, -24);
    }
    return o.grid;
}

function plates() {
    const o = createOverlay();
    const seams = [[1, 6], [8, 20], [14, 9], [20, 25], [26, 14], [4, 30], [16, 29], [28, 3]];
    for (const [x, y] of seams) {
        for (const [dx, dy] of [[0, 1], [1, 1], [2, 0], [3, 0], [4, 1]]) {
            o.pixel(x + dx, y + dy, -34);
            o.pixel(x + dx, y + dy + 1, 24);
        }
        o.stroke(x + 4, y + 1, [0, 0, 1, 1], -23);
    }
    return o.grid;
}

function knots() {
    const o = createOverlay();
    for (const [x, y] of [[7, 7], [23, 22]]) {
        const rows = ['..--..', '.-++-.', '-+..+-', '-+.-+-', '.-++-.', '..--..'];
        for (let dy = 0; dy < rows.length; dy++) for (let dx = 0; dx < rows[dy].length; dx++) {
            if (rows[dy][dx] === '-') o.pixel(x + dx, y + dy, -38);
            if (rows[dy][dx] === '+') o.pixel(x + dx, y + dy, 25);
        }
        o.stroke(x + 2, y - 3, [0, 0, -1], 18);
        o.stroke(x + 3, y + 6, [0, 0, 1], -21);
    }
    return o.grid;
}

function makeExample(info, overlay) {
    return {
        ...base, ...info,
        wood(x, y) {
            const px = mod(x), py = mod(y);
            const color = base.wood(px, py), d = overlay[py][px];
            return [clamp(color[0] + d), clamp(color[1] + d * 0.78), clamp(color[2] + d * 0.55), color[3]];
        },
    };
}

export const BARK_DETAIL_EXAMPLES = [
    makeExample({ id: 'fibras', badge: 'Detalhe 1 · Fibras', tag: 'Traços finos', title: '1 — Fibras delicadas', recommended: true,
        description: 'Pequenos traços verticais de luz e sombra acompanham o sentido natural da casca.' }, fibers()),
    makeExample({ id: 'fissuras', badge: 'Detalhe 2 · Fissuras', tag: 'Ranhuras irregulares', title: '2 — Fissuras suaves',
        description: 'Ranhuras estreitas e quebradas acrescentam profundidade sem trocar o desenho principal.' }, fissures()),
    makeExample({ id: 'placas', badge: 'Detalhe 3 · Placas', tag: 'Camadas da casca', title: '3 — Placas sobrepostas',
        description: 'Pequenas divisões e bordas iluminadas sugerem placas de casca em camadas.' }, plates()),
    makeExample({ id: 'nos', badge: 'Detalhe 4 · Nós', tag: 'Marcas orgânicas', title: '4 — Nós discretos',
        description: 'Dois pequenos nós e alguns traços ao redor criam marcas naturais no tronco.' }, knots()),
];
