import { openDatabase, storeRequest, STORE_NAME } from './world-storage.js';
import {
    importedSaveKeyFor, rejectedSaveKeyFor, saveBackupKeyFor,
} from './world-save-recovery.js';

export const META_PREFIX = 'world-meta:';

/**
 * Grava a data do último save nos metadados do mundo.
 *
 * A lista de mundos só precisa de data e status; com a data no meta, abrir o
 * menu não abre mais o blob inteiro de cada save. Retorna `true` quando o meta
 * mudou de fato.
 */
export async function markWorldSaved(worldId, savedAt, db = storeRequest) {
    if (typeof worldId !== 'string' || !worldId || !Number.isFinite(savedAt)) return false;
    const metaKey = META_PREFIX + worldId;
    const world = await db('readonly', store => store.get(metaKey));
    if (!world || world.lastSavedAt === savedAt) return false;
    await db('readwrite', store => store.put({ ...world, lastSavedAt: savedAt }, metaKey));
    return true;
}

export async function migrateLegacyWorlds(db = storeRequest) {
    const keys = await db('readonly', store => store.getAllKeys());
    const legacyKeys = keys.filter(key => typeof key === 'string' && /^world--?\d+$/.test(key));
    if (!legacyKeys.length) return;

    const legacyRequests = await db('readonly', store => legacyKeys.map(key => store.get(key)));
    const candidates = legacyKeys.flatMap((key, index) => {
        const save = legacyRequests[index].result;
        if (!save || !Number.isFinite(save.seed) || key !== `world-${save.seed}`) return [];
        const id = `legacy-${save.seed}`;
        return [{ key, save, id, metaKey: META_PREFIX + id }];
    });
    if (!candidates.length) return;

    const existingRequests = await db('readonly', store => candidates.map(({ metaKey }) => store.get(metaKey)));
    const missing = candidates.filter((candidate, index) => existingRequests[index].result === undefined);
    if (!missing.length) return;

    await db('readwrite', store => {
        for (const { key, save, id, metaKey } of missing) {
            store.put({
                id,
                name: `Mundo antigo · ${save.seed}`,
                seed: save.seed,
                saveKey: key,
                createdAt: Number.isFinite(save.time) ? save.time : Date.now(),
                ...(Number.isFinite(save.time) ? { lastSavedAt: save.time } : {}),
                legacy: true,
            }, metaKey);
        }
        return null;
    });
}

/**
 * Mundos com data e status, do mais recente para o mais antigo.
 *
 * O custo é proporcional ao número de mundos, não ao tamanho dos saves: a data
 * vem dos metadados e a existência das cópias é checada com `getKey`, que não
 * traz o conteúdo. Metadados criados antes desta versão não têm `lastSavedAt`;
 * nesse caso o save é lido uma única vez e a data é gravada no meta.
 */
export async function getWorlds(db = storeRequest) {
    await migrateLegacyWorlds(db);
    const keys = await db('readonly', store => store.getAllKeys());
    const metaKeys = keys.filter(key => typeof key === 'string' && key.startsWith(META_PREFIX));
    const metaRequests = await db('readonly', store => metaKeys.map(key => store.get(key)));
    const worlds = metaRequests
        .map(request => request.result)
        .filter(world => world && typeof world.id === 'string' && Number.isFinite(world.seed) && typeof world.saveKey === 'string');

    const presenceRequests = await db('readonly', store => worlds.map(world => ({
        save: store.getKey(world.saveKey),
        backup: store.getKey(saveBackupKeyFor(world.saveKey)),
        rejected: store.getKey(rejectedSaveKeyFor(world.saveKey)),
        imported: store.getKey(importedSaveKeyFor(world.saveKey)),
    })));

    const enrichedWorlds = worlds.map((world, index) => {
        const presence = presenceRequests[index];
        return {
            ...world,
            hasSave: presence.save.result !== undefined,
            hasBackup: presence.backup.result !== undefined,
            hasRejectedSave: presence.rejected.result !== undefined,
            hasImportedSave: presence.imported.result !== undefined,
        };
    });

    const withoutDate = [];
    enrichedWorlds.forEach((world, index) => {
        if (!Number.isFinite(world.lastSavedAt) && world.hasSave) withoutDate.push(index);
    });
    if (withoutDate.length) {
        const saveRequests = await db('readonly', store => withoutDate.map(index => store.get(worlds[index].saveKey)));
        const backfill = [];
        withoutDate.forEach((index, position) => {
            const savedAt = saveRequests[position].result?.time;
            if (!Number.isFinite(savedAt)) return;
            worlds[index].lastSavedAt = savedAt;
            enrichedWorlds[index].lastSavedAt = savedAt;
            backfill.push(index);
        });
        if (backfill.length) {
            await db('readwrite', store => {
                for (const index of backfill) store.put({ ...worlds[index] }, META_PREFIX + worlds[index].id);
                return null;
            });
        }
    }

    return enrichedWorlds
        .map(world => ({
            ...world,
            lastSavedAt: Number.isFinite(world.lastSavedAt) ? world.lastSavedAt : null,
            sortTimestamp: Number.isFinite(world.lastSavedAt) ? world.lastSavedAt
                : Number.isFinite(world.createdAt) ? world.createdAt : 0,
        }))
        .sort((a, b) => b.sortTimestamp - a.sortTimestamp);
}

export async function createWorldRecord(world) {
    await storeRequest('readwrite', store => store.put(world, META_PREFIX + world.id));
}

export async function renameWorldRecord(worldId, name) {
    const metaKey = META_PREFIX + worldId;
    const world = await storeRequest('readonly', store => store.get(metaKey));
    if (!world) throw new Error('Esse mundo não está mais disponível.');
    world.name = name;
    await storeRequest('readwrite', store => store.put(world, metaKey));
}

export async function deleteWorldRecord(world, lockTtl = 30000) {
    const lockKey = `${world.saveKey}-writer-lock`;
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        let removed = false;
        const request = store.get(lockKey);
        request.onsuccess = () => {
            const lock = request.result;
            if (lock && Number.isFinite(lock.heartbeat) && Date.now() - lock.heartbeat <= lockTtl) return;
            store.delete(world.saveKey);
            store.delete(saveBackupKeyFor(world.saveKey));
            store.delete(rejectedSaveKeyFor(world.saveKey));
            store.delete(importedSaveKeyFor(world.saveKey));
            store.delete(lockKey);
            store.delete(META_PREFIX + world.id);
            removed = true;
        };
        tx.oncomplete = () => { db.close(); resolve(removed); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Não foi possível excluir o mundo.')); };
    });
}
