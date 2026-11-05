import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
    DEFAULT_GAME_SETTINGS, GAME_SETTINGS_KEY, GAME_SETTING_FIELDS,
    formatSetting, loadGameSettings, notifyGameSettingsChange, onGameSettingsChange,
    sanitizeGameSettings, saveGameSettings, settingFraction, settingFromFraction, stepSetting,
} from '../world-game-settings.js';
import { OPTION_CONTROLS, OPTION_SCREENS, TOUCH_OPTION_CONTROLS } from '../world-options-view.js';

function fakeStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: key => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => { map.set(key, String(value)); },
        removeItem: key => { map.delete(key); },
        entries: () => [...map.entries()],
    };
}

test('sem nada salvo, valem os padrões', () => {
    assert.deepEqual(loadGameSettings(fakeStorage()), { ...DEFAULT_GAME_SETTINGS });
    assert.equal(DEFAULT_GAME_SETTINGS.sensitivity, 1);
    assert.equal(DEFAULT_GAME_SETTINGS.fov, 75);
    assert.equal(DEFAULT_GAME_SETTINGS.renderDistance, 4);
});

test('cada campo tem limites coerentes e formato legível', () => {
    for (const [key, field] of Object.entries(GAME_SETTING_FIELDS)) {
        if (field.choices) {
            assert.ok(field.choices.length > 1, `${key}: lista com mais de um modo`);
            assert.ok(field.choices.includes(field.default), `${key}: default está na lista`);
            assert.deepEqual([...field.choices], [...new Set(field.choices)], `${key}: sem repetição`);
        } else {
            assert.ok(field.min < field.max, `${key}: min < max`);
            assert.ok(field.step > 0, `${key}: step > 0`);
            assert.ok(field.default >= field.min && field.default <= field.max, `${key}: default na faixa`);
        }
        assert.equal(DEFAULT_GAME_SETTINGS[key], field.default);
        assert.ok(field.format(field.default).length > 0, `${key}: format devolve texto`);
    }
});

test('valores fora da faixa são presos nos limites', () => {
    assert.deepEqual(sanitizeGameSettings({ sensitivity: 9 }), { ...DEFAULT_GAME_SETTINGS, sensitivity: 2 });
    assert.deepEqual(sanitizeGameSettings({ sensitivity: 0.1 }), { ...DEFAULT_GAME_SETTINGS, sensitivity: 0.5 });
    assert.deepEqual(sanitizeGameSettings({ fov: 200 }), { ...DEFAULT_GAME_SETTINGS, fov: 100 });
    assert.deepEqual(sanitizeGameSettings({ fov: 10 }), { ...DEFAULT_GAME_SETTINGS, fov: 60 });
    assert.deepEqual(sanitizeGameSettings({ renderDistance: 99 }), { ...DEFAULT_GAME_SETTINGS, renderDistance: 6 });
});

test('valores são arredondados no passo do controle', () => {
    assert.equal(sanitizeGameSettings({ sensitivity: 0.62 }).sensitivity, 0.6);
    assert.equal(sanitizeGameSettings({ sensitivity: 1.27 }).sensitivity, 1.25);
    assert.equal(sanitizeGameSettings({ renderDistance: 2.6 }).renderDistance, 3);
    assert.equal(sanitizeGameSettings({ renderDistance: '5' }).renderDistance, 5);
    // arredondamento no passo não pode deixar 0.30000000000000004
    assert.equal(sanitizeGameSettings({ sensitivity: 0.8 }).sensitivity, 0.8);
});

test('lixo no storage volta para os padrões sem quebrar', () => {
    assert.deepEqual(sanitizeGameSettings(null), { ...DEFAULT_GAME_SETTINGS });
    assert.deepEqual(sanitizeGameSettings({ fov: 'abc', renderDistance: undefined }), { ...DEFAULT_GAME_SETTINGS });
    assert.deepEqual(loadGameSettings(fakeStorage({ [GAME_SETTINGS_KEY]: '{' })), { ...DEFAULT_GAME_SETTINGS });
    assert.deepEqual(loadGameSettings(fakeStorage({ [GAME_SETTINGS_KEY]: '[1,2,3]' })), { ...DEFAULT_GAME_SETTINGS });
});

