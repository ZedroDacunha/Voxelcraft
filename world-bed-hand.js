// A cama **equipada na mão**: o modelo de duas células, reduzido a um item.
//
// A cama não é um cubo, então na mão ela nunca podia ser o cubo genérico. Antes
// daqui o jogo desenhava o *ícone* extrudado (uma figura chata, como as
// ferramentas) — dava para reconhecer a cama, mas ela não era 3D. Agora a mão
// recebe a mesma peça que o jogador vê no mundo: pernas, travessa, colchão, aba
// e travesseiro, na cor da lã.
//
// Este módulo devolve **arrays puros** (posição, normal, UV e índice), sem THREE:
// o `game.js` só embrulha num `BufferGeometry`. Assim o desenho da mão pode ser
// testado sem navegador — o que importa é que as faces certas existam, com a UV
// do tile certo e o modelo centrado em quem gira.
import { ATLAS_UV_PAD_PX, atlasUV } from './world-catalog.js';
import { FACES } from './world-faces.js';
import { bedModelBoxes, BED_COLORS } from './world-bed.js';

/**
 * Como a cama fica na mão, no espaço do `heldAnchor` (a frente da câmera).
 *
 * O modelo é longo (duas células): girado no eixo Y ele atravessa a tela na
 * diagonal, como no Minecraft, e o giro em X mostra o topo do colchão com o
 * travesseiro do lado de perto. O Z leve descola a peça da horizontal, para ela
 * não ler como um cartão. A escala é a de um bloco grande na mão — a cama é
 * móvel, não ferramenta.
 */
export const HELD_BED = Object.freeze({
    scale: 0.26,
    position: Object.freeze([0.02, -0.02, -0.02]),
    rotation: Object.freeze([0.30, 0.55, 0.20]),
});

/**
 * Geometria da cama inteira, centrada no meio do modelo.
 *
 * O centro é `(0,5, 0,5, 1)`: meia célula em X, meia em Y e **uma** em Z — o
 * modelo tem duas células de comprimento, então o meio está no fim da primeira.
 * Centrar (em vez de deixar o pé na origem) é o que faz o giro da mão girar em
 * volta da peça e não em volta de uma quina.
 *
 * Face com tile `null` está enterrada dentro de outra caixa e não é desenhada —
 * é a mesma regra do mesher.
 */
export function bedHandGeometry(color, { scale = HELD_BED.scale } = {}) {
    const cor = BED_COLORS.includes(color) ? color : 'white';
    const centro = [0.5, 0.5, 1];
    const positions = [], normals = [], uvs = [], indices = [];
    for (const caixa of bedModelBoxes(cor)) {
        for (const face of FACES) {
            const tile = caixa.tiles[face.kind];
            if (tile == null) continue;
            const { u0, v0, uWidth, vHeight } = atlasUV(tile, ATLAS_UV_PAD_PX);
            const base = positions.length / 3;
            for (const canto of face.corners) {
                for (let axis = 0; axis < 3; axis++) {
                    const valor = caixa.min[axis] + canto.pos[axis] * (caixa.max[axis] - caixa.min[axis]);
                    positions.push((valor - centro[axis]) * scale);
                }
                normals.push(face.dir[0], face.dir[1], face.dir[2]);
                uvs.push(u0 + canto.uv[0] * uWidth, v0 + canto.uv[1] * vHeight);
            }
            indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
    }
    return { positions, normals, uvs, indices };
}
