import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    RESOLUTION_AUTO, RESOLUTION_IDS, RESOLUTION_MODES,
    renderAspect, renderTarget, resolutionLabel, resolutionMode, resolutionSize,
} from '../world-render-resolution.js';
import {
    DEFAULT_GAME_SETTINGS, GAME_SETTING_FIELDS, formatSetting, sanitizeGameSettings,
    settingFraction, settingFromFraction, stepSetting,
} from '../world-game-settings.js';
import { GRAPHICS_OPTION_CONTROLS } from '../world-options-view.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const dialog = html.slice(html.indexOf('<dialog id="options-dialog"'), html.indexOf('id="world-dialog"'));

// Corpo de uma função do game.js (do `function nome(` até a próxima `function`).
function sliceFn(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start > 0, `função ${name} não encontrada`);
    const next = source.indexOf('\nfunction ', start + 1);
    return source.slice(start, next > 0 ? next : undefined);
}

// --- o catálogo ---------------------------------------------------------

test('a lista vai de 360p a 4K, da menor para a maior', () => {
    assert.ok(RESOLUTION_MODES.length >= 18, 'a lista precisa cobrir as resoluções comuns');
    assert.equal(RESOLUTION_IDS[0], RESOLUTION_AUTO, 'a primeira é a janela do navegador');
    assert.equal(new Set(RESOLUTION_IDS).size, RESOLUTION_IDS.length, 'sem resolução repetida');

    let previous = 0;
    for (const mode of RESOLUTION_MODES.slice(1)) {
        const pixels = mode.width * mode.height;
        assert.ok(pixels > previous, `${mode.id}: fora de ordem (${pixels} px)`);
        previous = pixels;
        // o id é o próprio tamanho: "1280x720" não pode mentir sobre a largura
        assert.equal(mode.id, `${mode.width}x${mode.height}`, `${mode.id}: id não bate com o tamanho`);
        assert.ok(mode.width > 0 && mode.height > 0);
    }
    // as que o jogador pediu explicitamente, e as pontas da escada
    for (const id of ['1920x1080', '1280x720', '2560x1440', '3840x2160', '640x360']) {
        assert.ok(RESOLUTION_IDS.includes(id), `falta ${id}`);
    }
});

test('o texto na tela mostra a resolução com ×', () => {
    assert.equal(resolutionLabel('1920x1080'), '1920×1080');
    assert.equal(resolutionLabel('640x360'), '640×360');
    assert.equal(resolutionLabel(RESOLUTION_AUTO), 'Janela (nativa)');
    // id desconhecido não quebra a tela: cai na janela
    assert.equal(resolutionLabel('999x1'), 'Janela (nativa)');
    assert.equal(resolutionMode('999x1').id, RESOLUTION_AUTO);
});

test('"Janela" não tem tamanho; as outras têm exatamente o escolhido', () => {
    assert.equal(resolutionSize(RESOLUTION_AUTO), null);
    assert.deepEqual(resolutionSize('1920x1080'), { width: 1920, height: 1080 });
    assert.deepEqual(resolutionSize('3440x1440'), { width: 3440, height: 1440 });
    assert.equal(resolutionSize('nada'), null);
});

// --- o que vai para o renderer -----------------------------------------

test('"Janela" desenha no tamanho da tela, com a escala de qualidade', () => {
    const target = renderTarget(RESOLUTION_AUTO, { width: 1440, height: 900, scale: 1.5 });
    assert.equal(target.auto, true);
    assert.equal(target.width, 1440);
    assert.equal(target.height, 900);
    assert.equal(target.pixelRatio, 1.5);
});

test('resolução fixa manda no buffer, e a escala automática não entra por cima', () => {
    const target = renderTarget('1920x1080', { width: 1440, height: 900, scale: 1.5 });
    assert.equal(target.auto, false);
    assert.equal(target.width, 1920);
    assert.equal(target.height, 1080);
    // escolher 1920×1080 e receber 2880×1620 por causa do pixelRatio seria mentira
    assert.equal(target.pixelRatio, 1);
    // e nada de valor estranho virar NaN
    const weird = renderTarget('1280x720', { width: 0, height: -5, scale: 0 });
    assert.equal(weird.pixelRatio, 1);
    assert.equal(weird.width, 1280);
});

