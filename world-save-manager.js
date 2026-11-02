import { createWorldSaveLock } from './world-save-lock.js';
import {
    importedSaveKeyFor, preserveRejectedSave, rejectedSaveKeyFor, saveBackupKeyFor,
} from './world-save-recovery.js';

const SAVE_DEBOUNCE_MS = 5000;
const SAVE_RETRY_DELAYS_MS = [2000, 5000, 12000, 30000];

// Coordena o ciclo completo do save; o jogo fornece apenas callbacks para
// construir o estado vivo e apresentar mensagens ao jogador.
export function createWorldSaveManager({
    openDatabase,
    storeRequest,
    saveKey,
    tabId,
    seed,
    codec,
    buildSave,
    hasWorld,
    onToast = () => {},
    onSaveState = () => {},
    onBuildDuration = () => {},
    onSaved = () => {},
    onError = error => console.warn('Falha no salvamento do mundo:', error),
}) {
    const backupKey = saveBackupKeyFor(saveKey);
    const rejectedKey = rejectedSaveKeyFor(saveKey);
    const lock = createWorldSaveLock({
        openDatabase,
        saveKey,
        backupKey,
        tabId,
        onLost: () => {
            saveWriteBlocked = true;
            clearSaveRetry();
            onSaveState('blocked', 'Outra aba está usando este mundo');
            onToast('Outra aba assumiu o save; salvamento bloqueado aqui');
        },
        onError,
    });

    let saveWriteBlocked = false;
    let primarySaveKnownGood = false;
    let saving = false;
    let saveTimer = null;
    let saveRetryTimer = null;
    let saveRetryAttempt = 0;
    let savePending = false;
    let releaseLockAfterSave = false;
    let lastSaveResult = false;
    let saveFailureActive = false;

    function saveFailureMessage(error) {
        if (error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014) {
            return 'Armazenamento cheio; exporte uma cópia e libere espaço';
        }
        if (error?.name === 'SecurityError' || error?.name === 'NotAllowedError') {
            return 'O navegador bloqueou o armazenamento local do jogo';
        }
        return 'Falha ao salvar; o jogo tentará novamente';
    }

    // Avisa quem cuida dos metadados do mundo (data do último save) que o save
    // foi gravado. Falha aqui não pode derrubar o salvamento em si.
    function notifySaved(data) {
        try {
            const pending = onSaved(data);
            if (pending && typeof pending.catch === 'function') pending.catch(onError);
        } catch (error) {
            onError(error);
        }
    }

    function clearSaveTimer() {
        if (saveTimer === null) return;
        clearTimeout(saveTimer);
        saveTimer = null;
    }

    function clearSaveRetry(resetAttempt = false) {
        if (saveRetryTimer !== null) clearTimeout(saveRetryTimer);
        saveRetryTimer = null;
        if (resetAttempt) saveRetryAttempt = 0;
    }

    function isPermanentSaveFailure(error) {
        return error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014 ||
            error?.name === 'SecurityError' || error?.name === 'NotAllowedError';
    }

    function scheduleSaveRetry(error) {
        if (isPermanentSaveFailure(error) || !hasWorld() || saveWriteBlocked || !lock.isOwned || releaseLockAfterSave) return;
        if (saveRetryTimer !== null) return;
        const delayIndex = Math.min(saveRetryAttempt, SAVE_RETRY_DELAYS_MS.length - 1);
        const delay = SAVE_RETRY_DELAYS_MS[delayIndex];
        saveRetryAttempt++;
        saveRetryTimer = setTimeout(() => {
            saveRetryTimer = null;
            if (saving) savePending = true;
            else void performSave(true);
        }, delay);
    }

    async function load({ reset = false } = {}) {
        try {
            const ownsSave = await lock.acquire();
            if (!ownsSave) {
                saveWriteBlocked = true;
                onSaveState('blocked', 'Mundo aberto em outra aba');
                console.warn('Este mundo já está aberto em outra aba; o salvamento foi desativado aqui.');
                onToast('Mundo aberto em outra aba; salvamento desativado neste jogo');
            }
            if (reset) {
                if (!ownsSave) return null;
                await storeRequest('readwrite', store => {
                    store.delete(saveKey);
                    store.delete(backupKey);
                    store.delete(rejectedKey);
                    store.delete(importedSaveKeyFor(saveKey));
                });
                primarySaveKnownGood = false;
                return null;
            }

            const data = await storeRequest('readonly', store => store.get(saveKey));
            const valid = codec.validate(data, seed);
            primarySaveKnownGood = Boolean(valid);
            let rejectedSavePreserved = !data;

            if (data && !valid) {
                console.warn('Save inválido ou de outra versão: preservando o arquivo rejeitado antes de recuperar.');
                if (ownsSave) {
                    saveWriteBlocked = true;
                    try {
                        await preserveRejectedSave(storeRequest, saveKey, data);
                        rejectedSavePreserved = true;
                        console.warn('Save rejeitado preservado:', rejectedKey);
                    } catch (error) {
                        console.warn('Não foi possível arquivar o save rejeitado; ele será mantido intacto.', error);
                    } finally {
                        saveWriteBlocked = !lock.isOwned || !rejectedSavePreserved;
                    }
                }
            }

            if (valid) return valid;

            const recoverFrom = async (key, label, consume = false) => {
                const raw = await storeRequest('readonly', store => store.get(key));
                const recovered = codec.validate(raw, seed);
                if (!recovered) return null;

                if (ownsSave && lock.isOwned && rejectedSavePreserved) {
                    try {
                        const restored = await lock.write(raw, { deleteKey: consume ? key : undefined });
                        if (restored) {
                            primarySaveKnownGood = true;
                            saveWriteBlocked = false;
                            notifySaved(raw);
                            onToast(`Progresso recuperado de ${label}`);
                            console.info(`Save principal restaurado de ${label}:`, key);
                        } else {
                            saveWriteBlocked = true;
                            onToast(`${label} carregada; salvamento bloqueado para proteger o mundo`);
                        }
                    } catch (error) {
                        saveWriteBlocked = true;
                        onToast(`${label} carregada, mas não foi possível restaurá-la no disco`);
                        console.warn(`Cópia válida carregada sem substituir o save principal (${label}):`, error);
                    }
                } else {
                    if (ownsSave) saveWriteBlocked = true;
                    onToast(`${label} carregada em modo protegido`);
                }
                return recovered;
            };

            const imported = await recoverFrom(importedSaveKeyFor(saveKey), 'a cópia importada', true);
            if (imported) return imported;
            const backup = await recoverFrom(backupKey, 'o backup');
            if (backup) return backup;
            if (data) {
                onToast(rejectedSavePreserved
                    ? 'Save inválido preservado; não há backup válido'
                    : 'Save inválido mantido; salvamento bloqueado');
            }
            return null;
        } catch (error) {
            saveWriteBlocked = true;
            onSaveState('error', 'Não foi possível proteger o save');
            console.warn('Falha ao ler ou proteger o save; gravações bloqueadas para evitar perda de dados:', error);
            return null;
        }
    }

    function requestSave(quiet, immediate = false) {
        if (!hasWorld()) return;
        clearSaveTimer();
        clearSaveRetry(true);
        if (!immediate && quiet) {
            onSaveState('pending', 'Alterações aguardando salvamento');
            saveTimer = setTimeout(() => {
                saveTimer = null;
                performSave(true);
            }, SAVE_DEBOUNCE_MS);
            return;
        }
        performSave(quiet);
    }

    async function performSave(quiet) {
        if (!hasWorld()) return false;
        if (saving) { savePending = true; onSaveState('pending', 'Novas alterações aguardando salvamento'); return false; }
        if (saveWriteBlocked || !lock.isOwned) {
            lastSaveResult = false;
            onSaveState('blocked', 'Salvamento bloqueado para proteger o mundo');
            if (!quiet) onToast('Salvamento bloqueado para proteger o mundo aberto em outra aba');
            return false;
        }

        saving = true;
        onSaveState('saving', 'Salvando mundo…');
        let saved = false;
        let retryError = null;
        try {
            const startedAt = performance.now();
            const data = buildSave();
            onBuildDuration(performance.now() - startedAt);
            const wrote = await lock.write(data, { preservePrevious: primarySaveKnownGood });
            if (!wrote) saveWriteBlocked = true;
            else {
                primarySaveKnownGood = true;
                notifySaved(data);
                const recovered = saveFailureActive;
                saveFailureActive = false;
                clearSaveRetry(true);
                if (!quiet) onToast('Jogo salvo');
                else if (recovered) onToast('Salvamento retomado');
                onSaveState('saved', 'Mundo salvo');
            }
            if (!wrote) onSaveState('blocked', 'Salvamento bloqueado para proteger o mundo');
            saved = wrote;
        } catch (error) {
            onError(error);
            onSaveState('error', saveFailureMessage(error));
            if (!saveFailureActive) onToast(saveFailureMessage(error));
            saveFailureActive = true;
            retryError = error;
        } finally {
            lastSaveResult = saved;
            saving = false;
            if (savePending) {
                savePending = false;
                if (releaseLockAfterSave && (saveWriteBlocked || !lock.isOwned)) {
                    releaseLockAfterSave = false;
                    void lock.release();
                } else requestSave(true, true);
            } else if (releaseLockAfterSave) {
                releaseLockAfterSave = false;
                void lock.release();
            } else if (retryError) {
                scheduleSaveRetry(retryError);
            }
        }
        return saved;
    }

    async function flushAndRelease(quiet = true) {
        clearSaveTimer();
        clearSaveRetry();
        if (saving) {
            savePending = true;
            while (saving || savePending) await new Promise(resolve => setTimeout(resolve, 25));
            if (!lastSaveResult) return false;
            await lock.release();
            return true;
        }
        const saved = await performSave(quiet);
        if (saved) await lock.release();
        return saved;
    }

    function flushAndReleaseOnPageHide() {
        clearSaveTimer();
        clearSaveRetry();
        if (!hasWorld() || saveWriteBlocked || !lock.isOwned) {
            void lock.release();
            return;
        }
        releaseLockAfterSave = true;
        if (saving) {
            savePending = true;
            return;
        }
        void performSave(true);
    }

    window.addEventListener('pagehide', flushAndReleaseOnPageHide);

    return {
        load,
        requestSave,
        saveNow: performSave,
        flushAndRelease,
        release: () => { clearSaveRetry(true); return lock.release(); },
        get isSaving() { return saving; },
    };
}
