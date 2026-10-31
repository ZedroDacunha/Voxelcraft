import { consumeSaveResetRequest } from './world-save-reset.js';

/**
 * Adapta o carregamento do save à página atual.
 * A política de reset é avaliada uma única vez por carregamento de página.
 */
export function createWorldSaveLoader({
    saveManager,
    world,
    getHref,
    replaceUrl,
    confirmReset,
    onError = () => {},
}) {
    if (typeof saveManager?.load !== 'function') {
        throw new TypeError('saveManager.load é obrigatório');
    }
    let resetEvaluated = false;

    return function loadWorldSave() {
        let reset = false;
        if (!resetEvaluated) {
            resetEvaluated = true;
            let href;
            try {
                href = getHref();
            } catch (error) {
                onError(error);
                href = '';
            }
            const request = consumeSaveResetRequest({ href, world, replaceUrl, confirmReset, onError });
            reset = request.confirmed;
        }
        return saveManager.load({ reset });
    };
}
