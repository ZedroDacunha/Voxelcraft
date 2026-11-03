import test from 'node:test';
import assert from 'node:assert/strict';

import { WORLD_SAVE_VERSION } from '../world-save-codec.js';
import {
    importedSaveKeyFor, parseSaveCopy, preserveRejectedSave, rejectedSaveKeyFor,
    restoreSaveCopy, saveBackupKeyFor, stageImportedSaveCopy,
} from '../world-save-recovery.js';
import { createWorldSaveManager } from '../world-save-manager.js';
import { createFakeDatabase, createStoreRequest, fakeFile, withWindowStub } from './helpers/fake-indexeddb.mjs';

const SAVE_KEY = 'world-a';
const BACKUP_KEY = saveBackupKeyFor(SAVE_KEY);
const REJECTED_KEY = rejectedSaveKeyFor(SAVE_KEY);
const IMPORTED_KEY = importedSaveKeyFor(SAVE_KEY);
const LOCK_KEY = `${SAVE_KEY}-writer-lock`;
const SEED = 42;

const validCodec = { validate: (data, seed) => (data && data.v === WORLD_SAVE_VERSION && data.seed === seed ? data : null) };

const validCopy = (overrides = {}) => ({
    format: 'voxel-sandbox-save-copy',
    exportedAt: new Date().toISOString(),
    world: { id: 'w1', name: 'Mundo', seed: SEED },
    kind: 'current',
    save: { v: WORLD_SAVE_VERSION, seed: SEED, time: 1 },
    ...overrides,
});

// ---------------------------------------------------------------------------
// parseSaveCopy: arquivo escolhido pelo jogador
// ---------------------------------------------------------------------------

test('cópia válida é aceita e devolve o save', async () => {
    const save = await parseSaveCopy(fakeFile(validCopy()), SEED);
    assert.equal(save.v, WORLD_SAVE_VERSION);
    assert.equal(save.seed, SEED);
});

test('JSON quebrado e arquivo vazio têm mensagens próprias', async () => {
    await assert.rejects(() => parseSaveCopy(fakeFile('{ isso não é json'), SEED), /JSON válido/);
    await assert.rejects(() => parseSaveCopy({ size: 0, text: async () => '' }, SEED), /está vazio/);
});

test('arquivo grande demais ou ilegível é recusado', async () => {
    await assert.rejects(() => parseSaveCopy({ size: 64 * 1024 * 1024 + 1 }, SEED), /64 MB/);
    await assert.rejects(() => parseSaveCopy(null, SEED), /ler o arquivo/);
    await assert.rejects(
        () => parseSaveCopy({ size: 10, text: async () => { throw new Error('sumiu'); } }, SEED),
        /ler o arquivo/,
    );
});

test('cópia de outro jogo, de outra versão ou de outro mundo é recusada', async () => {
    await assert.rejects(() => parseSaveCopy(fakeFile(validCopy({ format: 'outro' })), SEED), /cópia compatível/);
    await assert.rejects(() => parseSaveCopy(fakeFile(validCopy({ kind: 'imported' })), SEED), /cópia compatível/);
    await assert.rejects(
        () => parseSaveCopy(fakeFile(validCopy({ world: { id: 'w1', name: 'x', seed: 7 } })), SEED),
        /cópia compatível/,
    );
    await assert.rejects(
        () => parseSaveCopy(fakeFile(validCopy({ save: { v: WORLD_SAVE_VERSION + 1, seed: SEED } })), SEED),
        /cópia compatível/,
    );
    await assert.rejects(
        () => parseSaveCopy(fakeFile(validCopy({ save: { v: WORLD_SAVE_VERSION, seed: 7 } })), SEED),
        /cópia compatível/,
    );
});

test('edições de terreno inválidas não passam pela desserialização', async () => {
    const copy = validCopy({
        save: {
            v: WORLD_SAVE_VERSION,
            seed: SEED,
            edits: [['0,0', { __type: 'Uint16Array', values: [1, -2] }]],
        },
    });
    await assert.rejects(() => parseSaveCopy(fakeFile(copy), SEED), /edições de terreno inválidas/);

    const good = validCopy({
        save: { v: WORLD_SAVE_VERSION, seed: SEED, edits: [['0,0', { __type: 'Uint16Array', values: [1, 2] }]] },
    });
    const save = await parseSaveCopy(fakeFile(good), SEED);
    assert.equal(save.edits[0][1] instanceof Uint16Array, true);
    assert.deepEqual([...save.edits[0][1]], [1, 2]);
});

