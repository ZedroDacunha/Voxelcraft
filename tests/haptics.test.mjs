import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    HAPTIC_EVENTS, HAPTIC_GAPS_MS, HAPTIC_PATTERNS, VIBRATION_DEFAULT,
    canVibrate, createHapticState, hapticDuration, hapticPattern, vibrationEnabled,
} from '../world-haptics.js';
import { DEFAULT_GAME_SETTINGS, formatSetting, sanitizeGameSettings } from '../world-game-settings.js';
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

// --- catálogo -----------------------------------------------------------

test('cada acontecimento tem um padrão de vibração válido', () => {
    assert.ok(HAPTIC_EVENTS.length >= 6, 'passos, botão, colocar, quebrar, golpe e dano');
    for (const event of HAPTIC_EVENTS) {
        const pattern = HAPTIC_PATTERNS[event];
        assert.ok(Array.isArray(pattern) && pattern.length > 0, `${event}: padrão vazio`);
        for (const part of pattern) {
            assert.ok(Number.isFinite(part) && part > 0, `${event}: parte inválida (${part})`);
            assert.ok(part <= 120, `${event}: pulso longo demais (${part} ms)`);
        }
        const gap = HAPTIC_GAPS_MS[event];
        assert.ok(Number.isFinite(gap) && gap > 0, `${event}: sem folga entre repetições`);
        assert.ok(gap >= hapticDuration(pattern) || event === 'hurt',
            `${event}: a folga é menor que o próprio pulso`);
    }
});

test('o dano é o mais forte e o passo o mais discreto', () => {
    assert.ok(hapticDuration(HAPTIC_PATTERNS.hurt) > hapticDuration(HAPTIC_PATTERNS.break));
    assert.ok(hapticDuration(HAPTIC_PATTERNS.break) > hapticDuration(HAPTIC_PATTERNS.step));
    assert.ok(hapticDuration(HAPTIC_PATTERNS.button) <= hapticDuration(HAPTIC_PATTERNS.place));
    // o passo é o mais frequente: a folga dele precisa segurar o ritmo de corrida
    assert.ok(HAPTIC_GAPS_MS.step >= 200, 'passo correndo chega a ~4 por segundo');
    for (const event of HAPTIC_EVENTS) {
        if (event === 'step') continue;
        assert.ok(HAPTIC_GAPS_MS[event] <= HAPTIC_GAPS_MS.step, `${event}: folga maior que o passo`);
    }
});

test('duração total de um padrão', () => {
    assert.equal(hapticDuration([10]), 10);
    assert.equal(hapticDuration([28, 40, 55]), 123);
    assert.equal(hapticDuration(null), 0);
    assert.equal(hapticDuration([10, null, 5]), 15);
});

// --- aparelho e opção ---------------------------------------------------

test('só afirma que vibra quando o navegador tem a função', () => {
    assert.equal(canVibrate({ vibrate() {} }), true);
    assert.equal(canVibrate({}), false);
    assert.equal(canVibrate(null), false);
    assert.equal(canVibrate(undefined), false);
    // Safari do iPhone: navigator existe, vibrate não
    assert.equal(canVibrate({ userAgent: 'Mozilla/5.0 (iPhone)' }), false);
});

test('a opção manda: desligada não vibra nada', () => {
    assert.equal(vibrationEnabled({}), true);
    assert.equal(vibrationEnabled({ touchVibration: 'on' }), true);
    assert.equal(vibrationEnabled({ touchVibration: 'off' }), false);
    assert.equal(vibrationEnabled({ touchVibration: 'qualquer' }), true, 'lixo não desliga');
    assert.equal(DEFAULT_GAME_SETTINGS.touchVibration, 'on');
    assert.equal(VIBRATION_DEFAULT, 'on');
    assert.equal(formatSetting('touchVibration', 'on'), 'Ligada');
    assert.equal(formatSetting('touchVibration', 'off'), 'Desligada');
    assert.equal(sanitizeGameSettings({ touchVibration: 'off' }).touchVibration, 'off');
    assert.equal(sanitizeGameSettings({ touchVibration: 'talvez' }).touchVibration, 'on');
});

// --- cadência -----------------------------------------------------------

test('a mesma vibração não repete dentro da folga', () => {
    const state = createHapticState();
    assert.deepEqual(hapticPattern('step', state, { now: 1000 }), HAPTIC_PATTERNS.step);
    // 100 ms depois ainda está dentro dos 220 ms do passo
    assert.equal(hapticPattern('step', state, { now: 1100 }), null);
    // passou a folga: vibra de novo
    assert.deepEqual(hapticPattern('step', state, { now: 1000 + HAPTIC_GAPS_MS.step }), HAPTIC_PATTERNS.step);
});

