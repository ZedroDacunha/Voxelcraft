// O caminho de erro do save: falha transitória, fila de espera e as falhas
// permanentes (armazenamento cheio, navegador bloqueando).
//
// É o teste que mais faltava: `scheduleSaveRetry` decide se o jogador vai perder
// progresso quando o IndexedDB falha. Sem teste, o comportamento é o que o
// código **pretende** — não o que ele faz.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorldSaveManager } from '../world-save-manager.js';
import { createFakeDatabase, createStoreRequest, withWindowStub } from './helpers/fake-indexeddb.mjs';

const LOCK_KEY = 'world-a-writer-lock';
const SAVE_KEY = 'world-a';
const SAVE = { v: 3, time: 1000 };

const quotaError = () => Object.assign(new Error('cheio'), { name: 'QuotaExceededError' });
const transientError = () => new Error('falha passageira do IndexedDB');

/**
 * Deixa o banco falso falhar nas gravações do **save** (e só nelas: o lease e o
 * backup continuam funcionando).
 *
 * A falha é injetada no `store.put` do save, que é onde o problema nasce de
 * verdade — e segue o mesmo desfecho observável do navegador: o pedido falha,
 * a **transação aborta** e o `lock.write` rejeita. (No IndexedDB real o erro do
 * disco chega em `request.onerror` e aborta a transação; aqui o abort é
 * síncrono, mas o que o código do jogo vê é o mesmo: rejeição com o erro.)
 *
 * Fazer o `storeRequest` do manager falhar não testaria nada: ele só é usado no
 * `load()` — a gravação passa por `world-save-lock.js`.
 */
function createFlakyDatabase(initial = {}) {
    const { data, db } = createFakeDatabase(initial);
    const state = { fail: () => null, saves: 0, entries: [] };

    const wrapped = {
        closes: 0,
        close() { db.close(); wrapped.closes++; },
        transaction(...args) {
            const tx = db.transaction(...args);
            const originalObjectStore = tx.objectStore.bind(tx);
            tx.objectStore = (...storeArgs) => {
                const store = originalObjectStore(...storeArgs);
                const originalPut = store.put.bind(store);
                store.put = (value, key) => {
                    if (key !== SAVE_KEY) return originalPut(value, key);
                    state.saves++;
                    state.entries.push(value);
                    const error = state.fail();
                    if (!error) return originalPut(value, key);
                    // pedido falho + transação abortada: é o que o jogo vê
                    tx.error = error;
                    tx.abort();
                    return { result: undefined, error, onsuccess: null, onerror: null };
                };
                return store;
            };
            return tx;
        },
    };

    return { data, db: wrapped, state };
}

function createManager({ db, overrides = {} }) {
    const states = [];
    const toasts = [];
    const errors = [];
    const manager = createWorldSaveManager({
        openDatabase: async () => db,
        storeRequest: createStoreRequest(db),
        saveKey: SAVE_KEY,
        tabId: 'tab-1',
        seed: 42,
        codec: { validate: data => data ?? null },
        buildSave: () => ({ ...SAVE }),
        hasWorld: () => true,
        onToast: message => toasts.push(message),
        onSaveState: (state, message) => states.push([state, message]),
        onSaved: () => {},
        onError: error => errors.push(error),
        ...overrides,
    });
    return { manager, states, toasts, errors };
}

/** Deixa microtasks e `setImmediate` pendentes rodarem (IndexedDB falso). */
async function settle(rounds = 12) {
    for (let i = 0; i < rounds; i++) await new Promise(resolve => setImmediate(resolve));
}

const lastState = (states) => states.at(-1)?.[0];
const lastErrorMessage = (states) => states.filter(([state]) => state === 'error').at(-1)?.[1] ?? '';

