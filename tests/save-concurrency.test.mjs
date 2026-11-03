import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorldSaveLock } from '../world-save-lock.js';
import { createWorldSaveManager } from '../world-save-manager.js';

const clone = value => (value === undefined ? undefined : structuredClone(value));

// IndexedDB de mentira com o mínimo que o lock usa: transação readwrite, store
// com get/put/delete e callbacks `onsuccess`/`oncomplete` disparados de forma
// assíncrona (como no navegador). `db.data` deixa o teste inspecionar o disco.
function createFakeDatabase(initial = {}) {
    const data = new Map(Object.entries(initial));
    const db = {
        closes: 0,
        close() { db.closes++; },
        transaction() {
            let aborted = false;
            const ops = [];
            const store = {
                get(key) { return enqueue(() => clone(data.get(key))); },
                put(value, key) { return enqueue(() => { data.set(key, clone(value)); return key; }); },
                delete(key) { return enqueue(() => { data.delete(key); return undefined; }); },
            };
            const tx = {
                error: null,
                abort() { aborted = true; tx.onabort?.(); },
                objectStore() { return store; },
            };
            function enqueue(run) {
                const request = { result: undefined, error: null, onsuccess: null, onerror: null };
                ops.push({ request, run });
                return request;
            }
            const flush = () => {
                // Um request por vez; callbacks podem criar novos (ex.: put dentro
                // do onsuccess de um get).
                for (let i = 0; i < ops.length && !aborted; i++) {
                    const { request, run } = ops[i];
                    try {
                        request.result = run();
                    } catch (error) {
                        request.error = error;
                        request.onerror?.();
                        return;
                    }
                    request.onsuccess?.();
                }
                if (!aborted) tx.oncomplete?.();
            };
            queueMicrotask(flush);
            return tx;
        },
    };
    return { data, db };
}

const LOCK_KEY = 'world-a-writer-lock';

function createLock(db, overrides = {}) {
    const lost = [];
    const errors = [];
    const lock = createWorldSaveLock({
        openDatabase: async () => db,
        saveKey: 'world-a',
        backupKey: 'world-a-backup',
        tabId: 'tab-1',
        onLost: () => lost.push('lost'),
        onError: error => errors.push(error),
        ...overrides,
    });
    return { lock, lost, errors };
}

test('a primeira aba adquire o lease e a segunda não rouba', async () => {
    const { data, db } = createFakeDatabase();
    const first = createLock(db);
    const second = createLock(db, { tabId: 'tab-2' });

    assert.equal(await first.lock.acquire(), true);
    assert.equal(first.lock.isOwned, true);
    assert.deepEqual(data.get(LOCK_KEY).id, 'tab-1');

    assert.equal(await second.lock.acquire(), false);
    assert.equal(second.lock.isOwned, false);
    assert.equal(data.get(LOCK_KEY).id, 'tab-1', 'o lease continua com a primeira aba');
    assert.deepEqual(second.lost, [], 'quem nunca teve posse não recebe aviso de perda');

    await first.lock.release();
});

test('lease expirado pode ser assumido por outra aba', async () => {
    const { data, db } = createFakeDatabase({ [LOCK_KEY]: { id: 'tab-2', heartbeat: Date.now() - 60_000 } });
    const { lock } = createLock(db, { ttl: 30_000 });

    assert.equal(await lock.acquire(), true);
    assert.equal(data.get(LOCK_KEY).id, 'tab-1');
    await lock.release();
});

test('lease com heartbeat inválido também expira', async () => {
    const { data, db } = createFakeDatabase({ [LOCK_KEY]: { id: 'tab-2' } });
    const { lock } = createLock(db);

    assert.equal(await lock.acquire(), true);
    assert.equal(data.get(LOCK_KEY).id, 'tab-1');
    await lock.release();
});

test('write grava o save e renova o heartbeat do lease', async () => {
    const { data, db } = createFakeDatabase({ [LOCK_KEY]: { id: 'tab-1', heartbeat: 1 } });
    const { lock } = createLock(db);
    await lock.acquire();

    assert.equal(await lock.write({ v: 3, seed: 42 }), true);
    assert.deepEqual(data.get('world-a'), { v: 3, seed: 42 });
    assert.ok(data.get(LOCK_KEY).heartbeat > 1, 'o lease é renovado junto com a gravação');
    await lock.release();
});

