const DB_NAME = 'voxel-sandbox';
export const STORE_NAME = 'worlds';
const DB_VERSION = 1;

export function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                request.result.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function storeRequest(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        let request;
        try { request = action(tx.objectStore(STORE_NAME)); }
        catch (error) { db.close(); reject(error); return; }
        tx.oncomplete = () => {
            db.close();
            resolve(request && 'result' in request ? request.result : request);
        };
        tx.onerror = tx.onabort = () => {
            db.close();
            reject(tx.error || new Error('Erro ao acessar os mundos salvos.'));
        };
    });
}
