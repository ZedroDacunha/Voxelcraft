/**
 * Pede pointer lock com fallback para navegadores sem unadjustedMovement.
 * A promessa resolve true somente quando o lock é confirmado; falhas,
 * ausência da API ou timeout resolvem false para a UI poder reagir.
 */
export function createPointerLockRequester({
    element,
    doc = element?.ownerDocument,
    setTimeout: schedule = globalThis.setTimeout,
    clearTimeout: cancel = globalThis.clearTimeout,
    timeoutMs = 1500,
    warn = () => {},
}) {
    if (!element || !doc || typeof element.requestPointerLock !== 'function') {
        return async () => false;
    }

    return function requestPointerLock() {
        if (doc.pointerLockElement === element) return Promise.resolve(true);

        return new Promise(resolve => {
            let settled = false;
            let timer = null;

            const cleanup = () => {
                doc.removeEventListener('pointerlockchange', onChange);
                doc.removeEventListener('pointerlockerror', onError);
                if (timer !== null) cancel(timer);
            };
            const finish = ok => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(ok);
            };
            const onChange = () => {
                if (doc.pointerLockElement === element) finish(true);
            };
            const onError = () => finish(false);

            doc.addEventListener('pointerlockchange', onChange);
            doc.addEventListener('pointerlockerror', onError);
            timer = schedule(() => finish(doc.pointerLockElement === element), timeoutMs);

            const reject = (error, options) => {
                if (options && error?.name === 'NotSupportedError') {
                    attempt(undefined);
                    return;
                }
                warn('Não foi possível capturar o mouse:', error);
                finish(false);
            };
            const attempt = options => {
                let result;
                try {
                    result = options ? element.requestPointerLock(options) : element.requestPointerLock();
                } catch (error) {
                    reject(error, options);
                    return;
                }
                if (result && typeof result.then === 'function') {
                    result.then(() => finish(true), error => reject(error, options));
                }
            };

            attempt({ unadjustedMovement: true });
        });
    };
}
