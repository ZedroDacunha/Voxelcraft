import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    GAME_SETTING_FIELDS, DEFAULT_GAME_SETTINGS, sanitizeGameSettings, formatSetting,
} from '../world-game-settings.js';
import {
    TOUCH_METRICS, TOUCH_MIN_SCALE, TOUCH_MAX_SCALE,
    clampTouchScale, touchLayoutState, touchStickRadius,
} from '../world-touch-layout.js';
import { OPTION_CONTROLS, TOUCH_OPTION_CONTROLS } from '../world-options-view.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('../world-options-view.js', import.meta.url), 'utf8');

const dialog = html.slice(html.indexOf('<dialog id="options-dialog"'), html.indexOf('id="world-dialog"'));

// --- preferências -------------------------------------------------------

test('as opções de toque nascem no destro e no tamanho de fábrica', () => {
    assert.equal(DEFAULT_GAME_SETTINGS.touchLayout, 'right');
    assert.equal(DEFAULT_GAME_SETTINGS.touchButtonSize, 1);
    assert.deepEqual([...GAME_SETTING_FIELDS.touchLayout.choices], ['right', 'left']);
    assert.equal(formatSetting('touchLayout', 'left'), 'Canhoto');
    assert.equal(formatSetting('touchLayout', 'right'), 'Destro');
    assert.equal(formatSetting('touchButtonSize', 1.2), '120%');
});

test('mão e tamanho sobrevivem a lixo no storage', () => {
    assert.equal(sanitizeGameSettings({ touchLayout: 'left' }).touchLayout, 'left');
    assert.equal(sanitizeGameSettings({ touchLayout: 'meio' }).touchLayout, 'right', 'modo desconhecido não entra');
    assert.equal(sanitizeGameSettings({ touchLayout: 3 }).touchLayout, 'right');
    // tamanho fora da faixa é preso nos limites e arredondado no passo
    assert.equal(sanitizeGameSettings({ touchButtonSize: 9 }).touchButtonSize, TOUCH_MAX_SCALE);
    assert.equal(sanitizeGameSettings({ touchButtonSize: 0 }).touchButtonSize, TOUCH_MIN_SCALE);
    assert.equal(sanitizeGameSettings({ touchButtonSize: 1.24 }).touchButtonSize, 1.2);
    assert.equal(sanitizeGameSettings({ touchButtonSize: NaN }).touchButtonSize, 1);
});

test('estado do layout traduz as preferências para o jogo', () => {
    assert.deepEqual(touchLayoutState({}), { layout: 'right', lefty: false, size: 1 });
    assert.deepEqual(touchLayoutState({ touchLayout: 'left', touchButtonSize: 1.3 }),
        { layout: 'left', lefty: true, size: 1.3 });
    // sem preferência válida, destro e tamanho 1 — nunca NaN
    assert.deepEqual(touchLayoutState(undefined), { layout: 'right', lefty: false, size: 1 });
    assert.deepEqual(touchLayoutState({ touchLayout: 'left', touchButtonSize: 'x' }),
        { layout: 'left', lefty: true, size: 1 });
});

test('a escala é presa na faixa do slider', () => {
    assert.equal(clampTouchScale(1), 1);
    assert.equal(clampTouchScale(0.2), TOUCH_MIN_SCALE);
    assert.equal(clampTouchScale(4), TOUCH_MAX_SCALE);
    assert.equal(clampTouchScale(undefined), 1);
    assert.equal(clampTouchScale('1.2'), 1.2);
    assert.equal(TOUCH_MIN_SCALE, GAME_SETTING_FIELDS.touchButtonSize.min);
    assert.equal(TOUCH_MAX_SCALE, GAME_SETTING_FIELDS.touchButtonSize.max);
});

test('o raio do joystick cresce junto com o tamanho escolhido', () => {
    // empurrar até o fim tem de ser o mesmo gesto proporcional no joystick
    // pequeno e no grande
    assert.equal(touchStickRadius(1), TOUCH_METRICS.stickRadius);
    assert.equal(touchStickRadius(1.4), TOUCH_METRICS.stickRadius * 1.4);
    assert.equal(touchStickRadius(0.8), TOUCH_METRICS.stickRadius * 0.8);
    assert.equal(touchStickRadius(99), TOUCH_METRICS.stickRadius * TOUCH_MAX_SCALE);
    assert.equal(touchStickRadius('nada'), TOUCH_METRICS.stickRadius);
});

// --- tela de opções -----------------------------------------------------

