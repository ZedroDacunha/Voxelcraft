import test from 'node:test';
import assert from 'node:assert/strict';
import { createZombiePopulation, zombieSpawnAllowed, zombieFullBlockSupport } from '../world-zombie-spawn.js';

const base = { distance: 26, blockLight: 0, skyLight: 15, day: 0, safe: true, lightReady: true };
test('nascimento exige distância, segurança e luz de bloco zero', () => {
    assert.equal(zombieSpawnAllowed(base), true);
    for (const change of [{ distance: 23 }, { distance: 33 }, { blockLight: 1 }, { safe: false }, { lightReady: false }, { day: 1 }])
        assert.equal(zombieSpawnAllowed({ ...base, ...change }), false);
    assert.equal(zombieSpawnAllowed({ ...base, skyLight: 0, day: 1 }), true);
    assert.equal(zombieSpawnAllowed({ ...base, distance: NaN }), false);
});

test('população controla limite, distância, descarte e modo sem nascimento', () => {
    let creates = 0, removes = 0, candidates = 0;
    const population = createZombiePopulation({ limit: 2, random: () => 0,
        spawnCandidate: ({ x, z }) => { candidates++; return { x, y: 10, z: z + creates * 4 }; },
        createZombie: position => { creates++; return { state: { ...position, dying: false } }; },
        removeZombie: () => removes++,
    });
    const player = { x: 0, y: 10, z: 0 };
    population.update(7, player, 0, { spawn: false });
    assert.equal(creates, 0);
    assert.equal(candidates, 0);
    population.update(6, player, 0);
    population.update(6, player, 0);
    assert.equal(creates, 2);
    population.update(6, player, 0);
    assert.equal(creates, 2);
    const first = population.entities[0];
    first.state.x = 100;
    population.update(.1, player, 0, { spawn: false });
    assert.equal(removes, 1);
    population.remove(first);
    assert.equal(removes, 1);
    assert.equal(population.entities.length, 1);
});

test('pontos inseguros e posições ocupadas não produzem novos zumbis', () => {
    let creates = 0;
    const population = createZombiePopulation({ random: () => 0,
        spawnCandidate: () => ({ x: 24, y: 0, z: 0 }),
        createZombie: position => { creates++; return { state: { ...position } }; },
        removeZombie: () => {},
    });
    population.update(6, { x: 0, y: 0, z: 0 }, 0);
    population.update(6, { x: 0, y: 0, z: 0 }, 0);
    assert.equal(creates, 1);
});


test('chão aceita sólidos padrão do catálogo e recusa blocos parciais', async () => {
    const { BLOCKS, ID } = await import('../world-catalog.js');
    for (const type of [ID.GRASS, ID.DIRT, ID.STONE]) assert.equal(zombieFullBlockSupport(type, BLOCKS), true);
    for (const type of [0, ID.WATER, ID.TORCH, ID.WOOD_DOOR_BOTTOM, ID.BED_HEAD]) assert.equal(zombieFullBlockSupport(type, BLOCKS), false);
});
