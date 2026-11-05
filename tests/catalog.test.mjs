import test from 'node:test';
import assert from 'node:assert/strict';

import { BLOCKS, ITEMS, RECIPES, ID, TILE, ATLAS_COLUMNS, ATLAS_ROWS, matchRecipe } from '../world-catalog.js';
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
        assert.ok(ITEMS[recipe.result].iconTile < ATLAS_COLUMNS * ATLAS_ROWS);
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

test('a lanterna de mofim é um bloco sólido que ilumina', () => {
    const TILE_MOFIM_LANTERN = TILE.MOFIM_LANTERN;
    const block = BLOCKS[ID.MOFIM_LANTERN];
    assert.ok(block, 'o bloco existe');
    assert.ok(block.light > 0, 'emite luz');
    assert.ok(block.light < BLOCKS[ID.TORCH].light, 'um pouco menos que a tocha');
    assert.notEqual(block.solid, false, 'é sólido (dá para apoiar coisas em cima)');
    assert.equal(block.render, 'opaque', 'renderiza como cubo normal, não como tocha');
    assert.equal(block.tiles.top, TILE_MOFIM_LANTERN, 'as seis faces usam o tile da lanterna');
    assert.equal(block.drop, ID.MOFIM_LANTERN, 'quebrar devolve a lanterna');
    assert.equal(ITEMS[ID.MOFIM_LANTERN].block, ID.MOFIM_LANTERN, 'e ela pode ser colocada de novo');
});

test('o pó luminoso é item de pilha e a receita da lanterna usa três pós', () => {
    const dust = ITEMS[ID.MOFIM_DUST];
    assert.equal(dust.name, 'Pó luminoso');
    assert.equal(dust.maxStack, 64);
    assert.deepEqual(dust.sprite, { kind: 'mofim-dust', mat: 'glow' }, 'tem sprite próprio, não ícone de bloco');

    const inv = new Inventory(9);
    for (const index of [0, 1, 3]) inv.slots[index] = { id: ID.MOFIM_DUST, count: 1 };
    inv.slots[4] = { id: ID.PLANKS, count: 1 };
    assert.deepEqual(matchRecipe(inv, 3), { id: ID.MOFIM_LANTERN, count: 1 });

    // Sem a tábua não é a receita: o pó sozinho não faz lanterna.
    inv.slots[4] = null;
    assert.equal(matchRecipe(inv, 3), null);
});

test('a tesoura é item próprio: duas barras de ferro na diagonal', () => {
    const shears = ITEMS[ID.SHEARS];
    assert.ok(shears, 'a tesoura existe');
    assert.equal(shears.name, 'Tesoura');
    assert.equal(shears.maxStack, 1, 'ferramenta não stacka');
    assert.deepEqual(shears.tool, { type: 'shears', tier: 1, speed: 1 });
    assert.ok(shears.maxDurability > 0, 'gasta com o uso');
    assert.equal(shears.block, undefined, 'não vira bloco');
    assert.equal(BLOCKS[ID.SHEARS], undefined, 'não existe bloco de tesoura');

    const inv = new Inventory(9);
    inv.slots[0] = { id: ID.IRON_INGOT, count: 1 };
    inv.slots[4] = { id: ID.IRON_INGOT, count: 1 };
    assert.deepEqual(matchRecipe(inv, 3), { id: ID.SHEARS, count: 1 });

    // Uma barra só não faz tesoura (e nem o ferro com outra coisa no lugar).
    inv.slots[4] = null;
    assert.equal(matchRecipe(inv, 3), null);
});

test('a lã vem em três cores: fardo, bloco e a receita de quatro fardos', () => {
    const cores = [
        ['WHITE', 'branca', TILE.WOOL_WHITE],
        ['GRAY', 'cinza', TILE.WOOL_GRAY],
        ['BLACK', 'preta', TILE.WOOL_BLACK],
    ];
    for (const [key, label, tile] of cores) {
        const wool = ITEMS[ID['WOOL_' + key]];
        assert.equal(wool.name, `Lã ${label}`);
        assert.equal(wool.maxStack, 64, 'fardo stacka');
        assert.equal(wool.block, undefined, 'o fardo é material, não bloco');
        assert.deepEqual(wool.sprite, { kind: 'wool', mat: key.toLowerCase() });

        const blockId = ID['WOOL_BLOCK_' + key];
        const block = BLOCKS[blockId];
        assert.equal(block.name, `Bloco de lã ${label}`);
        assert.equal(block.drop, blockId, 'quebrar devolve o bloco');
        assert.equal(block.tiles.top, tile);
        assert.equal(block.solid, true, 'é sólido como um bloco normal');
        assert.ok(block.hardness <= 1, 'quebra rápido com a mão');
        assert.equal(ITEMS[blockId].block, blockId, 'o item do bloco coloca o bloco');

        // Quatro fardos da mesma cor viram o bloco daquela cor.
        const inv = new Inventory(9);
        for (const index of [0, 1, 3, 4]) inv.slots[index] = { id: ID['WOOL_' + key], count: 1 };
        assert.deepEqual(matchRecipe(inv, 3), { id: blockId, count: 1 });
    }

    // Cores diferentes não se misturam.
    const misturado = new Inventory(9);
    for (const [index, id] of [[0, ID.WOOL_WHITE], [1, ID.WOOL_WHITE], [3, ID.WOOL_WHITE], [4, ID.WOOL_GRAY]]) {
        misturado.slots[index] = { id, count: 1 };
    }
    assert.equal(matchRecipe(misturado, 3), null);

    assert.equal(new Set(cores.map(([, , tile]) => tile)).size, 3, 'um tile por cor, sem reaproveitar');
    assert.equal(new Set(cores.map(([key]) => ID['WOOL_' + key])).size, 3);
    assert.equal(new Set(cores.map(([key]) => ID['WOOL_BLOCK_' + key])).size, 3);
});
