// PWA: manifest, service worker e a lista de arquivos que fazem o jogo abrir
// sem rede.
//
// O jogo não tem build nem bundler: o service worker guarda os arquivos como
// estão. Duas estratégias diferentes, porque os dois tipos de requisição têm
// problemas opostos:
//
// - **documento** (o index.html): rede primeiro. Se sair uma versão nova, o
//   jogador recebe na hora; sem rede, cai no cache e o jogo abre.
// - **demais arquivos**: cache primeiro, com atualização em segundo plano
//   (stale-while-revalidate). Os módulos já vêm com `?v=<hash>` no importmap,
//   então "servir do cache" nunca entrega código velho — hash diferente é URL
//   diferente.

export const PWA_MANIFEST_PATH = './manifest.webmanifest';
export const SERVICE_WORKER_PATH = './service-worker.js';

/**
 * Casca do jogo: o suficiente para abrir e chegar ao menu sem rede.
 *
 * O resto dos módulos entra no cache sozinho, na primeira visita — e essa é a
 * vantagem de não ter build: não existe lista de módulos para manter à mão.
 * Esta lista é curta de propósito, e o teste confere que ela bate com a do
 * service worker e que todo arquivo citado existe.
 */
export const APP_SHELL_FILES = Object.freeze([
    './',
    './index.html',
    './styles.css',
    './inventory.css',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/favicon-32.png',
    './menu-panorama.svg',
    './vendor/three/three.module.js',
    './vendor/three/addons/controls/PointerLockControls.js',
    './world-menu.js',
    './game.js',
    './world-terrain-worker.js',
]);

/** Dá para instalar/jogar offline neste contexto? (`file://` não tem service worker) */
export function pwaSupported({
    navigator: nav = globalThis.navigator,
    location: loc = globalThis.location,
} = {}) {
    if (!nav || !nav.serviceWorker) return false;
    const protocol = loc?.protocol ?? '';
    return protocol === 'http:' || protocol === 'https:';
}

/**
 * Service worker ligado? `?sw=0` desliga — útil para depurar cache durante o
 * desenvolvimento sem precisar limpar os dados do site.
 */
export function serviceWorkerEnabled({ location: loc = globalThis.location } = {}) {
    const search = loc?.search ?? '';
    return new URLSearchParams(search).get('sw') !== '0';
}

/**
 * Registra o service worker. Nunca rejeita: falhar em instalar não pode impedir
 * o jogo de rodar, e o pior caso é "jogável, mas precisa de rede".
 */
export async function registerServiceWorker({
    navigator: nav = globalThis.navigator,
    location: loc = globalThis.location,
    warn = (...args) => console.warn(...args),
} = {}) {
    if (!serviceWorkerEnabled({ location: loc })) return null;
    if (!pwaSupported({ navigator: nav, location: loc })) return null;
    try {
        const registration = await nav.serviceWorker.register(SERVICE_WORKER_PATH, { scope: './' });
        return registration ?? null;
    } catch (error) {
        warn('Service worker não registrou; o jogo segue precisando de rede:', error);
        return null;
    }
}

/** Rodando como aplicativo instalado (janela própria, sem barra do navegador). */
export function isStandalone({ matchMedia: query = globalThis.matchMedia } = {}) {
    if (typeof query !== 'function') return false;
    try {
        return Boolean(query('(display-mode: standalone)')?.matches);
    } catch {
        return false;
    }
}
