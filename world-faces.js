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
