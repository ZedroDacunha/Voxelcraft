import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { pauseMenuDisplay, shouldShowPauseMenu } from '../game-pause-menu.js';
import { OPTION_CONTROLS } from '../world-options-view.js';

// todas as linhas de valor do diálogo (a lista de categorias só tem navegação)
const ALL_CONTROLS = OPTION_CONTROLS;
import { GAME_SETTING_FIELDS } from '../world-game-settings.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const gameSource = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const viewSource = readFileSync(new URL('../world-options-view.js', import.meta.url), 'utf8');

// Recorta um bloco do HTML pelo id, para não confundir com o resto da página.
function blockAfter(id, length = 2200) {
    const start = html.indexOf(`id="${id}"`);
    assert.ok(start >= 0, `#${id} ausente no index.html`);
    return html.slice(start, start + length);
}

test('ESC abre um menu de pausa de verdade, no padrão de botões do jogo', () => {
    const panel = blockAfter('menu');
    assert.match(panel, /class="pause-card"/, 'o menu de pausa tem cartão próprio');
    assert.match(panel, /<h1>Jogo pausado<\/h1>/);
    for (const id of ['btn-play', 'btn-menu-options', 'btn-worlds']) {
        assert.ok(panel.includes(`id="${id}"`), `#${id} ausente no menu de pausa`);
    }
    assert.match(panel, /id="btn-play"[^>]*class="classic-btn|class="classic-btn[^"]*"[^>]*id="btn-play"|class="classic-btn classic-btn-wide" id="btn-play"/);
    assert.match(panel, /class="classic-btn classic-btn-wide" id="btn-menu-options"/);
    assert.match(panel, /class="classic-btn classic-btn-wide" id="btn-worlds"/);
    assert.match(panel, /Voltar ao jogo/);
    assert.match(panel, /Opções/);
    assert.match(panel, /Salvar e sair para os mundos/);
});

test('o texto solto de antes saiu do menu de pausa', () => {
    const panel = blockAfter('menu');
    assert.doesNotMatch(panel, /Parte 11/);
    assert.doesNotMatch(panel, /Clique para Jogar/);
    // as dicas de teclado continuam, mas recolhidas
    assert.match(panel, /<details class="pause-controls">/);
});

test('o menu de pausa centraliza o cartão e não perde o aviso de toque', () => {
    assert.equal(pauseMenuDisplay({}), 'grid');
    assert.equal(shouldShowPauseMenu({}), true);
    assert.match(styles, /\.pause-card\s*\{[^}]*border:\s*2px solid/);
    assert.match(styles, /\.pause-card\s*\{[^}]*border-radius:\s*0|\.pause-card\s*\{[^}]*box-shadow/);
    assert.ok(html.includes('id="menu-touch-hint"'), 'o aviso dos controles de toque continua');
});

test('a tela de opções abre do menu de pausa', () => {
    assert.match(gameSource, /getElementById\('btn-menu-options'\)\?\.addEventListener\('click'/);
    assert.match(gameSource, /optionsDialog\.showModal\(\)/);
    assert.match(html, /<dialog id="options-dialog"/);
});

test('as opções do jogo são as mesmas do menu (uma tela só)', () => {
    const dialog = html.slice(html.indexOf('<dialog id="options-dialog"'), html.indexOf('id="world-dialog"'));
    for (const { button, output } of ALL_CONTROLS) {
        assert.ok(dialog.includes(`id="${button}"`), `#${button} fora do diálogo de opções`);
        assert.ok(dialog.includes(`id="${output}"`), `#${output} fora do diálogo de opções`);
    }
    // Um botão sem type dentro do form method="dialog" fecharia a tela ao clicar.
    const buttons = dialog.match(/<button[^>]*>/g) ?? [];
    assert.ok(buttons.length >= ALL_CONTROLS.length + 2, 'faltam botões no diálogo');
    for (const button of buttons) {
        assert.match(button, /type="(button|submit)"/, `botão sem type: ${button}`);
    }
});

test('opções de faixa são barras: trilho, cursor e valor no meio', () => {
    const dialog = html.slice(html.indexOf('<dialog id="options-dialog"'), html.indexOf('id="world-dialog"'));
    // barra = faixa numérica ou lista com `slider` (a resolução é uma escada)
    const sliders = ALL_CONTROLS.filter(row => !GAME_SETTING_FIELDS[row.key].choices
        || GAME_SETTING_FIELDS[row.key].slider === true);

    assert.equal((dialog.match(/class="classic-btn option-btn option-slider"/g) ?? []).length, sliders.length);
    assert.equal((dialog.match(/class="option-track"/g) ?? []).length, sliders.length, 'um trilho por barra');
    assert.equal((dialog.match(/class="option-knob"/g) ?? []).length, sliders.length, 'um cursor por barra');
    assert.equal((dialog.match(/class="option-value"/g) ?? []).length, ALL_CONTROLS.length, 'toda opção mostra o valor');

    // o trilho é desenho, não conteúdo: fica fora do leitor de tela
    for (const track of dialog.match(/<span class="option-track"[^>]*>/g) ?? []) {
        assert.match(track, /aria-hidden="true"/);
    }
    assert.match(viewSource, /setAttribute\('role', 'slider'\)/);
    assert.match(viewSource, /aria-valuetext/);
    assert.match(viewSource, /--option-fill/);
});

test('gráficos é botão de clique, sem trilho nem cursor', () => {
    const dialog = html.slice(html.indexOf('<dialog id="options-dialog"'), html.indexOf('id="world-dialog"'));
    const graphicsStart = dialog.lastIndexOf('<button', dialog.indexOf('id="opt-graphics"'));
    const graphics = dialog.slice(graphicsStart, dialog.indexOf('</button>', graphicsStart));
    assert.match(graphics, /class="classic-btn option-btn"/, 'sem a classe de barra');
    assert.doesNotMatch(graphics, /option-track|option-knob/);

    // o clique anda um modo; o role de slider é só para os campos de faixa
    assert.match(viewSource, /const slider = !field\.choices/);
    assert.match(viewSource, /if \(slider\) \{[\s\S]*setAttribute\('role', 'slider'\)/);
    assert.match(viewSource, /buttonEl\.addEventListener\('click', \(\) => \{\s*apply\(key, stepSetting\(key, current\[key\], 1\)\)/);
});

test('o rótulo de cada controle bate com o texto da tela', () => {
    const dialog = html.slice(html.indexOf('<dialog id="options-dialog"'), html.indexOf('id="world-dialog"'));
    for (const { button, label } of ALL_CONTROLS) {
        const start = dialog.indexOf(`id="${button}"`);
        assert.ok(start > 0, `#${button} ausente`);
        const block = dialog.slice(start, dialog.indexOf('</button>', start));
        assert.match(block, new RegExp(`aria-label="${label}"`), `#${button}: aria-label deveria ser "${label}"`);
        assert.ok(block.includes(`<span class="option-name">${label}</span>`), `#${button}: nome na tela difere de "${label}"`);
    }
});

test('a tela de opções tem só o título, sem texto de explicação', () => {
    const dialog = html.slice(html.indexOf('<dialog id="options-dialog"'), html.indexOf('id="world-dialog"'));
    assert.match(dialog, /<h2 id="options-title">Opções<\/h2>/);
    assert.doesNotMatch(dialog, /options-hint/, 'sem parágrafo de instruções embaixo do título');
    // entre o topo do painel e a grade não há nada além do título
    const beforeGrid = dialog.slice(0, dialog.indexOf('class="options-grid"'));
    assert.equal((beforeGrid.match(/<p[\s>]/g) ?? []).length, 0, 'nada de texto solto embaixo do título');
});

test('abrir as opções esconde o cartão de pausa', () => {
    // Antes as duas janelas ficavam uma em cima da outra (o cartão aparecendo
    // através do painel translúcido).
    assert.match(gameSource, /document\.body\.classList\.add\('options-open'\)/);
    assert.match(gameSource, /optionsDialog\?\.addEventListener\('close', \(\) => \{\s*document\.body\.classList\.remove\('options-open'\)/);
    assert.match(styles, /body\.options-open \.pause-card \{\s*display:\s*none/);
});

test('mudar a distância de render avisa na hora, em vez de explicar sempre', () => {
    const start = gameSource.indexOf('function applyGameSettings');
    const body = gameSource.slice(start, gameSource.indexOf('onGameSettingsChange(settings =>', start));
    assert.match(body, /settings\.renderDistance !== appliedRenderDistance/);
    assert.match(body, /showToast\('Distância de render vale ao entrar no próximo mundo'\)/);
    assert.match(body, /if \(!quiet\)/, 'o aviso do boot não aparece');
});

test('o jogo aplica as opções ao vivo, menos a distância de render', () => {
    const start = gameSource.indexOf('function applyGameSettings');
    assert.ok(start > 0, 'falta a aplicação das opções');
    const body = gameSource.slice(start, gameSource.indexOf('onGameSettingsChange(settings =>', start));

    assert.match(body, /LOOK_SENSITIVITY = settings\.sensitivity/);
    assert.match(body, /GAME_SETTINGS\.fov = settings\.fov/);
    assert.match(body, /audio\.setVolume\?\.\(settings\.volume\)/);
    assert.match(body, /gfx\.setMode\(mode, \{ quiet \}\)/);
    assert.doesNotMatch(body, /RENDER_DISTANCE/, 'distância de render não muda com o mundo rodando');
});

test('ao entrar no mundo, a qualidade salva é aplicada sem aviso', () => {
    assert.match(gameSource, /applyGameSettings\(GAME_SETTINGS, \{ quiet: true \}\)/);
    assert.match(gameSource, /onGameSettingsChange\(settings => applyGameSettings\(settings\)\)/);
    assert.match(viewSource, /notifyGameSettingsChange\(current\)/);
});

test('a qualidade gráfica da tela de opções é a mesma do F4', () => {
    assert.match(gameSource, /const QUALITY_FROM_SETTING = \{ auto: 'auto', max: 'max', 0\.75: 0\.75, 0\.5: 0\.5 \}/);
    assert.match(gameSource, /const cycleQuality = \(\) => gfx\.cycle\(\)/);
});

test('a grade de opções vira uma coluna no celular', () => {
    assert.match(styles, /\.options-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
    assert.match(styles, /@media \(max-width: 560px\)\s*\{\s*\.options-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
    assert.match(styles, /\.option-btn\s*\{[^}]*display: flex/);
    assert.match(styles, /\.option-track\s*\{[^}]*position: absolute/);
    assert.match(styles, /\.option-knob\s*\{[^}]*left:\s*var\(--option-fill/, 'o cursor segue o valor');
});

// ------------------------------------------------ fundo borrado e escala

test('a pausa mostra o mundo de verdade, borrado, como no Minecraft', () => {
    // O borrão é do que já está pintado embaixo: o canvas do jogo continua
    // atrás, então a pausa é "de onde parou", não uma imagem fixa.
    const menuRule = styles.match(/#menu\s*\{[^}]*\}/)[0];
    assert.match(menuRule, /backdrop-filter:\s*blur\(/, 'falta o borrão do #menu');
    assert.match(menuRule, /-webkit-backdrop-filter:\s*blur\(/, 'Safari precisa do prefixo');
    assert.match(menuRule, /rgba\(0,\s*0,\s*0,\s*\.?4/, 'e uma película escura por cima');

    // os dois diálogos (opções, criar mundo) borram o que está atrás também
    assert.match(styles, /\.world-dialog::backdrop\s*\{[^}]*backdrop-filter:\s*blur\(/);
});

test('pausado, o HUD sai da frente e a mão não aparece no borrão', () => {
    assert.match(styles, /body\.is-paused #hud-bottom[^{]*\{\s*display:\s*none/);
    assert.match(styles, /body\.is-paused #crosshair/);
    assert.match(gameSource, /document\.body\.classList\.toggle\('is-paused', pauseMenuShown\)/);
    // Com o menu aberto a mão some; dormindo, ela também (a tela está preta).
    assert.match(gameSource, /if \(!pauseMenuShown && !sleep\.active\) renderer\.render\(handScene, handCamera\)/,
        'a mão em primeira pessoa não pode aparecer no fundo do menu');
    assert.match(gameSource, /pauseMenuShown = shouldShowPauseMenu\(state\)/);
});

test('a interface dos menus cresce com a resolução (escala de GUI)', () => {
    assert.match(styles, /--ui-scale:\s*1/);
    const breakpoints = styles.match(/@media \(min-width: \d+px\) and \(min-height: \d+px\)/g) ?? [];
    assert.ok(breakpoints.length >= 2, 'a escala precisa de degraus para telas grandes');
    assert.match(styles, /--ui-scale:\s*2;/, 'e chegar ao dobro numa tela bem grande');

    // menus medidos em `em`: o tamanho da fonte manda em tudo
    assert.match(styles, /#menu \{[^}]*font-size:\s*calc\(15px \* var\(--ui-scale\)\)/);
    assert.match(styles, /\.options-dialog \{[^}]*font-size:\s*calc\(15px \* var\(--ui-scale\)\)/);
    assert.match(styles, /\.pause-card \{[^}]*width:\s*min\(26em/);
    assert.match(styles, /\.options-dialog \{[^}]*width:\s*min\(44em/);
});

test('a tela de opções é larga, translúcida e com o Concluído no meio', () => {
    const dialogRule = styles.match(/\.options-dialog \{[^}]*width:\s*min\(44em[^}]*\}/)[0];
    assert.match(dialogRule, /background:\s*rgba\(/, 'deixa o mundo borrado aparecer');
    assert.match(dialogRule, /text-align:\s*center/);
    assert.match(styles, /\.options-dialog \.world-dialog-actions \{\s*justify-content:\s*center/);
    assert.match(styles, /\.options-dialog \[value="close"\] \{\s*min-width:/);

    // sem o "CONFIGURAÇÃO" acima do título: no original o título fica sozinho
    const dialog = html.slice(html.indexOf('<dialog id="options-dialog"'), html.indexOf('id="world-dialog"'));
    assert.doesNotMatch(dialog, /world-menu-eyebrow/);
});
