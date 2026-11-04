// Botão "Instalar app": quando ele aparece, o que dizer e o que fazer no clique.
//
// Instalar um PWA não é uma chamada de função — é um convite **do navegador**.
// O Chrome/Edge disparam `beforeinstallprompt` quando o app é elegível e, a
// partir desse evento guardado, o clique pode chamar `prompt()`. Se o jogo nunca
// guardar o evento, o convite do navegador some e o jogador não tem como instalar
// pelo próprio jogo.
//
// O Safari (iPhone/iPad) não dispara evento nenhum: lá o caminho é manual —
// Compartilhar → "Adicionar à Tela de Início" — então o botão só explica.
//
// Aqui fica a decisão inteira, sem DOM: quem chama entrega o evento, o
// user-agent e se já está rodando instalado, e recebe o que mostrar. O
// `world-menu.js` só liga os botões nisso.

/** Texto do botão em qualquer modo. */
export const INSTALL_LABEL = 'Instalar app';

/** Caminho manual do iOS (o Safari não tem convite programático). */
export const IOS_INSTALL_HINT = 'No Safari: toque em Compartilhar e depois em “Adicionar à Tela de Início”.';

/** Não deu para pedir a instalação agora (evento vencido ou navegador recusou). */
export const INSTALL_UNAVAILABLE_HINT = 'Este navegador não oferece a instalação agora. Use o menu dele: “Instalar app”.';

/**
 * Instrução manual para o navegador em questão, ou `null` quando não há nada
 * útil a dizer (no desktop sem convite, o botão simplesmente não aparece).
 */
export function installHintFor({ userAgent = '', standalone = false } = {}) {
    if (standalone) return null;
    const ua = String(userAgent ?? '');
    if (/iphone|ipad|ipod/i.test(ua)) return IOS_INSTALL_HINT;
    // iPadOS 13+ se apresenta como Macintosh com toque.
    if (/macintosh/i.test(ua) && /mobile/i.test(ua)) return IOS_INSTALL_HINT;
    return null;
}

/**
 * Estado do convite de instalação.
 *
 * `view` é o que a interface precisa:
 * - `{ visible: false }` — nada a mostrar (já instalado, ou o navegador não
 *   oferece e não há instrução manual);
 * - `{ mode: 'prompt' }` — o navegador deu o evento: o clique abre o convite;
 * - `{ mode: 'hint' }` — sem evento, mas há instrução (iOS): o clique revela o
 *   texto de `hint`.
 */
export function createInstallPrompt({ userAgent = '', standalone = false } = {}) {
    let deferred = null;
    let installed = Boolean(standalone);
    const hint = installHintFor({ userAgent, standalone: installed });

    function view() {
        if (installed) return { visible: false, mode: 'hidden', label: '', hint: '' };
        if (deferred) return { visible: true, mode: 'prompt', label: INSTALL_LABEL, hint: '' };
        if (hint) return { visible: true, mode: 'hint', label: INSTALL_LABEL, hint };
        return { visible: false, mode: 'hidden', label: '', hint: '' };
    }

    return {
        get view() { return view(); },
        /** O navegador já ofereceu o convite? (só nesse caso dá para chamar `prompt()`) */
        get hasPrompt() { return Boolean(deferred); },
        get installed() { return installed; },

        /**
         * Guarda o evento do navegador. Devolve `false` quando ele não serve
         * (já instalado, evento repetido ou objeto estranho) — nunca lança.
         */
        capturePromptEvent(event) {
            if (installed || deferred) return false;
            if (!event || typeof event.prompt !== 'function') return false;
            deferred = event;
            return true;
        },

        /**
         * Abre o convite do navegador.
         * Devolve `'accepted' | 'dismissed' | 'unavailable'`.
         *
         * O evento é descartado antes de usar: o navegador só aceita um
         * `prompt()` por evento, e pedir de novo com o mesmo estoura.
         */
        async prompt() {
            const event = deferred;
            if (!event) return 'unavailable';
            deferred = null;
            try {
                event.prompt();
                const choice = await event.userChoice;
                return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
            } catch {
                return 'unavailable';
            }
        },

        /** O navegador avisou que instalou (`appinstalled`). */
        markInstalled() {
            installed = true;
            deferred = null;
            return view();
        },
    };
}
