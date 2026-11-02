import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as THREE from '../vendor/three/three.module.js';
import { BLOCKS, ID } from '../world-catalog.js';
import {
    createWaterSystemClass, WATER_FLOW_CELLS_PER_TICK, WATER_FLOW_INTERVAL, WATER_FLOW_QUEUE_LIMIT,
    WATER_FLOW_QUEUE_COMPACT_MIN,
} from '../world-water.js';

const WORLD_HEIGHT = 64;
const FLOOR = 28;

function createWater() {
    const WaterSystem = createWaterSystemClass({
        THREE, BLOCKS, ID, WORLD_HEIGHT, WATER_LEVEL: 26, onSubmersionChange: () => {},
    });
    return new WaterSystem(undefined);
}

const cellKey = (x, y, z) => `${x},${y},${z}`;

function fakeWorld() {
    const blocks = new Map();
    return {
        blocks,
        getBlock: (x, y, z) => blocks.get(cellKey(x, y, z)) ?? 0,
        setBlock: (x, y, z, type) => {
            const key = cellKey(x, y, z);
            if ((blocks.get(key) ?? 0) === type) return false; // setBlock só "muda" de fato
            if (type === 0) blocks.delete(key);
            else blocks.set(key, type);
            return true;
        },
        countWhere: predicate => [...blocks.values()].filter(predicate).length,
    };
}

// Piso de pedra + paredes, para a água não cair nem sair do mapa do teste.
function stoneBasin(world, radius = 9) {
    for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) world.setBlock(x, FLOOR, z, ID.STONE);
    }
}

test('fila devolve as células na ordem em que entraram', () => {
    const water = createWater();
    water.enqueue(1, 30, 0);
    water.enqueue(2, 30, 0);
    water.enqueue(3, 30, 0);

    assert.equal(water.pendingFlow(), 3);
    assert.equal(water.dequeueFlow().key, '1,30,0');
    assert.equal(water.dequeueFlow().key, '2,30,0');
    assert.equal(water.dequeueFlow().key, '3,30,0');
    assert.equal(water.pendingFlow(), 0);
});

test('a mesma célula não entra duas vezes na fila', () => {
    const water = createWater();
    water.enqueue(1, 30, 1);
    water.enqueue(1, 30, 1);
    assert.equal(water.pendingFlow(), 1);

    // depois de processada, ela pode voltar (a marcação é removida na saída)
    water.dequeueFlow();
    water.enqueue(1, 30, 1);
    assert.equal(water.pendingFlow(), 1);
});

test('cada passada processa no máximo WATER_FLOW_CELLS_PER_TICK células', () => {
    const world = fakeWorld();
    const water = createWater();
    for (let i = 0; i < 20; i++) water.enqueue(i, 30, 0); // ar: sai da fila sem efeito

    water.updateFlow(world, WATER_FLOW_INTERVAL);
    assert.equal(water.pendingFlow(), 20 - WATER_FLOW_CELLS_PER_TICK);

    water.updateFlow(world, WATER_FLOW_INTERVAL);
    assert.equal(water.pendingFlow(), 20 - WATER_FLOW_CELLS_PER_TICK * 2);

    water.updateFlow(world, WATER_FLOW_INTERVAL);
    assert.equal(water.pendingFlow(), 0, 'a fila termina vazia');
});

test('antes do intervalo não há trabalho nenhum', () => {
    const world = fakeWorld();
    const water = createWater();
    for (let i = 0; i < 5; i++) water.enqueue(i, 30, 0);

    water.updateFlow(world, WATER_FLOW_INTERVAL * 0.5);
    assert.equal(water.pendingFlow(), 5);
});

