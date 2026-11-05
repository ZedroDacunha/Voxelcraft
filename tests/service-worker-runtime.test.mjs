// Executa o service worker de verdade, num contexto isolado com dublês de
// `caches`, `fetch` e dos eventos. Os testes de `pwa.test.mjs` conferem texto e
// estrutura; estes conferem **comportamento**: o que entra no cache, o que é
// servido offline e o que nem chega a ser interceptado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
// A página de verdade: o worker tira dela a lista de arquivos a guardar.
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const IMPORT_MAP = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(HTML)[1]);
const MODULE_URLS = Object.values(IMPORT_MAP.imports).filter(url => !url.endsWith('/'));
const BASE = 'https://example.test/';
// O nome do cache sai do próprio worker: mudar CACHE_VERSION não quebra o teste.
const CACHE = `voxel-sandbox-${/const CACHE_VERSION = '([^']+)'/.exec(SOURCE)[1]}`;

class FakeResponse {
    constructor(body = '', init = {}) {
        this.body = body;
        this.status = init.status ?? 200;
        this.ok = this.status >= 200 && this.status < 300;
        this.headers = init.headers ?? {};
    }
    clone() { return this; }
    text() { return this.body; }
}

const urlOf = (request) => new URL(typeof request === 'string' ? request : request.url, BASE).href;

const defaultBody = (url) => (url.endsWith('/index.html') || url === BASE ? HTML : `conteúdo de ${url}`);

function loadWorker({ status = () => 200, body = defaultBody } = {}) {
    const listeners = new Map();
    const cachesByName = new Map();
    const fetched = [];
    const state = { offline: false, body };
    let skipWaiting = 0;
    let claimed = 0;

    const fetchImpl = async (request) => {
        const url = urlOf(request);
        if (state.offline) throw new Error('offline');
        fetched.push(url);
        return new FakeResponse(state.body(url), { status: status(url) });
    };

    function makeCache() {
        const entries = new Map();
        return {
            entries,
            async put(request, response) { entries.set(urlOf(request), response); },
            async match(request) { return entries.get(urlOf(request)); },
            async add(url) {
                const response = await fetchImpl(url);
                if (!response || !response.ok) throw new Error(`não baixou ${urlOf(url)}`);
                entries.set(urlOf(url), response);
            },
            async keys() { return [...entries.keys()].map(url => ({ url })); },
            async delete(request) { return entries.delete(urlOf(request)); },
        };
    }

    const storage = {
        caches: cachesByName,
        async open(name) {
            if (!cachesByName.has(name)) cachesByName.set(name, makeCache());
            return cachesByName.get(name);
        },
        async keys() { return [...cachesByName.keys()]; },
        async delete(name) { return cachesByName.delete(name); },
    };

    const self = {
        location: new URL(BASE),
        addEventListener(type, handler) { listeners.set(type, handler); },
        skipWaiting: async () => { skipWaiting++; },
        clients: { claim: async () => { claimed++; } },
    };

    vm.runInContext(SOURCE, vm.createContext({
        self, caches: storage, fetch: fetchImpl, URL, Response: FakeResponse, console, Promise,
    }), { filename: 'service-worker.js' });

    async function fire(type, { request = null } = {}) {
        const handler = listeners.get(type);
        assert.ok(handler, `o worker escuta "${type}"`);
        const responded = [];
        const waited = [];
        handler({
            request,
            respondWith(value) { responded.push(Promise.resolve(value)); },
            waitUntil(value) { waited.push(Promise.resolve(value)); },
        });
        const settled = await Promise.all(waited);
        return {
            responded: responded.length ? await responded[0] : null,
            waited: settled,
            intercepted: responded.length > 0,
        };
    }

    return {
        listeners,
        storage,
        fetched,
        fire,
        cache: () => storage.open(CACHE),
        setOffline(value) { state.offline = value; },
        setBody(fn) { state.body = fn; },
        get skipWaiting() { return skipWaiting; },
        get claimed() { return claimed; },
    };
}

const get = (path) => ({ method: 'GET', mode: 'no-cors', url: new URL(path, BASE).href });
const navigate = (path = './') => ({ method: 'GET', mode: 'navigate', url: new URL(path, BASE).href });

// --- instalação e ativação ----------------------------------------------

