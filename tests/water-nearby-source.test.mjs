import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../vendor/three/three.module.js';
import { BLOCKS, ID } from '../world-catalog.js';
import { createWaterSystemClass } from '../world-water.js';

const WORLD_HEIGHT = 64;

function createWater() {
    const WaterSystem = createWaterSystemClass({
        THREE, BLOCKS, ID, WORLD_HEIGHT, onSubmersionChange: () => {},
    });
    return new WaterSystem(undefined);
}

const cellKey = (x, y, z) => `${x},${y},${z}`;

// Mundo de mentira que também conta leituras: é como o teste mede o custo da
// busca (quantos blocos ela consulta para responder).
function fakeWorld() {
    const blocks = new Map();
    let reads = 0;
    return {
        blocks,
        get reads() { return reads; },
        resetReads() { reads = 0; },
        getBlock: (x, y, z) => {
            reads++;
            return blocks.get(cellKey(x, y, z)) ?? 0;
        },
        setBlock: (x, y, z, type) => {
            if (type === 0) blocks.delete(cellKey(x, y, z));
            else blocks.set(cellKey(x, y, z), type);
            return true;
        },
    };
}

const SOURCE = ID.WATER;
const FLOW = ID.WATER_FLOW_4;
const FALL = ID.WATER_FALL;

// Fileira de água na horizontal, em `y`, começando em `x0` e indo até `x1`.
function horizontalLine(world, { y, z = 0, from, to, type = FLOW }) {
    for (let x = from; x <= to; x++) world.setBlock(x, y, z, type);
}

test('a própria célula sendo fonte já responde sim', () => {
    const water = createWater();
    const world = fakeWorld();
    world.setBlock(0, 30, 0, SOURCE);

    assert.equal(water.hasNearbySource(world, { x: 0, y: 30, z: 0 }), true);
});

test('fonte encostada na célula responde sim', () => {
    const water = createWater();
    const world = fakeWorld();
    world.setBlock(0, 30, 0, FLOW);
    world.setBlock(1, 30, 0, SOURCE);

    assert.equal(water.hasNearbySource(world, { x: 0, y: 30, z: 0 }), true);
});

test('o limite de sete passos é exato: alcança em 7, não alcança em 8', () => {
    const water = createWater();

    const reachable = fakeWorld();
    horizontalLine(reachable, { y: 30, from: 0, to: 6 });
    reachable.setBlock(7, 30, 0, SOURCE);
    assert.equal(
        water.hasNearbySource(reachable, { x: 0, y: 30, z: 0 }),
        true,
        'fonte a 7 blocos conta como perto (o 7º passo entra)',
    );

    const tooFar = fakeWorld();
    horizontalLine(tooFar, { y: 30, from: 0, to: 7 });
    tooFar.setBlock(8, 30, 0, SOURCE);
    assert.equal(
        water.hasNearbySource(tooFar, { x: 0, y: 30, z: 0 }),
        false,
        'fonte a 8 blocos não é perto: essa água evapora',
    );
});

test('a busca segue curva, não linha reta', () => {
    const water = createWater();
    const world = fakeWorld();
    // Água em "L": 4 passos para +x, 3 passos para +z. A fonte fica a 7 passos
    // *pelo caminho*, mas a ~5 em linha reta — uma busca gulosa/por raio erraria.
    horizontalLine(world, { y: 30, from: 0, to: 4 });
    for (let z = 1; z <= 3; z++) world.setBlock(4, 30, z, FLOW);
    world.setBlock(4, 30, 3, SOURCE);

    assert.equal(water.hasNearbySource(world, { x: 0, y: 30, z: 0 }), true);
});

test('um buraco na água corta o caminho até a fonte', () => {
    const water = createWater();
    const world = fakeWorld();
    world.setBlock(0, 30, 0, FLOW);
    world.setBlock(1, 30, 0, FLOW);
    // (2,30,0) fica vazio: a água não atravessa ar.
    world.setBlock(3, 30, 0, SOURCE);

    assert.equal(water.hasNearbySource(world, { x: 0, y: 30, z: 0 }), false);
});

