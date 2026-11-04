// Executa o service worker de verdade, num contexto isolado com dublês de
// `caches`, `fetch` e dos eventos. Os testes de `pwa.test.mjs` conferem texto e
// estrutura; estes conferem **comportamento**: o que entra no cache, o que é
// servido offline e o que nem chega a ser interceptado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { APP_SHELL_FILES } from '../world-pwa.js';

const SOURCE = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const BASE = 'https://example.test/';
const CACHE = 'voxel-sandbox-v1';

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

function loadWorker({ status = () => 200, body = (url) => `conteúdo de ${url}` } = {}) {
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

test('instala guardando a casca inteira e assume o controle', async () => {
    const worker = loadWorker();
    const install = await worker.fire('install');
    await install.waited;

    const cache = await worker.cache();
    for (const url of APP_SHELL_FILES) {
        assert.ok(cache.entries.has(new URL(url, BASE).href), `${url} entrou no cache`);
    }
    assert.equal(worker.skipWaiting, 1, 'versão nova não espera todas as abas fecharem');
});

test('um arquivo faltando não impede a instalação', async () => {
    const worker = loadWorker({ status: (url) => (url.endsWith('game.js') ? 404 : 200) });
    const install = await worker.fire('install');
    await install.waited;

    const cache = await worker.cache();
    assert.ok(cache.entries.has(new URL('./index.html', BASE).href), 'o resto foi guardado');
    assert.ok(!cache.entries.has(new URL('./game.js', BASE).href));
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
    assert.match(await result.responded.text(), /conteúdo de https:\/\/example\.test\//);

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
    assert.match(result.responded.body, /index\.html|example\.test/);
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
