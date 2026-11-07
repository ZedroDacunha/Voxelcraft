// Ícone de bloco: o cubo isométrico que aparece na barra e no inventário.
//
// O ícone de um bloco era só **uma face** (o tile de cima esticado num
// quadradinho): na barra, dez blocos diferentes viravam dez adesivos iguais. Aqui
// o bloco é desenhado como um cubo visto de quina, com a arte de verdade: topo,
// lateral esquerda e lateral direita (ou a frente, no forno e no baú).
//
// A arte é pintada em 32×32 — o tamanho de uma célula do atlas — e não em 16×16
// como os outros ícones: assim cada pixel do ícone amostra o tile (32×32) quase
// 1:1 e o bloco fica com detalhe de verdade, em vez de um borrão ampliado.
import { TILE_PX } from './world-catalog.js';

/** Lado do ícone de bloco, em pixels. Cabe inteiro numa célula do atlas. */
export const BLOCK_ICON_PX = 32;

/** O sprite é o **ícone** de bloco (arte de UI)? Então ele não é arte plana. */
export function isBlockIcon(sprite) {
    return sprite?.kind === 'block';
}

/**
 * Como um item aparece **no mundo** (caído no chão ou na mão): `'sprite'` é a
 * arte plana de 16×16 e `'cube'` é o bloco em 3D de verdade.
 *
 * O ícone de bloco é arte de UI: se ele fosse tratado como sprite plano, o
 * buildSpriteGeo (que trabalha em 16×16) mostraria só um pedaço do cubo
 * esticado na mão do jogador — foi exatamente esse o bug depois do ícone 3D.
 */
export function itemRenderMode(item) {
    return isBlockIcon(item?.sprite) ? 'cube' : 'sprite';
}

/**
 * Luz de cada face, em relação à textura original.
 *
 * O topo recebe luz cheia e as laterais ficam mais escuras — é o que dá volume
 * ao cubo. A esquerda é mais clara que a direita, como se a luz viesse de cima e
 * da esquerda.
 */
const LUZ = Object.freeze({ topo: 1, esquerda: 0.68, direita: 0.42 });

const escurecer = (cor, fator) => [
    Math.max(0, Math.min(255, Math.round(cor[0] * fator))),
    Math.max(0, Math.min(255, Math.round(cor[1] * fator))),
    Math.max(0, Math.min(255, Math.round(cor[2] * fator))),
];

/**
 * Cor média de uma caixa de `du × dv` texels em volta de `(u, v)`.
 *
 * Um pixel da face cobre mais de um texel do tile; pegar só um deles deixa a
 * superfície chuviscada (pedregulho sofre). A média é o que dá o desenho limpo.
 */
function amostrarCaixa(tile, u, v, du, dv, pixel) {
    const passosX = Math.max(1, Math.round(du * TILE_PX));
    const passosY = Math.max(1, Math.round(dv * TILE_PX));
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < passosX; i++) for (let j = 0; j < passosY; j++) {
        const x = Math.max(0, Math.min(TILE_PX - 1, Math.floor((u + ((i + 0.5) / passosX) * du) * TILE_PX)));
        const y = Math.max(0, Math.min(TILE_PX - 1, Math.floor((v + ((j + 0.5) / passosY) * dv) * TILE_PX)));
        const cor = pixel(tile, x, y);
        if (!cor || cor[3] === 0) continue;
        r += cor[0]; g += cor[1]; b += cor[2]; n++;
    }
    return n ? [r / n, g / n, b / n] : null;
}

/**
 * O cubo isométrico, em `BLOCK_ICON_PX` pixels.
 *
 * A conta é uma projeção isométrica simples: a face de cima é um losango que
 * ocupa a metade de cima do ícone e as duas laterais descem até a base. Para cada
 * pixel da tela, a função descobre **em qual face** ele cai e em que ponto da
 * textura ele está (as coordenadas `a`, `b` e `c` do cubo unitário).
 *
 * `tiles` precisa de `top` e `side`; `front` substitui a lateral direita quando
 * existe (forno, baú). `pixel(tile, x, y)` devolve `[r, g, b, a]`.
 */
export function createBlockIconPixels(tiles, pixel) {
    const N = BLOCK_ICON_PX;
    const hw = N / 2;               // meia-largura do losango de cima
    const hh = N / 4;               // meia-altura do losango de cima
    const lado = N / 2;             // altura das faces laterais
    const cx = (N - 1) / 2;         // centro horizontal (entre os dois pixels do meio)
    const topo = 0;                 // onde o losango começa, no eixo y

    const direita = tiles.front ?? tiles.side;
    const px = Array.from({ length: N }, () => Array(N).fill(null));

    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const telaX = x + 0.5, telaY = y + 0.5;

        // 1) face de cima: a e b vão de 0 a 1 dentro do tile
        const altura = (telaY - topo) / hh;
        const diagonal = (telaX - cx) / hw;
        const a = (altura + diagonal) / 2, b = (altura - diagonal) / 2;
        if (a >= 0 && a <= 1 && b >= 0 && b <= 1) {
            const cor = amostrarCaixa(tiles.top, a, b, 1 / (2 * hw), 1 / (2 * hh), pixel);
            if (cor) px[y][x] = escurecer(cor, LUZ.topo);
            continue;
        }

        // 2) lateral esquerda: b = 1, a anda na horizontal
        const aEsq = (telaX - cx) / hw + 1;
        if (aEsq >= 0 && aEsq <= 1) {
            const c = 1 - (telaY - topo - (aEsq + 1) * hh) / lado;
            if (c >= 0 && c <= 1) {
                const cor = amostrarCaixa(tiles.side, aEsq, 1 - c, 1 / hw, 1 / lado, pixel);
                if (cor) px[y][x] = escurecer(cor, LUZ.esquerda);
                continue;
            }
        }

        // 3) lateral direita (ou a frente do bloco): a = 1, b anda na horizontal
        const bDir = 1 - (telaX - cx) / hw;
        if (bDir >= 0 && bDir <= 1) {
            const c = 1 - (telaY - topo - (1 + bDir) * hh) / lado;
            if (c >= 0 && c <= 1) {
                const cor = amostrarCaixa(direita, bDir, 1 - c, 1 / hw, 1 / lado, pixel);
                if (cor) px[y][x] = escurecer(cor, LUZ.direita);
            }
        }
    }

    return px;
}

