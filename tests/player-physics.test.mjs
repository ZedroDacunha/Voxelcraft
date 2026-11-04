import test from 'node:test';
import assert from 'node:assert/strict';

import { ID } from '../world-catalog.js';
import {
    COLLISION_EPSILON,
    MAX_MOVE_STEP,
    PLAYER_RADIUS,
    collidesInWorld,
    movePlayerAxis,
    playerIntersectsBlock,
    unstickInWorld,
} from '../player-physics.js';

const H_STAND = 1.8;
const H_CROUCH = 1.5;

// Mundo de mentira a partir de uma lista de coordenadas sólidas. Só o que a
// física usa: `getBlock`, `isSolidForPhysics` e `doorCollisionBox`.
function makeWorld(solidCells = [], { door = null } = {}) {
    const solid = new Set(solidCells.map(cell => cell.join(',')));
    return {
        solid,
        getBlock: (x, y, z) => (door && door.test(x, y, z) ? door.type : (solid.has(`${x},${y},${z}`) ? ID.STONE : 0)),
        isSolidForPhysics: (x, y, z, type) => type !== 0 && !(door && type === door.type),
        doorCollisionBox: (x, y, z) => (door && door.test(x, y, z) ? door.box() : null),
    };
}

const pos = (x, y, z) => ({ x, y, z });

// ------------------------------------------------ colisão AABB x voxel

test('pé no chão exato não colide: a folga da borda evita colar no bloco', () => {
    const world = makeWorld([[0, 0, 0]]); // chão em y = 0..1

    assert.equal(collidesInWorld(world, 0.5, 1, 0.5, H_STAND), false, 'em cima do chão é livre');
    // A folga é de exatamente COLLISION_EPSILON: menos que isso ainda conta
    // como "parado no chão", mais que isso é corpo afundado no bloco.
    assert.equal(collidesInWorld(world, 0.5, 1 - COLLISION_EPSILON / 2, 0.5, H_STAND), false, 'dentro da folga, livre');
    assert.equal(collidesInWorld(world, 0.5, 1 - COLLISION_EPSILON * 2, 0.5, H_STAND), true, 'afundou de verdade: colide');
});

test('teto é respeitado pela altura do corpo', () => {
    // Vão de 2 blocos livres (y = 1 e y = 2), teto em y = 3.
    const world = makeWorld([[0, 3, 0]]);

    assert.equal(collidesInWorld(world, 0.5, 1, 0.5, H_STAND), false, 'em pé (1,8) cabe em 2 blocos de vão');
    assert.equal(collidesInWorld(world, 0.5, 1.3, 0.5, H_STAND), true, 'subiu 0,3: o topo em 3,1 bate no teto');
    assert.equal(collidesInWorld(world, 0.5, 1.3, 0.5, H_CROUCH), false, 'agachado o topo fica em 2,8 e passa');
});

test('a borda do bloco vizinho respeita o raio e a folga', () => {
    const world = makeWorld([[1, 1, 0]]); // parede à direita do jogador

    // Centro em 0,7: pMaxX = 1,0 → o bloco em x = 1 começa exatamente na borda.
    assert.equal(collidesInWorld(world, 1 - PLAYER_RADIUS, 1, 0.5, H_STAND), false, 'encostado na face não colide');
    // 1 mm além já entra no bloco.
    assert.equal(collidesInWorld(world, 1 - PLAYER_RADIUS + 1e-3, 1, 0.5, H_STAND), true);
});

test('o raio do corpo é o que impede passar por um vão de 1 bloco de largura', () => {
    const world = makeWorld([[0, 1, 0], [2, 1, 0]]); // corredor livre em x = 1

    assert.equal(collidesInWorld(world, 1.5, 1, 0.5, H_STAND), false, 'no meio do corredor passa');
    assert.equal(collidesInWorld(world, 1.5 - 0.35, 1, 0.5, H_STAND), true, 'encostou na parede da esquerda');
    assert.equal(collidesInWorld(world, 1.5 + 0.35, 1, 0.5, H_STAND), true, 'encostou na parede da direita');
});

