import { openDatabase, storeRequest, STORE_NAME } from './world-storage.js';
import {
    importedSaveKeyFor, rejectedSaveKeyFor, saveBackupKeyFor,
} from './world-save-recovery.js';

export const META_PREFIX = 'world-meta:';

export async function migrateLegacyWorlds() {
    const keys = await storeRequest('readonly', store => store.getAllKeys());
    const legacyKeys = keys.filter(key => typeof key === 'string' && /^world--?\d+$/.test(key));
    if (!legacyKeys.length) return;

    const legacyRequests = await storeRequest('readonly', store => legacyKeys.map(key => store.get(key)));
    const candidates = legacyKeys.flatMap((key, index) => {
        const save = legacyRequests[index].result;
        if (!save || !Number.isFinite(save.seed) || key !== `world-${save.seed}`) return [];
        const id = `legacy-${save.seed}`;
        return [{ key, save, id, metaKey: META_PREFIX + id }];
    });
    if (!candidates.length) return;

    const existingRequests = await storeRequest('readonly', store => candidates.map(({ metaKey }) => store.get(metaKey)));
    const missing = candidates.filter((candidate, index) => existingRequests[index].result === undefined);
    if (!missing.length) return;

    await storeRequest('readwrite', store => {
        for (const { key, save, id, metaKey } of missing) {
            store.put({
                id,
                name: `Mundo antigo · ${save.seed}`,
                seed: save.seed,
                saveKey: key,
                createdAt: Number.isFinite(save.time) ? save.time : Date.now(),
                legacy: true,
            }, metaKey);
        }
    });
}

export async function getWorlds() {
    await migrateLegacyWorlds();
    const keys = await storeRequest('readonly', store => store.getAllKeys());
    const metaKeys = keys.filter(key => typeof key === 'string' && key.startsWith(META_PREFIX));
    const metaRequests = await storeRequest('readonly', store => metaKeys.map(key => store.get(key)));
    const worlds = metaRequests
        .map(request => request.result)
        .filter(world => world && typeof world.id === 'string' && Number.isFinite(world.seed) && typeof world.saveKey === 'string');
    const saveRequests = await storeRequest('readonly', store => worlds.map(world => ({
        save: store.get(world.saveKey),
        backup: store.getKey(saveBackupKeyFor(world.saveKey)),
        rejected: store.getKey(rejectedSaveKeyFor(world.saveKey)),
        imported: store.getKey(importedSaveKeyFor(world.saveKey)),
    })));

    const enrichedWorlds = worlds.map((world, index) => {
        const records = saveRequests[index];
        const save = records.save.result;
        const lastSavedAt = Number.isFinite(save?.time) ? save.time : null;
        return {
            ...world,
            lastSavedAt,
            sortTimestamp: lastSavedAt ?? (Number.isFinite(world.createdAt) ? world.createdAt : 0),
            hasSave: save !== undefined,
            hasBackup: records.backup.result !== undefined,
            hasRejectedSave: records.rejected.result !== undefined,
            hasImportedSave: records.imported.result !== undefined,
        };
    });
    return enrichedWorlds.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
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
