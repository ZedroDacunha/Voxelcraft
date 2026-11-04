import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SOUND_RECIPES } from '../world-audio.js';

const DOOR_SOUNDS = ['door-open', 'door-close'];

test('os dois estados da porta têm receita própria', () => {
    for (const name of DOOR_SOUNDS) {
        const recipe = SOUND_RECIPES[name];
        assert.ok(recipe, `falta a receita ${name}`);
        assert.equal(recipe.kind, 'noise');
        assert.ok(recipe.thump, `${name}: precisa do batente de madeira`);
        assert.ok(recipe.thump.from > recipe.thump.to, `${name}: o baque desce`);
        assert.ok(recipe.q > 2, `${name}: madeira ressoa`);
        assert.ok(recipe.attack <= 0.02, `${name}: entra rápido`);
        assert.ok(recipe.duration >= 0.1 && recipe.duration <= 0.3, `${name}: rangido curto`);
    }
});

test('abrir é mais lento e mais suave; fechar é um golpe seco', () => {
    const open = SOUND_RECIPES['door-open'];
    const close = SOUND_RECIPES['door-close'];
    assert.ok(open.duration > close.duration, 'abrir demora mais que fechar');
    assert.ok(open.attack > close.attack, 'abrir tem entrada mais lenta (dobradiça)');
    assert.ok(open.gain < close.gain, 'fechar é mais alto (batida no batente)');
    assert.ok(close.thump.gain > open.thump.gain, 'o baque de fechar é mais forte');
    assert.ok(open.cut > close.cut, 'abrir começa mais brilhante');
});

test('a porta toca só depois de mudar de estado de fato', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    const fn = source.slice(source.indexOf('function toggleWoodDoor('));
    const body = fn.slice(0, fn.indexOf('\n}'));
    const playAt = body.indexOf("audio.play(open ? 'door-open' : 'door-close'");
    assert.ok(playAt > 0, 'a porta precisa tocar');

    // As recusas (não é porta / jogador no vão) saem antes do som.
    const refusals = [...body.matchAll(/return false;/g)].map(match => match.index);
    assert.ok(refusals.length >= 2, 'as recusas continuam existindo');
    for (const index of refusals) assert.ok(index < playAt, 'nenhuma recusa pode soar');

    // O som vem depois de aplicar o estado nas duas metades.
    const setBlocks = body.lastIndexOf('world.setBlock(half.x');
    assert.ok(setBlocks > 0 && setBlocks < playAt, 'o som vem depois da mudança de estado');
    assert.match(body, /rate: stepPitch\(\)/, 'tom varia entre portas iguais');
});
