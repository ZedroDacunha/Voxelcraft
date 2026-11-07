// AS FACES QUE O MESHER DESCARTA — a regra, e o buraco que ela abria.
//
// Cama e porta ocupam mais de uma célula. Quando o bloco vizinho é a outra
// metade da mesma peça, o mesher descartava **todas** as faces daquela direção.
// Faz sentido para o cubo, mas a cama não é cubo: as pernas param em 4,5/16 e o
// travesseiro em 14,5/16, então a face do travesseiro virada para o meio da cama
// não é emenda nenhuma — é a parte de baixo dele que o jogador enxergava como um
// vão escuro. A regra agora é: só descarta a face que está no **plano da célula**.
//
// O que este teste guarda, então:
//
// 1. `faceNaBordaDaCelula` responde "borda" só para a face que encosta em 0 ou 1;
// 2. na cama, a face do travesseiro para o meio das duas metades é desenhada (e
//    a do colchão na emenda não é, senão volta o z-fighting);
// 3. o `game.js` usa a regra nova — sem isso, o resto é decoração.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { faceNaBordaDaCelula } from '../world-faces.js';
import { bedShapes, bedModelBoxes } from '../world-bed.js';
import { woodDoorShape } from '../world-door.js';

const perto = (a, b) => Math.abs(a - b) <= 1e-6;

/** Repete a decisão do mesher: o vizinho nessa direção é a outra metade? */
function recusaFace(shape, dir) {
    return faceNaBordaDaCelula(shape, dir);
}

/** Faces que sobram de uma metade quando a emenda está em `dirEmenda`. */
function facesDesenhadas(part, dirEmenda) {
    const dirs = [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, -1, 0]];
    const desenhadas = [];
    bedShapes(part, 'south', 'white').forEach((shape, indice) => {
        for (const dir of dirs) {
            const kind = dir[1] > 0 ? 'top' : dir[1] < 0 ? 'bottom' : 'side';
            if (shape.tiles[kind] == null) continue;               // enterrada: nunca é vista
            const mesmaDirecao = perto(dir[0], dirEmenda[0]) && perto(dir[1], dirEmenda[1]) && perto(dir[2], dirEmenda[2]);
            if (mesmaDirecao && recusaFace(shape, dir)) continue;  // emenda: some
            desenhadas.push({ indice, dir, shape });
        }
    });
    return desenhadas;
}

test('faceNaBordaDaCelula: cubo cheio encosta nas seis bordas', () => {
    const cubo = { min: [0, 0, 0], max: [1, 1, 1] };
    for (const dir of [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, -1, 0]]) {
        assert.equal(faceNaBordaDaCelula(cubo, dir), true, `direção ${dir}`);
    }
});

test('faceNaBordaDaCelula: caixa no meio da célula não encosta em nada', () => {
    const meio = { min: [0.25, 0.25, 0.25], max: [0.75, 0.75, 0.75] };
    for (const dir of [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, -1, 0]]) {
        assert.equal(faceNaBordaDaCelula(meio, dir), false, `direção ${dir}`);
    }
});

test('faceNaBordaDaCelula: aceita a folga da cama (face em 0,99625)', () => {
    const comFolga = { min: [0.00375, 0.00375, 0], max: [0.99625, 0.5625, 0.99625] };
    assert.equal(faceNaBordaDaCelula(comFolga, [1, 0, 0]), true);
    assert.equal(faceNaBordaDaCelula(comFolga, [-1, 0, 0]), true);
    assert.equal(faceNaBordaDaCelula(comFolga, [0, 0, 1]), true);
});

test('faceNaBordaDaCelula: sem forma devolve falso (melhor face a mais que buraco)', () => {
    assert.equal(faceNaBordaDaCelula(null, [0, 0, 1]), false);
});

test('o travesseiro da cabeceira é desenhado no lado virado para o meio da cama', () => {
    // A cabeceira fica com a emenda em -Z (o pé vem antes no comprimento).
    const desenhadas = facesDesenhadas('head', [0, 0, -1]);
    const travesseiroDoLadoDoPe = desenhadas.filter(face => {
        const { min, max } = face.shape;
        const ehTravesseiro = min[1] > 0.5 && face.shape.tiles.top === 40;   // BED_PILLOW_TOP
        return ehTravesseiro && perto(face.dir[2], -1);
    });
    // São duas peças de travesseiro (corpo e tampa). As duas têm face virada para
    // o meio da cama, e as duas ficavam de fora.
    assert.equal(travesseiroDoLadoDoPe.length, 2,
        'a face do travesseiro virada para o meio da cama sumiu de novo — é o vão escuro embaixo dele');
    const z = travesseiroDoLadoDoPe.map(face => face.shape.min[2]).sort((a, b) => a - b);
    assert.equal(perto(z[0], 0.53125), true,
        'a face do corpo do travesseiro (8,5/16) tem de voltar a ser desenhada');
});

