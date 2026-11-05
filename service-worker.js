// Service worker do Voxel Sandbox.
//
// Sem build: este arquivo guarda os arquivos do jogo como estão no repositório.
// A casca (tudo o que o jogo precisa para abrir **e jogar**) é baixada na
// instalação; o resto entra no cache sozinho, no primeiro uso.
//
// De onde vem a lista de arquivos: **do próprio index.html**. O importmap lista
// todos os módulos com o `?v=<hash>` do conteúdo e o HTML lista o CSS, o
// manifest e os ícones — é exatamente a lista de URLs que o navegador vai pedir.
// Ler dali significa não ter uma segunda lista para envelhecer em silêncio
// (era o que acontecia antes: só os poucos arquivos da casca entravam, e o jogo
// em si dependia de ter sido aberto online antes).
//
// Regras:
// - documento → rede primeiro (versão nova chega na hora), cache como rede de
//   segurança;
// - arquivos → cache primeiro, com atualização em segundo plano. Os módulos têm
//   `?v=<hash>` no importmap, então cache nunca entrega código velho;
// - imagens (`assets/`) → mesma regra, com a versão na chave. O `?v=` delas é o
//   hash do próprio arquivo (`asset-versions.js`), então trocar a arte muda a
//   URL e a imagem nova chega na hora;
// - só origem própria: CDN de terceiros não entra no cache do jogo.
//
// Ao mudar a casca ou a estratégia, suba CACHE_VERSION: a ativação apaga as
// versões antigas do cache.

const CACHE_PREFIX = 'voxel-sandbox';
const CACHE_VERSION = 'v22';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const OFFLINE_DOCUMENT = './index.html';

// O mínimo para não ficar sem nada se o index.html não puder ser lido na
// instalação (rede caindo no meio, por exemplo). O resto vem da página.
const MINIMUM_SHELL = [
    './',
    './index.html',
    './styles.css',
    './inventory.css',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/favicon-32.png',
    './icons/apple-touch-icon-180.png',
    './menu-panorama.svg',
    './world-menu.js',
    './game.js',
];

// Imagens que o jogo carrega já dentro do mundo (não aparecem no index.html).
// Ficam guardadas na URL sem versão, como rede de segurança: se a versão do
// arquivo mudar e o jogador estiver sem rede, ainda desenha o capim de ontem.
// Um teste confere que a lista bate com os PNGs de `world-tall-grass.js`.
const IMAGES = [
    './assets/tall-grass-short-v2.png',
    './assets/tall-grass-medium-v2.png',
    './assets/tall-grass-tall-v2.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        const files = new Set([...MINIMUM_SHELL, ...IMAGES]);
        try {
            const page = await fetch(OFFLINE_DOCUMENT, { cache: 'no-store' });
            if (page && page.ok) {
                for (const url of pageFilesFromHtml(await page.clone().text())) files.add(url);
                await cache.put(OFFLINE_DOCUMENT, page);
            }
        } catch (error) {
            // Sem a página, fica o mínimo: o jogo ainda abre e completa o cache
            // no primeiro uso online.
        }
        // Um arquivo novo que ainda não existe não pode travar a instalação
        // inteira: guarda o que der e segue.
        await Promise.all([...files].map((url) => cacheFresh(cache, url)));
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
        await dropStaleModules();
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

/**
 * URLs que a página vai pedir, lidas do index.html: o importmap (todos os
 * módulos, com o hash do conteúdo), o `<script type="module">` de entrada, os
 * CSS, o manifest e os ícones.
 *
 * Tudo o que não for caminho relativo do próprio jogo fica de fora (CDN,
 * `three/addons/`, que é prefixo e não arquivo, e o próprio worker).
 */
function pageFilesFromHtml(html) {
    const files = new Set();
    const add = (url) => {
        if (typeof url !== 'string' || !url) return;
        if (url.endsWith('/') || url.startsWith('//') || /^[a-z]+:/i.test(url)) return;
        if (url.includes('service-worker.js')) return;
        files.add(url);
    };

    const map = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
    if (map) {
        try {
            const imports = JSON.parse(map[1]).imports ?? {};
            for (const url of Object.values(imports)) add(url);
        } catch (error) {
            // Importmap ilegível não pode derrubar a instalação: fica o mínimo.
        }
    }
    for (const match of html.matchAll(/<(?:script|link)[^>]*(?:src|href)="([^"]+)"/g)) add(match[1]);
    return [...files];
}

/** Limpa as versões antigas dos módulos (URL com `?v=` que não é a de hoje). */
async function dropStaleModules() {
    const cache = await caches.open(CACHE_NAME);
    let html;
    try {
        const page = await cache.match(OFFLINE_DOCUMENT);
        if (!page) return;
        html = await page.text();
    } catch (error) {
        return;
    }

    const current = new Set(pageFilesFromHtml(html).map((url) => new URL(url, self.location).href));
    if (!current.size) return;
    const knownPaths = new Set([...current].map((href) => new URL(href).pathname));

    for (const request of await cache.keys()) {
        const url = new URL(request.url);
        if (!url.searchParams.has('v')) continue;
        if (!knownPaths.has(url.pathname)) continue;
        if (current.has(url.origin + url.pathname + url.search)) continue;
        await cache.delete(request);
    }
}

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

/**
 * Guarda um arquivo **do servidor**, não do cache HTTP.
 *
 * `cache.add` aproveitaria a cópia que o navegador já tem — e é justamente ela
 * que fica velha quando alguém troca um PNG mantendo o caminho. `reload` força
 * a resposta real do servidor na hora da instalação.
 */
async function cacheFresh(cache, url) {
    try {
        const response = await fetch(url, { cache: 'reload' });
        if (response && response.ok) await cache.put(url, response);
    } catch (error) {
        // arquivo que não existe (ou rede caindo) não pode derrubar a instalação
    }
}

async function handleAsset(event, request) {
    const cache = await caches.open(CACHE_NAME);
    // A chave é a URL inteira, com o `?v=`: versão nova do arquivo = chave
    // nova = resposta do servidor, nunca a cópia velha.
    const key = request;
    const cached = await cache.match(key);

    const network = fetch(request)
        .then((response) => {
            if (response && response.ok) return storeAsset(cache, key, response);
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
    // Sem rede: uma imagem de outra versão ainda é melhor que chão vazio. Só
    // vale para `assets/` — código velho nunca é servido por engano.
    const previous = await cachedOtherVersion(cache, key);
    if (previous) return previous;
    return new Response('', { status: 504, statusText: 'Sem rede e sem cache' });
}

/** Guarda a resposta e apaga as versões anteriores do mesmo arquivo. */
async function storeAsset(cache, key, response) {
    await cache.put(key, response.clone());
    await forgetOtherVersions(cache, key);
    return response;
}

async function forgetOtherVersions(cache, key) {
    const url = new URL(key.url);
    if (!url.pathname.includes('/assets/')) return;
    for (const old of await cache.keys()) {
        const oldUrl = new URL(old.url);
        if (oldUrl.pathname !== url.pathname || oldUrl.search === url.search) continue;
        await cache.delete(old);
    }
}

/** Cópia guardada do mesmo arquivo em outra versão (rede de segurança). */
async function cachedOtherVersion(cache, key) {
    const url = new URL(key.url);
    if (!url.pathname.includes('/assets/')) return null;
    for (const old of await cache.keys()) {
        const oldUrl = new URL(old.url);
        if (oldUrl.pathname !== url.pathname) continue;
        const hit = await cache.match(old);
        if (hit) return hit;
    }
    return null;
}
