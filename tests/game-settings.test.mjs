import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
    DEFAULT_GAME_SETTINGS, GAME_SETTINGS_KEY, GAME_SETTING_FIELDS,
    loadGameSettings, sanitizeGameSettings, saveGameSettings,
} from '../world-game-settings.js';
import { OPTION_CONTROLS } from '../world-options-view.js';

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
        assert.ok(field.min < field.max, `${key}: min < max`);
        assert.ok(field.step > 0, `${key}: step > 0`);
        assert.ok(field.default >= field.min && field.default <= field.max, `${key}: default na faixa`);
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
    saveGameSettings({ sensitivity: 1.5, fov: 90, renderDistance: 2 }, storage);
    const [[key, value]] = storage.entries();
    assert.equal(key, GAME_SETTINGS_KEY);
    assert.deepEqual(JSON.parse(value), { sensitivity: 1.5, fov: 90, renderDistance: 2 });
    assert.deepEqual(loadGameSettings(storage), { sensitivity: 1.5, fov: 90, renderDistance: 2 });
});

test('save com storage bloqueado não lança', () => {
    const broken = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
    assert.deepEqual(loadGameSettings(broken), { ...DEFAULT_GAME_SETTINGS });
    assert.deepEqual(saveGameSettings({ fov: 80 }, broken), { ...DEFAULT_GAME_SETTINGS, fov: 80 });
});

test('todo controle da tela de opções existe no index.html', () => {
    const html = readFileSync(path.join(import.meta.dirname, '..', 'index.html'), 'utf8');
    for (const { key, input, output } of OPTION_CONTROLS) {
        assert.ok(GAME_SETTING_FIELDS[key], `campo desconhecido: ${key}`);
        assert.ok(html.includes(`id="${input}"`), `input #${input} ausente no index.html`);
        assert.ok(html.includes(`id="${output}"`), `output #${output} ausente no index.html`);
    }
    assert.ok(html.includes('id="btn-options-reset"'), 'botão de restaurar padrões ausente');
});
