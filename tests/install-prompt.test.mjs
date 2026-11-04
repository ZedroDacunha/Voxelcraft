import test from 'node:test';
import assert from 'node:assert/strict';

import {
    INSTALL_LABEL,
    INSTALL_UNAVAILABLE_HINT,
    IOS_INSTALL_HINT,
    createInstallPrompt,
    installHintFor,
} from '../world-install-prompt.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const CHROME_DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// Evento falso do Chrome: `prompt()` e `userChoice` como o navegador entrega.
function fakeEvent(outcome = 'accepted', { rejects = false } = {}) {
    const event = {
        preventDefault() {},
        promptCalls: 0,
        prompt() { this.promptCalls++; },
        userChoice: rejects ? Promise.reject(new Error('sem convite')) : Promise.resolve({ outcome }),
    };
    return event;
}

// ------------------------------------------------ quando o botão aparece

test('sem convite do navegador e sem instrução, não há botão', () => {
    const prompt = createInstallPrompt({ userAgent: CHROME_DESKTOP });
    assert.deepEqual(prompt.view, { visible: false, mode: 'hidden', label: '', hint: '' });
    assert.equal(prompt.hasPrompt, false);
});

test('com o evento do Chrome, o botão aparece e abre o convite', () => {
    const prompt = createInstallPrompt({ userAgent: CHROME_DESKTOP });
    assert.equal(prompt.capturePromptEvent(fakeEvent()), true);

    const view = prompt.view;
    assert.equal(view.visible, true);
    assert.equal(view.mode, 'prompt');
    assert.equal(view.label, INSTALL_LABEL);
    assert.equal(view.hint, '', 'com convite não precisa de instrução');
    assert.equal(prompt.hasPrompt, true);
});

test('no iPhone o botão aparece explicando o caminho manual', () => {
    const prompt = createInstallPrompt({ userAgent: IPHONE });
    const view = prompt.view;
    assert.equal(view.visible, true);
    assert.equal(view.mode, 'hint', 'o Safari nunca dá o evento');
    assert.equal(view.label, INSTALL_LABEL);
    assert.equal(view.hint, IOS_INSTALL_HINT);
    assert.match(view.hint, /Adicionar à Tela de Início/);
    assert.equal(prompt.hasPrompt, false);
});

test('já instalado (janela própria), nada aparece mesmo com evento', () => {
    const prompt = createInstallPrompt({ userAgent: IPHONE, standalone: true });
    assert.equal(prompt.view.visible, false);
    assert.equal(prompt.capturePromptEvent(fakeEvent()), false, 'não guarda evento de app já instalado');
    assert.equal(prompt.view.visible, false);
});

test('instrução manual: iOS sim, desktop e Android sem evento não', () => {
    assert.equal(installHintFor({ userAgent: IPHONE }), IOS_INSTALL_HINT);
    assert.equal(installHintFor({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X)' }), IOS_INSTALL_HINT);
    assert.equal(installHintFor({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Mobile/15E148' }), IOS_INSTALL_HINT, 'iPadOS se diz Macintosh');
    assert.equal(installHintFor({ userAgent: CHROME_ANDROID }), null);
    assert.equal(installHintFor({ userAgent: CHROME_DESKTOP }), null);
    assert.equal(installHintFor({ userAgent: IPHONE, standalone: true }), null, 'instalado não precisa de instrução');
    assert.equal(installHintFor(), null, 'sem user-agent, sem palpite');
});

// ------------------------------------------------ clique

test('aceitar a instalação devolve accepted e gasta o evento', async () => {
    const prompt = createInstallPrompt({ userAgent: CHROME_ANDROID });
    const event = fakeEvent('accepted');
    prompt.capturePromptEvent(event);

    assert.equal(await prompt.prompt(), 'accepted');
    assert.equal(event.promptCalls, 1, 'chamou o convite do navegador uma vez');
    assert.equal(prompt.hasPrompt, false, 'o evento não serve para um segundo clique');
    assert.equal(prompt.view.visible, false, 'no Android, sem evento o botão some (sem instrução manual)');
});

test('recusar devolve dismissed e o botão também some por esta sessão', async () => {
    const prompt = createInstallPrompt({ userAgent: CHROME_ANDROID });
    prompt.capturePromptEvent(fakeEvent('dismissed'));

    assert.equal(await prompt.prompt(), 'dismissed');
    assert.equal(prompt.view.visible, false, 'insistir com o mesmo evento não é possível');
    assert.equal(await prompt.prompt(), 'unavailable', 'segundo clique sem evento');
});

test('sem evento, o clique não quebra: devolve unavailable', async () => {
    const prompt = createInstallPrompt({ userAgent: IPHONE });
    assert.equal(await prompt.prompt(), 'unavailable');
    assert.equal(prompt.view.visible, true, 'no iPhone a instrução continua à mão');
});

test('convite que estoura devolve unavailable em vez de explodir', async () => {
    const prompt = createInstallPrompt({ userAgent: CHROME_ANDROID });
    prompt.capturePromptEvent(fakeEvent('accepted', { rejects: true }));
    assert.equal(await prompt.prompt(), 'unavailable');
    assert.equal(prompt.hasPrompt, false);
});

test('evento malformado não entra e o segundo evento não sobrescreve o primeiro', () => {
    const prompt = createInstallPrompt({ userAgent: CHROME_DESKTOP });
    assert.equal(prompt.capturePromptEvent(null), false);
    assert.equal(prompt.capturePromptEvent({}), false, 'sem prompt() não serve');
    assert.equal(prompt.capturePromptEvent({ prompt: 'não é função' }), false);

    const first = fakeEvent();
    assert.equal(prompt.capturePromptEvent(first), true);
    assert.equal(prompt.capturePromptEvent(fakeEvent()), false, 'o primeiro evento continua valendo');
    assert.equal(prompt.hasPrompt, true);
});

test('appinstalled tira o botão de vez', async () => {
    const prompt = createInstallPrompt({ userAgent: CHROME_ANDROID });
    prompt.capturePromptEvent(fakeEvent());
    prompt.markInstalled();

    assert.equal(prompt.installed, true);
    assert.equal(prompt.view.visible, false);
    assert.equal(prompt.hasPrompt, false, 'e o evento pendente é descartado');
    assert.equal(await prompt.prompt(), 'unavailable');
    assert.equal(prompt.capturePromptEvent(fakeEvent()), false, 'nada reabre depois de instalado');
});

test('as mensagens são curtas e não prometem o que o navegador não faz', () => {
    assert.equal(INSTALL_LABEL, 'Instalar app');
    assert.ok(IOS_INSTALL_HINT.length < 120);
    assert.ok(INSTALL_UNAVAILABLE_HINT.length < 140);
    assert.match(INSTALL_UNAVAILABLE_HINT, /navegador/i);
});