test('instala guardando o jogo inteiro, não só o menu', async () => {
    const worker = loadWorker();
    const install = await worker.fire('install');
    await install.waited;

    const cache = await worker.cache();
    // Todo módulo do importmap (é a lista de URLs que o navegador vai pedir)...
    for (const url of MODULE_URLS) {
        assert.ok(cache.entries.has(new URL(url, BASE).href), `${url} entrou no cache`);
    }
    // ...o CSS com a versão que a página pede, o manifest, os ícones e as imagens.
    for (const prefix of ['/styles.css?v=', '/inventory.css?v=', '/world-menu.js?v=']) {
        assert.ok([...cache.entries.keys()].some(href => href.includes(prefix)), `${prefix} entrou no cache`);
    }
    for (const url of ['./manifest.webmanifest', './icons/icon-192.png', './assets/tall-grass-short-v2.png']) {
        assert.ok(cache.entries.has(new URL(url, BASE).href), `${url} entrou no cache`);
    }
    assert.equal(worker.skipWaiting, 1, 'versão nova não espera todas as abas fecharem');
});

test('sem o index.html a instalação não trava: fica o mínimo', async () => {
    const worker = loadWorker({ body: (url) => (url.endsWith('/index.html') || url === BASE ? '' : `conteúdo de ${url}`) });
    const install = await worker.fire('install');
    await install.waited;

    const cache = await worker.cache();
    for (const url of ['./index.html', './styles.css', './game.js', './world-menu.js']) {
        assert.ok(cache.entries.has(new URL(url, BASE).href), `${url} entrou pelo mínimo`);
    }
    assert.equal(worker.skipWaiting, 1, 'instalação não travou');
});

test('um arquivo faltando não impede a instalação', async () => {
    const worker = loadWorker({ status: (url) => (url.endsWith('game.js?v=666d234b9b') ? 404 : 200) });
    const install = await worker.fire('install');
    await install.waited;

    const cache = await worker.cache();
    assert.ok(cache.entries.has(new URL('./index.html', BASE).href), 'o resto foi guardado');
    assert.ok(!cache.entries.has(new URL('./game.js?v=666d234b9b', BASE).href));
    assert.equal(worker.skipWaiting, 1, 'instalação não travou');
});

test('ativa apaga só as versões antigas do próprio jogo', async () => {
    const worker = loadWorker();
    const install = await worker.fire('install');
    await install.waited;
    await worker.storage.open('voxel-sandbox-v0'); // versão antiga do jogo
    await worker.storage.open('outro-app-cache');  // cache de outro projeto no mesmo domínio

    const activate = await worker.fire('activate');
    await activate.waited;

    assert.deepEqual((await worker.storage.keys()).sort(), ['outro-app-cache', CACHE].sort());
    assert.equal(worker.claimed, 1, 'assume as abas já abertas');
});

// --- documento ----------------------------------------------------------

test('documento: rede primeiro e cópia offline atualizada', async () => {
    const worker = loadWorker();
    await (await worker.fire('install')).waited;

    const result = await worker.fire('fetch', { request: navigate('./') });
    assert.ok(result.intercepted);
    assert.match(await result.responded.text(), /Voxel Sandbox/);

    const cache = await worker.cache();
    assert.ok(cache.entries.has(new URL('./index.html', BASE).href), 'guardou a página para o modo offline');
});

test('documento offline: serve o cache em vez de erro de rede', async () => {
    const worker = loadWorker();
    await (await worker.fire('install')).waited;
    await worker.fire('fetch', { request: navigate('./') }); // popula a cópia offline

    worker.setOffline(true);
    const result = await worker.fire('fetch', { request: navigate('./') });
    assert.equal(result.responded.ok, true, 'o jogo abre sem rede');
    assert.match(result.responded.body, /Voxel Sandbox/);
});

test('offline na primeira visita: página explicando, não tela em branco', async () => {
    const worker = loadWorker();
    worker.setOffline(true); // cache vazio, nunca instalou

    const result = await worker.fire('fetch', { request: navigate('./') });
    assert.equal(result.responded.status, 200);
    assert.match(result.responded.body, /Conecte-se/);
    assert.match(result.responded.headers['content-type'], /text\/html/);
});

// --- arquivos -----------------------------------------------------------

test('arquivo novo é buscado e guardado', async () => {
    const worker = loadWorker();
    await (await worker.fire('install')).waited;
    const request = get('./world-step-sounds.js?v=abc');

    const result = await worker.fire('fetch', { request });
    assert.ok(result.intercepted);
    assert.match(await result.responded.text(), /conteúdo de/);
    assert.ok((await worker.cache()).entries.has(request.url), 'entrou no cache para a próxima vez');
});

