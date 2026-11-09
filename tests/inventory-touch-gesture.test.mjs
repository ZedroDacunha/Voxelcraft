import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInventoryTouchGesture, INVENTORY_HOLD_MS, INVENTORY_TOUCH_SLOP } from '../inventory-touch-gesture.js';
import { invLeftClick, invRightClick } from '../inventory-logic.js';
import { Inventory } from '../inventory-model.js';
import { ID } from '../world-catalog.js';

function fixture(activate = () => {}) {
    let sequence = 0;
    const pending = new Map();
    const gesture = createInventoryTouchGesture({ activate,
        setTimer: (fn, ms) => { assert.equal(ms, INVENTORY_HOLD_MS); const id = ++sequence; pending.set(id, fn); return id; },
        clearTimer: id => pending.delete(id),
    });
    return { gesture, fire: () => { for (const fn of [...pending.values()]) fn(); }, pending };
}
const point = (pointerId, slot, x = 20, y = 20) => ({ pointerId, x, y, slot });

test('toque curto ativa uma única vez, sem disparar timer após soltar', () => {
    const events = [], slot = {};
    const { gesture, fire, pending } = fixture((...args) => events.push(args));
    assert.equal(gesture.start(point(1, slot)), true);
    gesture.end(point(1, slot)); fire();
    assert.deepEqual(events, [[slot, 0]]);
    assert.equal(pending.size, 0);
});

test('segurar ativa botão de dividir uma vez e soltar não repete', () => {
    const events = [], slot = {};
    const { gesture, fire } = fixture((...args) => events.push(args));
    gesture.start(point(1, slot)); fire(); gesture.end(point(1, slot));
    assert.deepEqual(events, [[slot, 2]]);
});

test('timer atrasado não transforma um toque prolongado em toque curto', () => {
    let time = 0, event;
    const gesture = createInventoryTouchGesture({ activate: (...args) => { event = args; }, now: () => time,
        setTimer: () => 1, clearTimer: () => {} });
    const slot = {};
    gesture.start(point(1, slot));
    time = INVENTORY_HOLD_MS + 1;
    gesture.end(point(1, slot));
    assert.deepEqual(event, [slot, 2]);
});

test('rolagem, soltura noutro slot, cancelamento e saída não movem itens', () => {
    const events = [], slot = {};
    const { gesture, fire } = fixture((...args) => events.push(args));
    gesture.start(point(1, slot)); gesture.move(point(1, slot, 20 + INVENTORY_TOUCH_SLOP, 20)); fire(); gesture.end(point(1, slot));
    gesture.start(point(2, slot)); gesture.end(point(2, {})); fire();
    gesture.start(point(3, slot)); gesture.pointerCancel(3); fire();
    gesture.start(point(4, slot)); gesture.cancel(); fire();
    assert.deepEqual(events, []);
});

test('segundo dedo não rouba nem encerra o primeiro gesto', () => {
    const events = [], slot = {};
    const { gesture } = fixture((...args) => events.push(args));
    gesture.start(point(1, slot));
    assert.equal(gesture.start(point(2, {})), false);
    gesture.pointerCancel(2); gesture.end(point(2, slot));
    gesture.end(point(1, slot));
    assert.deepEqual(events, [[slot, 0]]);
});

test('gestos reutilizam as regras reais de pilha, metade e unidade', () => {
    const inv = new Inventory(3), cursor = { stack: null };
    inv.slots[0] = { id: ID.DIRT, count: 9 };
    const { gesture, fire } = fixture((index, button) => button === 2 ? invRightClick(inv, index, cursor) : invLeftClick(inv, index, cursor));
    gesture.start(point(1, 0)); fire(); gesture.end(point(1, 0));
    assert.equal(cursor.stack.count, 5); assert.equal(inv.slots[0].count, 4);
    gesture.start(point(2, 1)); fire(); gesture.end(point(2, 1));
    assert.equal(inv.slots[1].count, 1); assert.equal(cursor.stack.count, 4);
    gesture.start(point(3, 2)); gesture.end(point(3, 2));
    assert.equal(inv.slots[2].count, 4); assert.equal(cursor.stack, null);
});

test('fiação protege o mouse, o cursor e os itens ao sair', () => {
    const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../inventory.css', import.meta.url), 'utf8');
    assert.match(game, /event\.pointerType !== 'touch' \|\| !inventoryOpen/);
    assert.match(game, /event\.preventDefault\(\);\s*inventoryTouchGesture\.start/);
    assert.match(game, /activateSlot\(slot, \{ button, touch: true \}\)/);
    assert.match(game, /!touch && cursorHeld\.stack && invLastClick\.key/);
    assert.match(game, /function closeInventory\(relock\) \{\s*if \(!inventoryOpen\) return;\s*inventoryTouchGesture\?\.cancel\(\)/);
    assert.match(game, /Não jogar fora uma pilha por um toque acidental no fundo/);
    assert.match(html, /id="inv-touch-held" role="status" aria-live="polite" hidden/);
    assert.match(css, /\.islot \{ touch-action: pan-y/);
});
