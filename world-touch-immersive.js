/** Tela cheia e orientação são recursos opcionais, solicitados por gesto do
 * jogador. Nunca saímos de uma tela cheia que já existia antes do jogo. */
export function createTouchImmersive({ doc, screen, isStandalone = () => false }) {
    let ownsFullscreen = false;
    let ownsOrientation = false;
    let generation = 0;
    let pending = null;

    async function enter() {
        if (pending) return pending;
        const ticket = generation;
        const task = (async () => {
            let fullscreen = Boolean(doc.fullscreenElement);
            if (!fullscreen && typeof doc.documentElement?.requestFullscreen === 'function') {
                try {
                    // Esta chamada acontece antes do primeiro await: o navegador
                    // ainda vê o gesto do botão Jogar.
                    await doc.documentElement.requestFullscreen();
                    fullscreen = Boolean(doc.fullscreenElement);
                    if (fullscreen) ownsFullscreen = true;
                } catch { /* navegador, iframe ou usuário recusou */ }
            }
            if (ticket !== generation) {
                if (ownsFullscreen && doc.fullscreenElement === doc.documentElement) {
                    ownsFullscreen = false;
                    try { await doc.exitFullscreen?.(); } catch { /* melhor esforço */ }
                }
                return { fullscreen: false, locked: false };
            }
            let locked = false;
            const orientation = screen?.orientation;
            if ((fullscreen || isStandalone()) && typeof orientation?.lock === 'function') {
                try {
                    await orientation.lock('landscape');
                    if (ticket === generation) { ownsOrientation = true; locked = true; }
                    else { try { orientation.unlock?.(); } catch { /* melhor esforço */ } }
                } catch { /* iOS e alguns browsers não permitem o lock */ }
            }
            if (ticket !== generation) return { fullscreen: false, locked: false };
            return { fullscreen, locked };
        })();
        pending = task;
        try { return await task; }
        finally { if (pending === task) pending = null; }
    }

    function onFullscreenChange() {
        if (doc.fullscreenElement) return;
        generation++;
        ownsFullscreen = false;
        if (ownsOrientation) {
            try { screen?.orientation?.unlock?.(); } catch { /* melhor esforço */ }
            ownsOrientation = false;
        }
    }

    async function release() {
        generation++;
        if (ownsOrientation) {
            try { screen?.orientation?.unlock?.(); } catch { /* melhor esforço */ }
            ownsOrientation = false;
        }
        if (ownsFullscreen && doc.fullscreenElement === doc.documentElement) {
            ownsFullscreen = false;
            try { await doc.exitFullscreen?.(); } catch { /* melhor esforço */ }
        }
    }
    function adoptFullscreen() {
        if (doc.fullscreenElement === doc.documentElement) ownsFullscreen = true;
    }
    return { enter, release, onFullscreenChange, adoptFullscreen };
}

export function isPortraitViewport(width, height) {
    return width > 0 && height > 0 && height > width;
}
