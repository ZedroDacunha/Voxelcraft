// Lease de escrita por mundo. Todas as decisões de posse e gravação passam
// por transações readwrite para impedir que duas abas sobrescrevam o mesmo save.
export function createWorldSaveLock({
    openDatabase,
    saveKey,
    backupKey,
    tabId,
    ttl = 30000,
    heartbeatMs = 5000,
    onLost = () => {},
    onError = () => {},
}) {
    const lockKey = `${saveKey}-writer-lock`;
    let owned = false;
    let heartbeatTimer = null;
    let heartbeatRunning = false;

    function stopHeartbeat() {
        if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }

    async function transact(action) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('worlds', 'readwrite');
            const store = tx.objectStore('worlds');
            let value;
            let failed = false;
            const request = store.get(lockKey);

            request.onsuccess = () => {
                try { value = action(store, request.result); }
                catch (error) {
                    failed = true;
                    try { tx.abort(); } catch {}
                    db.close();
                    reject(error);
                }
            };
            request.onerror = () => {
                failed = true;
                db.close();
                reject(request.error || new Error('Falha ao verificar o bloqueio do save.'));
            };
            tx.oncomplete = () => { db.close(); if (!failed) resolve(value); };
            tx.onerror = tx.onabort = () => {
                db.close();
                if (!failed) reject(tx.error || new Error('Falha na transação do save.'));
            };
        });
    }

    async function heartbeat() {
        if (!owned || heartbeatRunning) return;
        heartbeatRunning = true;
        try {
            const refreshed = await transact((store, lease) => {
                if (lease?.id !== tabId) return false;
                store.put({ id: tabId, heartbeat: Date.now() }, lockKey);
                return true;
            });
            if (!refreshed) loseOwnership();
        } catch (error) {
            loseOwnership();
            onError(error);
        } finally {
            heartbeatRunning = false;
        }
    }

    function loseOwnership() {
        if (!owned) return;
        owned = false;
        stopHeartbeat();
        onLost();
    }

    function startHeartbeat() {
        stopHeartbeat();
        heartbeatTimer = setInterval(heartbeat, heartbeatMs);
    }

    async function acquire() {
        const acquired = await transact((store, lease) => {
            const expired = !lease || !Number.isFinite(lease.heartbeat) || Date.now() - lease.heartbeat > ttl;
            if (!expired && lease.id !== tabId) return false;
            store.put({ id: tabId, heartbeat: Date.now() }, lockKey);
            return true;
        });
        const wasOwned = owned;
        owned = acquired;
        if (owned) startHeartbeat();
        else {
            stopHeartbeat();
            if (wasOwned) onLost();
        }
        return owned;
    }

    async function write(data, { preservePrevious = false } = {}) {
        if (!owned) return false;
        return transact((store, lease) => {
            if (lease?.id !== tabId) return false;
            if (preservePrevious && backupKey) {
                const previous = store.get(saveKey);
                previous.onsuccess = () => {
                    if (previous.result !== undefined) store.put(previous.result, backupKey);
                    store.put(data, saveKey);
                    store.put({ id: tabId, heartbeat: Date.now() }, lockKey);
                };
                return true;
            }
            store.put(data, saveKey);
            store.put({ id: tabId, heartbeat: Date.now() }, lockKey);
            return true;
        }).then(wrote => {
            if (!wrote) loseOwnership();
            return wrote;
        });
    }

    async function release() {
        stopHeartbeat();
        if (!owned) return false;
        owned = false;
        try {
            return await transact((store, lease) => {
                if (lease?.id !== tabId) return false;
                store.delete(lockKey);
                return true;
            });
        } catch (error) {
            onError(error);
            return false;
        }
    }

    return {
        acquire,
        write,
        release,
        get isOwned() { return owned; },
    };
}
