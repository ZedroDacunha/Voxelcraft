import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { META_PREFIX, getWorlds, markWorldSaved } from '../world-list-store.js';
import { restoreSaveCopy } from '../world-save-recovery.js';

const clone = value => (value === undefined ? undefined : structuredClone(value));

// IndexedDB falso: as ações recebem um "object store" com a mesma forma do real
// e devolvem `{ result }` (ou um array deles, como em world-storage.js). O que
// interessa medir aqui é **quais** chaves são lidas — não o conteúdo do save.
function createFakeDb(initial = {}) {
    const data = new Map(Object.entries(initial));
    const calls = { get: [], getKey: [], put: [], delete: [], getAllKeys: 0 };
    const db = async (mode, action) => {
        const store = {
            get(key) { calls.get.push(key); return { result: clone(data.get(key)) }; },
            getKey(key) { calls.getKey.push(key); return { result: data.has(key) ? key : undefined }; },
            put(value, key) { calls.put.push(key); if (mode === 'readwrite') data.set(key, clone(value)); return { result: key }; },
            delete(key) { calls.delete.push(key); data.delete(key); return { result: undefined }; },
            getAllKeys() { calls.getAllKeys++; return { result: [...data.keys()] }; },
        };
        const outcome = action(store);
        if (Array.isArray(outcome)) return outcome; // world-storage devolve o array de requests
        if (outcome === null || outcome === undefined) return outcome;
        return outcome.result;
    };
    return { data, calls, db };
}

const meta = (id, extra = {}) => ({
    id,
    name: `Mundo ${id}`,
    seed: 42,
    saveKey: `world-${id}`,
    createdAt: 1000,
    ...extra,
});

// Save "grande": o conteúdo não é lido, então nem precisa ser pequeno.
const bigSave = time => ({ v: 3, seed: 42, time, blocks: 'x'.repeat(64 * 1024) });

const saveKeysRead = calls => calls.get.filter(key => !key.startsWith(META_PREFIX));

test('lista lê só metadados quando a data do último save está no meta', async () => {
    const fake = createFakeDb({
        [META_PREFIX + 'a']: meta('a', { lastSavedAt: 5000 }),
        [META_PREFIX + 'b']: meta('b', { lastSavedAt: 9000 }),
        'world-a': bigSave(5000),
        'world-b': bigSave(9000),
        'world-b-backup': bigSave(8000),
    });

    const worlds = await getWorlds(fake.db);

    assert.deepEqual(saveKeysRead(fake.calls), [], 'nenhum save deveria ser aberto');
    assert.equal(worlds.length, 2);
    assert.deepEqual(worlds.map(world => world.id), ['b', 'a'], 'ordem por último save');
    assert.equal(worlds[0].lastSavedAt, 9000);
    assert.equal(worlds[0].hasSave, true);
    assert.equal(worlds[0].hasBackup, true);
    assert.equal(worlds[1].hasBackup, false);
});

test('existência das cópias é checada por chave, sem abrir conteúdo', async () => {
    const fake = createFakeDb({
        [META_PREFIX + 'a']: meta('a', { lastSavedAt: 5000 }),
        'world-a': bigSave(5000),
        'world-a-rejected': bigSave(4000),
        'world-a-imported': bigSave(4500),
    });

    const [world] = await getWorlds(fake.db);

    assert.equal(world.hasRejectedSave, true);
    assert.equal(world.hasImportedSave, true);
    assert.deepEqual(
        [...fake.calls.getKey].sort(),
        ['world-a', 'world-a-backup', 'world-a-imported', 'world-a-rejected'],
    );
});

test('meta sem data lê o save uma única vez e grava a data de volta', async () => {
    const fake = createFakeDb({
        [META_PREFIX + 'a']: meta('a'),
        'world-a': bigSave(7000),
    });

    const worlds = await getWorlds(fake.db);

    assert.deepEqual(saveKeysRead(fake.calls), ['world-a']);
    assert.equal(worlds[0].lastSavedAt, 7000);
    assert.equal(fake.data.get(META_PREFIX + 'a').lastSavedAt, 7000, 'meta foi atualizado');
    assert.equal(fake.data.get(META_PREFIX + 'a').name, 'Mundo a', 'o resto do meta é preservado');
    assert.equal(fake.data.get(META_PREFIX + 'a').hasSave, undefined, 'nada de status derivado no meta');

    fake.calls.get.length = 0;
    const again = await getWorlds(fake.db);
    assert.deepEqual(saveKeysRead(fake.calls), [], 'na segunda abertura nada é lido do save');
    assert.equal(again[0].lastSavedAt, 7000);
});

