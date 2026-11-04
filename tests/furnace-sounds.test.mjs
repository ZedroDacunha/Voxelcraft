import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SOUND_RECIPES } from '../world-audio.js';
import {
    FURNACE_AUDIBLE_DISTANCE,
    FURNACE_NEAR_DISTANCE,
    furnaceDistance,
    furnaceGain,
    furnaceSoundFor,
} from '../world-furnace-sounds.js';

const LOUD = { litChanged: true, lit: true, distance: 1 };

test('acender e apagar têm sons próprios', () => {
    assert.equal(furnaceSoundFor(LOUD).name, 'furnace-light');
    assert.equal(furnaceSoundFor({ litChanged: true, lit: false, distance: 1 }).name, 'furnace-out');
});

test('item pronto soa sem chama nenhuma', () => {
    const sound = furnaceSoundFor({ smelted: true, lit: true, distance: 2 });
    assert.equal(sound.name, 'furnace-done');
});

test('sem evento não há som (forno queimando não zumbe)', () => {
    assert.equal(furnaceSoundFor({ lit: true, distance: 1 }), null);
    assert.equal(furnaceSoundFor({ distance: 1 }), null);
    assert.equal(furnaceSoundFor(), null);
});

test('chama tem precedência sobre o item pronto', () => {
    const both = furnaceSoundFor({ litChanged: true, lit: true, smelted: true, distance: 0 });
    assert.equal(both.name, 'furnace-light');
});

test('o volume cai com a distância e zera longe', () => {
    assert.equal(furnaceGain(0), 1);
    assert.equal(furnaceGain(FURNACE_NEAR_DISTANCE), 1, 'colado continua cheio');
    assert.ok(furnaceGain(8) < 1 && furnaceGain(8) > 0);
    assert.ok(furnaceGain(8) > furnaceGain(15), 'monotônico');
    assert.equal(furnaceGain(FURNACE_AUDIBLE_DISTANCE), 0);
    assert.equal(furnaceGain(200), 0);

    // fora de alcance: nem chega a pedir som
    assert.equal(furnaceSoundFor({ litChanged: true, lit: true, distance: 50 }), null);
});

test('distância inválida não faz barulho', () => {
    assert.equal(furnaceGain(NaN), 0);
    assert.equal(furnaceGain(-4), 0);
    assert.equal(furnaceGain(undefined), 1, 'sem distância assume colado');
    assert.equal(furnaceSoundFor({ litChanged: true, lit: true, distance: NaN }), null);
});

test('distância sai do centro do forno e do corpo do jogador', () => {
    assert.equal(furnaceDistance('4,70,-2', { x: 4.5, y: 70.5, z: -1.5 }), 0);
    assert.equal(furnaceDistance('0,0,0', { x: 3.5, y: 0.5, z: 0.5 }), 3);
    assert.equal(furnaceDistance('lixo', { x: 0, y: 0, z: 0 }), Infinity);
    assert.equal(furnaceDistance('1,2,3', null), Infinity);
    assert.equal(furnaceDistance('1,2,3', { x: NaN, y: 0, z: 0 }), Infinity);
});

test('receitas do forno: crepitar longo, sopro curto, "pronto" quase metálico', () => {
    const light = SOUND_RECIPES['furnace-light'];
    const out = SOUND_RECIPES['furnace-out'];
    const done = SOUND_RECIPES['furnace-done'];
    assert.ok(light && out && done, 'as três receitas existem');

    assert.equal(light.kind, 'noise');
    assert.ok(light.duration > out.duration, 'acender demora mais que apagar');
    assert.ok(light.thump, 'acender tem um "whoomp" grave');
    assert.ok(light.gain <= 0.15 && out.gain <= 0.15, 'não rouba a mixagem');

    assert.equal(out.kind, 'noise');
    assert.ok(out.duration <= 0.5, 'sopro curto');

    assert.equal(done.wave, 'triangle');
    assert.ok(done.duration <= 0.2, 'o "pronto" é um toque, não uma nota');
    assert.notEqual(done.from, done.to, 'com uma queda de tom');
});

test('o jogo só pede som quando o passo trouxe evento', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    const fn = source.slice(source.indexOf('function updateFurnaces('));
    const body = fn.slice(0, fn.indexOf('\n}'));

    assert.match(body, /stepFurnace\(f, dt\)[\s\S]*litChanged/);
    assert.match(body, /if \(litChanged \|\| smelted\)/, 'sem evento, nada de som');
    assert.match(body, /lit: f\.burn > 0/, 'acende ou apaga vem do estado real do forno');
    assert.match(body, /distance: furnaceDistance\(key, player\.pos\)/);
    assert.match(body, /audio\.play\(sound\.name, \{ gainScale: sound\.gainScale \}\)/);
    // a distância é calculada dentro do `if`: nada de quebrar chave a cada quadro
    const playAt = body.indexOf('if (litChanged || smelted)');
    assert.ok(body.indexOf('furnaceDistance') > playAt);
});
