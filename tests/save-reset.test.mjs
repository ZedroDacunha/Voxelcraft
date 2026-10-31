import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    consumeSaveResetRequest,
    saveResetConfirmationMessage,
} from '../world-save-reset.js';
import { createWorldSaveLoader } from '../world-save-loader.js';

const WORLD = { name: 'Mundo de teste', seed: 12345, saveKey: 'world-abc' };

function makeResetProbe({ href, confirmed = true, replaceFails = false, confirmThrows = false }) {
    const replaced = [];
    const messages = [];
    const errors = [];
    const result = consumeSaveResetRequest({
        href,
        world: WORLD,
        replaceUrl: url => {
            if (replaceFails) throw new Error('history bloqueado');
            replaced.push(url);
        },
        confirmReset: message => {
            messages.push(message);
            if (confirmThrows) throw new Error('confirm indisponível');
            return confirmed;
        },
        onError: error => errors.push(error),
    });
    return { result, replaced, messages, errors };
}

test('sem parâmetro de reset nada é confirmado nem removido', () => {
    const probe = makeResetProbe({ href: 'https://game.test/?debug&pr=1#hud' });
    assert.deepEqual(probe.result, { requested: false, confirmed: false, cleaned: false });
    assert.deepEqual(probe.replaced, []);
    assert.deepEqual(probe.messages, []);
});

test('reset confirmado remove apenas o parâmetro reset e preserva o restante da URL', () => {
    const probe = makeResetProbe({ href: 'https://game.test/play?debug&reset&pr=1#hud' });
    assert.deepEqual(probe.result, { requested: true, confirmed: true, cleaned: true });
    assert.deepEqual(probe.replaced, ['/play?debug&pr=1#hud']);
    assert.equal(probe.messages.length, 1);
    assert.match(probe.messages[0], /Mundo de teste/);
    assert.match(probe.messages[0], /12345/);
    assert.match(probe.messages[0], /não pode ser desfeita/);
});

test('reset cancelado também consome o parâmetro e não autoriza apagar', () => {
    const probe = makeResetProbe({ href: 'https://game.test/?reset', confirmed: false });
    assert.deepEqual(probe.result, { requested: true, confirmed: false, cleaned: true });
    assert.deepEqual(probe.replaced, ['/']);
});

test('se a URL não puder ser limpa, o reset falha fechado e nem chega a confirmar', () => {
    const probe = makeResetProbe({ href: 'https://game.test/?reset', replaceFails: true });
    assert.deepEqual(probe.result, { requested: true, confirmed: false, cleaned: false });
    assert.deepEqual(probe.messages, []);
    assert.equal(probe.errors.length, 1);
});

test('falha no diálogo de confirmação não autoriza apagar', () => {
    const probe = makeResetProbe({ href: 'https://game.test/?reset', confirmThrows: true });
    assert.deepEqual(probe.result, { requested: true, confirmed: false, cleaned: true });
    assert.equal(probe.errors.length, 1);
});

test('mensagem de confirmação identifica mundo e seed', () => {
    const message = saveResetConfirmationMessage(WORLD);
    assert.match(message, /Mundo de teste/);
    assert.match(message, /seed 12345/);
    assert.match(message, /backup/);
});

function makeLoaderProbe({ href = 'https://game.test/?debug&reset', confirmed = true, replaceFails = false } = {}) {
    let currentHref = href;
    const loads = [];
    const replaced = [];
    const messages = [];
    const errors = [];
    const saveManager = {
        load(options) {
            loads.push(options);
            return Promise.resolve(null);
        },
    };
    const loader = createWorldSaveLoader({
        saveManager,
        world: WORLD,
        getHref: () => currentHref,
        replaceUrl: url => {
            if (replaceFails) throw new Error('history bloqueado');
            replaced.push(url);
            currentHref = new URL(url, currentHref).href;
        },
        confirmReset: message => {
            messages.push(message);
            return confirmed;
        },
        onError: error => errors.push(error),
    });
    return {
        loader, loads, replaced, messages, errors,
        setHref: next => { currentHref = next; },
        getHref: () => currentHref,
    };
}

test('loader passa reset ao manager apenas depois de confirmação explícita', async () => {
    const probe = makeLoaderProbe();
    await probe.loader();
    assert.deepEqual(probe.loads, [{ reset: true }]);
    assert.equal(probe.messages.length, 1);
    assert.equal(probe.getHref(), 'https://game.test/?debug');
});

test('voltar ao menu e reentrar não repete o reset', async () => {
    const probe = makeLoaderProbe();
    await probe.loader();
    await probe.loader();
    assert.deepEqual(probe.loads, [{ reset: true }, { reset: false }]);
    assert.equal(probe.messages.length, 1);
    assert.deepEqual(probe.replaced, ['/?debug']);
});

test('mesmo que a URL receba reset de novo na mesma página, o loader não apaga outra vez', async () => {
    const probe = makeLoaderProbe();
    await probe.loader();
    probe.setHref('https://game.test/?reset');
    await probe.loader();
    assert.deepEqual(probe.loads, [{ reset: true }, { reset: false }]);
    assert.equal(probe.messages.length, 1);
});

test('cancelar no primeiro carregamento mantém o save e não tenta de novo na mesma página', async () => {
    const probe = makeLoaderProbe({ confirmed: false });
    await probe.loader();
    probe.setHref('https://game.test/?reset');
    await probe.loader();
    assert.deepEqual(probe.loads, [{ reset: false }, { reset: false }]);
    assert.equal(probe.messages.length, 1);
});

test('history bloqueado impede reset no carregamento e em novas tentativas', async () => {
    const probe = makeLoaderProbe({ replaceFails: true });
    await probe.loader();
    await probe.loader();
    assert.deepEqual(probe.loads, [{ reset: false }, { reset: false }]);
    assert.equal(probe.messages.length, 0);
    assert.equal(probe.errors.length, 1);
});

test('game.js usa o loader modular e não lê mais reset diretamente da URL', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /createWorldSaveLoader/);
    assert.doesNotMatch(source, /has\(['"]reset['"]\)/);
});