test('porta colide pelo painel e não pelo voxel inteiro', () => {
    // Porta "aberta": não é sólida, mas tem painel fino no meio do voxel.
    const box = { minX: 0.4375, maxX: 0.5625, minZ: 0, maxZ: 1 };
    const world = makeWorld([], {
        door: { type: ID.WOOD_DOOR_BOTTOM, test: (x, y, z) => x === 0 && y === 1 && z === 0, box: () => box },
    });

    assert.equal(collidesInWorld(world, 0.5, 1, 0.5, H_STAND), true, 'no painel colide mesmo não sendo sólida');
    assert.equal(collidesInWorld(world, 0.0375 + PLAYER_RADIUS, 1, 0.5, H_STAND), true, 'encostado no painel colide');
    assert.equal(collidesInWorld(world, 0.0375, 1, 0.5, H_STAND), false, 'antes do painel passa: o vão sobra');
});

// ------------------------------------------------ deslocamento por eixo

test('andar livre move exatamente a distância pedida', () => {
    const world = makeWorld([[0, 0, 0], [5, 0, 0]]); // só chão longe
    const p = pos(0.5, 1, 0.5);

    assert.equal(movePlayerAxis(world, p, 'x', 0.6, H_STAND), false, 'nada no caminho');
    assert.ok(Math.abs(p.x - 1.1) < 1e-12, `posição final ${p.x}`);
});

test('bater na parede para encostado na face, não na borda do voxel', () => {
    const world = makeWorld([[0, 0, 0], [3, 1, 0]]); // parede em x = 3
    const p = pos(0.5, 1, 0.5);
    const target = 3 - PLAYER_RADIUS; // 2,7: encostado, sem atravessar

    assert.equal(movePlayerAxis(world, p, 'x', 4, H_STAND), true, 'foi barrado');
    assert.ok(p.x <= target, `parou antes da parede: ${p.x}`);
    assert.ok(p.x > target - MAX_MOVE_STEP / 64, `parou encostado (${p.x}), bem mais perto que um sub-passo`);
});

test('movimento grande não atravessa parede fina (subdivisão em passos)', () => {
    const world = makeWorld([[0, 0, 0], [2, 1, 0]]); // parede isolada em x = 2
    const p = pos(0.5, 1, 0.5);

    assert.equal(movePlayerAxis(world, p, 'x', 30, H_STAND), true);
    assert.ok(p.x < 2, `parou antes da parede em vez de teletransportar: ${p.x}`);
});

test('andar para trás também encosta na parede', () => {
    const world = makeWorld([[0, 0, 0], [-3, 1, 0]]);
    const p = pos(0.5, 1, 0.5);

    assert.equal(movePlayerAxis(world, p, 'x', -4, H_STAND), true);
    assert.ok(p.x >= -3 + 1 + PLAYER_RADIUS - 1e-9, `parou à direita da parede: ${p.x}`);
});

test('deslocamento nulo não mexe em nada', () => {
    const world = makeWorld([[1, 1, 0]]);
    const p = pos(0.5, 1, 0.5);

    assert.equal(movePlayerAxis(world, p, 'x', 0, H_STAND), false);
    assert.deepEqual(p, { x: 0.5, y: 1, z: 0.5 });
});

test('a altura do corpo decide a passagem por um vão apertado', () => {
    // Teto baixo em y = 3 e corpo começando em 1,3: em pé o topo (3,1) entra no
    // bloco, agachado (2,8) passa. É o efeito real de agachar no deslocamento.
    const world = makeWorld([[3, 3, 0]]);
    const standing = pos(0.5, 1.3, 0.5);
    const crouched = pos(0.5, 1.3, 0.5);

    assert.equal(movePlayerAxis(world, standing, 'x', 4, H_STAND), true, 'em pé foi barrado');
    assert.ok(standing.x < 3, `parou antes do bloco do teto: ${standing.x}`);

    assert.equal(movePlayerAxis(world, crouched, 'x', 4, H_CROUCH), false, 'agachado passou');
    assert.ok(crouched.x > 3.5, `atravessou o vão: ${crouched.x}`);
});

