import test from 'node:test';
import assert from 'node:assert/strict';

import { ID } from '../world-catalog.js';
import { woodDoorCollision, woodDoorPart } from '../world-door.js';

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

test('porta aberta é passável e não tem caixa de colisão', () => {
    for (const facing of ['north', 'south', 'east', 'west']) {
        assert.equal(woodDoorCollision(woodDoorPart(ID.WOOD_DOOR_BOTTOM_OPEN), facing), null);
        assert.equal(woodDoorCollision(woodDoorPart(ID.WOOD_DOOR_TOP_OPEN), facing), null);
    }
    assert.equal(woodDoorCollision(null, 'south'), null);
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
