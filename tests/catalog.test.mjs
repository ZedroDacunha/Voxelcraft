import test from 'node:test';
import assert from 'node:assert/strict';

import { BLOCKS, ITEMS, RECIPES, ID, ATLAS_COLUMNS, matchRecipe } from '../world-catalog.js';
import { woodDoorPart, woodDoorType, woodDoorShape } from '../world-door.js';
import { Inventory } from '../inventory-model.js';

test('itens e blocos não compartilham IDs, exceto o diamante', () => {
    // ID.DIAMOND_ORE é reutilizado de propósito como item "Diamante" para
    // manter saves antigos; qualquer outro caso é uma colisão acidental.
    const intentional = new Set([ID.DIAMOND_ORE]);
    const conflicts = Object.keys(ITEMS)
        .map(Number)
        .filter(id => BLOCKS[id] && ITEMS[id].block !== id && !intentional.has(id))
        .map(id => `${id}:${ITEMS[id].name}/${BLOCKS[id].name}`);
    assert.deepEqual(conflicts, []);
});

test('toda receita produz um item que existe', () => {
    for (const recipe of RECIPES) {
        assert.ok(ITEMS[recipe.result], `receita com resultado inexistente: ${recipe.result}`);
        assert.ok(ITEMS[recipe.result].iconTile < ATLAS_COLUMNS);
    }
});

test('receita da porta produz uma porta colocável (não uma ferramenta)', () => {
    const recipe = RECIPES.find(entry => entry.result === ID.WOOD_DOOR);
    assert.ok(recipe, 'receita da porta ausente');
    const item = ITEMS[ID.WOOD_DOOR];
    assert.equal(item.name, 'Porta de carvalho');
    assert.equal(item.block, ID.WOOD_DOOR_BOTTOM);
    assert.equal(recipe.result, ID.WOOD_DOOR);
    assert.equal(recipe.count, 3);
});

test('IDs e blocos da porta ficam fora da faixa das ferramentas', () => {
    assert.ok([ID.WOOD_DOOR, ID.WOOD_DOOR_BOTTOM, ID.WOOD_DOOR_TOP,
        ID.WOOD_DOOR_BOTTOM_OPEN, ID.WOOD_DOOR_TOP_OPEN]
        .every(id => id >= 86), 'IDs da porta devem ficar fora da faixa das ferramentas');
    assert.equal(BLOCKS[ID.WOOD_DOOR_BOTTOM].solid, true);
    assert.equal(BLOCKS[ID.WOOD_DOOR_BOTTOM_OPEN].solid, false);
    assert.equal(BLOCKS[ID.WOOD_DOOR_BOTTOM].render, 'door');
});

test('as metades da porta alternam entre aberta e fechada', () => {
    const pairs = [
        [ID.WOOD_DOOR_BOTTOM, ID.WOOD_DOOR_BOTTOM_OPEN],
        [ID.WOOD_DOOR_TOP, ID.WOOD_DOOR_TOP_OPEN],
    ];
    for (const [closed, open] of pairs) {
        assert.deepEqual(woodDoorPart(closed), { half: closed === ID.WOOD_DOOR_BOTTOM ? 'bottom' : 'top', open: false });
        assert.equal(woodDoorPart(open).open, true);
        assert.equal(woodDoorType(woodDoorPart(closed).half, true), open);
        assert.equal(woodDoorType(woodDoorPart(open).half, false), closed);
    }
    assert.equal(woodDoorPart(ID.STONE), null);
});

test('a porta fechada é fina no eixo certo; aberta usa o eixo oposto', () => {
    const closed = woodDoorShape('south', false);
    assert.equal(closed.normalAxis, 2);
    assert.ok(closed.max[2] - closed.min[2] < 0.5);
    assert.equal(closed.min[0], 0);
    assert.equal(closed.max[0], 1);

    const open = woodDoorShape('south', true);
    assert.equal(open.normalAxis, 0);
    assert.ok(open.max[0] - open.min[0] < 0.5);

    const eastWest = woodDoorShape('east', false);
    assert.equal(eastWest.normalAxis, 0);
});

test('a grade 3x3 reconhece a receita da porta', () => {
    const inv = new Inventory(9);
    for (const index of [0, 1, 3, 4, 6, 7]) inv.slots[index] = { id: ID.PLANKS, count: 1 };
    assert.deepEqual(matchRecipe(inv, 3), { id: ID.WOOD_DOOR, count: 3 });
});