// ------------------------------------------------ sair de dentro de bloco

test('corpo livre não precisa ser desentalado', () => {
    const world = makeWorld([[0, 0, 0]]);
    const p = pos(0.5, 1, 0.5);

    assert.equal(unstickInWorld(world, p, H_STAND), false);
    assert.deepEqual(p, { x: 0.5, y: 1, z: 0.5 }, 'sem mexer na posição');
});

test('sair do painel da porta usa o primeiro deslocamento livre', () => {
    const box = { minX: 0.4375, maxX: 0.5625, minZ: 0, maxZ: 1 };
    const world = makeWorld([], {
        door: { type: ID.WOOD_DOOR_BOTTOM, test: (x, y, z) => x === 0 && y === 1, box: () => box },
    });
    const p = pos(0.5, 1, 0.5); // dentro do painel

    assert.equal(unstickInWorld(world, p, H_STAND), true);
    assert.equal(p.y, 1, 'saiu no mesmo nível, sem precisar subir');
    // O primeiro deslocamento que serve é [0.45, 0] ou [-0.45, 0]: qualquer um
    // tira o corpo do painel fino.
    assert.ok(Math.abs(Math.abs(p.x - 0.5) - 0.45) < 1e-9, `deslocou em x: ${p.x}`);
    assert.equal(p.z, 0.5);
    assert.equal(collidesInWorld(world, p.x, p.y, p.z, H_STAND), false, 'a posição nova é livre');
});

test('preso em bloco maciço, tenta subir antes de desistir', () => {
    // Coluna maciça de y = 0 a 2; livre a partir de y = 3.
    const cells = [];
    for (let y = 0; y <= 2; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) cells.push([dx, y, dz]);
    const world = makeWorld(cells);
    const p = pos(0, 1, 0);

    assert.equal(unstickInWorld(world, p, H_STAND), true);
    assert.equal(p.y, 3, 'subiu até a primeira altura livre');
    assert.equal(collidesInWorld(world, p.x, p.y, p.z, H_STAND), false);
});

test('sem nenhum ponto livre, avisa que não deu', () => {
    // Tudo maciço na faixa testada (y de 0 até muito acima).
    const cells = [];
    for (let y = 0; y <= 8; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) cells.push([dx, y, dz]);
    const world = makeWorld(cells);
    const p = pos(0, 1, 0);

    assert.equal(unstickInWorld(world, p, H_STAND), false);
    assert.deepEqual(p, { x: 0, y: 1, z: 0 }, 'não move se não há para onde ir');
});

// ------------------------------------------------ ocupação de célula

test('intersecção de célula trata encostar como fora', () => {
    const p = pos(1.5, 1, 1.5); // raio 0,3 → x de 1,2 a 1,8

    assert.equal(playerIntersectsBlock(p, H_STAND, 1, 1, 1), true, 'célula embaixo do corpo');
    assert.equal(playerIntersectsBlock(p, H_STAND, 2, 1, 1), false, 'célula à direita: encosta, não ocupa');

    // Encostar (ou passar) não ocupa: 1 µm além da borda já é fora.
    const past = pos(2 + PLAYER_RADIUS + 1e-6, 1, 1.5);
    assert.equal(playerIntersectsBlock(past, H_STAND, 1, 1, 1), false, 'borda e além não contam');

    // Altura: pés em 1 e topo em 2,8 cobrem as células 1 e 2, não a 3.
    assert.equal(playerIntersectsBlock(p, H_STAND, 1, 2, 1), true);
    assert.equal(playerIntersectsBlock(p, H_STAND, 1, 3, 1), false);
});
