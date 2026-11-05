import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { RESOLUTION_CONFIRM_MS } from '../world-options-view.js';
import { renderTarget } from '../world-render-resolution.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('../world-options-view.js', import.meta.url), 'utf8');
const dialog = html.slice(html.indexOf('<dialog id="options-dialog"'), html.indexOf('id="world-dialog"'));

// Corpo de uma função do game.js (do `function nome(` até a próxima `function`).
function sliceFn(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start > 0, `função ${name} não encontrada`);
    const next = source.indexOf('\nfunction ', start + 1);
    return source.slice(start, next > 0 ? next : undefined);
}

// --- o aviso que ficava escondido ---------------------------------------

test('com as Opções abertas o aviso aparece dentro da janela', () => {
    const body = sliceFn(game, 'showToast');
    assert.match(body, /function showToast\(text, ms = 2000\)/);
    assert.match(body, /const status = document\.getElementById\('options-status'\);/);
    // o <dialog> modal fica na top layer: o #toast apareceria atrás dele
    assert.match(body, /if \(!document\.getElementById\('options-dialog'\)\?\.open\) \{\n {8}status\.textContent = '';\n {8}return;\n {4}\}/);
    assert.match(body, /status\.textContent = text;/);
    assert.match(body, /optionsStatusTimer = setTimeout\(\(\) => \{ status\.textContent = ''; \}, Math\.max\(ms, 2600\)\);/);
    // e o diálogo tem a linha onde o texto cai
    assert.match(dialog, /<p id="options-status" class="options-status" role="status" aria-live="polite"><\/p>/);
});

