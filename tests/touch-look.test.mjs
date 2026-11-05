import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TOUCH_LOOK_SENSITIVITY, lookAfterDrag, touchLookSensitivity } from '../world-touch-controls.js';
import {
    DEFAULT_GAME_SETTINGS, GAME_SETTING_FIELDS, formatSetting, sanitizeGameSettings,
    settingFromFraction, settingFraction, stepSetting,
} from '../world-game-settings.js';
import { TOUCH_OPTION_CONTROLS } from '../world-options-view.js';

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

// --- o campo nas opções -------------------------------------------------

test('a sensibilidade do olhar é uma barra de 0,5 a 2, 80% de fábrica', () => {
    const field = GAME_SETTING_FIELDS.touchSensitivity;
    assert.ok(field, 'campo touchSensitivity não existe');
    assert.equal(DEFAULT_GAME_SETTINGS.touchSensitivity, 0.8, '80% de fábrica');
    assert.equal(field.min, 0.5);
    assert.equal(field.max, 2);
    assert.equal(field.step, 0.05);
    assert.equal(field.format(0.8), '80%');
    assert.equal(field.format(1), '100%');
    assert.equal(field.format(0.5), '50%');
});

test('valor fora da faixa é preso e arredondado no passo', () => {
    assert.equal(sanitizeGameSettings({ touchSensitivity: 0.1 }).touchSensitivity, 0.5);
    assert.equal(sanitizeGameSettings({ touchSensitivity: 9 }).touchSensitivity, 2);
    assert.equal(sanitizeGameSettings({ touchSensitivity: 1.27 }).touchSensitivity, 1.25);
    assert.equal(sanitizeGameSettings({ touchSensitivity: '1.5' }).touchSensitivity, 1.5);
    // lixo não derruba a opção nem deixa NaN no storage
    assert.equal(sanitizeGameSettings({ touchSensitivity: 'abc' }).touchSensitivity, 0.8);
    // `null` vira 0 no Number() e o 0 cai no mínimo — igual ao volume, que fica mudo
    assert.equal(sanitizeGameSettings({ touchSensitivity: null }).touchSensitivity, 0.5);
});

test('a barra anda de 5 em 5 e dá a volta nos extremos', () => {
    assert.equal(settingFraction('touchSensitivity', 0.5), 0);
    assert.equal(settingFraction('touchSensitivity', 2), 1);
    assert.equal(settingFraction('touchSensitivity', 1.25), 0.5);
    assert.equal(settingFromFraction('touchSensitivity', 0), 0.5);
    assert.equal(settingFromFraction('touchSensitivity', 1), 2);
    assert.equal(stepSetting('touchSensitivity', 0.8, 1), 0.85);
    assert.equal(stepSetting('touchSensitivity', 2, 1), 2, 'no máximo não passa da faixa');
    assert.equal(stepSetting('touchSensitivity', 0.5, -1), 0.5);
});

// --- a conta do giro ----------------------------------------------------

test('o giro do dedo é a base multiplicada pela opção', () => {
    assert.equal(touchLookSensitivity({ touchSensitivity: 1 }), TOUCH_LOOK_SENSITIVITY);
    assert.ok(Math.abs(touchLookSensitivity({ touchSensitivity: 2 }) - TOUCH_LOOK_SENSITIVITY * 2) < 1e-12);
    assert.ok(Math.abs(touchLookSensitivity({ touchSensitivity: 0.5 }) - TOUCH_LOOK_SENSITIVITY * 0.5) < 1e-12);
    // de fábrica o dedo gira 80% do que girava antes da barra existir
    assert.ok(Math.abs(touchLookSensitivity(DEFAULT_GAME_SETTINGS) - TOUCH_LOOK_SENSITIVITY * 0.8) < 1e-12);
});

test('sem opção válida cai no padrão, nunca em zero', () => {
    for (const settings of [undefined, null, {}, { touchSensitivity: 'x' }, { touchSensitivity: 0 }, { touchSensitivity: -2 }]) {
        assert.ok(touchLookSensitivity(settings) > 0, `virou zero ou negativo: ${JSON.stringify(settings)}`);
        assert.ok(Math.abs(touchLookSensitivity(settings) - TOUCH_LOOK_SENSITIVITY * DEFAULT_GAME_SETTINGS.touchSensitivity) < 1e-12);
    }
});