test('chaves desconhecidas não vazam para as preferências', () => {
    const clean = sanitizeGameSettings({ fov: 80, hack: true, outro: 3 });
    assert.deepEqual(Object.keys(clean).sort(), Object.keys(DEFAULT_GAME_SETTINGS).sort());
    assert.equal(clean.fov, 80);
});

test('save grava na chave certa e load devolve o mesmo', () => {
    const storage = fakeStorage();
    const settings = {
        sensitivity: 1.5, fov: 90, renderDistance: 2, volume: 0.35, graphics: '0.5',
        touchLayout: 'left', touchButtonSize: 1.2, touchVibration: 'off',
        touchSensitivity: 1.1,
    };
    saveGameSettings(settings, storage);
    const [[key, value]] = storage.entries();
    assert.equal(key, GAME_SETTINGS_KEY);
    assert.deepEqual(JSON.parse(value), settings);
    assert.deepEqual(loadGameSettings(storage), settings);
});

test('volume aceita mudo, respeita 0–1 e arredonda no passo', () => {
    assert.equal(DEFAULT_GAME_SETTINGS.volume, 0.7);
    assert.equal(GAME_SETTING_FIELDS.volume.format(0), 'mudo');
    assert.equal(GAME_SETTING_FIELDS.volume.format(0.7), '70%');
    assert.equal(sanitizeGameSettings({ volume: 0 }).volume, 0);
    assert.equal(sanitizeGameSettings({ volume: -3 }).volume, 0);
    assert.equal(sanitizeGameSettings({ volume: 4 }).volume, 1);
    assert.equal(sanitizeGameSettings({ volume: 0.62 }).volume, 0.6);
});

test('save com storage bloqueado não lança', () => {
    const broken = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
    assert.deepEqual(loadGameSettings(broken), { ...DEFAULT_GAME_SETTINGS });
    assert.deepEqual(saveGameSettings({ fov: 80 }, broken), { ...DEFAULT_GAME_SETTINGS, fov: 80 });
});

test('todo controle da tela de opções existe no index.html', () => {
    const html = readFileSync(path.join(import.meta.dirname, '..', 'index.html'), 'utf8');
    for (const { key, button, output } of [...OPTION_CONTROLS, ...TOUCH_OPTION_CONTROLS]) {
        assert.ok(GAME_SETTING_FIELDS[key], `campo desconhecido: ${key}`);
        assert.ok(html.includes(`id="${button}"`), `botão #${button} ausente no index.html`);
        assert.ok(html.includes(`id="${output}"`), `saída #${output} ausente no index.html`);
    }
    assert.ok(html.includes('id="btn-options-reset"'), 'botão de restaurar padrões ausente');
});

test('a tela de opções tem uma barra para cada campo, numa tela só', () => {
    // as categorias (Áudio, Gráficos, Controles, Toque), juntas, cobrem todos
    const keys = OPTION_CONTROLS.map(row => row.key);
    assert.deepEqual([...keys].sort(), Object.keys(GAME_SETTING_FIELDS).sort());
    // e nenhum campo aparece em duas categorias
    assert.equal(new Set(keys).size, keys.length, 'campo repetido entre as categorias');
    // cada categoria da lista tem a sua grade com as linhas dela
    const screens = OPTION_SCREENS.filter(screen => screen.controls);
    assert.deepEqual(screens.map(screen => screen.key), ['audio', 'graphics', 'controls', 'touch']);
    assert.deepEqual(screens.flatMap(screen => screen.controls), OPTION_CONTROLS);
    assert.equal(screens.find(screen => screen.key === 'touch').controls, TOUCH_OPTION_CONTROLS);
});

// ------------------------------------------------ qualidade gráfica (lista)

