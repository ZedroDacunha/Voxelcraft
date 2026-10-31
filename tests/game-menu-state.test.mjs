import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { pauseMenuDisplay, shouldShowPauseMenu } from '../game-pause-menu.js';
import { createPointerLockRequester } from '../game-pointer-lock.js';

function makeDoc() {
    const listeners = new Map();
    return {
        pointerLockElement: null,
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(handler);
        },
        removeEventListener(type, handler) {
            listeners.get(type)?.delete(handler);
        },
        emit(type) {
            for (const handler of listeners.get(type) ?? []) handler();
        },
        listenerCount(type) {
            return listeners.get(type)?.size ?? 0;
        },
    };
}

function makeTimers() {
    const timers = new Map();
    let nextId = 0;
    return {
        setTimeout(handler, delay) {
            const id = ++nextId;
            timers.set(id, { handler, delay });
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        runNext() {
            const [id, timer] = timers.entries().next().value ?? [];
            if (timer) timer.handler();
            return id;
        },
        get size() {
            return timers.size;
        },
    };
}

function makeRequester({ element, doc = makeDoc(), timers = makeTimers(), warn = () => {} }) {
    const request = createPointerLockRequester({
        element,
        doc,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
        timeoutMs: 1500,
        warn,
    });
    return { request, doc, timers };
}

test('menu de pausa aparece quando nenhum estado exclusivo está ativo', () => {
    assert.equal(shouldShowPauseMenu(), true);
    assert.equal(shouldShowPauseMenu({ locked: false, inventoryOpen: false, dead: false }), true);
    assert.equal(pauseMenuDisplay({}), 'flex');
});

test('menu de pausa fica oculto durante jogo, inventário ou morte', () => {
    assert.equal(shouldShowPauseMenu({ locked: true }), false);
    assert.equal(shouldShowPauseMenu({ inventoryOpen: true }), false);
    assert.equal(shouldShowPauseMenu({ dead: true }), false);
    assert.equal(pauseMenuDisplay({ locked: true }), 'none');
    assert.equal(pauseMenuDisplay({ inventoryOpen: true }), 'none');
    assert.equal(pauseMenuDisplay({ dead: true }), 'none');
});

test('pointer lock bem-sucedido resolve true e limpa listeners/timer', async () => {
    const doc = makeDoc();
    const timers = makeTimers();
    const calls = [];
    const element = {
        requestPointerLock(options) {
            calls.push(options);
            doc.pointerLockElement = element;
            return Promise.resolve();
        },
    };
    const { request } = makeRequester({ element, doc, timers });
    assert.equal(await request(), true);
    assert.deepEqual(calls, [{ unadjustedMovement: true }]);
    assert.equal(timers.size, 0);
    assert.equal(doc.listenerCount('pointerlockchange'), 0);
    assert.equal(doc.listenerCount('pointerlockerror'), 0);
});

test('NotSupportedError tenta novamente sem unadjustedMovement', async () => {
    const doc = makeDoc();
    const calls = [];
    const element = {
        requestPointerLock(options) {
            calls.push(options);
            if (calls.length === 1) {
                return Promise.reject(Object.assign(new Error('sem suporte'), { name: 'NotSupportedError' }));
            }
            doc.pointerLockElement = element;
            return Promise.resolve();
        },
    };
    const { request } = makeRequester({ element, doc });
    assert.equal(await request(), true);
    assert.deepEqual(calls, [{ unadjustedMovement: true }, undefined]);
});

test('falha de permissão/cooldown resolve false e avisa a UI', async () => {
    const warnings = [];
    const element = {
        requestPointerLock() {
            return Promise.reject(Object.assign(new Error('cooldown'), { name: 'SecurityError' }));
        },
    };
    const { request, timers } = makeRequester({ element, warn: (...args) => warnings.push(args) });
    assert.equal(await request(), false);
    assert.equal(warnings.length, 1);
    assert.equal(timers.size, 0);
});

test('erro síncrono também resolve false', async () => {
    const element = {
        requestPointerLock() {
            throw Object.assign(new Error('bloqueado'), { name: 'SecurityError' });
        },
    };
    const { request } = makeRequester({ element });
    assert.equal(await request(), false);
});

test('evento pointerlockerror encerra a espera com false', async () => {
    const doc = makeDoc();
    const element = { requestPointerLock: () => undefined };
    const { request, timers } = makeRequester({ element, doc });
    const pending = request();
    doc.emit('pointerlockerror');
    assert.equal(await pending, false);
    assert.equal(timers.size, 0);
});

test('timeout sem confirmação resolve false', async () => {
    const element = { requestPointerLock: () => undefined };
    const { request, timers } = makeRequester({ element });
    const pending = request();
    assert.equal(timers.size, 1);
    timers.runNext();
    assert.equal(await pending, false);
});

test('se o elemento já está capturado, não pede lock de novo', async () => {
    const doc = makeDoc();
    const element = {
        requestPointerLock() {
            throw new Error('não deveria chamar');
        },
    };
    doc.pointerLockElement = element;
    const { request } = makeRequester({ element, doc });
    assert.equal(await request(), true);
});

test('API ausente resolve false sem lançar', async () => {
    const { request } = makeRequester({ element: {} });
    assert.equal(await request(), false);
});

test('game.js usa política modular e não esconde o menu antes de confirmar lock', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /pauseMenuDisplay/);
    assert.match(source, /createPointerLockRequester/);
    assert.match(source, /function syncPauseMenu/);
    assert.match(source, /syncPauseMenu\(\{ locked: true \}\)/);
    assert.match(source, /syncPauseMenu\(\{ locked: false \}\)/);
    assert.doesNotMatch(source, /menu\.style\.display = 'none';\s*requestLock\(\)/);
    assert.doesNotMatch(source, /setTimeout\(\(\) => \{ if \(!controls\.isLocked\) menu\.style\.display = 'flex'; \}, 400\)/);
});