test('write com preservePrevious guarda o save anterior no backup', async () => {
    const { data, db } = createFakeDatabase({ 'world-a': { v: 3, geracao: 1 } });
    const { lock } = createLock(db);
    await lock.acquire();

    assert.equal(await lock.write({ v: 3, geracao: 2 }, { preservePrevious: true }), true);
    assert.deepEqual(data.get('world-a'), { v: 3, geracao: 2 });
    assert.deepEqual(data.get('world-a-backup'), { v: 3, geracao: 1 }, 'o anterior vira backup');
    await lock.release();
});

test('write sem preservePrevious não mexe no backup', async () => {
    const { data, db } = createFakeDatabase({ 'world-a': { geracao: 1 }, 'world-a-backup': { geracao: 0 } });
    const { lock } = createLock(db);
    await lock.acquire();

    await lock.write({ geracao: 2 });
    assert.deepEqual(data.get('world-a-backup'), { geracao: 0 });
    await lock.release();
});

test('write com deleteKey consome a cópia importada', async () => {
    const { data, db } = createFakeDatabase({ 'world-a-imported': { importado: true } });
    const { lock } = createLock(db);
    await lock.acquire();

    assert.equal(await lock.write({ v: 3 }, { deleteKey: 'world-a-imported' }), true);
    assert.equal(data.has('world-a-imported'), false);
    await lock.release();
});

test('write sem posse não grava nada e avisa a perda', async () => {
    const { data, db } = createFakeDatabase();
    const { lock, lost } = createLock(db);
    await lock.acquire();

    // outra aba assumiu o lease (lease expirado ou roubado por fora)
    data.set(LOCK_KEY, { id: 'tab-2', heartbeat: Date.now() });

    assert.equal(await lock.write({ v: 3 }), false);
    assert.equal(data.has('world-a'), false, 'nada foi gravado');
    assert.equal(lock.isOwned, false);
    assert.deepEqual(lost, ['lost'], 'onLost é chamado uma vez');
});

test('write antes de adquirir devolve false sem tocar no banco', async () => {
    const { data, db } = createFakeDatabase();
    const { lock } = createLock(db);

    assert.equal(await lock.write({ v: 3 }), false);
    assert.equal(data.has('world-a'), false);
});

test('release apaga o lease e libera a próxima aba', async () => {
    const { data, db } = createFakeDatabase();
    const first = createLock(db);
    const second = createLock(db, { tabId: 'tab-2' });

    await first.lock.acquire();
    assert.equal(await first.lock.release(), true);
    assert.equal(first.lock.isOwned, false);
    assert.equal(data.has(LOCK_KEY), false, 'lease removido');

    assert.equal(await second.lock.acquire(), true);
    await second.lock.release();
});

test('release sem posse devolve false', async () => {
    const { db } = createFakeDatabase();
    const { lock } = createLock(db);
    assert.equal(await lock.release(), false);
});

test('erro ao abrir o banco rejeita acquire', async () => {
    const { lock } = createLock(null, { openDatabase: async () => { throw new Error('banco indisponível'); } });
    await assert.rejects(() => lock.acquire(), /banco indisponível/);
    assert.equal(lock.isOwned, false);
});

test('heartbeat renova o lease e detecta quando outra aba assume', async () => {
    const { data, db } = createFakeDatabase();
    const { lock, lost } = createLock(db, { heartbeatMs: 5 });
    await lock.acquire();
    const firstBeat = data.get(LOCK_KEY).heartbeat;

    await new Promise(resolve => setTimeout(resolve, 25));
    assert.ok(data.get(LOCK_KEY).heartbeat >= firstBeat, 'heartbeat avança enquanto a aba é dona');

    // outra aba assume o lease
    data.set(LOCK_KEY, { id: 'tab-2', heartbeat: Date.now() });
    await new Promise(resolve => setTimeout(resolve, 30));

    assert.equal(lock.isOwned, false, 'a perda de posse é detectada pelo heartbeat');
    assert.ok(lost.length >= 1);
});

// ---------------------------------------------------------------------------
// Save manager: as travas de concorrência vistas de fora (é o que impede duas
// abas de sobrescreverem o mesmo mundo).
// ---------------------------------------------------------------------------
// O manager registra um listener de `pagehide` ao ser criado; no Node não há
// window, então o teste oferece um stub mínimo.
function withWindowStub() {
    const previous = globalThis.window;
    globalThis.window = { addEventListener() {} };
    return () => {
        if (previous === undefined) delete globalThis.window;
        else globalThis.window = previous;
    };
}

