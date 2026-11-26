import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Inventory } from '../inventory-model.js';
import { ID, ITEMS } from '../world-catalog.js';
import { invRightClick } from '../inventory-logic.js';
import { craftSlotsAlongSegment, createCraftRightDrag } from '../inventory-craft-drag.js';

function setup(size = 2, count = 12) {
    const craftInv = new Inventory(9);
    const cursor = { stack: { id: ID.PLANKS, count } };
    const drag = createCraftRightDrag({ craftInv, cursor, gridSize: () => size });
    return { craftInv, cursor, drag };
}

for (const size of [2, 3]) {
    test(`distribui uma unidade em cada espaço da grade ${size}×${size} e não repete visitas`, () => {
        const { craftInv, cursor, drag } = setup(size);
        assert.equal(drag.start(0), true);
        for (let i = 0; i < size * size; i++) drag.visit(i);
        for (let i = size * size - 1; i >= 0; i--) drag.visit(i);
        assert.deepEqual(craftInv.slots.slice(0, size * size).map(s => s?.count), Array(size * size).fill(1));
        assert.equal(cursor.stack.count, 12 - size * size);
        assert.equal(drag.visit(size * size), false);
        drag.cancel();
        assert.equal(drag.visit(0), false);
        assert.equal(drag.start(0), true);
        assert.equal(craftInv.slots[0].count, 2);
    });
}

test('ignora espaços cheios ou incompatíveis e conserva itens', () => {
    const { craftInv, cursor, drag } = setup();
    craftInv.slots[0] = { id: ID.STONE, count: 7 };
    craftInv.slots[1] = { id: ID.PLANKS, count: ITEMS[ID.PLANKS].maxStack };
    craftInv.slots[2] = { id: ID.PLANKS, count: 3 };
    assert.equal(drag.start(), true);
    assert.equal(drag.visit(0), false);
    assert.equal(drag.visit(1), false);
    assert.equal(drag.visit(2), true);
    assert.deepEqual(craftInv.slots.slice(0, 3), [
        { id: ID.STONE, count: 7 }, { id: ID.PLANKS, count: ITEMS[ID.PLANKS].maxStack }, { id: ID.PLANKS, count: 4 },
    ]);
    assert.equal(cursor.stack.count, 11);
});

test('clique inicial incompatível continua disponível para a troca normal', () => {
    const { craftInv, cursor, drag } = setup();
    craftInv.slots[0] = { id: ID.STONE, count: 7 };
    assert.equal(drag.start(0), false);
    invRightClick(craftInv, 0, cursor);
    assert.deepEqual(cursor.stack, { id: ID.STONE, count: 7 });
    assert.deepEqual(craftInv.slots[0], { id: ID.PLANKS, count: 12 });
    assert.equal(drag.visit(1), false);
});

test('para quando a pilha acaba ou é substituída; mantém dano ao depositar', () => {
    const { craftInv, cursor, drag } = setup(3, 2);
    cursor.stack.damage = 3;
    drag.start(0);
    assert.deepEqual(craftInv.slots[0], { id: ID.PLANKS, count: 1, damage: 3 });
    assert.equal(drag.visit(1), true);
    assert.equal(cursor.stack, null);
    assert.equal(drag.visit(2), false);
    cursor.stack = { id: ID.STONE, count: 5 };
    assert.equal(drag.visit(2), false);
    assert.equal(craftInv.slots[2], null);
});

test('só começa com pilha e posição válida; após cancelar não movimenta nada', () => {
    const { craftInv, cursor, drag } = setup();
    assert.equal(drag.start(-1), false);
    assert.equal(drag.start(4), false);
    assert.equal(drag.start(1.5), false);
    cursor.stack = null;
    assert.equal(drag.start(), false);
    cursor.stack = { id: ID.PLANKS, count: 4 };
    assert.equal(drag.start(), true);
    drag.cancel();
    assert.equal(drag.visit(0), false);
    assert.equal(craftInv.slots[0], null);
});

test('segmentos rápidos encontram espaços atravessados na ordem do trajeto', () => {
    const slots = [0, 1, 2].map(index => ({ index, left: index * 20, right: index * 20 + 10, top: 0, bottom: 10 }));
    assert.deepEqual(craftSlotsAlongSegment({ x: -5, y: 5 }, { x: 55, y: 5 }, slots), [0, 1, 2]);
    assert.deepEqual(craftSlotsAlongSegment({ x: 55, y: 5 }, { x: -5, y: 5 }, slots), [2, 1, 0]);
    assert.deepEqual(craftSlotsAlongSegment({ x: 5, y: 5 }, { x: 5, y: 5 }, slots), [0]);
    assert.deepEqual(craftSlotsAlongSegment({ x: -5, y: 15 }, { x: 55, y: 15 }, slots), []);
});

test('sem pilha no cursor, clique direito normal continua pegando metade', () => {
    const { craftInv, cursor, drag } = setup();
    cursor.stack = null;
    craftInv.slots[0] = { id: ID.PLANKS, count: 5 };
    assert.equal(drag.start(0), false);
    invRightClick(craftInv, 0, cursor);
    assert.equal(cursor.stack.count, 3);
    assert.equal(craftInv.slots[0].count, 2);
    assert.equal(drag.visit(1), false);
});

test('fiação encerra gestos fora do inventário e mantém o caminho de clique normal', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /document\.addEventListener\('mousemove', onCraftDragMove\)/);
    assert.match(source, /document\.addEventListener\('mouseup', event => \{ if \(event\.button === 2\) cancelCraftRightDrag\(\)/);
    assert.match(source, /window\.addEventListener\('blur', cancelCraftRightDrag\)/);
    assert.match(source, /visibilitychange[^\n]*document\.hidden\) cancelCraftRightDrag\(\)/);
    assert.match(source, /function closeInventory\(relock\)[\s\S]*?cancelCraftRightDrag\(\)/);
    assert.match(source, /craftRightDrag\.start\(Number\(el\.dataset\.index\)\)[\s\S]*?activateSlot\(el, \{ button: e\.button, shiftKey: e\.shiftKey \}\)/);
    assert.match(source, /if \(changed\) renderInventory\(\)/);
});