// ---------------------------------------------------------------------------
// Cópias guardadas no banco (importação, rejeitado, restauração)
// ---------------------------------------------------------------------------

test('importar cópia grava quando o mundo está fechado', async () => {
    const { data, db } = createFakeDatabase();
    await stageImportedSaveCopy(createStoreRequest(db), { saveKey: SAVE_KEY }, { v: WORLD_SAVE_VERSION });

    assert.deepEqual(data.get(IMPORTED_KEY), { v: WORLD_SAVE_VERSION });
    assert.equal(data.has(SAVE_KEY), false, 'o save principal não é tocado na importação');
});

test('importar cópia com o mundo aberto em outra aba é recusado', async () => {
    const { data, db } = createFakeDatabase({ [LOCK_KEY]: { id: 'tab-2', heartbeat: Date.now() } });
    await assert.rejects(
        () => stageImportedSaveCopy(createStoreRequest(db), { saveKey: SAVE_KEY }, { v: WORLD_SAVE_VERSION }),
        /outra aba/,
    );
    assert.equal(data.has(IMPORTED_KEY), false);
});

test('save rejeitado é guardado sem sobrescrever o primeiro', async () => {
    const { data, db } = createFakeDatabase();
    const storeRequest = createStoreRequest(db);

    await preserveRejectedSave(storeRequest, SAVE_KEY, { problema: 1 });
    assert.deepEqual(data.get(REJECTED_KEY), { problema: 1 });

    await preserveRejectedSave(storeRequest, SAVE_KEY, { problema: 2 });
    assert.deepEqual(data.get(REJECTED_KEY), { problema: 1 }, 'o primeiro arquivo rejeitado é o que fica');
});

test('restaurar cópia inválida não mexe no save principal', async () => {
    const { data, db } = createFakeDatabase({
        [SAVE_KEY]: { v: WORLD_SAVE_VERSION, seed: SEED, time: 10 },
        [BACKUP_KEY]: { lixo: true },
    });

    await assert.rejects(
        () => restoreSaveCopy(createStoreRequest(db), { saveKey: SAVE_KEY, seed: SEED }, 'backup', validCodec),
        /não é válida/,
    );
    assert.deepEqual(data.get(SAVE_KEY), { v: WORLD_SAVE_VERSION, seed: SEED, time: 10 });
});

test('restaurar cópia com o mundo aberto em outra aba é recusado', async () => {
    const { data, db } = createFakeDatabase({
        [LOCK_KEY]: { id: 'tab-2', heartbeat: Date.now() },
        [SAVE_KEY]: { v: WORLD_SAVE_VERSION, seed: SEED, time: 10 },
        [BACKUP_KEY]: { v: WORLD_SAVE_VERSION, seed: SEED, time: 5 },
    });

    await assert.rejects(
        () => restoreSaveCopy(createStoreRequest(db), { saveKey: SAVE_KEY, seed: SEED }, 'backup', validCodec),
        /outra aba/,
    );
    assert.equal(data.get(SAVE_KEY).time, 10);
});

// ---------------------------------------------------------------------------
// O carregamento do jogo: o que acontece com o save que não valida
// ---------------------------------------------------------------------------

function createManager(db, hooks = {}) {
    const toasts = [];
    const states = [];
    const manager = createWorldSaveManager({
        openDatabase: async () => db,
        storeRequest: createStoreRequest(db),
        saveKey: SAVE_KEY,
        tabId: 'tab-1',
        seed: SEED,
        codec: validCodec,
        buildSave: () => ({ v: WORLD_SAVE_VERSION, seed: SEED, time: 999 }),
        hasWorld: () => true,
        onToast: message => toasts.push(message),
        onSaveState: (state, message) => states.push([state, message]),
        onSaved: () => {},
        onError: () => {},
        ...hooks,
    });
    return { manager, toasts, states };
}

test('save válido é carregado sem acionar recuperação', async () => {
    const restoreWindow = withWindowStub();
    try {
        const save = { v: WORLD_SAVE_VERSION, seed: SEED, time: 10 };
        const { data, db } = createFakeDatabase({ [SAVE_KEY]: save });
        const { manager, toasts } = createManager(db);

        assert.deepEqual(await manager.load(), save);
        assert.deepEqual(toasts, []);
        assert.equal(data.has(BACKUP_KEY), false);
        await manager.flushAndRelease(true);
    } finally {
        restoreWindow();
    }
});

