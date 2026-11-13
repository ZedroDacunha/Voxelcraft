import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryPlayerRotation } from '../inventory-player-rotation.js';

function setup() {
    const handlers = {}, frames = new Map(), renders = []; let id = 0, capture = null;
    const canvas = { addEventListener: (type, fn) => { handlers[type] = fn; }, setPointerCapture: n => { capture = n; },
        hasPointerCapture: n => capture === n, releasePointerCapture: () => { capture = null; }, focus() {} };
    const ctrl = createInventoryPlayerRotation({ canvas, render: angle => renders.push(angle),
        requestFrame: fn => { frames.set(++id, fn); return id; }, cancelFrame: n => frames.delete(n) });
    const emit = (type, fields = {}) => handlers[type]({ pointerId: 1, pointerType: 'touch', clientX: 0, button: 0, preventDefault() {}, stopPropagation() {}, ...fields });
    const flush = () => { const list = [...frames.values()]; frames.clear(); list.forEach(fn => fn()); };
    return { ctrl, emit, flush, frames, renders };
}
test('arrastar gira e limita redesenho a um por quadro, ignorando outro dedo', () => {
    const t = setup(); t.ctrl.open(); t.emit('pointerdown');
    t.emit('pointermove', { clientX: 10 }); t.emit('pointermove', { pointerId: 2, clientX: 99 });
    t.emit('pointermove', { clientX: 20 }); assert.equal(t.frames.size, 1); t.flush();
    assert.ok(Math.abs(t.renders[1] - .18) < 1e-9);
    t.emit('pointerup'); t.emit('pointermove', { clientX: 40 }); assert.equal(t.frames.size, 0);
});
test('fechar, cancelar e reabrir não deixa arrasto ou desenho pendente', () => {
    const t = setup(); t.ctrl.open(); t.emit('pointerdown'); t.emit('pointermove', { clientX: 30 });
    t.ctrl.close(); t.flush(); assert.equal(t.renders.length, 1);
    t.ctrl.open(); assert.equal(t.renders.at(-1), -.22);
    t.emit('pointerdown'); t.emit('pointercancel'); t.emit('pointermove', { clientX: 50 }); assert.equal(t.frames.size, 0);
    t.emit('pointerdown'); t.ctrl.cancel(); t.emit('pointermove', { clientX: 50 }); assert.equal(t.frames.size, 0);
});
test('setas giram e clique direito não inicia arrasto', () => {
    const t = setup(); t.ctrl.open(); t.emit('pointerdown', { pointerType: 'mouse', button: 2 });
    t.emit('pointermove', { clientX: 50 }); assert.equal(t.frames.size, 0);
    let prevented = false; t.emit('keydown', { key: 'ArrowRight', preventDefault: () => { prevented = true; } });
    t.flush(); assert.ok(prevented); assert.ok(t.renders.at(-1) > -.22);
});
