import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BLOCKS, ID } from '../world-catalog.js';
import {
    STEP_MATERIALS,
    STEP_MAX_MOVED,
    stepDistanceThisFrame,
    stepMaterialFor,
    stepPitch,
    stepSoundFor,
} from '../world-step-sounds.js';
import { SOUND_RECIPES } from '../world-audio.js';

test('cada material tem receita de som própria', () => {
    assert.deepEqual(STEP_MATERIALS, ['grass', 'dirt', 'stone', 'wood', 'sand', 'wool']);
    for (const material of STEP_MATERIALS) {
        assert.ok(SOUND_RECIPES[`step-${material}`], `falta a receita step-${material}`);
    }
});

test('o bloco pisado escolhe o material', () => {
    const expected = {
        [ID.GRASS]: 'grass',
        [ID.TALL_GRASS]: 'grass',
        [ID.LEAVES]: 'grass',
        [ID.DIRT]: 'dirt',
        [ID.STONE]: 'stone',
        [ID.COBBLE]: 'stone',
        [ID.COAL_ORE]: 'stone',
        [ID.FURNACE]: 'stone',
        [ID.LOG]: 'wood',
        [ID.PLANKS]: 'wood',
        [ID.CRAFTING_TABLE]: 'wood',
        [ID.CHEST]: 'wood',
        [ID.WOOD_DOOR_BOTTOM]: 'wood',
        [ID.SAND]: 'sand',
        [ID.WOOL_BLOCK_WHITE]: 'wool',
        [ID.WOOL_BLOCK_GRAY]: 'wool',
        [ID.WOOL_BLOCK_BLACK]: 'wool',
    };
    for (const [id, material] of Object.entries(expected)) {
        assert.equal(stepMaterialFor(Number(id)), material, `bloco ${Number(id)}`);
    }
});

test('ar, água e tocha não fazem barulho de passo', () => {
    for (const type of [0, ID.WATER, ID.WATER_FLOW_1, ID.WATER_FALL, ID.TORCH, 9999]) {
        assert.equal(stepMaterialFor(type), null, `bloco ${type}`);
        assert.equal(stepSoundFor(type), null);
    }
    assert.equal(stepSoundFor(ID.GRASS), 'step-grass');
});

test('todo bloco do catálogo que não é líquido tem passo definido', () => {
    // Garante que blocos novos não fiquem silenciosos por esquecimento.
    const silent = [];
    for (const [id, block] of Object.entries(BLOCKS)) {
        const type = Number(id);
        if (block.render === 'liquid') continue;
        if (block.waterLevel || block.waterSource) continue;
        if (type === ID.TORCH || type === ID.TORCH_WALL_XP || type === ID.TORCH_WALL_XN
            || type === ID.TORCH_WALL_ZP || type === ID.TORCH_WALL_ZN) continue;
        if (!stepMaterialFor(type)) silent.push(`${block.name} (${type})`);
    }
    assert.deepEqual(silent, []);
});

test('só conta passo com o pé no chão e fora da água', () => {
    const base = { moved: 0.08, dt: 1 / 60, onGround: true, inWater: false };
    assert.equal(stepDistanceThisFrame(base), 0.08);
    assert.equal(stepDistanceThisFrame({ ...base, onGround: false }), 0, 'pulando/caindo');
    assert.equal(stepDistanceThisFrame({ ...base, inWater: true }), 0, 'nadando tem som próprio');
    assert.equal(stepDistanceThisFrame({ ...base, moved: 0 }), 0, 'parado');
    assert.equal(stepDistanceThisFrame({ ...base, moved: 0.0008 }), 0, 'abaixo da velocidade mínima');
    assert.equal(stepDistanceThisFrame({ ...base, dt: 0 }), 0);
    assert.equal(stepDistanceThisFrame(), 0);
});

test('deslocamento de teleporte ou parede não vira passo', () => {
    const base = { dt: 1 / 60, onGround: true, inWater: false };
    // respawn/carregamento movem o jogador dezenas de blocos em um quadro
    assert.equal(stepDistanceThisFrame({ ...base, moved: STEP_MAX_MOVED * 2 }), 0);
    // empurrando a parede: a velocidade continua, o deslocamento é ~0
    assert.equal(stepDistanceThisFrame({ ...base, moved: 1e-6 }), 0);
});

test('o tom de cada passo varia dentro de uma faixa curta', () => {
    assert.equal(stepPitch(() => 0), 0.9);
    assert.equal(stepPitch(() => 1), 1.1);
    assert.equal(stepPitch(() => 0.5), 1);
    for (let i = 0; i < 50; i++) {
        const pitch = stepPitch();
        assert.ok(pitch >= 0.9 && pitch <= 1.1, `variação fora da faixa: ${pitch}`);
    }
});

test('game.js toca o passo do bloco sob os pés com o áudio compartilhado', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /const audio = getSharedAudio\(\)/, 'reaproveita o AudioContext do menu');
    assert.match(source, /const raw = Math\.hypot\(p\.x - footPos\.x, p\.z - footPos\.z\)/);
    assert.match(source, /stepDistanceThisFrame\(\{ moved, dt, onGround: player\.onGround, inWater \}\)/);
    assert.match(source, /Math\.floor\(player\.pos\.y - 0\.05\)/, 'pega o bloco sob os pés');
    assert.match(source, /audio\.play\(sound, \{[\s\S]{0,160}?rate: stepPitch\(\)/);

    const menu = readFileSync(new URL('../world-menu.js', import.meta.url), 'utf8');
    assert.match(menu, /getSharedAudio\(/, 'o menu cria o sistema que o jogo reaproveita');
});
