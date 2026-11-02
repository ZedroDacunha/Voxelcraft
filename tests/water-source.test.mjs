import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../vendor/three/three.module.js';
import { BLOCKS, ID } from '../world-catalog.js';
import { createWaterSystemClass } from '../world-water.js';

const WORLD_HEIGHT = 64;
const WATER_LEVEL = 26;

function createWater() {
    const WaterSystem = createWaterSystemClass({
        THREE, BLOCKS, ID, WORLD_HEIGHT, WATER_LEVEL, onSubmersionChange: () => {},
    });
    return new WaterSystem(undefined);
}

const cellKey = (x, y, z) => `${x},${y},${z}`;

function fakeWorld() {
    const blocks = new Map();
    const values = () => [...blocks.values()];
    return {
        blocks,
        getBlock: (x, y, z) => blocks.get(cellKey(x, y, z)) ?? 0,
        setBlock: (x, y, z, type) => {
            if (type === 0) blocks.delete(cellKey(x, y, z));
            else blocks.set(cellKey(x, y, z), type);
            return true;
        },
        countWhere: predicate => values().filter(predicate).length,
        countSources: () => values().filter(type => BLOCKS[type]?.waterSource).length,
    };
}

// Caixa de pedra maciça em volta de y = 30; o interior é aberto pelo teste.
function stoneBox(world, radius, floor = 28, ceiling = 32) {
    for (let x = -radius; x <= radius; x++) {
        for (let y = floor; y <= ceiling; y++) {
            for (let z = -radius; z <= radius; z++) {
                world.setBlock(x, y, z, ID.STONE);
            }
        }
    }
}

test('quebrar bloco ao lado de uma fonte não cria outra fonte', () => {
    const world = fakeWorld();
    stoneBox(world, 2);
    world.setBlock(0, 30, 0, ID.WATER); // fonte no meio da pedra
    const sourcesBefore = world.countSources();
    assert.equal(sourcesBefore, 1);

    const water = createWater();
    const touched = water.onBlockBroken(world, 1, 30, 0); // pedra ao lado da fonte

    assert.equal(touched, true, 'a água deveria ser detectada');
    assert.equal(world.getBlock(1, 30, 0), 0, 'o bloco quebrado vira ar');
    assert.equal(world.countSources(), sourcesBefore, 'nenhuma fonte nova');

    water.updateFlow(world, 0.2);
    const filled = world.getBlock(1, 30, 0);
    assert.equal(BLOCKS[filled]?.render, 'liquid', 'a água escorre para o buraco');
    assert.equal(BLOCKS[filled]?.flowing, true, 'o buraco recebe água de fluxo, não fonte');
    assert.equal(BLOCKS[filled]?.waterSource, undefined);
    assert.equal(world.countSources(), sourcesBefore);

    // A célula fica: há uma fonte adjacente (fluxo longe da fonte evapora).
    water.updateFlow(world, 0.2);
    assert.equal(world.getBlock(1, 30, 0), filled, 'não evapora ao lado da fonte');
});

test('água cai no buraco aberto abaixo de uma fonte', () => {
    const world = fakeWorld();
    stoneBox(world, 2);
    world.setBlock(0, 31, 0, ID.WATER);

    const water = createWater();
    water.onBlockBroken(world, 0, 30, 0); // bloco debaixo da fonte
    water.updateFlow(world, 0.2);

    assert.equal(world.getBlock(0, 30, 0), ID.WATER_FALL, 'a fonte cai pela abertura');
    assert.equal(world.countSources(), 1);
});

test('quebrar longe da água não enfileira fluxo', () => {
    const world = fakeWorld();
    world.setBlock(0, 30, 0, ID.STONE);

    const water = createWater();
    const touched = water.onBlockBroken(world, 0, 30, 0);

    assert.equal(touched, false);
    assert.equal(world.getBlock(0, 30, 0), 0);
    assert.equal(water.flowQueue.length, 0, 'sem água em volta, nada a simular');
});

test('fluxo sem fonte por perto evapora (contraste com o caso da fonte)', () => {
    const world = fakeWorld();
    world.setBlock(10, 30, 10, ID.WATER_FLOW_3); // fluxo isolado, longe de qualquer fonte

    const water = createWater();
    water.enqueue(10, 30, 10);
    water.updateFlow(world, 0.2);

    assert.equal(world.getBlock(10, 30, 10), 0, 'água de fluxo isolada desaparece');
});

test('minerar vários blocos em volta de um lago não multiplica fontes', () => {
    const world = fakeWorld();
    stoneBox(world, 3);
    for (let z = -1; z <= 1; z++) world.setBlock(0, 30, z, ID.WATER); // "lago" de 3 fontes
    const sourcesBefore = world.countSources();
    assert.equal(sourcesBefore, 3);

    const water = createWater();
    const targets = [[1, 30, 0], [1, 30, 1], [-1, 30, 0], [0, 31, 1]];
    for (const [x, y, z] of targets) water.onBlockBroken(world, x, y, z);
    for (let step = 0; step < 20; step++) water.updateFlow(world, 0.2);

    assert.equal(world.countSources(), sourcesBefore, 'o número de fontes permanentes não muda');
    assert.ok(world.countWhere(type => BLOCKS[type]?.flowing) > 0, 'o buraco é preenchido com fluxo');
});