test('a linha de status não ocupa espaço quando está vazia', () => {
    assert.match(css, /\.options-status:empty \{ display: none; \}/);
    assert.match(css, /\.options-dialog \.options-status \{[^}]*color: #fff/);
});

// --- a pergunta "Manter / Reverter" -------------------------------------

test('a confirmação é um painel no padrão do menu, com contagem', () => {
    assert.equal(RESOLUTION_CONFIRM_MS, 10000, 'dez segundos para decidir');
    const start = dialog.lastIndexOf('<div', dialog.indexOf('id="options-confirm"'));
    const block = dialog.slice(start, dialog.indexOf('world-dialog-actions'));
    assert.match(block, /role="group" aria-labelledby="options-confirm-text"/);
    assert.match(block, /<span id="options-confirm-text" role="status">/);
    // a contagem é enfeite: quem ouve recebe só a pergunta
    assert.match(block, /<span class="options-confirm-count" id="options-confirm-count" aria-hidden="true">10<\/span>/);
    // os dois botões são do padrão cinza do menu
    assert.match(block, /class="classic-btn" type="button" id="btn-resolution-keep">Manter</);
    assert.match(block, /class="classic-btn" type="button" id="btn-resolution-revert">Reverter</);
    // sem trilho nem cursor: não são barras
    assert.doesNotMatch(block, /option-track|option-knob/);
    // começa escondido e o CSS respeita o hidden
    assert.match(block, /<div class="options-confirm" id="options-confirm"[^>]*hidden>/);
    assert.match(css, /\.options-confirm\[hidden\] \{ display: none; \}/);
    assert.match(css, /\.options-confirm \{[^}]*border: 2px solid #171717/);
});

test('só resolução fixa pede confirmação', () => {
    assert.match(view, /export const RESOLUTION_CONFIRM_MS = 10000;/);
    assert.match(view, /import \{ resolutionSize \} from '\.\/world-render-resolution\.js';/);
    assert.match(view, /if \(!confirmPanel \|\| !resolutionSize\(current\.resolution\)\) \{/);
    // e "Janela" (sem tamanho) nunca abre a pergunta
    assert.match(view, /if \(previous === undefined \|\| previous === current\.resolution \|\| !resolutionSize\(current\.resolution\)\) \{/);
});

test('a contagem volta sozinha para a resolução anterior', () => {
    assert.match(view, /let left = Math\.round\(RESOLUTION_CONFIRM_MS \/ 1000\);/);
    assert.match(view, /confirmTimer = setTimeout\(revertResolution, RESOLUTION_CONFIRM_MS\);/);
    const revert = view.slice(view.indexOf('function revertResolution()'), view.indexOf('function askResolutionConfirm('));
    assert.match(revert, /hideResolutionConfirm\(\);/);
    assert.match(revert, /reverting = true;\n {8}apply\('resolution', previous\);\n {8}reverting = false;/);
    // reverter não pode abrir uma pergunta nova
    assert.match(view, /function settleResolution\(previous\) \{\n {8}if \(reverting\) return;/);
});

test('a pergunta sai ao soltar a barra, não a cada degrau do arrasto', () => {
    // durante o arrasto só aplica; a pergunta vem no pointerup/pointercancel
    assert.match(view, /if \(isResolution\) pointerStart = current\[key\];/);
    assert.match(view, /buttonEl\.addEventListener\('pointerup', settle\);/);
    assert.match(view, /buttonEl\.addEventListener\('pointercancel', settle\);/);
    assert.doesNotMatch(view, /pointermove', \(event\) => \{\n[^}]*settleResolution/);
    // no teclado não existe "soltar": pergunta depois de cada mudança
    assert.match(view, /const before = current\[key\];/);
    assert.match(view, /if \(isResolution\) settleResolution\(before\);/);
});

test('Manter fecha a pergunta; fechar a janela mantém a escolha', () => {
    const keep = view.slice(view.indexOf("keepButton?.addEventListener"), view.indexOf("revertButton?.addEventListener"));
    assert.match(keep, /hideResolutionConfirm\(\);/);
    assert.match(keep, /resolutionButton\(\)\?\.focus\?\.\(\);/);
    // fechar as Opções é decisão do jogador: some com a pergunta, sem reverter
    const close = view.slice(view.indexOf("dialog.addEventListener('close'"), view.indexOf('// Fecha a janela e pede ao jogo'));
    assert.match(close, /hideResolutionConfirm\(\);/);
    assert.doesNotMatch(close, /revertResolution/);
    // e "Restaurar padrões" também cancela a pergunta pendente
    const reset = view.slice(view.indexOf("#btn-options-reset"), view.indexOf('#btn-options-reset') + 400);
    assert.match(reset, /hideResolutionConfirm\(\);/);
});

test('a pergunta não deixa timers soltos', () => {
    const hide = view.slice(view.indexOf('function hideResolutionConfirm()'), view.indexOf('function revertResolution('));
    assert.match(hide, /clearTimeout\(confirmTimer\);/);
    assert.match(hide, /clearInterval\(confirmTick\);/);
    assert.match(hide, /confirmPrevious = null;/);
    assert.match(hide, /if \(confirmPanel\) confirmPanel\.hidden = true;/);
    // e a contagem para de correr quando chega a zero
    assert.match(view, /if \(left <= 0\) clearInterval\(confirmTick\);/);
});

// --- limites do aparelho ------------------------------------------------

test('resolução acima do que a GPU aceita é clampada mantendo a proporção', () => {
    const big = renderTarget('3840x2160', { limit: 2048 });
    assert.equal(big.clamped, true);
    assert.equal(big.width, 2048);
    assert.equal(big.height, 1152, '2048×2048 achataria o mundo');
    assert.equal(big.width / big.height, 3840 / 2160);

    const ok = renderTarget('1280x720', { limit: 4096 });
    assert.equal(ok.clamped, false);
    assert.deepEqual([ok.width, ok.height], [1280, 720]);

    // "Janela" nunca é clampada por aqui: quem manda é a tela
    assert.equal(renderTarget('auto', { width: 800, height: 600, scale: 1, limit: 64 }).clamped, false);
});

test('o jogo pergunta o teto à GPU e avisa o tamanho aplicado', () => {
    assert.match(sliceFn(game, 'deviceRenderLimit'), /renderer\?\.capabilities\?\.maxTextureSize/);
    assert.match(sliceFn(game, 'applyRenderResolution'), /limit: deviceRenderLimit\(\),/);
    const message = sliceFn(game, 'resolutionMessage');
    assert.match(message, /target\.clamped \? `Resolução: \$\{applied\} \(limite do aparelho\)`/);
});

test('redimensionar a janela não recria o buffer da resolução fixa', () => {
    assert.match(sliceFn(game, 'applyRenderResolution'), /function applyRenderResolution\(\{ buffer = true \} = \{\}\) \{/);
    assert.match(sliceFn(game, 'applyRenderResolution'), /if \(buffer\) renderer\.setSize\(target\.width, target\.height, false\);/);
    assert.match(game, /applyRenderResolution\(\{ buffer: false \}\);/);
});
