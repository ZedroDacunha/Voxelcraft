// PWA: registrar o service worker e saber quando isso faz sentido.
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
//
// A lista do que guardar **não mora aqui**: o worker a lê do próprio
// index.html na instalação (importmap + `<link>`s), que é a mesma lista de URLs
// que o navegador vai pedir. Aqui fica só a decisão de registrar.

export const PWA_MANIFEST_PATH = './manifest.webmanifest';
export const SERVICE_WORKER_PATH = './service-worker.js';

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
