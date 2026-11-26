// Parte 1: estudos do formato dos tufos, sem alterar as texturas do jogo.
// As quatro propostas usam a mesma paleta, posições e máscara de transparência
// da folha equilibrada atual, para concentrar a comparação no desenho.
import { BALANCED_TREE_TEXTURES } from '../world-tree-textures.js';

const SIZE = 32;
const PALETTE = {
    back: { d: [32, 62, 30], s: [42, 78, 36], m: [56, 100, 44], l: [72, 118, 50], h: [84, 132, 54] },
    mid: { d: [36, 68, 32], s: [50, 92, 42], m: [74, 122, 52], l: [96, 144, 62], h: [116, 160, 68] },
    front: { d: [44, 80, 38], s: [64, 108, 48], m: [92, 140, 60], l: [116, 162, 68], h: [142, 180, 78] },
};

const DESIGNS = [
    {
        id: 'ovais', badge: 'Formato 1 · Ovais', tag: 'Folhas individuais',
        title: '1 — Ovais sobrepostas',
        description: 'Folhas arredondadas, separadas por pequenas sombras, com contornos simples e orientação variada.',
        sprites: [
            ['..hh..', '.hllm.', 'hllmmm', 'lmmmms', '.mmss.', '..dd..'],
            ['..hh...', '.hllm..', 'hllmmms', '.mmmms.', '..ssd..'],
            ['..h...', '.hllm.', 'hllmms', 'lmmmms', '.mmsd.', '..dd..'],
        ],
    },
    {
        id: 'lobos', badge: 'Formato 2 · Lobos', tag: 'Tufos agrupados',
        title: '2 — Tufos trilobados',
        description: 'Pequenos grupos de três pontas arredondadas, para ler a copa como conjuntos de folhas em vez de folhas soltas.',
        sprites: [
            ['.hh.hhh.', 'hllhllhm', 'llmlmmms', 'lmmmmmmS', '.mmssms.', '..sddds.'],
            ['.hh.hhh.', 'hllhllhm', 'lmmhmmms', 'lmmmmmmS', '.mssmms.', '..ddds..'],
            ['.hh.hh..', 'hllhllh.', 'llmlmmms', '.mmmmms.', '..msssd.', '...dd...'],
        ],
    },
    {
        id: 'pontudas', badge: 'Formato 3 · Pontudas', tag: 'Folíolos alongados',
        title: '3 — Folíolos alongados',
        description: 'Folíolos mais estreitos e com pontas, alternando a direção para formar raminhos delicados.',
        sprites: [
            ['...h....', '..hll...', 'h.hllm.h', 'hlmmmslm', '.mmmsms.', '..msms..', '...dd...'],
            ['.h...h..', 'hll.hll.', '.hlmhllm', '..mmmmmS', '.hmmms..', '..mss...', '...dd...'],
            ['..h..h..', '.hl.hll.', 'hllmhllm', '.hlmmmms', '..mmmss.', '...ds...'],
        ],
    },
    {
        id: 'leques', badge: 'Formato 4 · Leques', tag: 'Massas amplas',
        title: '4 — Leques arredondados',
        description: 'Tufos mais largos em camadas curvas, com bordas escalonadas e detalhes internos discretos.',
        sprites: [
            ['..hhh....', '.hlllhhh.', 'hllmlhllm', 'lmmmmmmms', 'lmmssmmms', '.mssddss.', '..dddd...'],
            ['...hhh...', '.hhlllhh.', 'hllmmllhm', 'lmmmmmmms', '.mmssmms.', '..ssdds..', '...ddd...'],
            ['..hhh.h..', '.hlllhll.', 'hllmlhllm', 'lmmmmmmms', '.mmssmms.', '..sddds..'],
        ],
    },
];

function hash(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function stamp(grid, sprite, ox, oy, colors, flip) {
    for (let y = 0; y < sprite.length; y++) {
        const row = sprite[y];
        for (let x = 0; x < row.length; x++) {
            const symbol = row[flip ? row.length - x - 1 : x].toLowerCase();
            if (!colors[symbol]) continue;
            grid[(oy + y) % SIZE][(ox + x) % SIZE] = [...colors[symbol], 255];
        }
    }
}

function buildLeafGrid(sprites, alt, cutout = true) {
    const seed = alt ? 1201 : 1101;
    const grid = Array.from({ length: SIZE }, () =>
        Array.from({ length: SIZE }, () => [...PALETTE.back.d, 255]));
    for (const [pass, count, offset] of [['back', 5, 100], ['mid', 5, 200], ['front', 4, 300]]) {
        for (let gy = 0; gy < count; gy++) for (let gx = 0; gx < count; gx++) {
            const x = Math.floor((gx + 0.15 + hash(gx, gy, seed + offset) * 0.7) * SIZE / count);
            const y = Math.floor((gy + 0.15 + hash(gx, gy, seed + offset + 19) * 0.7) * SIZE / count);
            const sprite = sprites[Math.floor(hash(gx, gy, seed + offset + 53) * sprites.length)];
            stamp(grid, sprite, x, y, PALETTE[pass], hash(gx, gy, seed + offset + 97) > 0.5);
        }
    }
    // Conserva exatamente os mesmos recortes do jogo nesta fase. Os recortes
    // serão estudados separadamente, depois de escolher o formato.
    if (cutout) for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        if (BALANCED_TREE_TEXTURES.leaves(x, y, alt)[3] === 0) grid[y][x] = [0, 0, 0, 0];
    }
    return grid;
}

// A versão sem máscara permite experimentar outros recortes sem pintar de
// verde os buracos antigos: os detalhes das folhas permanecem sob eles.
const uncutChosen = [0, 1].map(alt => buildLeafGrid(DESIGNS[0].sprites, alt, false));
export const chosenLeafUncut = (x, y, alt = 0) => uncutChosen[alt ? 1 : 0][y][x];

export const LEAF_SHAPE_EXAMPLES = DESIGNS.map(design => {
    const grids = [buildLeafGrid(design.sprites, 0), buildLeafGrid(design.sprites, 1)];
    return {
        ...design,
        wood: BALANCED_TREE_TEXTURES.wood,
        woodEnd: BALANCED_TREE_TEXTURES.woodEnd,
        leaves: (x, y, alt = 0) => grids[alt ? 1 : 0][y][x],
    };
});