test('falha transitória vira mensagem, aviso único e nova tentativa', async (t) => {
    const restoreWindow = withWindowStub();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const { data, db, state } = createFlakyDatabase();
        const { manager, states, toasts, errors } = createManager({ db });

        await manager.load();
        state.fail = () => transientError();
        assert.equal(await manager.saveNow(true), false);
        await settle();

        assert.equal(errors.length, 1, 'o erro chega ao onError');
        assert.match(lastErrorMessage(states), /tentará novamente/, 'a mensagem diz que vai tentar de novo');
        assert.equal(toasts.filter(message => /tentará novamente/.test(message)).length, 1,
            'avisa uma vez, não a cada tentativa');
        assert.equal(data.has(SAVE_KEY), false, 'nada foi gravado');

        const savesBefore = state.saves;
        t.mock.timers.tick(1999);
        await settle();
        assert.equal(state.saves, savesBefore, 'não tenta antes da hora');

        state.fail = () => null; // a falha passageira passou
        t.mock.timers.tick(1);
        await settle();
        assert.deepEqual(data.get(SAVE_KEY), SAVE, 'o retry gravou o mundo');
        assert.equal(lastState(states), 'saved');
        assert.ok(toasts.includes('Salvamento retomado'), 'quem viu o erro é avisado da volta');
        await manager.release();
    } finally {
        restoreWindow();
    }
});

test('armazenamento cheio não fica tentando para sempre', async (t) => {
    const restoreWindow = withWindowStub();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const { db, state } = createFlakyDatabase();
        const { manager, states, toasts } = createManager({ db });

        await manager.load();
        state.fail = () => quotaError();
        await manager.saveNow(true);
        await settle();

        assert.match(lastErrorMessage(states), /Armazenamento cheio/, 'explica o problema e o que fazer');
        assert.ok(toasts.some(message => /exporte uma cópia/.test(message)), 'sugere exportar uma cópia');

        const saves = state.saves;
        t.mock.timers.tick(300000); // 5 minutos
        await settle();
        assert.equal(state.saves, saves, 'retry infinito com disco cheio só gastaria bateria');
        await manager.release();
    } finally {
        restoreWindow();
    }
});

test('navegador bloqueando o armazenamento também é falha permanente', async (t) => {
    const restoreWindow = withWindowStub();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
        for (const error of [
            { name: 'SecurityError' },
            { name: 'NotAllowedError' },
            { code: 22 },
            { code: 1014 },
        ]) {
            const { db, state } = createFlakyDatabase();
            const { manager, states } = createManager({ db });

            await manager.load();
            state.fail = () => error;
            await manager.saveNow(true);
            await settle();

            const message = lastErrorMessage(states);
            const expected = error.code ? /Armazenamento cheio/ : /bloqueou o armazenamento/;
            assert.match(message, expected, `mensagem para ${error.name ?? error.code}`);

            const saves = state.saves;
            t.mock.timers.tick(60000);
            await settle();
            assert.equal(state.saves, saves, `${error.name ?? error.code} não deve entrar em retry`);
            await manager.release();
        }
    } finally {
        restoreWindow();
    }
});

test('a espera cresce a cada falha e tem teto', async (t) => {
    const restoreWindow = withWindowStub();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const { db, state } = createFlakyDatabase();
        const { manager } = createManager({ db });

        await manager.load();
        state.fail = () => transientError();
        await manager.saveNow(true);
        await settle();

        // escada de world-save-manager.js: 2 s, 5 s, 12 s, 30 s, e para aí
        for (const delay of [2000, 5000, 12000, 30000, 30000]) {
            const saves = state.saves;
            t.mock.timers.tick(delay - 1);
            await settle();
            assert.equal(state.saves, saves, `não tenta antes de ${delay} ms`);

            t.mock.timers.tick(1);
            await settle();
            assert.ok(state.saves > saves, `tenta depois de ${delay} ms`);
        }
        await manager.release();
    } finally {
        restoreWindow();
    }
});

