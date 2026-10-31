export const SAVE_RESET_PARAM = 'reset';

function searchWithoutResetParam(search) {
    const raw = search.startsWith('?') ? search.slice(1) : search;
    if (!raw) return '';
    const kept = raw.split('&').filter(piece => {
        if (!piece) return false;
        const rawKey = piece.split('=', 1)[0];
        let key = rawKey;
        try {
            key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
        } catch {}
        return key !== SAVE_RESET_PARAM;
    });
    return kept.length ? `?${kept.join('&')}` : '';
}

export function saveResetConfirmationMessage(world) {
    const name = String(world?.name ?? 'mundo');
    const seed = world?.seed ?? 'desconhecida';
    return `Apagar todo o progresso de "${name}" (seed ${seed}), incluindo save atual, backup e cópias de recuperação? Esta ação não pode ser desfeita.`;
}

/**
 * Consome um pedido de reset vindo da URL antes de qualquer gravação.
 * O parâmetro é removido primeiro; se isso falhar, o reset é bloqueado.
 */
export function consumeSaveResetRequest({
    href,
    world,
    replaceUrl,
    confirmReset,
    onError = () => {},
}) {
    const idle = { requested: false, confirmed: false, cleaned: false };
    let url;
    try {
        url = new URL(href);
    } catch (error) {
        onError(error);
        return idle;
    }
    if (!url.searchParams.has(SAVE_RESET_PARAM)) return idle;

    const nextUrl = `${url.pathname}${searchWithoutResetParam(url.search)}${url.hash}`;
    try {
        if (typeof replaceUrl !== 'function') throw new TypeError('replaceUrl indisponível');
        replaceUrl(nextUrl);
    } catch (error) {
        onError(error);
        return { requested: true, confirmed: false, cleaned: false };
    }

    let confirmed = false;
    try {
        confirmed = confirmReset(saveResetConfirmationMessage(world)) === true;
    } catch (error) {
        onError(error);
    }
    return { requested: true, confirmed, cleaned: true };
}