test('a câmera usa a proporção do buffer, não a da janela', () => {
    assert.equal(renderAspect({ width: 1920, height: 1080 }), 1920 / 1080);
    assert.equal(renderAspect({ width: 1024, height: 768 }), 4 / 3);
    assert.equal(renderAspect({ width: 0, height: 0 }), 1);
    assert.equal(renderAspect(null), 1);
});

// --- a opção nas configurações -----------------------------------------

test('a resolução é um campo de lista com barra, 8% de fábrica', () => {
    const field = GAME_SETTING_FIELDS.resolution;
    assert.ok(field, 'campo resolution não existe');
    assert.equal(DEFAULT_GAME_SETTINGS.resolution, RESOLUTION_AUTO);
    assert.deepEqual([...field.choices], [...RESOLUTION_IDS], 'a lista da tela é a do módulo');
    assert.equal(field.slider, true, 'vinte resoluções pedem barra, não vinte cliques');
    assert.equal(formatSetting('resolution', '1280x720'), '1280×720');
    assert.equal(formatSetting('resolution'), 'Janela (nativa)');
});

test('valor desconhecido volta para "Janela"', () => {
    assert.equal(sanitizeGameSettings({ resolution: '1280x720' }).resolution, '1280x720');
    assert.equal(sanitizeGameSettings({ resolution: '1920x1080' }).resolution, '1920x1080');
    assert.equal(sanitizeGameSettings({ resolution: '999x1' }).resolution, RESOLUTION_AUTO);
    assert.equal(sanitizeGameSettings({ resolution: 1080 }).resolution, RESOLUTION_AUTO, 'número não é resolução');
    assert.equal(sanitizeGameSettings({}).resolution, RESOLUTION_AUTO);
});

test('a barra anda de degrau em degrau e para nas pontas', () => {
    const last = RESOLUTION_IDS[RESOLUTION_IDS.length - 1];
    assert.equal(settingFraction('resolution', RESOLUTION_AUTO), 0);
    assert.equal(settingFraction('resolution', last), 1);
    assert.equal(settingFromFraction('resolution', 0), RESOLUTION_AUTO);
    assert.equal(settingFromFraction('resolution', 1), last);
    // uma seta anda uma resolução
    assert.equal(stepSetting('resolution', RESOLUTION_AUTO, 1), RESOLUTION_IDS[1]);
    assert.equal(stepSetting('resolution', RESOLUTION_IDS[1], -1), RESOLUTION_AUTO);
    // e nas pontas não dá a volta (lista com barra para, como os números)
    assert.equal(stepSetting('resolution', RESOLUTION_AUTO, -1), RESOLUTION_AUTO);
    assert.equal(stepSetting('resolution', last, 1), last);
    // já uma lista de clique continua dando a volta
    assert.equal(stepSetting('graphics', '0.5', 1), 'auto', 'gráficos é clique, não barra');
});

// --- a linha na tela ----------------------------------------------------

test('a linha "Resolução" mora em Gráficos e é uma barra', () => {
    const row = GRAPHICS_OPTION_CONTROLS.find(control => control.key === 'resolution');
    assert.ok(row, 'campo resolution fora da categoria Gráficos');
    assert.equal(row.label, 'Resolução');
    assert.equal(row.button, 'opt-resolution');

    const start = dialog.lastIndexOf('<button', dialog.indexOf('id="opt-resolution"'));
    const block = dialog.slice(start, dialog.indexOf('</button>', start));
    assert.match(block, /class="classic-btn option-btn option-slider"/, 'é barra, não botão de clique');
    assert.match(block, /<span class="option-track" aria-hidden="true"><span class="option-knob"><\/span><\/span>/);
    assert.match(block, /aria-label="Resolução"/);
    assert.ok(block.includes('<span class="option-name">Resolução</span>'));
    assert.match(block, /<span class="option-value" id="opt-resolution-value">Janela \(nativa\)<\/span>/);
    // dentro da grade de Gráficos, não de outra categoria
    assert.ok(html.indexOf('id="options-graphics-grid"') < html.indexOf('id="opt-resolution"'));
});

// --- fiação no jogo ----------------------------------------------------

