import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../vendor/three/three.module.js';
import { ID } from '../world-catalog.js';
import {
    CREATURE_LIMIT,
    DESPAWN_DISTANCE,
    FLEE_SPEED,
    HIT_COOLDOWN,
    SCARE_DURATION,
    SCARE_RADIUS,
    SCARE_SPEED,
    WANDER_SPEED,
    createCreatureSystemClass,
    creatureInReach,
    shouldFlee,
} from '../world-creature.js';

const CHUNK_SIZE = 16;
const GROUND = 10; // `heightAt` devolve o bloco do topo; o Mofim anda em GROUND + 1

// Mundo plano de grama com um relógio controlado pelo teste.
function makeWorld() {
    return {
        seed: 4242,
        scene: new THREE.Scene(),
        getChunk: () => ({}),
        generator: { heightAt: () => GROUND },
        getBlock: (x, y) => (y === GROUND ? ID.GRASS : 0),
    };
}

function makeSystem(world, clock) {
    const CreatureSystem = createCreatureSystemClass({
        THREE, ID, CHUNK_SIZE, now: () => clock.t,
    });
    return new CreatureSystem(world);
}

const idlePlayer = pos => ({ pos, vel: { x: 0, z: 0 }, crouching: false });
const walkerPlayer = (pos, crouching = false) => ({ pos, vel: { x: SCARE_SPEED + 2, z: 0 }, crouching });

// Deixa o spawn acontecer e devolve a primeira criatura.
function spawnOne(system, world, clock, player) {
    for (let i = 0; i < 40 && system.entities.length === 0; i++) {
        clock.t += 5;
        system.update(0.016, player, true);
    }
    assert.equal(system.entities.length, 1, 'o Mofim deveria ter nascido');
    return system.entities[0];
}

// ------------------------------------------------ regra do susto (pura)

test('chegar perto correndo assusta', () => {
    assert.equal(shouldFlee({ distance: SCARE_RADIUS, playerSpeed: SCARE_SPEED }), true, 'no limite do raio ainda assusta');
    assert.equal(shouldFlee({ distance: 2, playerSpeed: 5.6 }), true, 'correndo de perto');
});

test('chegar agachado não assusta, mesmo rápido e colado', () => {
    assert.equal(shouldFlee({ distance: 0.5, playerSpeed: 9, crouching: true }), false);
});

test('andar devagar (abaixo do limiar) não assusta', () => {
    assert.equal(shouldFlee({ distance: 1, playerSpeed: SCARE_SPEED - 0.01 }), false);
    // O passo agachado real (1,3 m/s) fica abaixo do limiar de 2,2.
    assert.equal(shouldFlee({ distance: 1, playerSpeed: 1.3 }), false);
});

test('longe demais não assusta, mesmo correndo', () => {
    assert.equal(shouldFlee({ distance: SCARE_RADIUS + 0.01, playerSpeed: 6 }), false);
    assert.equal(shouldFlee({ distance: 30, playerSpeed: 6 }), false);
});

test('jogador parado não assusta', () => {
    assert.equal(shouldFlee({ distance: 1, playerSpeed: 0 }), false);
});

// ------------------------------------------------ golpe (mira)

const entityAt = (x, y, z) => ({ x, y, z });

test('o golpe acerta o Mofim que está na mira e perto', () => {
    const entities = [entityAt(2, 1, 0)];
    const hit = creatureInReach(entities, { x: 0, y: 1.45, z: 0 }, { x: 1, y: 0, z: 0 });
    assert.equal(hit, entities[0]);
});

test('golpe não acerta o que está atrás, fora do alcance ou fora do ângulo', () => {
    const origin = { x: 0, y: 1.45, z: 0 };
    const aim = { x: 1, y: 0, z: 0 };
    assert.equal(creatureInReach([entityAt(-2, 1, 0)], origin, aim), null, 'atrás');
    assert.equal(creatureInReach([entityAt(9, 1, 0)], origin, aim), null, 'longe');
    assert.equal(creatureInReach([entityAt(0, 4, 0)], origin, aim), null, 'acima da cabeça');
});

test('entre dois na mira, o golpe pega o mais próximo', () => {
    const near = entityAt(1.5, 1, 0);
    const far = entityAt(3, 1, 0);
    assert.equal(creatureInReach([far, near], { x: 0, y: 1.45, z: 0 }, { x: 1, y: 0, z: 0 }), near);
});

// ------------------------------------------------ comportamento

