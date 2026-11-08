import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTouchImmersive, isPortraitViewport } from '../world-touch-immersive.js';

function setup({ hasFullscreen = true, existing = false, reject = false, standalone = false } = {}) {
    const calls = [];
    const doc = { documentElement: {}, fullscreenElement: null };
    if (existing) doc.fullscreenElement = {};
    if (hasFullscreen) doc.documentElement.requestFullscreen = () => {
        calls.push('fullscreen');
        if (reject) return Promise.reject(new Error('negado'));
        doc.fullscreenElement = doc.documentElement;
        return Promise.resolve();
    };
    doc.exitFullscreen = () => { calls.push('exit'); doc.fullscreenElement = null; return Promise.resolve(); };
    const screen = { orientation: { lock: async value => { calls.push(value); }, unlock: () => calls.push('unlock') } };
    return { calls, doc, screen, controller: createTouchImmersive({ doc, screen, isStandalone: () => standalone }) };
}

test('toque solicita tela cheia imediatamente e depois trava paisagem', async () => {
    const { calls, controller } = setup();
    const promise = controller.enter();
    assert.deepEqual(calls, ['fullscreen'], 'pedido imediato ainda dentro do gesto');
    assert.deepEqual(await promise, { fullscreen: true, locked: true });
    assert.deepEqual(calls, ['fullscreen', 'landscape']);
    await controller.release();
    assert.deepEqual(calls, ['fullscreen', 'landscape', 'unlock', 'exit']);
});

test('sem suporte ou com recusa o jogo pode continuar sem tela cheia', async () => {
    for (const options of [{ hasFullscreen: false }, { reject: true }]) {
        const { calls, controller } = setup(options);
        assert.deepEqual(await controller.enter(), { fullscreen: false, locked: false });
        assert.ok(!calls.includes('landscape'));
        await controller.release();
        assert.ok(!calls.includes('exit'));
    }
});

test('respeita tela cheia preexistente e permite bloqueio no app instalado', async () => {
    const existing = setup({ existing: true });
    assert.deepEqual(await existing.controller.enter(), { fullscreen: true, locked: true });
    await existing.controller.release();
    assert.deepEqual(existing.calls, ['landscape', 'unlock']);
    const installed = setup({ hasFullscreen: false, standalone: true });
    assert.deepEqual(await installed.controller.enter(), { fullscreen: false, locked: true });
    await installed.controller.release();
    assert.deepEqual(installed.calls, ['landscape', 'unlock']);
});

test('orientação recusada não impede modo de toque nem gera erro', async () => {
    const { calls, screen, controller } = setup();
    screen.orientation.lock = async () => { calls.push('negado'); throw Error('negado'); };
    assert.deepEqual(await controller.enter(), { fullscreen: true, locked: false });
    await controller.release();
    assert.deepEqual(calls, ['fullscreen', 'negado', 'exit']);
});

test('sair enquanto o pedido está pendente desfaz apenas tela cheia própria', async () => {
    const { doc, calls, controller } = setup();
    let finish;
    doc.documentElement.requestFullscreen = () => new Promise(resolve => { finish = () => { doc.fullscreenElement = doc.documentElement; resolve(); }; });
    const entering = controller.enter();
    await controller.release();
    finish();
    assert.deepEqual(await entering, { fullscreen: false, locked: false });
    assert.deepEqual(calls, ['exit']);
});

test('ao sair manualmente da tela cheia libera orientação sem pedir novamente', async () => {
    const { calls, doc, controller } = setup();
    await controller.enter();
    doc.fullscreenElement = null;
    controller.onFullscreenChange();
    await controller.release();
    assert.deepEqual(calls, ['fullscreen', 'landscape', 'unlock']);
});

test('aviso de orientação só é necessário em retrato', () => {
    assert.equal(isPortraitViewport(390, 844), true);
    assert.equal(isPortraitViewport(844, 390), false);
    assert.equal(isPortraitViewport(0, 0), false);
});

test('integração preserva mouse, oferece orientação e aplica viewport seguro', () => {
    const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(game, /function beginTouchPlay\(\)[\s\S]*?touchImmersive\.enter\(\)/);
    assert.match(game, /Gire o celular para jogar na horizontal/);
    assert.match(game, /if \(!touchMode \|\| preferMouse\)/);
    assert.match(game, /await touchImmersive\.release\(\);\s*location\.reload\(\)/);
    assert.match(html, /viewport-fit=cover/);
});

test('controle adotado da resolução não é abandonado ao voltar para resolução nativa', async () => {
    const { calls, doc, controller } = setup();
    doc.fullscreenElement = doc.documentElement;
    controller.adoptFullscreen();
    await controller.enter();
    await controller.release();
    assert.deepEqual(calls, ['landscape', 'unlock', 'exit']);
});

test('saída manual durante bloqueio pendente desfaz o lock tardio', async () => {
    const { calls, doc, screen, controller } = setup();
    let finish;
    screen.orientation.lock = () => new Promise(resolve => { finish = resolve; });
    const entering = controller.enter();
    await Promise.resolve();
    doc.fullscreenElement = null;
    controller.onFullscreenChange();
    finish();
    assert.deepEqual(await entering, { fullscreen: false, locked: false });
    assert.deepEqual(calls, ['fullscreen', 'unlock']);
});

test('áreas seguras protegem controles destros e canhotos', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    assert.match(css, /body\.touch-mode #touch-stick \{[^}]*safe-area-inset-left/);
    assert.match(css, /body\.touch-mode\.touch-left #touch-stick \{[^}]*safe-area-inset-right/);
    assert.match(css, /body\.touch-mode #hud-bottom \{[^}]*safe-area-inset-bottom/);
});
