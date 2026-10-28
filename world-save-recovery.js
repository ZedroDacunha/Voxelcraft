import { WORLD_SAVE_VERSION } from './world-save-codec.js';
import { MAX_SAVE_COPY_BYTES } from './world-save-settings.js';

export const saveBackupKeyFor = saveKey => `${saveKey}-backup`;
export const rejectedSaveKeyFor = saveKey => `${saveKey}-rejected`;
export const importedSaveKeyFor = saveKey => `${saveKey}-imported`;

export async function readSaveCopy(storeRequest, world, kind) {
    const key = kind === 'backup'
        ? saveBackupKeyFor(world.saveKey)
        : kind === 'rejected' ? rejectedSaveKeyFor(world.saveKey)
            : kind === 'current' ? world.saveKey : null;
    if (!key) throw new Error('Tipo de cópia do save inválido.');
    const save = await storeRequest('readonly', store => store.get(key));
    if (!save) throw new Error('Esta cópia de segurança não está mais disponível.');
    return save;
}

export function serializeSaveCopy(world, kind, save) {
    const file = {
        format: 'voxel-sandbox-save-copy',
        exportedAt: new Date().toISOString(),
        world: { id: world.id, name: world.name, seed: world.seed },
        kind,
        save,
    };
    return JSON.stringify(file, (field, value) => value instanceof Uint16Array
        ? { __type: 'Uint16Array', values: Array.from(value) }
        : value, 2);
}

export async function parseSaveCopy(file, expectedSeed) {
    if (!file || !Number.isFinite(file.size)) throw new Error('Não foi possível ler o arquivo selecionado.');
    if (file.size === 0) throw new Error('O arquivo selecionado está vazio.');
    if (file.size > MAX_SAVE_COPY_BYTES) throw new Error('O arquivo ultrapassa o limite de 64 MB.');

    let source;
    try {
        source = await file.text();
    } catch {
        throw new Error('Não foi possível ler o arquivo selecionado.');
    }

    let archive;
    try {
        archive = JSON.parse(source, (field, value) => {
            if (value?.__type !== 'Uint16Array') return value;
            if (!Array.isArray(value.values) || value.values.length > 32768 ||
                value.values.some(item => !Number.isInteger(item) || item < 0 || item > 65535)) {
                throw new Error('O arquivo contém edições de terreno inválidas.');
            }
            return new Uint16Array(value.values);
        });
    } catch (error) {
        if (error instanceof SyntaxError) throw new Error('O arquivo selecionado não contém um JSON válido.');
        throw error;
    }
    const save = archive?.save;
    if (archive?.format !== 'voxel-sandbox-save-copy' || !['current', 'backup', 'rejected'].includes(archive.kind) ||
        archive.world?.seed !== expectedSeed || save?.v !== WORLD_SAVE_VERSION || save.seed !== expectedSeed) {
        throw new Error('O arquivo não é uma cópia compatível deste mundo.');
    }
    return save;
}

export async function stageImportedSaveCopy(storeRequest, world, save, lockTtl = 30000) {
    let worldIsOpen = false;
    await storeRequest('readwrite', store => {
        const request = store.get(`${world.saveKey}-writer-lock`);
        request.onsuccess = () => {
            const lock = request.result;
            if (lock && Number.isFinite(lock.heartbeat) && Date.now() - lock.heartbeat <= lockTtl) {
                worldIsOpen = true;
                return;
            }
            store.put(save, importedSaveKeyFor(world.saveKey));
        };
        return request;
    });
    if (worldIsOpen) throw new Error('Feche este mundo em outra aba antes de importar uma cópia.');
}

export async function restoreSaveCopy(storeRequest, world, kind, codec, lockTtl = 30000) {
    const sourceKey = kind === 'backup'
        ? saveBackupKeyFor(world.saveKey)
        : kind === 'rejected' ? rejectedSaveKeyFor(world.saveKey)
            : kind === 'imported' ? importedSaveKeyFor(world.saveKey) : null;
    if (!sourceKey) throw new Error('Tipo de cópia do save inválido.');

    let worldIsOpen = false;
    let sourceIsInvalid = false;
    let restored = false;
    await storeRequest('readwrite', store => {
        const lockRequest = store.get(`${world.saveKey}-writer-lock`);
        const currentRequest = store.get(world.saveKey);
        const sourceRequest = store.get(sourceKey);
        const rejectedRequest = store.get(rejectedSaveKeyFor(world.saveKey));
        const requests = [lockRequest, currentRequest, sourceRequest, rejectedRequest];
        let completed = 0;

        const prepareRestore = () => {
            completed++;
            if (completed !== requests.length) return;

            const lock = lockRequest.result;
            worldIsOpen = Boolean(lock && Number.isFinite(lock.heartbeat) && Date.now() - lock.heartbeat <= lockTtl);
            if (worldIsOpen) return;

            const source = sourceRequest.result;
            if (!codec.validate(source, world.seed)) {
                sourceIsInvalid = true;
                return;
            }

            const current = currentRequest.result;
            if (current !== undefined) {
                if (codec.validate(current, world.seed)) store.put(current, saveBackupKeyFor(world.saveKey));
                else if (rejectedRequest.result === undefined) store.put(current, rejectedSaveKeyFor(world.saveKey));
            }
            store.put(source, world.saveKey);
            if (kind === 'imported') store.delete(sourceKey);
            restored = true;
        };

        for (const request of requests) request.onsuccess = prepareRestore;
        return sourceRequest;
    });

    if (worldIsOpen) throw new Error('Feche este mundo em outra aba antes de restaurar uma cópia.');
    if (sourceIsInvalid || !restored) throw new Error('Esta cópia não é válida para o mundo selecionado.');
}

// Guarda o primeiro save rejeitado sem substituir o último backup válido.
export async function preserveRejectedSave(storeRequest, saveKey, data) {
    const rejectedKey = rejectedSaveKeyFor(saveKey);
    await storeRequest('readwrite', store => {
        const request = store.get(rejectedKey);
        request.onsuccess = () => {
            if (request.result === undefined) store.put(data, rejectedKey);
        };
        return request;
    });
}