test('só água conta: bloco sólido no lugar da água não emenda o caminho', () => {
    const water = createWater();
    const world = fakeWorld();
    world.setBlock(0, 30, 0, FLOW);
    world.setBlock(1, 30, 0, ID.STONE);
    world.setBlock(2, 30, 0, SOURCE);

    assert.equal(water.hasNearbySource(world, { x: 0, y: 30, z: 0 }), false);
});

test('descer não custa passo: cachoeira longa continua ligada à fonte', () => {
    const water = createWater();
    const world = fakeWorld();
    world.setBlock(0, 50, 0, SOURCE);
    for (let y = 49; y >= 10; y--) world.setBlock(0, y, 0, FALL);

    assert.equal(
        water.hasNearbySource(world, { x: 0, y: 10, z: 0 }),
        true,
        '40 blocos de queda não gastam nenhum dos 7 passos',
    );
});

test('o orçamento de passos também limita o que é explorado', () => {
    const water = createWater();

    // Fonte a 6 passos: com orçamento 5 não é perto, com 6 é.
    const world = fakeWorld();
    horizontalLine(world, { y: 30, from: 0, to: 5 });
    world.setBlock(6, 30, 0, SOURCE);
    assert.equal(water.hasNearbySource(world, { x: 0, y: 30, z: 0 }, 5), false);
    assert.equal(water.hasNearbySource(world, { x: 0, y: 30, z: 0 }, 6), true);

    // Com orçamento 0 só a própria célula é examinada: nem o vizinho de cima,
    // que "não custa passo", é visitado — expandir exige orçamento > 0.
    const capped = fakeWorld();
    capped.setBlock(0, 30, 0, FALL);
    capped.setBlock(0, 31, 0, SOURCE);
    assert.equal(water.hasNearbySource(capped, { x: 0, y: 30, z: 0 }, 0), false);
    assert.equal(water.hasNearbySource(capped, { x: 0, y: 31, z: 0 }, 0), true);
});

test('queda sem fonte em cima não engana a busca', () => {
    const water = createWater();
    const world = fakeWorld();
    for (let y = 49; y >= 10; y--) world.setBlock(0, y, 0, FALL);

    assert.equal(water.hasNearbySource(world, { x: 0, y: 10, z: 0 }), false);
});

test('limite do mundo não é visitado e não trava a busca', () => {
    const water = createWater();
    const world = fakeWorld();
    world.setBlock(0, 0, 0, FLOW);
    // Água "fora" do mundo, em y = -1: só poderia ser alcançada descendo.
    world.setBlock(0, -1, 0, SOURCE);
    world.setBlock(0, WORLD_HEIGHT, 0, SOURCE);

    assert.equal(
        water.hasNearbySource(world, { x: 0, y: 0, z: 0 }),
        false,
        'y < 0 e y >= WORLD_HEIGHT ficam de fora',
    );
});

test('água em ciclo sem fonte termina e responde não', () => {
    const water = createWater();
    const world = fakeWorld();
    // Quadrado de água de 3x3 em volta da célula inicial: todo mundo é vizinho
    // de todo mundo. Sem o controle de visitados isto rodaria para sempre.
    for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) world.setBlock(x, 30, z, FLOW);
    }

    assert.equal(water.hasNearbySource(world, { x: 0, y: 30, z: 0 }), false);
});

test('o custo da busca é limitado mesmo num lago grande', () => {
    const water = createWater();
    const world = fakeWorld();
    // Lago sem fonte: bacia de 41x41 de água de fluxo, 10 blocos de altura.
    for (let x = -20; x <= 20; x++) {
        for (let z = -20; z <= 20; z++) {
            for (let y = 20; y < 30; y++) world.setBlock(x, y, z, FLOW);
        }
    }

    world.resetReads();
    const found = water.hasNearbySource(world, { x: 0, y: 29, z: 0 });

    assert.equal(found, false);
    // Horizontal custa passo (limite 7) e vertical é de graça, então o pior caso
    // é a coluna: ~15x15 posições × 64 de altura. Medido em 2.429 leituras (5 ms);
    // o teto é folgado de propósito — serve para pegar uma regressão do tipo
    // "varrer o mundo", não para fixar o número exato.
    assert.ok(world.reads < 5000, `leu ${world.reads} blocos; o esperado é algo em torno de 2,4 mil`);
});