test('sucesso zera a escada de espera', async (t) => {
    const restoreWindow = withWindowStub();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const { data, db, state } = createFlakyDatabase();
        const { manager } = createManager({ db });

        await manager.load();
        state.fail = () => transientError();
        await manager.saveNow(true);
        await settle();
        for (const delay of [2000, 5000, 12000]) { // gasta a escada até 30 s
            t.mock.timers.tick(delay);
            await settle();
        }
        assert.equal(data.has(SAVE_KEY), false);

        state.fail = () => null;
        t.mock.timers.tick(30000);
        await settle();
        assert.deepEqual(data.get(SAVE_KEY), SAVE, 'gravou no topo da escada');

        // nova falha depois do sucesso volta a esperar 2 s, não 30 s
        state.fail = () => transientError();
        await manager.saveNow(true);
        await settle();
        const saves = state.saves;
        t.mock.timers.tick(1999);
        await settle();
        assert.equal(state.saves, saves, 'a escada foi zerada pelo sucesso');
        state.fail = () => null;
        t.mock.timers.tick(1);
        await settle();
        assert.ok(state.saves > saves, 'volta a tentar em 2 s');
        await manager.release();
    } finally {
        restoreWindow();
    }
});

test('duas falhas seguidas não agendam dois retries', async (t) => {
    const restoreWindow = withWindowStub();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const { db, state } = createFlakyDatabase();
        const { manager } = createManager({ db });

        await manager.load();
        state.fail = () => transientError();
        await manager.saveNow(true);
        await settle();
        await manager.saveNow(true);
        await settle();

        const saves = state.saves;
        t.mock.timers.tick(2000);
        await settle();
        assert.equal(state.saves, saves + 1, 'um retry, não dois pelo mesmo timer');
        await manager.release();
    } finally {
        restoreWindow();
    }
});

test('sem mundo carregado, nada de gravação nem de retry', async (t) => {
    const restoreWindow = withWindowStub();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const { db, state } = createFlakyDatabase();
        const { manager, states } = createManager({ db, overrides: { hasWorld: () => false } });

        state.fail = () => transientError();
        assert.equal(await manager.saveNow(true), false);
        await settle();
        assert.equal(state.saves, 0, 'nem tenta gravar sem mundo');
        assert.deepEqual(states, [], 'nada de mensagem de erro para o jogador');

        t.mock.timers.tick(60000);
        await settle();
        assert.equal(state.saves, 0);
    } finally {
        restoreWindow();
    }
});

test('outra aba dona do lease bloqueia, mas não agenda retry', async (t) => {
    const restoreWindow = withWindowStub();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const { db, state } = createFlakyDatabase({ [LOCK_KEY]: { id: 'tab-2', heartbeat: Date.now() } });
        const { manager, states } = createManager({ db });

        await manager.load();
        state.fail = () => transientError();
        assert.equal(await manager.saveNow(true), false);
        await settle();

        assert.equal(state.saves, 0, 'sem posse do lease nem tenta gravar');
        assert.equal(lastState(states), 'blocked');
        t.mock.timers.tick(60000);
        await settle();
        assert.equal(state.saves, 0, 'bloqueio não é falha transitória: não fica tentando');
    } finally {
        restoreWindow();
    }
});

test('sair do jogo cancela o retry pendente e grava no flush', async (t) => {
    const restoreWindow = withWindowStub();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const { data, db, state } = createFlakyDatabase();
        const { manager } = createManager({ db });

        await manager.load();
        state.fail = () => transientError();
        await manager.saveNow(true);
        await settle();
        assert.equal(data.has(SAVE_KEY), false);

        state.fail = () => null;
        t.mock.timers.tick(1999); // o jogador sai antes do retry disparar
        await settle();
        await manager.flushAndRelease(true);
        await settle();
        assert.deepEqual(data.get(SAVE_KEY), SAVE, 'o flush grava na saída');

        const saves = state.saves;
        t.mock.timers.tick(30000);
        await settle();
        assert.equal(state.saves, saves, 'o retry agendado não dispara depois do flush');
    } finally {
        restoreWindow();
    }
});