function createStoreRequest(db) {
    return async (mode, action) => {
        const tx = db.transaction('worlds', mode);
        const outcome = action(tx.objectStore('worlds'));
        if (Array.isArray(outcome)) return outcome;
        if (outcome === null || outcome === undefined) return outcome;
        await new Promise(resolve => setImmediate(resolve));
        return outcome.result;
    };
}

test('o save manager não grava quando outra aba tem o lease', async () => {
    const restoreWindow = withWindowStub();
    try {
        const { data, db } = createFakeDatabase({ [LOCK_KEY]: { id: 'tab-2', heartbeat: Date.now() } });
        const states = [];
        const toasts = [];
        const manager = createWorldSaveManager({
            openDatabase: async () => db,
            storeRequest: createStoreRequest(db),
            saveKey: 'world-a',
            tabId: 'tab-1',
            seed: 42,
            codec: { validate: data => data ?? null },
            buildSave: () => ({ v: 3, time: 1 }),
            hasWorld: () => true,
            onToast: message => toasts.push(message),
            onSaveState: (state, message) => states.push([state, message]),
            onSaved: () => {},
            onError: () => {},
        });

        assert.equal(await manager.load(), null);
        assert.equal(await manager.saveNow(true), false);
        assert.equal(data.has('world-a'), false, 'nada foi gravado por cima da outra aba');
        assert.ok(states.some(([state]) => state === 'blocked'), 'a UI é avisada do bloqueio');
        assert.ok(toasts.some(message => /outra aba/i.test(message)));
        assert.equal(data.get(LOCK_KEY).id, 'tab-2', 'o lease da outra aba continua intacto');
    } finally {
        restoreWindow();
    }
});

test('o save manager grava e avisa quando a aba é dona do lease', async () => {
    const restoreWindow = withWindowStub();
    try {
        const { data, db } = createFakeDatabase();
        const states = [];
        const saved = [];
        const manager = createWorldSaveManager({
            openDatabase: async () => db,
            storeRequest: createStoreRequest(db),
            saveKey: 'world-a',
            tabId: 'tab-1',
            seed: 42,
            codec: { validate: data => data ?? null },
            buildSave: () => ({ v: 3, time: 777 }),
            hasWorld: () => true,
            onToast: () => {},
            onSaveState: (state, message) => states.push([state, message]),
            onSaved: data => saved.push(data),
            onError: () => {},
        });

        await manager.load();
        assert.equal(await manager.saveNow(true), true);

        assert.deepEqual(data.get('world-a'), { v: 3, time: 777 });
        assert.equal(data.get(LOCK_KEY).id, 'tab-1', 'o lease continua com quem salvou');
        assert.ok(states.some(([state]) => state === 'saved'));
        assert.deepEqual(saved, [{ v: 3, time: 777 }], 'onSaved recebe o save gravado (data do meta)');
        await manager.flushAndRelease(true);
    } finally {
        restoreWindow();
    }
});

test('requestSave em modo silencioso espera o debounce antes de gravar', async t => {
    const restoreWindow = withWindowStub();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const { data, db } = createFakeDatabase();
        const states = [];
        const manager = createWorldSaveManager({
            openDatabase: async () => db,
            storeRequest: createStoreRequest(db),
            saveKey: 'world-a',
            tabId: 'tab-1',
            seed: 42,
            codec: { validate: data => data ?? null },
            buildSave: () => ({ v: 3, time: 999 }),
            hasWorld: () => true,
            onToast: () => {},
            onSaveState: (state, message) => states.push([state, message]),
            onSaved: () => {},
            onError: () => {},
        });

        await manager.load();
        manager.requestSave(true);
        assert.equal(states[states.length - 1][0], 'pending', 'fica pendente aguardando o debounce');
        assert.equal(data.has('world-a'), false, 'ainda não gravou');

        t.mock.timers.tick(5000);
        for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve));

        assert.deepEqual(data.get('world-a'), { v: 3, time: 999 }, 'gravou depois do debounce');
        await manager.flushAndRelease(true);
    } finally {
        restoreWindow();
    }
});