test('arquivo em cache é servido na hora e atualizado por trás', async () => {
    const worker = loadWorker({ body: () => 'versão 1' });
    await (await worker.fire('install')).waited;
    const request = get('./world-audio.js?v=abc');

    const first = await worker.fire('fetch', { request });
    assert.equal(await first.responded.text(), 'versão 1');

    worker.setBody(() => 'versão 2'); // o servidor publicou algo novo
    const second = await worker.fire('fetch', { request });
    assert.equal(await second.responded.text(), 'versão 1', 'jogador não espera a rede');
    await second.waited;
    assert.equal(await (await (await worker.cache()).match(request)).text(), 'versão 2',
        'a atualização em segundo plano trocou o cache');
});

test('arquivo sem cache e sem rede: 504 explícito', async () => {
    const worker = loadWorker();
    await (await worker.fire('install')).waited;
    worker.setOffline(true);

    const result = await worker.fire('fetch', { request: get('./modulo-que-nunca-viu.js') });
    assert.equal(result.responded.status, 504);
    assert.equal(result.responded.body, '');
});

test('imagem trocada chega na hora: versão diferente na URL não reusa o cache', async () => {
    const worker = loadWorker();
    await (await worker.fire('install')).waited;

    // Ontem o jogo pedia a arte com esta versão...
    const antiga = get('./assets/tall-grass-tall-v2.png?v=hash-antigo');
    await (await worker.fire('fetch', { request: antiga })).waited;

    // ...o PNG foi trocado e o `?v=` passou a ser o hash do arquivo novo.
    const nova = get('./assets/tall-grass-tall-v2.png?v=hash-novo');
    const result = await worker.fire('fetch', { request: nova });
    assert.match(await result.responded.text(), /hash-novo/, 'desenhou a arte que o servidor tem agora');
    const cache = await worker.cache();
    assert.ok(cache.entries.has(nova.url), 'a versão nova entrou no cache');
    assert.ok(!cache.entries.has(antiga.url), 'e a velha saiu (uma cópia por imagem)');
});

test('sem rede, a imagem de outra versão ainda serve de rede de segurança', async () => {
    const worker = loadWorker();
    await (await worker.fire('install')).waited;
    worker.setOffline(true);

    // A instalação guarda a imagem sem versão; o jogo pede com o hash do arquivo.
    const result = await worker.fire('fetch', { request: get('./assets/tall-grass-tall-v2.png?v=hash-de-hoje') });
    assert.equal(result.responded.status, 200, 'sem rede e ainda assim desenha o capim');
    assert.match(await result.responded.text(), /tall-grass-tall/);
});

test('código de outra versão nunca é servido (só imagem aceita fallback)', async () => {
    const worker = loadWorker();
    await (await worker.fire('install')).waited;
    await (await worker.cache()).put(
        new URL('./world-audio.js?v=antigo', BASE).href, new FakeResponse('código velho'),
    );
    worker.setOffline(true);

    const result = await worker.fire('fetch', { request: get('./world-audio.js?v=novo') });
    assert.equal(result.responded.status, 504, 'melhor sem som do que com o código de outra versão');
});

test('versão antiga de módulo sai do cache na ativação (imagem fica)', async () => {
    const worker = loadWorker();
    await (await worker.fire('install')).waited;

    const cache = await worker.cache();
    const velho = new URL('./world-audio.js?v=versao-antiga', BASE).href;
    const imagem = new URL('./assets/sounds/passo.ogg?v=1', BASE).href;
    await cache.put(velho, new FakeResponse('código velho'));
    await cache.put(imagem, new FakeResponse('som'));

    const activate = await worker.fire('activate');
    await activate.waited;

    assert.ok(!cache.entries.has(velho), 'módulo de versão antiga não fica ocupando espaço');
    assert.ok(cache.entries.has(imagem), 'o que não é arquivo do jogo fica');
    const atual = new URL(MODULE_URLS[0], BASE).href;
    assert.ok(cache.entries.has(atual), 'e a versão de hoje continua lá');
});

// --- o que fica de fora -------------------------------------------------

test('não intercepta o que não é do jogo', async () => {
    const worker = loadWorker();
    await (await worker.fire('install')).waited;

    const foreign = await worker.fire('fetch', {
        request: { method: 'GET', mode: 'no-cors', url: 'https://unpkg.com/three@0.160.0/build/three.module.js' },
    });
    assert.equal(foreign.intercepted, false, 'CDN fora do cache do jogo');

    const post = await worker.fire('fetch', {
        request: { method: 'POST', mode: 'cors', url: new URL('./save', BASE).href },
    });
    assert.equal(post.intercepted, false, 'escrita no servidor não passa pelo worker');

    const selfRequest = await worker.fire('fetch', { request: get('./service-worker.js') });
    assert.equal(selfRequest.intercepted, false, 'o worker não cacheia a si mesmo');
});
