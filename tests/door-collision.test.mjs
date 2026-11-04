import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ID } from '../world-catalog.js';
import { collidesInWorld } from '../player-physics.js';
import {
    WOOD_DOOR_THICKNESS,
    boxOverlapsXZ,
    woodDoorCollision,
    woodDoorPart,
    woodDoorShape,
} from '../world-door.js';

const H_STAND = 1.8;

const near = (actual, expected, message) =>
    assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);

test('porta fechada colide só com o painel, centralizado no voxel', () => {
    for (const facing of ['north', 'south', 'east', 'west']) {
        const box = woodDoorCollision(woodDoorPart(ID.WOOD_DOOR_BOTTOM), facing);
        assert.ok(box, `sem caixa de colisão para ${facing}`);
        const eastWest = facing === 'east' || facing === 'west';
        // eixo normal à porta: painel fino; eixo do batente: bloco inteiro
        if (eastWest) {
            near(box.maxX - box.minX, 0.125, 'espessura');
            near(box.minZ, 0, 'batente minZ');
            near(box.maxZ, 1, 'batente maxZ');
        } else {
            near(box.maxZ - box.minZ, 0.125, 'espessura');
            near(box.minX, 0, 'batente minX');
            near(box.maxX, 1, 'batente maxX');
        }
        near((box.minX + box.maxX) / 2, 0.5, 'centro X');
        near((box.minZ + box.maxZ) / 2, 0.5, 'centro Y');
        assert.ok(box.minX >= 0 && box.maxX <= 1 && box.minZ >= 0 && box.maxZ <= 1);
    }
});

test('porta aberta colide com o painel girado, encostado na borda', () => {
    for (const facing of ['north', 'south', 'east', 'west']) {
        const box = woodDoorCollision(woodDoorPart(ID.WOOD_DOOR_BOTTOM_OPEN), facing);
        assert.ok(box, `sem caixa de colisão para ${facing}`);
        const eastWest = facing === 'east' || facing === 'west';
        // Aberta: o painel gira 90° e fica fino no eixo do batente.
        if (eastWest) {
            near(box.minZ, 0, 'borda do batente');
            near(box.maxZ - box.minZ, WOOD_DOOR_THICKNESS, 'espessura');
            near(box.minX, 0, 'vão minX');
            near(box.maxX, 1, 'vão maxX');
        } else {
            near(box.minX, 0, 'borda do batente');
            near(box.maxX - box.minX, WOOD_DOOR_THICKNESS, 'espessura');
            near(box.minZ, 0, 'vão minZ');
            near(box.maxZ, 1, 'vão maxZ');
        }
        // A metade de cima acompanha a de baixo.
        assert.deepEqual(woodDoorCollision(woodDoorPart(ID.WOOD_DOOR_TOP_OPEN), facing), box);
    }
    assert.equal(woodDoorCollision(null, 'south'), null);
});

test('o vão da porta aberta continua largo o bastante para o jogador', () => {
    const radius = 0.3;
    const box = woodDoorCollision(woodDoorPart(ID.WOOD_DOOR_BOTTOM_OPEN), 'south');
    const free = 1 - (box.maxX - box.minX);
    assert.ok(free > 2 * radius + 0.2, `folga insuficiente: ${free}`);

    // Passando pelo meio do vão o corpo não toca no painel...
    assert.equal(boxOverlapsXZ(box, 0.5 - radius, 0.5 + radius, -0.5, 0.5), false);
    // ...mas encostado no batente, toca.
    assert.equal(boxOverlapsXZ(box, 0.1 - radius, 0.1 + radius, -0.5, 0.5), true);
});

test('o painel aberto é sólido do mesmo jeito que o fechado', () => {
    const facing = 'north';
    const closed = woodDoorShape(facing, false);
    const open = woodDoorShape(facing, true);
    assert.equal(closed.normalAxis, 2, 'fechada é fina em Z');
    assert.equal(open.normalAxis, 0, 'aberta é fina em X');
    near(closed.max[2] - closed.min[2], WOOD_DOOR_THICKNESS, 'espessura fechada');
    near(open.max[0] - open.min[0], WOOD_DOOR_THICKNESS, 'espessura aberta');
});

test('boxOverlapsXZ detecta contato de borda como não-colisão', () => {
    const box = { minX: 0, maxX: 0.125, minZ: 0, maxZ: 1 };
    assert.equal(boxOverlapsXZ(box, 0.125, 0.425, 0.2, 0.8), false, 'encostado não sobrepõe');
    assert.equal(boxOverlapsXZ(box, 0.124, 0.424, 0.2, 0.8), true, '1 mm dentro já colide');
    assert.equal(boxOverlapsXZ(box, 0.5, 0.8, 0.2, 0.8), false, 'do outro lado do vão é livre');
    assert.equal(boxOverlapsXZ(box, 0.1, 0.4, 0.9, 1.3), true, 'sobrepõe no eixo Z também');
});

test('a colisão olha o painel da porta antes de descartar bloco não sólido', () => {
    // A porta aberta é `solid: false`: se a colisão a descartasse antes de olhar
    // a caixa, o jogador voltaria a atravessar o painel. Este teste era um grep
    // no game.js; agora que a colisão é um módulo, dá para exercitar a regra.
    const panel = { minX: 0.4375, maxX: 0.5625, minZ: 0, maxZ: 1 };
    const doorWorld = {
        getBlock: () => ID.WOOD_DOOR_BOTTOM,
        isSolidForPhysics: () => false,
        doorCollisionBox: () => panel,
    };
    assert.equal(collidesInWorld(doorWorld, 0.5, 1, 0.5, H_STAND), true, 'painel aberto colide');
    assert.equal(collidesInWorld(doorWorld, 0.9, 1, 0.5, H_STAND), false, 'ao lado do painel é livre');

    // Bloco não sólido que não é porta continua passável (água, grama alta).
    const softWorld = {
        getBlock: () => ID.WATER,
        isSolidForPhysics: () => false,
        doorCollisionBox: () => null,
    };
    assert.equal(collidesInWorld(softWorld, 0.5, 1, 0.5, H_STAND), false);
});

test('game.js mantém as regras de porta que dependem do estado do jogo', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /const targetType = woodDoorType\('bottom', open\)/);
    assert.match(source, /Saia do vão da porta para abri-la/);
    assert.match(source, /function unstickPlayer\(\)/);
});

test('jogador encosta no painel em vez de parar na borda do voxel', () => {
    const radius = 0.3;
    const box = woodDoorCollision(woodDoorPart(ID.WOOD_DOOR_BOTTOM), 'south');
    const overlaps = z => (z + radius > box.minZ) && (z - radius < box.maxZ);

    // Encostado no painel o jogador não sobrepõe a geometria...
    const touching = box.minZ - radius;
    assert.equal(overlaps(touching - 1e-4), false);
    // ...e 0,1 mm a mais já colide.
    assert.equal(overlaps(touching + 1e-4), true);

    // Antes o corpo parava na borda do voxel (z = 0, a 0,4375 do painel);
    // agora o centro fica a 0,1375 do início do voxel, encostado no painel.
    near(touching, 0.4375 - radius, 'posição encostado');
    assert.ok(touching > 0, 'o jogador deve poder entrar no voxel até o painel');
    assert.ok(touching < 0.5, 'o jogador não pode atravessar o painel');
});