test('o jogo aplica a resolução no renderer, com o buffer do tamanho escolhido', () => {
    const body = sliceFn(game, 'applyRenderResolution');
    assert.match(body, /renderTarget\(resolutionMode, \{/);
    assert.match(body, /width: window\.innerWidth,/);
    assert.match(body, /scale: gfx\.scale,/);
    assert.match(body, /renderer\.setPixelRatio\(target\.pixelRatio\);/);
    // janela = tamanho da tela; fixa = buffer escolhido com updateStyle desligado
    assert.match(body, /renderer\.setSize\(target\.width, target\.height\);/);
    assert.match(body, /renderer\.setSize\(target\.width, target\.height, false\);/);
    // esticada para a tela toda (decisão do jogador: sem faixas)
    assert.match(body, /canvasEl\.style\.width = `\$\{window\.innerWidth\}px`;/);
    assert.match(body, /canvasEl\.style\.height = `\$\{window\.innerHeight\}px`;/);
    // a mão e a câmera acompanham a proporção do buffer
    assert.match(body, /const aspect = renderAspect\(target\);/);
    assert.match(body, /handCamera\.aspect = aspect;/);
});

test('escolher uma resolução fixa pede tela cheia; voltar para Janela sai dela', () => {
    const body = sliceFn(game, 'requestResolutionFullscreen');
    assert.match(body, /const fixed = resolutionSize\(value\) !== null;/);
    assert.match(body, /if \(fixed && !document\.fullscreenElement && !resolutionFullscreenPending\)/);
    // um pedido em voo por vez: arrastar a barra dispara um por degrau
    assert.match(body, /const request = document\.documentElement\.requestFullscreen\?\.\(\);/);
    assert.match(body, /resolutionFullscreenPending = true;/);
    // só sai da tela cheia se foi a resolução que entrou nela
    assert.match(body, /else if \(!fixed && resolutionFullscreen && document\.fullscreenElement\)/);
    assert.match(body, /document\.exitFullscreen\?\.\(\)\?\.catch/);
    // sair da tela cheia na mão (F11/Esc) não pode deixar a marca ligada
    assert.match(game, /document\.addEventListener\('fullscreenchange', \(\) => \{\n {4}if \(!document\.fullscreenElement\) resolutionFullscreen = false;/);
    // e tudo dentro de try: navegador sem a API (iPhone) não pode derrubar o jogo
    assert.match(body, /} catch \{/);
});

test('a resolução vale na hora, com aviso, ao mudar nas opções', () => {
    const body = sliceFn(game, 'applyGameSettings');
    assert.match(body, /const resolutionChanged = settings\.resolution !== resolutionMode;/);
    assert.match(body, /resolutionMode = settings\.resolution;/);
    assert.match(body, /GAME_SETTINGS\.resolution = settings\.resolution;/);
    assert.match(body, /applyRenderResolution\(\);/);
    assert.match(body, /if \(resolutionChanged\) \{/);
    assert.match(body, /requestResolutionFullscreen\(resolutionMode\);/);
    // o aviso diz o tamanho aplicado de verdade (que pode ter sido clampado)
    assert.match(body, /showToast\(resolutionMessage\(resolutionMode\), 3000\);/);
    assert.match(game, /function resolutionMessage\(value\) \{/);
    assert.match(sliceFn(game, 'resolutionMessage'), /return target\.clamped \?/);
    // muda depois da qualidade, para a escala já estar atualizada
    assert.ok(body.indexOf('gfx.setMode(mode, { quiet })') < body.indexOf('applyRenderResolution();'));
});

test('o renderer nasce com a resolução salva e o resize não estraga a fixa', () => {
    assert.match(game, /\/\/ já nasce com a resolução escolhida nas opções[\s\S]{0,80}?applyRenderResolution\(\);/);
    assert.match(game, /let resolutionMode = GAME_SETTINGS\.resolution;/);
    // com resolução fixa, redimensionar a janela só reestica a imagem
    assert.match(game, /if \(resolutionSize\(resolutionMode\)\) \{\n {12}\/\/ o buffer continua do mesmo tamanho; só a imagem esticada muda\n {12}applyRenderResolution\(\{ buffer: false \}\);/);
    // a escala automática de qualidade fica guardada para quando voltar a Janela
    assert.match(game, /if \(pendingScale !== null && !resolutionSize\(resolutionMode\)\) renderer\.setPixelRatio\(pendingScale\);/);
    // o F3 diz em que resolução o jogo está desenhando
    assert.match(game, /resolução \$\{resolutionLabel\(resolutionMode\)\}/);
});
