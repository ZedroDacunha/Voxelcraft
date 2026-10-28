export const saveBackupKeyFor = saveKey => `${saveKey}-backup`;
export const rejectedSaveKeyFor = saveKey => `${saveKey}-rejected`;
export const importedSaveKeyFor = saveKey => `${saveKey}-imported`;

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
