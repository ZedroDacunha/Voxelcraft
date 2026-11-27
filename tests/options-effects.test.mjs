// Efeitos: a sub-tela dentro de Gráficos com os cinco on/off — partículas,
// nuvens, folhas, balanço da câmera e flash de dano — e o jogo obedecendo na
// hora. Cada toggle tem um portão próprio no game.js; aqui ficam os portões.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { DEFAULT_GAME_SETTINGS, GAME_SETTING_FIELDS } from '../world-game-settings.js';
import { EFFECTS_OPTION_CONTROLS, OPTION_SCREENS } from '../world-options-view.js';

const root = file => path.join(import.meta.dirname, '..', file);
const html = readFileSync(root('index.html'), 'utf8');
const game = readFileSync(root('game.js'), 'utf8');

const KEYS = ['particles', 'clouds', 'leaves', 'cameraBob', 'hurtFlash'];

test('os cinco efeitos são campos on/off, ligados por padrão, sem barra', () => {
    assert.deepEqual(EFFECTS_OPTION_CONTROLS.map(row => row.key), KEYS);
    for (const key of KEYS) {
        const field = GAME_SETTING_FIELDS[key];
        assert.deepEqual([...field.choices], ['on', 'off'], key);
        assert.equal(field.default, 'on', key);
        assert.equal(DEFAULT_GAME_SETTINGS[key], 'on', key);
        assert.notEqual(field.slider, true, `${key} é botão de clique, não barra`);
    }
    // o formato devolve o rótulo da linha; o jogo lê on/off
    assert.equal(GAME_SETTING_FIELDS.particles.format('off'), 'Desligadas');
    assert.equal(GAME_SETTING_FIELDS.clouds.format('on'), 'Ligadas');
    assert.equal(GAME_SETTING_FIELDS.leaves.format('off'), 'Desligadas');
    assert.equal(GAME_SETTING_FIELDS.cameraBob.format('off'), 'Desligado');
    assert.equal(GAME_SETTING_FIELDS.hurtFlash.format('on'), 'Ligado');
});

test('Efeitos é sub-tela de Gráficos, aberta por botão na grade de Gráficos', () => {
    const effects = OPTION_SCREENS.find(screen => screen.key === 'effects');
    assert.equal(effects.parent, 'graphics', 'Voltar do Efeitos cai em Gráficos');
    assert.equal(effects.grid, 'options-effects-grid');
    assert.equal(effects.open, 'opt-open-effects');
    assert.equal(effects.controls, EFFECTS_OPTION_CONTROLS);
    // o abridor mora na grade de Gráficos, como o do toque mora em Controles
    assert.match(html, /id="opt-open-effects" aria-label="Efeitos" aria-expanded="false" aria-controls="options-effects-grid"/);
    const graphicsAt = html.indexOf('id="options-graphics-grid"');
    const openerAt = html.indexOf('id="opt-open-effects"');
    const gridAt = html.indexOf('id="options-effects-grid"');
    assert.ok(graphicsAt < openerAt && openerAt < gridAt, 'abridor dentro de Gráficos, a grade de Efeitos em seguida');
    assert.match(html, /<div class="options-grid" id="options-effects-grid" hidden>/);
});

test('as cinco linhas existem na grade de Efeitos com nome e valor', () => {
    const gridAt = html.indexOf('id="options-effects-grid"');
    for (const { button, output, label } of EFFECTS_OPTION_CONTROLS) {
        const at = html.indexOf(`id="${button}"`);
        assert.ok(at > gridAt, `#${button} fora de #options-effects-grid`);
        assert.ok(html.includes(`aria-label="${label}"`), `#${button} sem o rótulo ${label}`);
        assert.ok(html.includes(`<span class="option-name">${label}</span>`), `#${button} sem o nome visível ${label}`);
        assert.ok(html.includes(`id="${output}"`), `#${output} ausente`);
    }
});

test('applyGameSettings espelha os cinco campos e avisa as nuvens na hora', () => {
    for (const key of KEYS) {
        assert.ok(game.includes(`GAME_SETTINGS.${key} = settings.${key};`), `snapshot de ${key} ausente`);
    }
    assert.match(game, /worldClouds\.setVisible\(settings\.clouds !== 'off'\);/);
});

test('partículas desligadas param quebra, golpe, fumaça de forno, pó e migalhas', () => {
    // quebra e golpe: o próprio sistema recebe o portão lendo GAME_SETTINGS
    assert.match(game, /enabled: \(\) => GAME_SETTINGS\.particles !== 'off',/);
    // fumaça de forno: o update recebe mapa vazio — a que existe acaba sozinha
    assert.match(game, /const NO_FURNACES = new Map\(\);/);
    assert.match(game, /furnaceSmoke\.update\(dt, GAME_SETTINGS\.particles === 'off' \? NO_FURNACES : furnaces/);
    // pó de criatura: escala 0 é passo vazio no world-creature-dust
    assert.match(game, /dustQuality: \(\) => \(GAME_SETTINGS\.particles === 'off' \? 0 : dustScaleFor\(gfx\.mode\)\)/);
    // migalhas da maçã, na mão e na terceira pessoa (o recado ainda é limpo)
    assert.match(game, /if \(GAME_SETTINGS\.particles !== 'off'\) firstPersonCrumbs\.burst/);
    assert.match(game, /if \(GAME_SETTINGS\.particles !== 'off'\) thirdPersonCrumbs\.burst/);
});

test('folhas desligadas viram qualidade 0 — o modo sem folhas do sistema', () => {
    assert.match(game, /quality: GAME_SETTINGS\.leaves === 'off' \? 0 : quality/);
});

test('balanço da câmera desligado trava posição, rolagem e mão', () => {
    assert.match(game, /if \(pose\.amplitude > 0 && GAME_SETTINGS\.cameraBob !== 'off'\)/);
    assert.match(game, /GAME_SETTINGS\.cameraBob !== 'off' \? gaitPose\(gait\)\.roll : 0/);
    assert.match(game, /const ba = \(GAME_SETTINGS\.cameraBob !== 'off' \? gaitNow\.amplitude : 0\) \* swim\.walkWeight;/);
});

test('flash de dano desligado zera a opacidade do overlay', () => {
    assert.match(game, /hurtEl\.style\.opacity = GAME_SETTINGS\.hurtFlash === 'off' \? '0' : String\(hurtFlash\);/);
});