test('as pernas da cabeceira também aparecem no lado do meio da cama', () => {
    const desenhadas = facesDesenhadas('head', [0, 0, -1]);
    const pernas = desenhadas.filter(face => face.shape.max[1] < 0.2 && perto(face.dir[2], -1));
    assert.equal(pernas.length, 2, 'as duas pernas da cabeceira perdem a face interna');
});

test('a emenda continua sem face: o colchão não desenha o lado que encosta na outra metade', () => {
    // Pé: emenda em +Z. Cabeceira: emenda em -Z. Em ambas, o colchão vai até a borda.
    for (const [part, dirEmenda] of [['foot', [0, 0, 1]], ['head', [0, 0, -1]]]) {
        const desenhadas = facesDesenhadas(part, dirEmenda);
        const colchaoNaEmenda = desenhadas.filter(face => {
            const { min, max } = face.shape;
            const ehColchao = perto(min[1], 0.25) && perto(max[1], 0.5);
            return ehColchao && perto(face.dir[0], dirEmenda[0]) && perto(face.dir[2], dirEmenda[2]);
        });
        assert.equal(colchaoNaEmenda.length, 0,
            `metade ${part}: a face do colchão na emenda voltou — pisca-pisca`);
    }
});

test('as duas metades juntas não perdem nada fora do plano da emenda', () => {
    // Toda face que a regra descarta tem de estar no plano da célula: é a única
    // forma de a emenda não voltar a abrir buraco.
    for (const [part, dirEmenda] of [['foot', [0, 0, 1]], ['head', [0, 0, -1]]]) {
        for (const shape of bedShapes(part, 'south', 'white')) {
            for (const dir of [[0, 0, -1], [0, 0, 1]]) {
                if (!perto(dir[2], dirEmenda[2])) continue;
                const naBorda = faceNaBordaDaCelula(shape, dir);
                const plano = dir[2] > 0 ? shape.max[2] : shape.min[2];
                if (naBorda) assert.equal(perto(plano, dir[2] > 0 ? 1 : 0), true,
                    `metade ${part}: face em ${plano} foi descartada sem estar na borda`);
            }
        }
    }
});

test('a porta continua descartando só a face do plano (emenda das duas metades)', () => {
    // Porta fechada virada para o norte: o painel é fino em Z, então as faces de
    // X encostam na borda (somem com vizinho porta) e as do painel não.
    const fechada = woodDoorShape('north', false);
    assert.equal(faceNaBordaDaCelula(fechada, [1, 0, 0]), true);
    assert.equal(faceNaBordaDaCelula(fechada, [-1, 0, 0]), true);
    assert.equal(faceNaBordaDaCelula(fechada, [0, 0, 1]), false);
    assert.equal(faceNaBordaDaCelula(fechada, [0, 0, -1]), false);
    // Em altura ela ocupa a célula inteira: é essa face que a pilha descarta.
    assert.equal(faceNaBordaDaCelula(fechada, [0, 1, 0]), true);
    assert.equal(faceNaBordaDaCelula(fechada, [0, -1, 0]), true);
});

test('a cama inteira (as duas metades) é a mesma do modelo da mão', () => {
    // O modelo da mão vem de `bedModelBoxes`, o mundo de `bedShapes`. Se os dois
    // se separarem, a cama da mão deixa de ser a cama que o jogador vê no chão.
    const doMundo = [...bedShapes('foot', 'south', 'white'), ...bedShapes('head', 'south', 'white')];
    const daMao = bedModelBoxes('white');
    assert.equal(doMundo.length, daMao.length);
    assert.equal(daMao.length, 12);
});

test('o game.js usa a regra da borda no mesher', () => {
    const jogo = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(jogo, /import \{ FACES, faceNaBordaDaCelula \} from '\.\/world-faces\.js';/);
    assert.match(jogo, /return neighborRender === currentRender && faceNaBordaDaCelula\(shape, dir\);/);
    // O mesher tem de passar a forma para o `solid`: sem ela a regra não tem o
    // que medir e volta a descartar tudo.
    assert.match(jogo, /solid\(lx, y, lz, t, f\.dir, shape\)/);
    assert.equal(/neighborRender === 'bed';/.test(jogo), false, 'a regra antiga da cama voltou');
});
