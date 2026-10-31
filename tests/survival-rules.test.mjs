import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
    DEATH_CAUSES, HUNGER_LOW, HUNGER_MAX, HUNGER_WARNINGS, STARVE_DAMAGE, STARVE_INTERVAL,
    advanceStarvation, deathTitle, hungerStage,
} from '../world-survival-rules.js';

const root = path.join(import.meta.dirname, '..');
const gameSource = readFileSync(path.join(root, 'game.js'), 'utf8');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const css = readFileSync(path.join(root, 'styles.css'), 'utf8');

test('faixas da fome: ok, aviso e vazio', () => {
    assert.equal(hungerStage(HUNGER_MAX), 'ok');
    assert.equal(hungerStage(HUNGER_LOW + 1), 'ok');
    assert.equal(hungerStage(HUNGER_LOW), 'low');
    assert.equal(hungerStage(1), 'low');
    assert.equal(hungerStage(0), 'empty');
});

test('fome inválida nunca vira "ok"', () => {
    assert.equal(hungerStage(-5), 'empty');
    assert.equal(hungerStage(NaN), 'empty');
    assert.equal(hungerStage(undefined), 'empty');
});

test('comer zera o relógio da inanição', () => {
    const state = advanceStarvation({ hunger: 3, timer: 3.9, dt: 0.2 });
    assert.deepEqual(state, { timer: 0, damage: 0 });
});

test('fome zerada acumula tempo sem dano antes do intervalo', () => {
    let timer = 0;
    for (let i = 0; i < 39; i++) {
        const step = advanceStarvation({ hunger: 0, timer, dt: 0.1 });
        timer = step.timer;
        assert.equal(step.damage, 0, `dano cedo demais no passo ${i}`);
    }
    assert.ok(timer > STARVE_INTERVAL - 0.15 && timer < STARVE_INTERVAL);
});

test('cada intervalo completo tira um ponto de vida', () => {
    const first = advanceStarvation({ hunger: 0, timer: STARVE_INTERVAL - 0.1, dt: 0.1 });
    assert.deepEqual(first, { timer: 0, damage: STARVE_DAMAGE });

    let health = 20;
    let timer = 0;
    for (let tick = 0; tick < 20; tick++) {
        const step = advanceStarvation({ hunger: 0, timer, dt: STARVE_INTERVAL });
        timer = step.timer;
        health -= step.damage;
    }
    assert.equal(health, 0, 'fome zerada consome toda a vida');
});

test('um quadro longo não vira rajada de dano', () => {
    const step = advanceStarvation({ hunger: 0, timer: 0, dt: 120 });
    assert.deepEqual(step, { timer: 0, damage: STARVE_DAMAGE });
});

test('tempo negativo é ignorado', () => {
    const step = advanceStarvation({ hunger: 0, timer: 1, dt: -5 });
    assert.deepEqual(step, { timer: 1, damage: 0 });
});

test('cada faixa de alerta tem um aviso legível', () => {
    for (const stage of ['low', 'empty']) {
        assert.ok(HUNGER_WARNINGS[stage].length > 10, `${stage}: aviso curto demais`);
    }
    assert.equal(HUNGER_WARNINGS.ok, undefined);
});

test('a tela de morte diz a causa', () => {
    assert.match(deathTitle('starve'), /fome/);
    assert.match(deathTitle('drown'), /afogado/);
    assert.match(deathTitle('fall'), /queda/);
    assert.equal(deathTitle('generic'), DEATH_CAUSES.generic);
    assert.equal(deathTitle('origem-desconhecida'), DEATH_CAUSES.generic);
    assert.equal(deathTitle(), DEATH_CAUSES.generic);
});

test('game.js usa as regras e não tem mais o piso de 1 de vida', () => {
    assert.match(gameSource, /advanceStarvation\(/);
    assert.match(gameSource, /takeDamage\(starve\.damage, 'starve'\)/);
    assert.match(gameSource, /deathTitle\(source\)/);
    assert.doesNotMatch(gameSource, /if \(health > 1\) takeDamage\(1, 'starve'\)/,
        'a inanição precisa poder matar');
});

test('a HUD e a tela de morte têm onde mostrar o aviso', () => {
    assert.match(html, /id="hunger-bar"/);
    assert.match(html, /<h1 id="death-cause">/);
    assert.match(css, /#hunger-bar\.starving \.food/);
    assert.match(css, /#hunger-bar\.low \.food/);
});