test('a tela de toque é a mesma janela, com Voltar — nunca duas janelas', () => {
    assert.match(dialog, /<div class="options-grid" id="options-main-grid">/);
    const touchGrid = dialog.indexOf('<div class="options-grid" id="options-touch-grid" hidden>');
    assert.ok(touchGrid > 0, 'a sub-tela existe e começa escondida');
    // só uma <dialog> de opções, e a sub-tela mora dentro dela
    assert.equal((html.match(/<dialog[^>]*id="options-dialog"/g) ?? []).length, 1);
    assert.ok(html.indexOf('id="options-touch-grid"') < html.indexOf('</dialog>', html.indexOf('<dialog id="options-dialog"')));
    // o Voltar nasce escondido e vive nas ações do mesmo formulário
    const back = dialog.match(/<button[^>]*id="btn-options-back"[^>]*>/);
    assert.ok(back, 'botão Voltar ausente');
    assert.match(back[0], /type="button"/, 'sem type ele fecharia o diálogo');
    assert.match(back[0], /hidden/);
});

test('o botão de entrada mostra como estão os controles', () => {
    const entry = dialog.slice(dialog.indexOf('id="opt-touch-open"'), dialog.indexOf('</button>', dialog.indexOf('id="opt-touch-open"')));
    assert.match(entry, /aria-expanded="false"/);
    assert.match(entry, /aria-controls="options-touch-grid"/);
    assert.match(entry, /<span class="option-name">Controles de toque<\/span>/);
    assert.match(entry, /<span class="option-summary" id="opt-touch-summary">Destro · 100%<\/span>/);
    // é navegação, não barra: sem trilho nem cursor
    assert.doesNotMatch(entry, /option-track|option-knob/);
    assert.match(css, /\.option-value, \.option-summary \{ color: #fff; font-weight: 700; \}/);
});

test('as duas linhas de toque existem com nome e valor na tela', () => {
    for (const { button, output, label } of TOUCH_OPTION_CONTROLS) {
        const start = dialog.indexOf(`id="${button}"`);
        assert.ok(start > 0, `#${button} ausente`);
        const block = dialog.slice(start, dialog.indexOf('</button>', start));
        assert.match(block, new RegExp(`aria-label="${label}"`), `#${button}: aria-label`);
        assert.ok(block.includes(`<span class="option-name">${label}</span>`), `#${button}: nome na tela`);
        assert.ok(block.includes(`id="${output}"`), `#${button}: saída de valor`);
    }
    // mão é lista (clique alterna) e tamanho é barra (arrasta)
    const openTag = (id) => dialog.lastIndexOf('<button', dialog.indexOf(`id="${id}"`));
    const layout = dialog.slice(openTag('opt-touch-layout'), dialog.indexOf('</button>', openTag('opt-touch-layout')));
    const size = dialog.slice(openTag('opt-touch-size'), dialog.indexOf('</button>', openTag('opt-touch-size')));
    assert.doesNotMatch(layout, /option-slider|option-track/, 'Mão é botão de clique');
    assert.match(size, /class="classic-btn option-btn option-slider"/);
    assert.match(size, /<span class="option-track" aria-hidden="true">/);
});

test('a tela de toque troca a grade no lugar e volta ao fechar', () => {
    assert.match(view, /const rows = OPTION_SCREENS\.flatMap\(screen => buildRows\(screen\.controls\)\);/);
    assert.match(view, /function showScreen\(next = 'main', \{ focus = true \} = \{\}\) \{/);
    assert.match(view, /if \(grid\) grid\.hidden = key !== target;/, 'uma grade por vez');
    assert.match(view, /if \(controlsDetails\) controlsDetails\.hidden = target !== keysScreen;/, 'a lista de teclas é da categoria Controles');
    assert.match(view, /if \(title\) title\.textContent = titles\.get\(target\) \?\? 'Opções';/);
    assert.match(view, /if \(backButton\) backButton\.hidden = target === 'main';/);
    // fechar não rouba o foco de quem abriu as opções; voltar devolve ao botão que abriu
    assert.match(view, /openers\.get\(left\)\?\.focus\?\.\(\);/);
    assert.match(view, /opener\?\.setAttribute\('aria-expanded', String\(target === key\)\);/);
    assert.match(view, /opener\?\.addEventListener\('click', \(\) => showScreen\(key\)\);/);
    assert.match(view, /backButton\?\.addEventListener\('click', goBack\);/);
    // fechar e reabrir sempre cai na lista de categorias
    assert.match(view, /dialog\.addEventListener\('close', \(\) => showScreen\('main', \{ focus: false \}\)\);/);
    // e o resumo acompanha o que está salvo
    assert.match(view, /touchSummary\.textContent = `\$\{formatSetting\('touchLayout', settings\.touchLayout\)\} · \$\{formatSetting\('touchButtonSize', settings\.touchButtonSize\)\}`;/);
});

test('a sub-tela escondida não aparece por cima da grade', () => {
    // display:grid da classe ganharia do [hidden] do navegador
    assert.match(css, /\.options-grid\[hidden\] \{ display: none; \}/);
    assert.match(html, /<div class="options-grid" id="options-touch-grid" hidden>/);
});

test('o resumo do botão não é confundido com o valor de uma barra', () => {
    // "um .option-value por linha" é o que o teste do menu de pausa confere
    const values = (dialog.match(/class="option-value"/g) ?? []).length;
    const rows = OPTION_CONTROLS.length;
    assert.equal(values, rows, 'o resumo usa .option-summary, não .option-value');
});

// --- jogo e CSS ---------------------------------------------------------

test('o jogo aplica lado e tamanho, inclusive ao vivo no ESC', () => {
    assert.match(game, /import \{ touchLayoutState, touchStickRadius \} from '\.\/world-touch-layout\.js';/);
    assert.match(game, /document\.body\.classList\.toggle\('touch-left', state\.lefty\);/);
    assert.match(game, /document\.body\.style\.setProperty\('--touch-scale', String\(state\.size\)\);/);
    // applyGameSettings roda no começo e a cada mudança de opção
    assert.match(game, /applyTouchLayout\(settings\);/);
    assert.match(game, /applyGameSettings\(GAME_SETTINGS, \{ quiet: true \}\);/);
    assert.match(game, /onGameSettingsChange\(settings => applyGameSettings\(settings\)\);/);
    // o joystick usa o raio do tamanho escolhido, lido a cada movimento
    assert.match(game, /const radius = touchStickRadius\(touchScale\);/);
    assert.match(game, /const vector = stickVector\(dx, dy, radius\);/);
    assert.match(game, /translate\(\$\{\(vector\.x \* radius\)\.toFixed\(1\)\}px, \$\{\(vector\.y \* radius\)\.toFixed\(1\)\}px\)/);
});

test('canhoto espelha joystick, botões, topo e dica', () => {
    assert.match(css, /body\.touch-left #touch-stick \{ left: auto; right: 16px; \}/);
    assert.match(css, /body\.touch-left #touch-actions \{ right: auto; left: 14px; \}/);
    assert.match(css, /body\.touch-left #touch-top \{ right: auto; left: 14px; \}/);
    assert.match(css, /body\.touch-left #touch-hint \{ [^}]*text-align: right; \}/);
    // e inverte as colunas: Pular/Cavar ficam no lado do polegar, como no destro
    assert.match(css, /body\.touch-left #touch-actions \{ direction: rtl; \}/);
    // o destro é o desenho de fábrica: nada a fazer além de não ter a classe
    assert.match(game, /document\.body\.classList\.toggle\('touch-right', !state\.lefty\);/);
});

test('tudo do toque escala junto com --touch-scale', () => {
    // cada medida de referência do módulo aparece no CSS multiplicada pela escala
    for (const value of [TOUCH_METRICS.stick, TOUCH_METRICS.button, TOUCH_METRICS.topButton,
        TOUCH_METRICS.icon, TOUCH_METRICS.topIcon, TOUCH_METRICS.gap]) {
        assert.ok(css.includes(`calc(${value}px * var(--touch-scale, 1))`), `${value}px sem escala no CSS`);
    }
    // o CSS lê as medidas por variável, e a hotbar sobe pela altura real dos
    // botões (dois botões + o vão), não por um número fixo
    assert.match(css, /body\.touch-mode #hud-bottom \{ bottom: calc\(14px \+ 2 \* var\(--touch-btn-size, 64px\) \+ var\(--touch-gap-size, 10px\)\); \}/);
    assert.match(css, /--touch-btn-size: min\(calc\(64px \* var\(--touch-scale, 1\)\), 17vw\);/);
    assert.match(css, /\#touch-actions \{ position: absolute; right: 14px; bottom: 20px; display: grid;\n        grid-template-columns: repeat\(2, var\(--touch-btn-size, 64px\)\); gap: var\(--touch-gap-size, 10px\);/);
    // o botão do joystick acompanha o disco (mesma proporção de 56/132)
    assert.match(css, /calc\(var\(--touch-stick-size, 132px\) \* 0\.4242\)/);
});

test('no tamanho máximo os controles ainda cabem lado a lado', () => {
    // O slider vai até 140%, mas o CSS trava cada controle numa fatia da largura
    // (min(..., Nvw)). Em 320 px — o celular mais estreito que roda o jogo — o
    // joystick e o par de botões precisam caber sem se encostar.
    const caps = { stick: 34, buttons: 17 };
    for (const [name, vw] of Object.entries(caps)) {
        assert.ok(css.includes(`${vw}vw`), `falta a trava de ${vw}vw (${name})`);
    }
    const margin = 30;   // 16px do joystick + 14px dos botões
    const used = caps.stick + caps.buttons * 2 + margin / 3.2; // em vw de 320px
    assert.ok(used < 100, `controles ocupam ${used.toFixed(0)}% da largura`);
    // e no tamanho de fábrica nada é cortado: a trava só age quando precisa
    assert.ok(TOUCH_METRICS.button < 390 * caps.buttons / 100, 'botão de fábrica não é apertado em 390px');
});
