import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

import {
    APP_SHELL_FILES,
    PWA_MANIFEST_PATH,
    SERVICE_WORKER_PATH,
    isStandalone,
    pwaSupported,
    registerServiceWorker,
    serviceWorkerEnabled,
} from '../world-pwa.js';
import { localModules } from '../tools/stamp-importmap.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const exists = (file) => existsSync(new URL(`../${file}`, import.meta.url));

const manifest = JSON.parse(read('manifest.webmanifest'));
const worker = read('service-worker.js');
const html = read('index.html');
const pwaModule = read('world-pwa.js');

function pngInfo(file) {
    const buffer = readFileSync(new URL(`../${file}`, import.meta.url));
    assert.deepEqual([...buffer.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${file}: assinatura PNG`);
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.length };
}

// --- manifest -----------------------------------------------------------

test('o manifest tem o que o navegador exige para instalar', () => {
    assert.equal(manifest.name, 'Voxel Sandbox');
    assert.ok(manifest.short_name.length <= 12, 'short_name cabe embaixo do ícone');
    assert.equal(manifest.start_url, './', 'relativo: funciona em subpasta (GitHub Pages)');
    assert.equal(manifest.scope, './');
    assert.equal(manifest.display, 'standalone');
    assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
    assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
    assert.equal(manifest.lang, 'pt-BR');
    assert.ok(manifest.description.length > 20);
    assert.ok(manifest.icons.length >= 3);
});

test('cada ícone do manifest existe, é PNG e tem o tamanho anunciado', () => {
    const seen = new Set();
    for (const icon of manifest.icons) {
        const file = icon.src.replace(/^\.\//, '');
        assert.ok(exists(file), `${file} existe`);
        const [width, height] = icon.sizes.split('x').map(Number);
        const info = pngInfo(file);
        assert.equal(info.width, width, `${file}: largura`);
        assert.equal(info.height, height, `${file}: altura`);
        assert.ok(info.bytes > 300 && info.bytes < 200_000, `${file}: tamanho plausível (${info.bytes} bytes)`);
        assert.equal(icon.type, 'image/png');
        seen.add(file);
    }
    assert.ok(seen.size >= 3, 'pelo menos 192, 512 e maskable');
});

test('há um ícone maskable com fundo cheio e folga para o recorte', () => {
    const maskable = manifest.icons.filter(icon => icon.purpose === 'maskable');
    assert.ok(maskable.length >= 1, 'Android recorta o ícone: precisa de um maskable');
    const info = pngInfo(maskable[0].src.replace(/^\.\//, ''));
    assert.ok(info.width >= 512, 'maskable grande o bastante para o recorte');
});

// --- casca offline ------------------------------------------------------

test('a casca offline tem o essencial e todo arquivo citado existe', () => {
    for (const url of APP_SHELL_FILES) {
        const file = url.replace(/^\.\//, '');
        if (file === '' ) continue; // './' é o próprio index.html
        assert.ok(exists(file), `${url} existe no repositório`);
        assert.ok(statSync(new URL(`../${file}`, import.meta.url)).size > 0, `${url} não está vazio`);
    }
    const files = APP_SHELL_FILES.join(' ');
    for (const essential of ['index.html', 'styles.css', 'game.js', 'world-menu.js',
        'vendor/three/three.module.js', 'world-terrain-worker.js', 'manifest.webmanifest']) {
        assert.ok(files.includes(essential), `casca inclui ${essential}`);
    }
    assert.equal(PWA_MANIFEST_PATH, './manifest.webmanifest');
    assert.equal(SERVICE_WORKER_PATH, './service-worker.js');
});

test('a lista do service worker não diverge da lista do módulo', () => {
    const start = worker.indexOf('const SHELL = [');
    const end = worker.indexOf('];', start);
    assert.ok(start > 0 && end > start, 'service worker declara SHELL');
    const listed = [...worker.slice(start, end).matchAll(/'([^']+)'/g)].map(match => match[1]);
    assert.deepEqual(listed.sort(), [...APP_SHELL_FILES].sort(),
        'as duas listas precisam ser idênticas (teste existe para elas não divergirem em silêncio)');
});

test('o service worker não é importado por nenhum módulo da página', () => {
    assert.ok(!localModules().includes('service-worker.js'), 'fora do importmap');
    assert.ok(!html.includes('service-worker.js?v='), 'e sem versão na URL: o worker precisa de URL estável');
    assert.ok(html.includes('world-pwa.js?v='), 'o módulo de registro entra no importmap');
});

// --- service worker -----------------------------------------------------

test('instala guardando a casca, sem travar por causa de um arquivo', () => {
    assert.match(worker, /self\.addEventListener\('install'/);
    assert.match(worker, /caches\.open\(CACHE_NAME\)/);
    assert.match(worker, /SHELL\.map\(\(url\) => cache\.add\(url\)\.catch\(\(\) => \{\}\)\)/,
        'um 404 na casca não pode impedir a instalação');
    assert.match(worker, /self\.skipWaiting\(\)/, 'versão nova assume sem esperar todas as abas fecharem');
});

test('ativa limpando caches antigos e assumindo as abas abertas', () => {
    assert.match(worker, /self\.addEventListener\('activate'/);
    assert.match(worker, /caches\.keys\(\)/);
    assert.match(worker, /name\.startsWith\(CACHE_PREFIX\) && name !== CACHE_NAME/);
    assert.match(worker, /caches\.delete\(name\)/);
    assert.match(worker, /self\.clients\.claim\(\)/);
    assert.match(worker, /const CACHE_VERSION = 'v\d+'/, 'versão explícita, para poder invalidar');
    assert.match(worker, /CACHE_PREFIX\}-/, 'nome do cache derivado da versão');
});

test('documento: rede primeiro, cache como rede de segurança', () => {
    const body = worker.slice(worker.indexOf('async function handleDocument'), worker.indexOf('async function handleAsset'));
    assert.match(body, /const response = await fetch\(request\)/, 'tenta a rede primeiro');
    assert.match(body, /cache\.put\(OFFLINE_DOCUMENT, response\.clone\(\)\)/, 'atualiza a cópia offline');
    assert.match(body, /catch \{/, 'sem rede, cai no cache');
    assert.match(body, /cache\.match\(OFFLINE_DOCUMENT\)/);
    assert.match(body, /Sem conexão|não foi guardado|Conecte-se/, 'e explica o que fazer se nunca abriu online');
});

test('arquivos: cache primeiro e atualização em segundo plano', () => {
    const body = worker.slice(worker.indexOf('async function handleAsset'));
    assert.match(body, /const cached = await cache\.match\(request\)/);
    assert.match(body, /if \(cached\) \{/);
    assert.match(body, /event\.waitUntil\(network\.catch/, 'atualiza sem fazer o jogador esperar');
    assert.match(body, /cache\.put\(request, response\.clone\(\)\)/);
    assert.match(body, /status: 504/, 'offline sem cache: erro explícito, não página em branco');
});

test('o worker só mexe na própria origem', () => {
    assert.match(worker, /if \(request\.method !== 'GET'\) return;/);
    assert.match(worker, /if \(url\.origin !== self\.location\.origin\) return;/,
        'CDN e terceiros ficam fora do cache do jogo');
    assert.match(worker, /url\.pathname\.endsWith\('\/service-worker\.js'\)/, 'o worker não cacheia a si mesmo');
    assert.match(worker, /request\.mode === 'navigate'/);
});

// --- registro -----------------------------------------------------------

test('só registra em http(s): em file:// não existe service worker', () => {
    const nav = { serviceWorker: { register: async () => ({ scope: './' }) } };
    assert.equal(pwaSupported({ navigator: nav, location: { protocol: 'https:' } }), true);
    assert.equal(pwaSupported({ navigator: nav, location: { protocol: 'http:' } }), true);
    assert.equal(pwaSupported({ navigator: nav, location: { protocol: 'file:' } }), false);
    assert.equal(pwaSupported({ navigator: {}, location: { protocol: 'https:' } }), false);
    assert.equal(pwaSupported({ navigator: null, location: { protocol: 'https:' } }), false);
    assert.equal(pwaSupported(), false, 'sem navigator/location (Node, teste) não explode nem registra');
});

test('?sw=0 desliga o cache, para depurar sem limpar dados do site', () => {
    assert.equal(serviceWorkerEnabled({ location: { search: '' } }), true);
    assert.equal(serviceWorkerEnabled({ location: { search: '?sw=0' } }), false);
    assert.equal(serviceWorkerEnabled({ location: { search: '?debug&sw=0' } }), false);
    assert.equal(serviceWorkerEnabled({ location: { search: '?sw=1' } }), true);
    assert.equal(serviceWorkerEnabled(), true);
});

test('registra o worker do caminho certo, com escopo relativo', async () => {
    const calls = [];
    const nav = { serviceWorker: { register: async (url, options) => { calls.push([url, options]); return { scope: './' }; } } };
    const registration = await registerServiceWorker({ navigator: nav, location: { protocol: 'https:', search: '' } });
    assert.deepEqual(calls, [['./service-worker.js', { scope: './' }]]);
    assert.deepEqual(registration, { scope: './' });
});

test('falha ao registrar avisa e não quebra o jogo', async () => {
    const warnings = [];
    const nav = { serviceWorker: { register: async () => { throw new Error('sem permissão'); } } };
    const registration = await registerServiceWorker({
        navigator: nav,
        location: { protocol: 'https:', search: '' },
        warn: (...args) => warnings.push(args.join(' ')),
    });
    assert.equal(registration, null);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Service worker/);
});

test('contexto sem suporte não chama register', async () => {
    let called = false;
    const nav = { serviceWorker: { register: async () => { called = true; return {}; } } };
    assert.equal(await registerServiceWorker({ navigator: nav, location: { protocol: 'file:', search: '' } }), null);
    assert.equal(await registerServiceWorker({ navigator: nav, location: { protocol: 'https:', search: '?sw=0' } }), null);
    assert.equal(called, false);
});

test('reconhece quando está rodando instalado', () => {
    assert.equal(isStandalone({ matchMedia: () => ({ matches: true }) }), true);
    assert.equal(isStandalone({ matchMedia: () => ({ matches: false }) }), false);
    assert.equal(isStandalone({ matchMedia: () => { throw new Error('sem matchMedia'); } }), false);
    assert.equal(isStandalone({ matchMedia: null }), false);
});

// --- ligação com a página -----------------------------------------------

test('o index.html aponta o manifest, o tema e os ícones', () => {
    assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
    assert.match(html, /<meta name="theme-color" content="#171717">/);
    assert.match(html, /<link rel="icon" href="icons\/favicon-32\.png"/);
    assert.match(html, /<link rel="apple-touch-icon" href="icons\/icon-192\.png">/,
        'iOS não lê o manifest: precisa do toque na tela inicial');
    assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
});

test('o menu registra o service worker sem travar a abertura', () => {
    const menu = read('world-menu.js');
    assert.match(menu, /import \{[^}]*registerServiceWorker[^}]*\} from '\.\/world-pwa\.js';/);
    assert.match(menu, /registerServiceWorker\(\)\.catch/, 'registro é assíncrono e não bloqueia o menu');
    assert.match(pwaModule, /export async function registerServiceWorker/);
});

test('a tela inicial tem o botão de instalar no padrão de botões do menu', () => {
    // UI nova segue o padrão cinza do menu (2px, sem raio) — nada de botão solto.
    assert.match(html, /class="classic-btn classic-btn-wide" id="btn-install"[^>]*hidden/, 'nasce escondido');
    assert.match(html, /id="install-hint"/, 'e tem onde explicar a instalação');
    assert.match(html, /<p id="install-hint"[^>]*aria-live="polite"/, 'o aviso é anunciado');
});

test('o menu guarda o convite do navegador para o clique poder instalar', () => {
    const menu = read('world-menu.js');
    assert.match(menu, /addEventListener\('beforeinstallprompt'/, 'sem isso o convite do Chrome passa e não volta');
    assert.match(menu, /event\.preventDefault\(\)/, 'preventDefault tira o mini-aviso do Chrome e mantém o evento');
    assert.match(menu, /capturePromptEvent\(event\)/);
    assert.match(menu, /addEventListener\('appinstalled'/, 'instalou: o botão sai');
    assert.match(menu, /installPrompt\.prompt\(\)/, 'o clique chama o convite guardado');
    assert.match(menu, /createInstallPrompt\(/, 'a decisão vem do módulo de instalação');
});

test('o servidor de desenvolvimento entrega o manifest com o tipo certo', () => {
    const serve = read('tools/serve.mjs');
    assert.match(serve, /'\.webmanifest': 'application\/manifest\+json; charset=utf-8'/,
        'sem o MIME correto o Chrome ignora o manifest');
});