test('save sem data válida não quebra a lista e cai na data de criação', async () => {
    const fake = createFakeDb({
        [META_PREFIX + 'a']: meta('a', { createdAt: 1234 }),
        'world-a': { v: 3, seed: 42 },
    });

    const [world] = await getWorlds(fake.db);

    assert.equal(world.hasSave, true);
    assert.equal(world.lastSavedAt, null);
    assert.equal(world.sortTimestamp, 1234);
});

test('mundo ainda sem save usa a data de criação', async () => {
    const fake = createFakeDb({
        [META_PREFIX + 'a']: meta('a', { lastSavedAt: 9000 }),
        'world-a': bigSave(9000),
        [META_PREFIX + 'novo']: meta('novo', { createdAt: 9500 }),
    });

    const worlds = await getWorlds(fake.db);

    assert.deepEqual(worlds.map(world => world.id), ['novo', 'a']);
    assert.equal(worlds[0].hasSave, false);
    assert.equal(worlds[0].lastSavedAt, null);
    assert.deepEqual(saveKeysRead(fake.calls), [], 'mundo sem save não é lido');
});

test('metadados inválidos são ignorados', async () => {
    const fake = createFakeDb({
        [META_PREFIX + 'sem-seed']: { id: 'sem-seed', name: 'x', saveKey: 'world-x' },
        [META_PREFIX + 'sem-chave']: { id: 'sem-chave', name: 'x', seed: 1 },
        [META_PREFIX + '']: { name: 'sem id', seed: 1, saveKey: 'world-y' },
        [META_PREFIX + 'ok']: meta('ok', { lastSavedAt: 1 }),
    });

    const worlds = await getWorlds(fake.db);

    assert.deepEqual(worlds.map(world => world.id), ['ok']);
});

test('mundos legados ganham meta com a data do save', async () => {
    const fake = createFakeDb({
        'world-123': { seed: 123, time: 4321 },
    });

    const worlds = await getWorlds(fake.db);

    assert.equal(worlds.length, 1);
    assert.equal(worlds[0].id, 'legacy-123');
    assert.equal(worlds[0].lastSavedAt, 4321);
    assert.equal(worlds[0].hasSave, true);
    assert.equal(fake.data.get(META_PREFIX + 'legacy-123').lastSavedAt, 4321);
});

test('migração de legado não mexe em chaves que não são save', async () => {
    const fake = createFakeDb({
        'world-abc': { seed: 'abc' },
        'world-meta:existente': meta('existente', { saveKey: 'outro' }),
    });

    const worlds = await getWorlds(fake.db);

    assert.deepEqual(worlds.map(world => world.id), ['existente']);
    assert.equal(fake.data.has('world-abc'), true, 'chave estranha fica intacta');
});

test('markWorldSaved grava a data no meta', async () => {
    const fake = createFakeDb({ [META_PREFIX + 'a']: meta('a') });

    assert.equal(await markWorldSaved('a', 777, fake.db), true);
    assert.equal(fake.data.get(META_PREFIX + 'a').lastSavedAt, 777);
    assert.equal(fake.data.get(META_PREFIX + 'a').name, 'Mundo a');
});

test('markWorldSaved não regrava a mesma data', async () => {
    const fake = createFakeDb({ [META_PREFIX + 'a']: meta('a', { lastSavedAt: 777 }) });

    assert.equal(await markWorldSaved('a', 777, fake.db), false);
    assert.deepEqual(fake.calls.put, []);

    assert.equal(await markWorldSaved('a', 778, fake.db), true);
    assert.deepEqual(fake.calls.put, [META_PREFIX + 'a']);
});

