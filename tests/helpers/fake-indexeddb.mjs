// Ferramentas compartilhadas pelos testes que precisam de IndexedDB.
//
// Não é um arquivo de teste (não casa com os padrões que o `node --test`
// descobre): é só um apoio importado por eles.

export const clone = value => (value === undefined ? undefined : structuredClone(value));

// IndexedDB de mentira com o mínimo que o jogo usa: transação readwrite, store
// com get/put/delete e callbacks `onsuccess`/`oncomplete` disparados de forma
// assíncrona (como no navegador). `data` deixa o teste inspecionar o "disco".
//
// Detalhe importante: um `onsuccess` pode criar outro request (é o caso do
// `preservePrevious` e da restauração de cópia) — o flush processa a fila até o
// fim antes de disparar `oncomplete`.
export function createFakeDatabase(initial = {}) {
    const data = new Map(Object.entries(initial));
    const db = {
        closes: 0,
        close() { db.closes++; },
        transaction() {
            let aborted = false;
            let thrownInHandler = false;
            const ops = [];
            const store = {
                get(key) { return enqueue(() => clone(data.get(key))); },
                put(value, key) { return enqueue(() => { data.set(key, clone(value)); return key; }); },
                delete(key) { return enqueue(() => { data.delete(key); return undefined; }); },
            };
            const tx = {
                error: null,
                get thrownInHandler() { return thrownInHandler; },
                abort() { aborted = true; tx.onabort?.(); },
                objectStore() { return store; },
            };
            function enqueue(run) {
                const request = { result: undefined, error: null, onsuccess: null, onerror: null };
                ops.push({ request, run });
                return request;
            }
            const flush = () => {
                for (let i = 0; i < ops.length && !aborted; i++) {
                    const { request, run } = ops[i];
                    try {
                        request.result = run();
                    } catch (error) {
                        request.error = error;
                        request.onerror?.();
                        return;
                    }
                    // O navegador engole exceção que escapa de um handler de evento:
                    // a transação segue e commita. Reproduzir isso é o que permite
                    // testar o perigo do `preservePrevious` (gravar dentro do
                    // `onsuccess` e falhar calado).
                    try {
                        request.onsuccess?.();
                    } catch {
                        thrownInHandler = true;
                    }
                }
                if (!aborted) tx.oncomplete?.();
            };
            queueMicrotask(flush);
            return tx;
        },
    };
    return { data, db };
}

// Adaptador no formato de `storeRequest` de world-storage.js: devolve o
// `result` do request (ou o array de requests), esperando a transação terminar.
export function createStoreRequest(db) {
    return async (mode, action) => {
        const tx = db.transaction('worlds', mode);
        const outcome = action(tx.objectStore('worlds'));
        if (Array.isArray(outcome)) return outcome;
        if (outcome === null || outcome === undefined) return outcome;
        await new Promise(resolve => setImmediate(resolve));
        return outcome.result;
    };
}

// O save manager registra um listener de `pagehide` ao ser criado; no Node não há
// window, então os testes oferecem um stub mínimo e restauram no fim.
export function withWindowStub() {
    const previous = globalThis.window;
    globalThis.window = { addEventListener() {} };
    return () => {
        if (previous === undefined) delete globalThis.window;
        else globalThis.window = previous;
    };
}

// Arquivo falso no formato que `parseSaveCopy` espera (`size` + `text()`).
export function fakeFile(contents) {
    const text = typeof contents === 'string' ? contents : JSON.stringify(contents);
    return { size: text.length, text: async () => text };
}