test('save inválido é preservado e o backup assume o lugar', async () => {
    const restoreWindow = withWindowStub();
    try {
        const broken = { v: 99, seed: SEED, time: 10 };
        const backup = { v: WORLD_SAVE_VERSION, seed: SEED, time: 5 };
        const { data, db } = createFakeDatabase({ [SAVE_KEY]: broken, [BACKUP_KEY]: backup });
        const { manager, toasts } = createManager(db);

        assert.deepEqual(await manager.load(), backup);
        assert.deepEqual(data.get(REJECTED_KEY), broken, 'o save quebrado fica guardado para inspeção');
        assert.deepEqual(data.get(SAVE_KEY), backup, 'o backup é promovido a save principal');
        assert.ok(toasts.some(message => /backup/i.test(message)));
        await manager.flushAndRelease(true);
    } finally {
        restoreWindow();
    }
});

test('cópia importada válida é promovida e consumida', async () => {
    const restoreWindow = withWindowStub();
    try {
        const imported = { v: WORLD_SAVE_VERSION, seed: SEED, time: 3 };
        const { data, db } = createFakeDatabase({ [SAVE_KEY]: { v: 99, seed: SEED }, [IMPORTED_KEY]: imported });
        const { manager, toasts } = createManager(db);

        assert.deepEqual(await manager.load(), imported);
        assert.deepEqual(data.get(SAVE_KEY), imported);
        assert.equal(data.has(IMPORTED_KEY), false, 'a cópia importada é consumida');
        assert.ok(toasts.some(message => /importada/i.test(message)));
        await manager.flushAndRelease(true);
    } finally {
        restoreWindow();
    }
});

test('save inválido sem nenhuma cópia devolve null e avisa o jogador', async () => {
    const restoreWindow = withWindowStub();
    try {
        const broken = { v: 99, seed: SEED };
        const { data, db } = createFakeDatabase({ [SAVE_KEY]: broken });
        const { manager, toasts } = createManager(db);

        assert.equal(await manager.load(), null);
        assert.deepEqual(data.get(REJECTED_KEY), broken, 'nada é apagado');
        assert.deepEqual(data.get(SAVE_KEY), broken, 'o save original continua no lugar');
        assert.ok(toasts.length >= 1, 'o jogador é avisado');
        await manager.release();
    } finally {
        restoreWindow();
    }
});

test('reset apaga save, backup, rejeitado e cópia importada', async () => {
    const restoreWindow = withWindowStub();
    try {
        const { data, db } = createFakeDatabase({
            [SAVE_KEY]: { v: WORLD_SAVE_VERSION, seed: SEED, time: 10 },
            [BACKUP_KEY]: { v: WORLD_SAVE_VERSION, seed: SEED, time: 9 },
            [REJECTED_KEY]: { v: 99, seed: SEED },
            [IMPORTED_KEY]: { v: WORLD_SAVE_VERSION, seed: SEED, time: 8 },
        });
        const { manager } = createManager(db);

        assert.equal(await manager.load({ reset: true }), null);
        for (const key of [SAVE_KEY, BACKUP_KEY, REJECTED_KEY, IMPORTED_KEY]) {
            assert.equal(data.has(key), false, `${key} deveria ter sido apagado`);
        }
        await manager.release();
    } finally {
        restoreWindow();
    }
});

test('falha ao ler o save bloqueia gravações em vez de arriscar o mundo', async () => {
    const restoreWindow = withWindowStub();
    try {
        const { data, db } = createFakeDatabase({ [SAVE_KEY]: { v: WORLD_SAVE_VERSION, seed: SEED, time: 1 } });
        const states = [];
        const { manager } = createManager(db, {
            storeRequest: async () => { throw new Error('leitura falhou'); },
            onSaveState: (state, message) => states.push([state, message]),
        });

        assert.equal(await manager.load(), null);
        assert.equal(await manager.saveNow(true), false, 'não grava por cima de um save que não conseguiu ler');
        assert.deepEqual(data.get(SAVE_KEY), { v: WORLD_SAVE_VERSION, seed: SEED, time: 1 });
        assert.ok(states.some(([state]) => state === 'blocked' || state === 'error'));
        await manager.release();
    } finally {
        restoreWindow();
    }
});
