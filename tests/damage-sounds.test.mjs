import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SOUND_RECIPES } from '../world-audio.js';
import { HURT_FULL_GAIN_DAMAGE, damageSoundFor, hurtGain } from '../world-damage-sounds.js';

test('dano comum toca o gemido; dano fatal toca a morte', () => {
    const hurt = damageSoundFor({ damage: 2, dead: false });
    assert.equal(hurt.name, 'hurt');
    assert.ok(hurt.gainScale >= 0.7 && hurt.gainScale <= 1.4);

    const death = damageSoundFor({ damage: 20, dead: true });
    assert.equal(death.name, 'death');
    assert.equal(death.gainScale, 1);
});

test('sem dano não há som', () => {
    assert.equal(damageSoundFor({ damage: 0 }), null);
    assert.equal(damageSoundFor({ damage: -3 }), null);
    assert.equal(damageSoundFor({ damage: NaN }), null);
    assert.equal(damageSoundFor({}), null);
    assert.equal(damageSoundFor(), null);
});

test('o gemido cresce com o dano e satura', () => {
    assert.equal(hurtGain(0), 0.7);
    assert.equal(hurtGain(1), 0.7 + (1 / HURT_FULL_GAIN_DAMAGE) * 0.7);
    assert.ok(hurtGain(2) < hurtGain(5), 'dano maior, gemido maior');
    assert.equal(hurtGain(HURT_FULL_GAIN_DAMAGE), 1.4);
    assert.equal(hurtGain(999), 1.4, 'satura');
    assert.equal(hurtGain(NaN), 0.7, 'valor inválido não vira ganho NaN');
    assert.equal(hurtGain('3'), hurtGain(3), 'aceita número em texto');
});

test('morte é mais longa e desce mais que o ferimento', () => {
    const hurt = SOUND_RECIPES.hurt;
    const death = SOUND_RECIPES.death;
    assert.ok(hurt && death, 'as duas receitas existem');
    for (const [name, recipe] of Object.entries({ hurt, death })) {
        assert.equal(recipe.kind, 'noise', `${name}: ruído`);
        assert.ok(recipe.thump, `${name}: o gemido precisa do corpo grave`);
        assert.ok(recipe.thump.from > recipe.thump.to, `${name}: o tom cai`);
        assert.ok(recipe.gain <= 0.2, `${name}: não estoura a mixagem`);
    }
    assert.ok(death.duration > hurt.duration * 2, 'a morte dura bem mais');
    assert.ok(death.thump.to < hurt.thump.to, 'a morte desce mais fundo');
    assert.ok(death.duration <= 0.8, 'mas não vira música');
});

test('o dano toca em takeDamage, depois do dano aplicado e só uma vez', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    const fn = source.slice(source.indexOf('function takeDamage('));
    const body = fn.slice(0, fn.indexOf('\n}'));

    const playAt = body.indexOf('audio.play(sound.name');
    assert.ok(playAt > 0, 'takeDamage precisa tocar o som');

    // invulnerabilidade e dano zero saem antes: nada de som sem dano
    const earlyReturns = [...body.matchAll(/return;/g)].map(match => match.index);
    for (const index of earlyReturns) assert.ok(index < playAt, 'recusa não pode soar');

    assert.match(body, /damageSoundFor\(\{ damage: amount, dead: health <= 0 \}\)/);
    assert.match(body, /if \(health <= 0\) die\(source\);/);
    assert.ok(body.indexOf('damageSoundFor') < body.indexOf('die(source)'),
        'a morte ainda toca o som dela antes de trocar de tela');
});