/**
 * Ícone de um bloco **com forma própria**, desenhado a partir das caixas do
 * modelo — é o caso da cama, que não é cubo e por isso não cabe na projeção de
 * uma face só.
 *
 * A conta é um lançamento de raio por pixel, em projeção ortográfica: para cada
 * pixel do ícone, o raio desce na direção da câmera e a primeira caixa que ele
 * encontra diz a cor. Como são poucas caixas (a cama tem onze), o custo é
 * irrelevante — e o ícone fica sempre igual ao modelo do mundo, sem uma segunda
 * arte para manter em dia.
 */
const LUZ_DE_FACE = Object.freeze({
    topo: 1, xMais: 0.78, xMenos: 0.66, zMais: 0.86, zMenos: 0.58, fundo: 0.45,
});

export function createModelIconPixels(boxes, pixel, {
    size = BLOCK_ICON_PX, yaw = 40, pitch = 28, scale = null, center = [0.5, 0.4, 1],
} = {}) {
    const N = size;
    const s = scale ?? N / 2.25;
    const px = Array.from({ length: N }, () => Array(N).fill(null));
    const azim = (yaw * Math.PI) / 180, elev = (pitch * Math.PI) / 180;
    const f = normalizar([
        -Math.cos(elev) * Math.sin(azim), -Math.sin(elev), -Math.cos(elev) * Math.cos(azim),
    ]);
    const direita = normalizar([-f[2], 0, f[0]]);
    const cima = [
        direita[1] * f[2] - direita[2] * f[1],
        direita[2] * f[0] - direita[0] * f[2],
        direita[0] * f[1] - direita[1] * f[0],
    ];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const u = (x + 0.5 - N / 2) / s;
        const v = (N / 2 - (y + 0.5)) / s;
        const origem = [0, 1, 2].map(a => center[a] + direita[a] * u + cima[a] * v - f[a] * 8);
        let perto = Infinity, achado = null;
        for (const box of boxes) {
            let t0 = -Infinity, t1 = Infinity, eixo = 0, sinal = -1;
            for (let a = 0; a < 3; a++) {
                const inv = 1 / f[a];
                let ta = (box.min[a] - origem[a]) * inv;
                let tb = (box.max[a] - origem[a]) * inv;
                let sinalEixo = -1;
                if (ta > tb) { const t = ta; ta = tb; tb = t; sinalEixo = 1; }
                if (ta > t0) { t0 = ta; eixo = a; sinal = sinalEixo; }
                if (tb < t1) t1 = tb;
            }
            if (t0 <= t1 && t0 > 0 && t0 < perto) { perto = t0; achado = { box, eixo, sinal }; }
        }
        if (!achado) continue;
        const { box, eixo, sinal } = achado;
        const p = [0, 1, 2].map(a => origem[a] + f[a] * perto);
        const lx = (p[0] - box.min[0]) / (box.max[0] - box.min[0]);
        const ly = (p[1] - box.min[1]) / (box.max[1] - box.min[1]);
        const lz = (p[2] - box.min[2]) / (box.max[2] - box.min[2]);
        let tile, tu, tv, luz;
        if (eixo === 1) {
            tile = sinal > 0 ? box.tiles.top : (box.tiles.bottom ?? box.tiles.side);
            tu = 1 - lx; tv = 1 - lz;
            luz = sinal > 0 ? LUZ_DE_FACE.topo : LUZ_DE_FACE.fundo;
        } else if (eixo === 0) {
            tile = box.tiles.front ?? box.tiles.side;
            tu = sinal > 0 ? 1 - lz : lz; tv = ly;
            luz = sinal > 0 ? LUZ_DE_FACE.xMais : LUZ_DE_FACE.xMenos;
        } else {
            tile = box.tiles.front ?? box.tiles.side;
            tu = sinal > 0 ? lx : 1 - lx; tv = ly;
            luz = sinal > 0 ? LUZ_DE_FACE.zMais : LUZ_DE_FACE.zMenos;
        }
        if (tile === undefined) continue;
        const tx = Math.max(0, Math.min(TILE_PX - 1, Math.floor(tu * TILE_PX)));
        const ty = Math.max(0, Math.min(TILE_PX - 1, Math.floor((1 - tv) * TILE_PX)));
        const cor = pixel(tile, tx, ty);
        if (!cor || cor[3] === 0) continue;
        px[y][x] = escurecer(cor, luz).map(v => Math.round(v));
    }
    return px;
}

function normalizar(v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
}
