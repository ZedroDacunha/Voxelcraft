import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    AUDIO_OPTION_CONTROLS, CONTROL_OPTION_CONTROLS, GRAPHICS_OPTION_CONTROLS,
    OPTION_CONTROLS, OPTION_SCREENS, TOUCH_OPTION_CONTROLS,
} from '../world-options-view.js';
import { GAME_SETTING_FIELDS } from '../world-game-settings.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const view = readFileSync(new URL('../world-options-view.js', import.meta.url), 'utf8');
const dialog = html.slice(html.indexOf('<dialog id="options-dialog"'), html.indexOf('id="world-dialog"'));

// Recorta o bloco do `<button>` de um id (do `<button` anterior até o `</button>`).
function buttonBlock(id) {
    const at = dialog.indexOf(`id="${id}"`);
    assert.ok(at > 0, `#${id} ausente no index.html`);
    const start = dialog.lastIndexOf('<button', at);
    return dialog.slice(start, dialog.indexOf('</button>', start));
}

// Recorta a grade de uma tela pelo id.
function gridBlock(grid) {
    const at = dialog.indexOf(`id="${grid}"`);
    assert.ok(at > 0, `#${grid} ausente no index.html`);
    const start = dialog.lastIndexOf('<div', at);
    const end = dialog.indexOf('</div>', dialog.indexOf('<details', start) > 0 ? dialog.indexOf('<details', start) : start);
    return dialog.slice(start, end);
}

const screenOf = key => OPTION_SCREENS.find(screen => screen.key === key);
const categories = OPTION_SCREENS.filter(screen => screen.parent === 'main');

// --- a lista de categorias ----------------------------------------------

test('a janela abre com três categorias: Áudio, Gráficos e Controles', () => {
    assert.deepEqual(categories.map(screen => screen.title), ['Áudio', 'Gráficos', 'Controles']);
    assert.deepEqual(categories.map(screen => screen.open), ['opt-open-audio', 'opt-open-graphics', 'opt-open-controls']);
    // e o título da tela de entrada continua "Opções"
    assert.equal(screenOf('main').title, 'Opções');
    assert.match(dialog, /<h2 id="options-title">Opções<\/h2>/);
});

test('cada categoria é um botão de navegação, só com o nome', () => {
    for (const screen of categories) {
        const block = buttonBlock(screen.open);
        assert.match(block, /class="classic-btn option-btn"/, `#${screen.open}: padrão do menu`);
        assert.ok(block.includes(`<span class="option-name">${screen.title}</span>`), `#${screen.open}: nome`);
        // sem valor, sem resumo e sem trilho: não é barra, é porta
        assert.doesNotMatch(block, /option-value|option-summary|option-track|option-knob/);
        // acessível: o botão diz que abre uma tela e qual grade ele controla
        assert.match(block, /aria-expanded="false"/);
        assert.ok(block.includes(`aria-controls="${screen.grid}"`), `#${screen.open}: aria-controls`);
        assert.ok(block.includes(`aria-label="${screen.title}"`), `#${screen.open}: aria-label`);
    }
});

// --- as grades ----------------------------------------------------------

test('cada categoria tem a própria grade, escondida até ser aberta', () => {
    const mainGrid = dialog.lastIndexOf('<div', dialog.indexOf('id="options-main-grid"'));
    assert.doesNotMatch(dialog.slice(mainGrid, dialog.indexOf('>', mainGrid)), /hidden/, 'a lista abre visível');
    for (const screen of OPTION_SCREENS.filter(s => s.key !== 'main')) {
        const at = dialog.lastIndexOf('<div', dialog.indexOf(`id="${screen.grid}"`));
        assert.match(dialog.slice(at, dialog.indexOf('>', at)), /hidden/, `#${screen.grid}: começa escondida`);
    }
});

test('as linhas de valor ficam na categoria certa', () => {
    assert.deepEqual(AUDIO_OPTION_CONTROLS.map(row => row.key), ['volume']);
    assert.deepEqual(GRAPHICS_OPTION_CONTROLS.map(row => row.key), ['graphics', 'fov', 'renderDistance']);
    assert.deepEqual(CONTROL_OPTION_CONTROLS.map(row => row.key), ['sensitivity']);
    assert.deepEqual(TOUCH_OPTION_CONTROLS.map(row => row.key),
        ['touchSensitivity', 'touchLayout', 'touchButtonSize', 'touchVibration']);
    // toda linha é um campo de verdade e aparece no HTML dentro da grade da tela
    for (const screen of OPTION_SCREENS.filter(s => s.controls)) {
        const grid = gridBlock(screen.grid);
        for (const { button, output, key } of screen.controls) {
            assert.ok(GAME_SETTING_FIELDS[key], `${key}: campo desconhecido`);
            assert.ok(grid.includes(`id="${button}"`), `#${button} fora de #${screen.grid}`);
            assert.ok(grid.includes(`id="${output}"`), `#${output} fora de #${screen.grid}`);
        }
    }
});