test('a barra do mouse não mexe mais no giro do dedo', () => {
    // mexer só na do mouse não muda nada no toque; a do toque muda sozinha
    assert.equal(touchLookSensitivity({ sensitivity: 2 }), touchLookSensitivity({ sensitivity: 0.5 }));
    assert.notEqual(touchLookSensitivity({ touchSensitivity: 1 }), touchLookSensitivity({ touchSensitivity: 0.5 }));
    // e o mouse continua no caminho dele, com a barra do mouse
    assert.match(game, /look\.yaw -= mx \* LOOK_SPEED \* LOOK_SENSITIVITY;/);
});

test('o mesmo arrasto gira proporcionalmente à barra', () => {
    const turn = (touchSensitivity) => lookAfterDrag({ yaw: 0, pitch: 0 }, 120, 0, {
        sensitivity: touchLookSensitivity({ touchSensitivity }),
    }).yaw;
    const quarter = turn(0.5);
    const whole = turn(1);
    assert.ok(Math.abs(quarter) > 0);
    assert.ok(Math.abs(whole - quarter * 2) < 1e-9, 'metade da barra, metade do giro');
    // e o teto vertical continua valendo em qualquer sensibilidade
    const up = lookAfterDrag({ yaw: 0, pitch: 0 }, 0, -100000, {
        sensitivity: touchLookSensitivity({ touchSensitivity: 2 }),
    });
    assert.equal(up.pitch, Math.PI / 2 - 0.02);
});

// --- a linha na tela de toque ------------------------------------------

test('a linha é uma barra arrastável na sub-tela de toque', () => {
    const row = TOUCH_OPTION_CONTROLS.find(control => control.key === 'touchSensitivity');
    assert.ok(row, 'campo touchSensitivity fora da sub-tela de toque');
    assert.equal(row.label, 'Sensibilidade do olhar');

    const start = dialog.lastIndexOf('<button', dialog.indexOf('id="opt-touch-sensitivity"'));
    const block = dialog.slice(start, dialog.indexOf('</button>', start));
    assert.match(block, /class="classic-btn option-btn option-slider"/, 'é barra, não lista');
    assert.match(block, /<span class="option-track" aria-hidden="true"><span class="option-knob"><\/span><\/span>/);
    assert.match(block, /aria-label="Sensibilidade do olhar"/);
    assert.ok(block.includes('<span class="option-name">Sensibilidade do olhar</span>'));
    assert.match(block, /<span class="option-value" id="opt-touch-sensitivity-value">80%<\/span>/);
    // está na grade de toque, não na principal
    const grid = html.indexOf('id="options-touch-grid"');
    assert.ok(grid > 0 && html.indexOf('id="opt-touch-sensitivity"') > grid);
});

test('formatar a opção na tela usa o formato do campo', () => {
    assert.equal(formatSetting('touchSensitivity', 0.8), '80%');
    assert.equal(formatSetting('touchSensitivity'), '80%', 'sem valor, mostra o padrão');
});

// --- fiação no jogo ----------------------------------------------------

test('o jogo guarda o giro do dedo e relê a cada mudança de opção', () => {
    assert.match(game, /import \{[\s\S]{0,400}?touchLookSensitivity,[\s\S]{0,80}?\} from '\.\/world-touch-controls\.js';/);
    assert.match(game, /let touchLookScale = touchLookSensitivity\(GAME_SETTINGS\);/);
    assert.match(sliceFn(game, 'applyTouchLayout'), /touchLookScale = touchLookSensitivity\(settings\);/);
    // applyTouchLayout roda dentro de applyGameSettings, que roda no começo e a cada mudança
    assert.match(sliceFn(game, 'applyGameSettings'), /applyTouchLayout\(settings\);/);
    assert.match(game, /applyGameSettings\(GAME_SETTINGS, \{ quiet: true \}\);/);
    assert.match(game, /onGameSettingsChange\(settings => applyGameSettings\(settings\)\);/);
});

test('o arrasto do dedo usa essa sensibilidade, e não a do mouse', () => {
    const canvasMove = game.slice(game.indexOf("canvas.addEventListener('pointermove'"));
    const look = canvasMove.slice(canvasMove.indexOf('lookAfterDrag('), canvasMove.indexOf('applyLook();'));
    assert.match(look, /sensitivity: touchLookScale,/);
    assert.doesNotMatch(look, /LOOK_SENSITIVITY/, 'a barra do mouse não entra no toque');
});