test('o limite da fila conta só as células pendentes', () => {
    const world = fakeWorld();
    const water = createWater();
    for (let i = 0; i < WATER_FLOW_QUEUE_LIMIT + 10; i++) {
        water.enqueue(i % 40, 30, Math.floor(i / 40));
    }
    assert.equal(water.pendingFlow(), WATER_FLOW_QUEUE_LIMIT, 'enche até o limite');

    water.updateFlow(world, WATER_FLOW_INTERVAL);
    const freed = WATER_FLOW_CELLS_PER_TICK;
    assert.equal(water.pendingFlow(), WATER_FLOW_QUEUE_LIMIT - freed);

    // espaço liberado volta a aceitar células
    water.enqueue(999, 30, 999);
    assert.equal(water.pendingFlow(), WATER_FLOW_QUEUE_LIMIT - freed + 1);
});

test('a fila não cresce sem limite: o array é compactado durante o consumo', () => {
    const world = fakeWorld();
    const water = createWater();
    for (let i = 0; i < 600; i++) water.enqueue(i % 50, 30, Math.floor(i / 50));

    const slack = [];
    const lengths = [];
    for (let tick = 0; tick < 100; tick++) {
        water.updateFlow(world, WATER_FLOW_INTERVAL);
        slack.push(water.flowQueue.length - water.pendingFlow()); // células já consumidas guardadas
        lengths.push(water.flowQueue.length);
    }

    assert.equal(water.pendingFlow(), 0, 'fila drenou');
    // A compactação acontece quando metade do array já foi consumida: a folga
    // nunca passa de metade da fila inicial, e o array nunca cresce acima dela.
    assert.ok(Math.max(...slack) <= 300 + WATER_FLOW_CELLS_PER_TICK, `folga alta demais: ${Math.max(...slack)}`);
    assert.ok(Math.max(...lengths) <= 600, 'o array não cresce além do que foi enfileirado');
    assert.ok(water.flowQueue.length <= WATER_FLOW_QUEUE_COMPACT_MIN + WATER_FLOW_CELLS_PER_TICK,
        `sobrou array grande no fim: ${water.flowQueue.length}`);
});

test('a água continua escorrendo pela vizinhança depois das compactações', () => {
    const world = fakeWorld();
    stoneBasin(world, 9);
    world.setBlock(0, FLOOR + 1, 0, ID.WATER); // fonte sobre o piso
    const water = createWater();
    water.activate(world, 0, FLOOR + 1, 0);

    for (let tick = 0; tick < 120; tick++) water.updateFlow(world, WATER_FLOW_INTERVAL);

    const flowing = world.countWhere(type => BLOCKS[type]?.flowing);
    assert.ok(flowing >= 4, `esperava água de fluxo espalhada, veio ${flowing}`);
    assert.equal(world.getBlock(0, FLOOR + 1, 0), ID.WATER, 'a fonte continua no lugar');
    assert.equal(BLOCKS[world.getBlock(3, FLOOR + 1, 0)]?.render, 'liquid', 'chegou a 3 blocos');
    assert.equal(world.countWhere(type => BLOCKS[type]?.waterSource), 1, 'nenhuma fonte nova');
});

test('fluxo isolado continua evaporando com a fila por cursor', () => {
    const world = fakeWorld();
    stoneBasin(world, 3);
    world.setBlock(2, FLOOR + 1, 2, ID.WATER_FLOW_2);

    const water = createWater();
    water.enqueue(2, FLOOR + 1, 2);
    for (let tick = 0; tick < 10; tick++) water.updateFlow(world, WATER_FLOW_INTERVAL);

    assert.equal(world.getBlock(2, FLOOR + 1, 2), 0);
});

test('a fila não usa mais shift() (custo O(fila) por célula)', () => {
    const source = readFileSync(new URL('../world-water.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /flowQueue\.shift\(\)/);
    assert.match(source, /this\.flowHead\+= 1;|this\.flowHead\+\+;/);
    assert.match(source, /pendingFlow\(\) >= WATER_FLOW_QUEUE_LIMIT/);
    assert.match(source, /step < WATER_FLOW_CELLS_PER_TICK && this\.pendingFlow\(\) > 0/);
    assert.match(source, /this\.flowQueue = this\.flowQueue\.slice\(this\.flowHead\)/);
});
