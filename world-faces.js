// As seis faces de um cubo unitário, com a UV de cada canto.
//
// Vive num módulo próprio porque **três** coisas desenham caixas e todas precisam
// do mesmo canto no mesmo lugar: o mesher do mundo (`buildCubeGeo` e as caixas
// das formas próprias), as nuvens e a cama na mão. Antes a tabela morava no
// `game.js` e quem quisesse desenhar uma caixa fora dele copiava os seis cantos
// à mão — cópia que envelhece calada.
//
// `pos` vai de 0 a 1 em cada eixo (o canto do cubo unitário); `uv` é a posição
// dentro do tile, com a origem embaixo à esquerda, como o atlas é amostrado.
export const FACES = Object.freeze([
    { kind: 'side',   dir: [-1, 0, 0], corners: [ { pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] }, { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] } ] },
    { kind: 'side',   dir: [ 1, 0, 0], corners: [ { pos: [1, 1, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [0, 0] }, { pos: [1, 1, 0], uv: [1, 1] }, { pos: [1, 0, 0], uv: [1, 0] } ] },
    { kind: 'bottom', dir: [ 0,-1, 0], corners: [ { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 0], uv: [1, 1] }, { pos: [0, 0, 0], uv: [0, 1] } ] },
    { kind: 'top',    dir: [ 0, 1, 0], corners: [ { pos: [0, 1, 1], uv: [1, 1] }, { pos: [1, 1, 1], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 0] } ] },
    { kind: 'side',   dir: [ 0, 0,-1], corners: [ { pos: [1, 0, 0], uv: [0, 0] }, { pos: [0, 0, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 1] } ] },
    { kind: 'side',   dir: [ 0, 0, 1], corners: [ { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 1, 1], uv: [0, 1] }, { pos: [1, 1, 1], uv: [1, 1] } ] },
]);

/**
 * A face de uma caixa de forma própria está no **plano da célula**?
 *
 * Cama e porta ocupam mais de uma célula e desenham forma fina dentro dela: as
 * pernas da cama param em 4,5/16, o travesseiro em 14,5/16. Quando o vizinho é a
 * outra metade da mesma peça, a única face que dá para descartar é a que encosta
 * na borda da célula (ela é interna, e desenhá-la brigaria pelo mesmo pixel). As
 * outras continuam visíveis — o caso que denunciou isso foi o travesseiro: a
 * face dele virada para o meio da cama sumia e deixava um vão escuro embaixo.
 *
 * A tolerância existe por causa da folga que a cama aplica nas faces de fora
 * (0,06/16): a face "na borda" fica em 0,99625 e não em 1.
 */
export function faceNaBordaDaCelula(shape, dir, tol = 0.01) {
    if (!shape) return false;
    const eixo = dir[0] !== 0 ? 0 : dir[2] !== 0 ? 2 : 1;
    return dir[eixo] > 0 ? shape.max[eixo] >= 1 - tol : shape.min[eixo] <= tol;
}