test('cada acontecimento tem a própria memória', () => {
    const state = createHapticState();
    assert.ok(hapticPattern('break', state, { now: 500 }));
    // quebrar não bloqueia colocar, nem o dano logo depois
    assert.ok(hapticPattern('place', state, { now: 505 }));
    assert.ok(hapticPattern('hurt', state, { now: 510 }));
    // mas o mesmo, sim
    assert.equal(hapticPattern('break', state, { now: 510 }), null);
});

test('padrão sem estado, evento desconhecido e tempo estranho', () => {
    // sem estado a função só responde "qual é o padrão"
    assert.deepEqual(hapticPattern('punch'), HAPTIC_PATTERNS.punch);
    assert.equal(hapticPattern('nada'), null);
    assert.equal(hapticPattern('nada', createHapticState(), { now: 0 }), null);
    // tempo inválido conta como 0 (não vira NaN nos cálculos)
    const state = createHapticState();
    assert.ok(hapticPattern('hurt', state, { now: NaN }));
    assert.equal(hapticPattern('hurt', state, { now: 10 }), null, 'NaN contou como 0');
});

// --- tela de opções -----------------------------------------------------

test('a vibração é uma linha de clique na tela de toque', () => {
    const row = TOUCH_OPTION_CONTROLS.find(control => control.key === 'touchVibration');
    assert.ok(row, 'campo touchVibration fora da sub-tela de toque');
    assert.equal(row.label, 'Vibração');

    const start = dialog.lastIndexOf('<button', dialog.indexOf('id="opt-touch-vibration"'));
    const block = dialog.slice(start, dialog.indexOf('</button>', start));
    assert.match(block, /class="classic-btn option-btn"/, 'é lista, não barra');
    assert.doesNotMatch(block, /option-track|option-knob/);
    assert.match(block, /aria-label="Vibração"/);
    assert.ok(block.includes('<span class="option-name">Vibração</span>'));
    assert.match(block, /<span class="option-value" id="opt-touch-vibration-value">Ligada<\/span>/);
});

// --- fiação no jogo -----------------------------------------------------

test('o jogo só vibra no toque, com a opção ligada e onde o aparelho deixa', () => {
    const body = sliceFn(game, 'haptic');
    assert.match(body, /if \(!touchMode \|\| !hapticOn \|\| !canVibrate\(navigator\)\) return;/);
    assert.match(body, /const pattern = hapticPattern\(event, hapticState, \{ now: performance\.now\(\) \}\);/);
    assert.match(body, /if \(pattern\) navigator\.vibrate\(pattern\);/);
    // a opção é lida junto das outras de toque, então muda ao vivo no ESC
    assert.match(game, /hapticOn = vibrationEnabled\(settings\);/);
    assert.match(game, /let hapticOn = vibrationEnabled\(GAME_SETTINGS\);/);
});

test('cada acontecimento chama a vibração certa, no lugar certo', () => {
    assert.match(sliceFn(game, 'breakBlock'), /haptic\('break'\);/);
    assert.match(sliceFn(game, 'takeDamage'), /haptic\('hurt'\);/);
    assert.match(sliceFn(game, 'strikeCreature'), /haptic\('punch'\);/);
    // colocar bloco está dentro de useHeldItem (junto do som de colocar)
    const use = sliceFn(game, 'useHeldItem');
    assert.match(use, /haptic\('place'\);/);
    assert.ok(use.indexOf("haptic('place')") > use.indexOf('world.setBlock'), 'só depois de colocar de verdade');
    // o passo vibra uma vez por batida, não a cada quadro
    const steps = sliceFn(game, 'playFootsteps');
    assert.match(steps, /\n {4}\}\n {4}haptic\('step'\);\n\}/, 'haptic fora do laço de passos');
    assert.ok(steps.indexOf("haptic('step')") > steps.indexOf('for (let i = 0; i < steps; i++)'));
});

test('botão apertado vibra e pausar cancela um pulso no meio', () => {
    const buttons = game.slice(game.indexOf("for (const button of ui.querySelectorAll('[data-touch]'))"),
        game.indexOf("// Hotbar: no toque não existe roda do mouse"));
    assert.match(buttons, /if \(!playing\(\)\) return;\n {16}haptic\('button'\);/);
    // dano longo pode estar vibrando quando o jogador pausa ou morre
    assert.match(sliceFn(game, 'resetInputFlags'), /stopHaptics\(\);/);
    assert.match(sliceFn(game, 'stopHaptics'), /navigator\.vibrate\(0\)/);
});