test('nasce no capim, a uma distância segura e no máximo três por vez', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });

    for (let i = 0; i < 200; i++) {
        clock.t += 1;
        system.update(0.016, player, true);
    }

    assert.equal(system.entities.length, CREATURE_LIMIT, 'enche até o limite e para');
    for (const e of system.entities) {
        const distance = Math.hypot(e.x, e.z);
        assert.ok(distance >= 9 && distance <= 24, `nasceu a ${distance.toFixed(1)} do jogador`);
        assert.equal(e.y, GROUND + 1, 'em cima da grama');
        assert.equal(e.group.parent, world.scene, 'o modelo entrou na cena');
    }
});

test('jogador correndo perto assusta e o Mofim corre para longe', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    // Traz o Mofim para 4 blocos do jogador, no eixo +x.
    creature.x = 4; creature.z = 0; creature.y = GROUND + 1;
    const angry = walkerPlayer({ x: 0, y: GROUND + 1, z: 0 });
    const before = Math.hypot(creature.x, creature.z);

    clock.t += 0.2;
    system.update(0.1, angry, true);
    assert.ok(creature.scaredUntil > clock.t, 'ficou assustado');

    for (let i = 0; i < 10; i++) {
        clock.t += 0.1;
        system.update(0.1, angry, true);
    }
    const after = Math.hypot(creature.x, creature.z);
    assert.ok(after > before + 1, `fugiu: ${before.toFixed(2)} → ${after.toFixed(2)}`);
});

test('fugir é mais rápido que vagar', () => {
    assert.ok(FLEE_SPEED > WANDER_SPEED * 3, 'a fuga tem que ser visível');
});

test('jogador agachado não assusta: o Mofim continua o passeio', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 2; creature.z = 0; creature.y = GROUND + 1;
    const sneaking = walkerPlayer({ x: 0, y: GROUND + 1, z: 0 }, true);

    for (let i = 0; i < 20; i++) {
        clock.t += 0.1;
        system.update(0.1, sneaking, true);
    }
    assert.equal(creature.scaredUntil, 0, 'nunca ficou assustado');
});

test('levar um golpe assusta na hora, mesmo agachado e de perto', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 2; creature.z = 0; creature.y = GROUND + 1;
    clock.t = 100;

    const origin = { x: 0, y: GROUND + 1.45, z: 0 };
    const hit = system.hitFrom(origin, { x: 1, y: 0, z: 0 });
    assert.equal(hit, creature, 'o golpe achou o Mofim');
    assert.equal(creature.scaredUntil, 100 + SCARE_DURATION);

    // Botão segurado não vira uma saraivada de golpes: o mesmo Mofim fica em
    // cooldown por um instante.
    assert.equal(system.hitFrom(origin, { x: 1, y: 0, z: 0 }), null);
    clock.t = 100 + HIT_COOLDOWN + 0.001;
    assert.equal(system.hitFrom(origin, { x: 1, y: 0, z: 0 }), creature, 'depois do cooldown volta a valer');
});

test('golpe no vazio não assusta ninguém', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 2; creature.z = 0;
    assert.equal(system.hitFrom({ x: 0, y: GROUND + 1.45, z: 0 }, { x: -1, y: 0, z: 0 }), null);
    assert.equal(creature.scaredUntil, 0);
});

test('o susto passa depois de um tempo e ele acalma', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 4; creature.z = 0;
    clock.t = 50;
    system.scare(creature, clock.t, { x: 0, z: 0 });
    assert.ok(creature.scaredUntil > clock.t);

    // Passado o tempo, com o jogador longe e parado, o medo acaba.
    clock.t += SCARE_DURATION + 0.5;
    system.update(0.1, player, true);
    assert.ok(creature.scaredUntil <= clock.t, 'o medo expirou');
});

test('longe demais, o Mofim desaparece da cena', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = DESPAWN_DISTANCE + 2;
    assert.equal(creature.group.parent, world.scene);

    clock.t += 0.1;
    system.update(0.1, player, true);
    assert.equal(system.entities.length, 0, 'saiu da lista');
    assert.equal(creature.group.parent, null, 'saiu da cena');
});

test('pausado (menu/inventário), nada se move nem nasce', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = walkerPlayer({ x: 0, y: GROUND + 1, z: 0 });

    for (let i = 0; i < 10; i++) {
        clock.t += 5;
        system.update(0.016, player, false);
    }
    assert.equal(system.entities.length, 0);
});