test('markWorldSaved ignora mundo inexistente e dados inválidos', async () => {
    const fake = createFakeDb({});

    assert.equal(await markWorldSaved('nao-existe', 1, fake.db), false);
    assert.equal(await markWorldSaved('', 1, fake.db), false);
    assert.equal(await markWorldSaved(null, 1, fake.db), false);
    assert.equal(await markWorldSaved('a', NaN, fake.db), false);
    assert.equal(await markWorldSaved('a', '123', fake.db), false);
    assert.deepEqual(fake.calls.put, []);
    assert.deepEqual(fake.calls.get, ['world-meta:nao-existe'], 'só o mundo informado é consultado');
});

test('a lista não cresce em leituras de save conforme o tamanho do mundo', async () => {
    const initial = {};
    for (let i = 0; i < 20; i++) {
        initial[META_PREFIX + `w${i}`] = meta(`w${i}`, { lastSavedAt: 1000 + i });
        initial[`world-w${i}`] = bigSave(1000 + i);
        initial[`world-w${i}-backup`] = bigSave(900 + i);
    }
    const fake = createFakeDb(initial);

    const worlds = await getWorlds(fake.db);

    assert.equal(worlds.length, 20);
    assert.deepEqual(saveKeysRead(fake.calls), []);
    // 1x getAllKeys da migração + 1x getAllKeys da lista + 20 metas + 20 presenças
    assert.equal(fake.calls.get.length, 20, 'uma leitura de meta por mundo');
    assert.equal(fake.calls.getKey.length, 80, 'quatro checagens de chave por mundo');
});

// A restauração de cópia usa callbacks `onsuccess` do IndexedDB; este fake
// dispara os handlers depois da ação, como o navegador faria.
function createHydratingDb(initial = {}) {
    const data = new Map(Object.entries(initial));
    const db = async (mode, action) => {
        const requests = [];
        const makeRequest = result => {
            const request = { result };
            requests.push(request);
            return request;
        };
        const store = {
            get(key) { return makeRequest(clone(data.get(key))); },
            getKey(key) { return makeRequest(data.has(key) ? key : undefined); },
            put(value, key) { if (mode === 'readwrite') data.set(key, clone(value)); return makeRequest(key); },
            delete(key) { if (mode === 'readwrite') data.delete(key); return makeRequest(undefined); },
            getAllKeys() { return makeRequest([...data.keys()]); },
        };
        const outcome = action(store);
        for (const request of requests) request.onsuccess?.();
        if (Array.isArray(outcome)) return outcome;
        if (outcome === null || outcome === undefined) return outcome;
        return outcome.result;
    };
    return { data, db };
}

test('restaurar uma cópia devolve o save restaurado (para atualizar a data)', async () => {
    const fake = createHydratingDb({
        'world-a': { v: 1, time: 900 },
        'world-a-backup': { v: 1, time: 500 },
        'world-a-imported': { v: 1, time: 300 },
    });
    const codec = { validate: data => (data && data.v === 1 ? data : null) };
    const world = { saveKey: 'world-a', seed: 42 };

    const fromBackup = await restoreSaveCopy(fake.db, world, 'backup', codec);
    assert.equal(fromBackup.time, 500);
    assert.equal(fake.data.get('world-a').time, 500);
    assert.equal(fake.data.get('world-a-backup').time, 900, 'o save anterior virou backup');

    const fromImported = await restoreSaveCopy(fake.db, world, 'imported', codec);
    assert.equal(fromImported.time, 300);
    assert.equal(fake.data.has('world-a-imported'), false, 'a cópia importada é consumida');
});

const source = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('a data do último save é atualizada no mesmo fluxo do salvamento', () => {
    const manager = source('world-save-manager.js');
    assert.match(manager, /onSaved = \(\) => \{\}/);
    assert.match(manager, /notifySaved\(data\)/, 'save normal avisa a data');
    assert.match(manager, /notifySaved\(raw\)/, 'recuperação no carregamento também avisa');

    const game = source('game.js');
    assert.match(game, /onSaved: data => markWorldSaved\(ACTIVE_WORLD\.id, data\?\.time\)\s*\.catch\(/);

    const menu = source('world-menu.js');
    assert.match(menu, /onWorldSaved: \(worldId, savedAt\) => markWorldSaved\(worldId, savedAt\)/);

    const options = source('world-save-options.js');
    assert.match(options, /await onWorldSaved\(world\.id, restoredSave\?\.time\)/);
});