test('o toque mora dentro de Controles, um nível abaixo', () => {
    const touch = screenOf('touch');
    assert.equal(touch.parent, 'controls', 'Voltar do toque cai em Controles');
    assert.equal(screenOf('controls').parent, 'main');
    // a linha "Controles de toque" está na grade de Controles
    assert.ok(gridBlock('options-controls-grid').includes('id="opt-touch-open"'));
    // essa é a única linha de navegação que mostra como está (mão e tamanho)
    const block = buttonBlock('opt-touch-open');
    assert.match(block, /<span class="option-summary" id="opt-touch-summary">Destro · 100%<\/span>/);
    assert.ok(block.includes('aria-controls="options-touch-grid"'));
});

test('só as linhas de valor mostram valor; o resumo é do botão de toque', () => {
    assert.equal((dialog.match(/class="option-value"/g) ?? []).length, OPTION_CONTROLS.length,
        'um valor por linha de barra/lista');
    assert.equal((dialog.match(/class="option-summary"/g) ?? []).length, 1,
        'só o botão de toque resume');
    assert.equal((dialog.match(/class="option-track"/g) ?? []).length,
        OPTION_CONTROLS.filter(row => !GAME_SETTING_FIELDS[row.key].choices).length);
});

// --- a troca de telas ---------------------------------------------------

test('a troca de tela é no lugar: uma grade, um título, um Voltar', () => {
    assert.match(view, /const grids = new Map\(OPTION_SCREENS\.map\(\(\{ key, grid \}\) => \[key, dialog\.querySelector\(`#\$\{grid\}`\)\]\)\);/);
    assert.match(view, /function showScreen\(next = 'main', \{ focus = true \} = \{\}\) \{/);
    assert.match(view, /const target = grids\.get\(next\) \? next : 'main';/);
    assert.match(view, /if \(grid\) grid\.hidden = key !== target;/);
    assert.match(view, /if \(title\) title\.textContent = titles\.get\(target\) \?\? 'Opções';/);
    assert.match(view, /if \(backButton\) backButton\.hidden = target === 'main';/);
    // continua uma janela só: a grade nova entra no lugar da anterior
    assert.doesNotMatch(view, /showModal|new .*Dialog|insertAdjacentHTML/, 'nada de segunda janela');
});

test('Voltar sobe um nível e devolve o foco ao botão que abriu', () => {
    assert.match(view, /function goBack\(\) \{/);
    assert.match(view, /const left = screen;/);
    assert.match(view, /showScreen\(parents\.get\(left\) \?\? 'main', \{ focus: false \}\);/);
    assert.match(view, /openers\.get\(left\)\?\.focus\?\.\(\);/);
    // abrir foca a primeira linha da categoria
    assert.match(view, /grids\.get\(target\)\?\.querySelector\('button'\)\?\.focus\?\.\(\);/);
});

test('fechar e reabrir sempre volta para a lista de categorias', () => {
    assert.match(view, /dialog\.addEventListener\('close', \(\) => showScreen\('main', \{ focus: false \}\)\);/);
    assert.match(view, /refresh: \(\) => \{\n {12}current = loadGameSettings\(\);\n {12}render\(current\);\n {12}showScreen\('main', \{ focus: false \}\);/);
    // sem roubar o foco de quem estava atrás do diálogo
    assert.doesNotMatch(view, /close', \(\) => \{[^}]*focus/);
});

test('a lista de teclas é da categoria Controles', () => {
    assert.equal(screenOf('controls').keys, true);
    assert.match(view, /const keysScreen = OPTION_SCREENS\.find\(screen => screen\.keys\)\?\.key;/);
    assert.match(view, /if \(controlsDetails\) controlsDetails\.hidden = target !== keysScreen;/);
    // e ela continua existindo, recolhida, dentro do diálogo
    assert.match(dialog, /<details class="options-controls">/);
});

test('"Editar posições" só aparece na tela de toque, dentro do mundo', () => {
    assert.match(view, /if \(editButton\) editButton\.hidden = target !== 'touch' \|\| !canEditPositions\(\);/);
});

test('as grades somem de verdade quando escondidas', () => {
    // display:grid da classe ganharia do [hidden] do navegador
    assert.match(readFileSync(new URL('../styles.css', import.meta.url), 'utf8'), /\.options-grid\[hidden\] \{ display: none; \}/);
});

// --- o resto do diálogo continua igual --------------------------------

test('Concluído e Restaurar padrões continuam em todas as telas', () => {
    const actions = dialog.slice(dialog.indexOf('class="world-dialog-actions"'));
    assert.match(actions, /id="btn-options-reset">Restaurar padrões</);
    assert.match(actions, /id="btn-options-back" hidden>Voltar</, 'Voltar é o único que entra e sai');
    assert.match(actions, /value="close"/);
    // Restaurar padrões não muda de tela nem esconde o botão
    assert.match(view, /#btn-options-reset'\)\?\.addEventListener\('click'/);
    assert.doesNotMatch(view, /#btn-options-reset'\)\?\.addEventListener\('click', \(\) => \{[^}]*showScreen/);
});
