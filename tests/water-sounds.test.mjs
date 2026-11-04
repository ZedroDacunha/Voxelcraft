import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SOUND_RECIPES } from '../world-audio.js';
import {
    SPLASH_MAX_FALL_SPEED,
    createWaterAudioState,
    splashGain,
    waterSoundFor,
} from '../world-water-sounds.js';

const step = (state, options) => waterSoundFor(state, options);

test('entrar na água toca splash, sair toca saída', () => {
    const state = createWaterAudioState();
    assert.equal(step(state, { inWater: false, headInWater: false }), null, 'seco');

    const splash = step(state, { inWater: true, headInWater: false, fallSpeed: 4 });
    assert.equal(splash.name, 'water-splash');
    assert.ok(splash.gainScale > 0.7 && splash.gainScale < 1.5);

    assert.equal(step(state, { inWater: true, headInWater: false }), null, 'continuar na água não repete');

    const exit = step(state, { inWater: false, headInWater: false });
    assert.equal(exit.name, 'water-exit');
    assert.equal(step(state, { inWater: false }), null, 'fora da água não repete');
});

test('mergulhar a cabeça tem som próprio, distinto do splash', () => {
    const state = createWaterAudioState();
    step(state, { inWater: true, headInWater: false }); // entrou na superfície
    const dive = step(state, { inWater: true, headInWater: true });
    assert.equal(dive.name, 'water-dive');
    assert.equal(step(state, { inWater: true, headInWater: true }), null);
    // voltar a respirar não é "sair da água"
    assert.equal(step(state, { inWater: true, headInWater: false }), null);
});

test('entrar direto de uma queda soa como splash, sem mergulho duplicado', () => {
    const state = createWaterAudioState();
    const sound = step(state, { inWater: true, headInWater: true, fallSpeed: 9 });
    assert.equal(sound.name, 'water-splash', 'o splash cobre o mergulho');
    assert.equal(step(state, { inWater: true, headInWater: true }), null);
});

test('o splash cresce com a velocidade da queda e satura', () => {
    assert.equal(splashGain(0), 0.7);
    assert.equal(splashGain(-0), 0.7, 'sem queda é o mais discreto');
    assert.ok(splashGain(4) < splashGain(8), 'queda maior, splash maior');
    assert.equal(splashGain(SPLASH_MAX_FALL_SPEED), 1.5);
    assert.equal(splashGain(999), 1.5, 'satura no máximo');
    assert.equal(splashGain(-20), 1.5, 'usa a magnitude (caindo = velocidade negativa)');
    assert.equal(splashGain(undefined), 0.7);
    assert.equal(splashGain(NaN), 0.7);
});

test('as receitas de água existem e soam como água', () => {
    for (const name of ['water-splash', 'water-exit', 'water-dive', 'swim-stroke']) {
        const recipe = SOUND_RECIPES[name];
        assert.ok(recipe, `falta a receita ${name}`);
        assert.equal(recipe.kind, 'noise');
        assert.ok(recipe.cut >= 200 && recipe.cut <= 4000, `${name}: banda de água`);
        assert.ok(recipe.duration >= 0.1 && recipe.duration <= 0.35, `${name}: curto`);
        assert.ok(recipe.gain <= 0.16, `${name}: não domina a mixagem`);
    }
    // submergir é abafado: corte baixo e Q maior que o splash
    assert.ok(SOUND_RECIPES['water-dive'].cut < SOUND_RECIPES['water-splash'].cut);
    assert.ok(SOUND_RECIPES['water-dive'].duration > SOUND_RECIPES['water-exit'].duration);
    assert.ok(SOUND_RECIPES['water-splash'].thump, 'o splash tem corpo grave');
    assert.ok(!SOUND_RECIPES['swim-stroke'].thump, 'a braçada é leve');
});

test('game.js usa a transição na física e a braçada ao empurrar a água', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /const waterSound = waterSoundFor\(waterAudio, \{/);
    assert.match(source, /fallSpeed: player\.vel\.y/);
    assert.match(source, /if \(waterSound\) audio\.play\(waterSound\.name, \{ gainScale: waterSound\.gainScale/);

    // as duas saídas de natação (superfície e submerso) tocam a braçada
    const strokes = [...source.matchAll(/swimStrokeLocked = true;\n\s*(?:if \(player\.vel\.y > 4\.0\)[^\n]*\n\s*)?audio\.play\('swim-stroke'/g)];
    assert.equal(strokes.length, 1, 'braçada na superfície');
    assert.match(source, /Velocidade terminal subindo[\s\S]{0,120}?audio\.play\('swim-stroke'/,
        'braçada também submerso');
});
