// Service worker do Voxel Sandbox.
//
// Sem build: este arquivo guarda os arquivos do jogo como estão no repositório.
// A casca (index.html, css, three, entrada do menu e do jogo) é baixada na
// instalação; todo o resto entra no cache sozinho, no primeiro uso.
//
// Regras:
// - documento → rede primeiro (versão nova chega na hora), cache como rede de
//   segurança;
// - arquivos → cache primeiro, com atualização em segundo plano. Os módulos têm
//   `?v=<hash>` no importmap, então cache nunca entrega código velho;
// - só origem própria: CDN de terceiros não entra no cache do jogo.
//
// Ao mudar a casca ou a estratégia, suba CACHE_VERSION: a ativação apaga as
// versões antigas.

const CACHE_PREFIX = 'voxel-sandbox';
const CACHE_VERSION = 'v1';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const OFFLINE_DOCUMENT = './index.html';

// Mesma lista de world-pwa.js (APP_SHELL_FILES). O teste compara as duas para
// não haver duas verdades divergindo em silêncio — o service worker é script
// clássico e não pode importar o módulo.
const SHELL = [
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
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        // Um arquivo novo que ainda não existe não pode travar a instalação
        // inteira: guarda o que der e segue.
        await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(
            names
                .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
                .map((name) => caches.delete(name)),
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    let url;
    try {
        url = new URL(request.url);
    } catch {
        return;
    }
    // Só a própria origem: nada de interceptar CDN, fonte ou analytics.
    if (url.origin !== self.location.origin) return;
    // O próprio service worker nunca sai do cache (senão ele não atualiza).
    if (url.pathname.endsWith('/service-worker.js')) return;

    if (request.mode === 'navigate') {
        event.respondWith(handleDocument(request));
        return;
    }
    event.respondWith(handleAsset(event, request));
});

async function handleDocument(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            // guarda a página mais recente como documento offline
            cache.put(OFFLINE_DOCUMENT, response.clone());
        }
        return response;
    } catch {
        const cached = (await cache.match(request)) || (await cache.match(OFFLINE_DOCUMENT));
        if (cached) return cached;
        return new Response(
            '<!DOCTYPE html><meta charset="utf-8"><title>Sem conexão</title>'
            + '<p style="font:16px sans-serif;padding:24px">O jogo ainda não foi guardado neste aparelho. '
            + 'Conecte-se uma vez para poder jogar sem rede.</p>',
            { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
        );
    }
}

async function handleAsset(event, request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const network = fetch(request)
        .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => null);

    if (cached) {
        // atualiza em segundo plano, sem fazer o jogador esperar
        event.waitUntil(network.catch(() => {}));
        return cached;
    }

    const response = await network;
    if (response) return response;
    return new Response('', { status: 504, statusText: 'Sem rede e sem cache' });
}