test('gráficos guardam o modo escolhido e voltam ao padrão quando o valor não existe', () => {
    assert.equal(DEFAULT_GAME_SETTINGS.graphics, 'auto');
    assert.equal(sanitizeGameSettings({ graphics: '0.75' }).graphics, '0.75');
    assert.equal(sanitizeGameSettings({ graphics: 'max' }).graphics, 'max');
    assert.equal(sanitizeGameSettings({ graphics: 'ultra' }).graphics, 'auto', 'modo desconhecido não entra');
    assert.equal(sanitizeGameSettings({ graphics: 0.5 }).graphics, 'auto', 'número não é modo');
    assert.equal(GAME_SETTING_FIELDS.graphics.format('0.5'), 'Média');
    assert.equal(GAME_SETTING_FIELDS.graphics.format('auto'), 'Automática');
});

test('valor na barra: posição, ida e volta', () => {
    // campo numérico: 0 na esquerda, 1 na direita
    assert.equal(settingFraction('fov', 60), 0);
    assert.equal(settingFraction('fov', 100), 1);
    assert.equal(settingFraction('fov', 80), 0.5);
    assert.equal(settingFromFraction('fov', 0), 60);
    assert.equal(settingFromFraction('fov', 1), 100);
    assert.equal(settingFromFraction('fov', 0.5), 80);

    // lista: 4 modos ocupam 0, 1/3, 2/3 e 1
    assert.equal(settingFraction('graphics', 'auto'), 0);
    assert.equal(settingFraction('graphics', '0.5'), 1);
    assert.equal(settingFromFraction('graphics', 0), 'auto');
    assert.equal(settingFromFraction('graphics', 1), '0.5');
    assert.equal(settingFromFraction('graphics', 0.9), '0.5', 'arredonda para o modo mais perto');
});

test('a barra nunca gera valor fora da faixa nem valor quebrado', () => {
    assert.equal(settingFromFraction('volume', -1), 0);
    assert.equal(settingFromFraction('volume', 2), 1);
    assert.equal(settingFromFraction('volume', Number.NaN), 0);
    assert.equal(settingFromFraction('sensitivity', 0.333), 1, 'arredonda no passo de 0,05');
    assert.equal(settingFromFraction('renderDistance', 0.5), 4, 'chunks são inteiros (passo 1)');
    assert.equal(settingFromFraction('campo-que-nao-existe', 0.5), undefined);
});

test('passo a passo para no limite e dá a volta nas listas', () => {
    assert.equal(stepSetting('fov', 75, 1), 76);
    assert.equal(stepSetting('fov', 75, -1), 74);
    assert.equal(stepSetting('fov', 100, 1), 100, 'no máximo, o + não passa da faixa');
    assert.equal(stepSetting('fov', 60, -1), 60);
    assert.equal(stepSetting('volume', 1, 1), 1);
    assert.equal(stepSetting('graphics', 'auto', 1), 'max');
    assert.equal(stepSetting('graphics', '0.5', 1), 'auto', 'lista dá a volta');
    assert.equal(stepSetting('graphics', 'auto', -1), '0.5', 'e também para trás');
});

test('formatar valor usa o formato do campo', () => {
    assert.equal(formatSetting('fov', 75), '75°');
    assert.equal(formatSetting('volume', 0), 'mudo');
    assert.equal(formatSetting('graphics', '0.75'), 'Alta');
    assert.equal(formatSetting('campo-que-nao-existe', 3), '3');
});

test('quem grava avisa quem assina, e um ouvinte quebrado não derruba os outros', () => {
    const seen = [];
    const stopA = onGameSettingsChange(() => { throw new Error('tela quebrada'); });
    const stopB = onGameSettingsChange(settings => seen.push(settings.volume));

    notifyGameSettingsChange({ ...DEFAULT_GAME_SETTINGS, volume: 0.4 });
    assert.deepEqual(seen, [0.4], 'o segundo ouvinte recebe mesmo com o primeiro falhando');

    stopB();
    stopA();
    notifyGameSettingsChange({ ...DEFAULT_GAME_SETTINGS, volume: 0.9 });
    assert.deepEqual(seen, [0.4], 'depois de cancelar não chega mais nada');

    // assinatura inválida não quebra e devolve uma função de cancelar
    const stopNothing = onGameSettingsChange(null);
    assert.equal(typeof stopNothing, 'function');
    stopNothing();
});
