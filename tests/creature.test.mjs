import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../vendor/three/three.module.js';
import { BLOCKS, ID } from '../world-catalog.js';
import {
    CHIRP_COOLDOWN,
    CHIRP_RANGE,
    GLIDE_DURATION,
    CREATURE_LIMIT,
    DESPAWN_DISTANCE,
    FLEE_SPEED,
    HIT_COOLDOWN,
    HOP_DURATION,
    HOP_HEIGHT,
    SCARE_DURATION,
    SCARE_RADIUS,
    SCARE_SPEED,
    WANDER_SPEED,
    chirpFor,
    createCreatureSystemClass,
    creatureInReach,
    glideHeightAt,
    shouldFlee,
} from '../world-creature.js';

const CHUNK_SIZE = 16;
const GROUND = 10; // `heightAt` devolve o bloco do topo; o Mofim anda em GROUND + 1

// Mundo plano de grama com um relógio controlado pelo teste. `heightAt` pode ser
// trocado para montar degraus.
function makeWorld({ heightAt = () => GROUND, groundType = () => ID.GRASS, above = () => 0 } = {}) {
    const groundAt = (x, z) => heightAt(Math.floor(x), Math.floor(z));
    return {
        seed: 4242,
        scene: new THREE.Scene(),
        getChunk: () => ({}),
        generator: { heightAt: (x, z) => heightAt(x, z) },
        getBlock: (x, y, z) => {
            const gx = Math.floor(x), gz = Math.floor(z);
            const ground = groundAt(gx, gz);
            if (y === ground) return groundType(gx, gz);
            if (y === ground + 1) return above(gx, gz);
            return 0;
        },
    };
}

function makeSystem(world, clock, { onChirp = () => {} } = {}) {
    const CreatureSystem = createCreatureSystemClass({
        THREE, ID, BLOCKS, CHUNK_SIZE, now: () => clock.t, onChirp,
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

// ------------------------------------------------ chilreio

test('chilreio só acontece perto, respeitando a espera entre chamados', () => {
    const base = { at: 100, distance: 5 };
    assert.equal(chirpFor({ ...base, lastChirpAt: 99.9 }), null, 'espera entre chamados');
    assert.equal(chirpFor({ at: 100, distance: CHIRP_RANGE + 1, nextIdleAt: 0 }), null, 'longe demais');

    assert.equal(chirpFor({ ...base, pending: 'startle' }), 'startle', 'o grito do susto');
    assert.equal(chirpFor({ ...base, scared: true }), 'panic', 'chiado de quem está fugindo');
    assert.equal(chirpFor({ ...base, nextIdleAt: 50 }), 'idle', 'chamado de passeio na hora sorteada');
    assert.equal(chirpFor({ ...base, nextIdleAt: 500 }), null, 'fora da hora sorteada fica calado');
    assert.equal(chirpFor({ ...base, lastChirpAt: 100 - CHIRP_COOLDOWN }), null, 'no limite da espera ainda cala');
});

test('levar um golpe faz o Mofim gritar, e não repete no mesmo instante', () => {
    const clock = { t: 0 };
    const chirps = [];
    const world = makeWorld();
    const system = makeSystem(world, clock, { onChirp: info => chirps.push(info) });
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 2; creature.z = 0; creature.y = GROUND + 1;
    clock.t = 40;
    system.hitFrom({ x: 0, y: GROUND + 1.45, z: 0 }, { x: 1, y: 0, z: 0 });
    clock.t += 0.02;
    system.update(0.02, player, true);

    assert.equal(chirps.length, 1, 'um chilreio');
    assert.equal(chirps[0].reason, 'startle', 'e é o grito, não o chamado de passeio');

    // Segurando o botão o golpe se repete a cada cooldown, mas o chilreio tem o
    // seu próprio intervalo: sem dois bipes seguidos.
    clock.t += 0.4;
    system.hitFrom({ x: 0, y: GROUND + 1.45, z: 0 }, { x: 1, y: 0, z: 0 });
    clock.t += 0.02;
    system.update(0.02, player, true);
    assert.equal(chirps.length, 1, 'o chilreio tem espera própria');

    clock.t += CHIRP_COOLDOWN;
    system.update(0.02, player, true);
    assert.equal(chirps.length, 2, 'passada a espera, ele chia de novo');
    assert.equal(chirps[1].reason, 'startle', 'o novo golpe é um grito novo');
});

test('longe do jogador o Mofim não chia', () => {
    const clock = { t: 0 };
    const chirps = [];
    const world = makeWorld();
    const system = makeSystem(world, clock, { onChirp: info => chirps.push(info) });
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = CHIRP_RANGE + 5; creature.z = 0;
    clock.t = 40;
    system.scare(creature, clock.t, { x: 0, z: 0 });
    for (let i = 0; i < 20; i++) { clock.t += 0.1; system.update(0.1, player, true); }

    assert.deepEqual(chirps, [], 'fora do alcance, silêncio');
    assert.equal(creature.chirpPending, null, 'e o grito não fica guardado para depois');
});

// ------------------------------------------------ degrau

test('degrau de um bloco: ele sobe pulando, com arco visível', () => {
    const clock = { t: 0 };
    // Chão em 10 (pé em 11) até x = 2; a partir de x = 3 o chão sobe um bloco.
    const world = makeWorld({ heightAt: x => (x >= 3 ? GROUND + 1 : GROUND) });
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 1.5; creature.z = 0; creature.y = GROUND + 1;
    let highest = -Infinity;
    for (let i = 0; i < 60; i++) {
        clock.t += 0.05;
        creature.targetX = 6; creature.targetZ = 0; // empurra o passeio degrau acima
        system.update(0.05, player, true);
        highest = Math.max(highest, creature.group.position.y);
    }

    assert.equal(creature.y, GROUND + 2, 'subiu o degrau');
    assert.ok(creature.x > 3, `atravessou o degrau (x = ${creature.x.toFixed(2)})`);
    assert.ok(
        highest > GROUND + 2 + HOP_HEIGHT * 0.6,
        `o pulo aparece no desenho (máximo ${highest.toFixed(2)})`,
    );
    // Depois do pulo ele volta ao chão (fora da janela do arco).
    clock.t += HOP_DURATION;
    system.update(HOP_DURATION, player, true);
    assert.ok(Math.abs(creature.group.position.y - creature.y) < 0.1, 'assentou no chão');
});

test('degrau de dois blocos: continua barrado', () => {
    const clock = { t: 0 };
    // Chão sobe dois blocos de uma vez a partir de x = 3.
    const world = makeWorld({ heightAt: x => (x >= 3 ? GROUND + 2 : GROUND) });
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 1.5; creature.z = 0; creature.y = GROUND + 1;
    for (let i = 0; i < 60; i++) {
        clock.t += 0.05;
        creature.targetX = 6; creature.targetZ = 0;
        system.update(0.05, player, true);
    }

    assert.equal(creature.y, GROUND + 1, 'não subiu');
    assert.ok(creature.x < 3, `parou antes da parede (x = ${creature.x.toFixed(2)})`);
});

// ------------------------------------------------ descida (planeio)

test('planeio desce depressa no começo e pousa devagar', () => {
    const from = 12, to = 11;

    assert.equal(glideHeightAt(from, to, 0), from);
    assert.equal(glideHeightAt(from, to, 1), to);

    // Monotônico: sempre descendo, nunca abaixo do chão.
    let previous = from;
    for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
        const y = glideHeightAt(from, to, progress);
        assert.ok(y < previous, `desce em ${progress}: ${y} >= ${previous}`);
        assert.ok(y > to, `não atravessa o chão em ${progress}: ${y}`);
        previous = y;
    }

    // O primeiro quarto da descida cai muito mais que o último: é o que separa
    // "planeio" de "queda" (que aceleraria ao contrário).
    const primeiroQuarto = from - glideHeightAt(from, to, 0.25);
    const ultimoQuarto = glideHeightAt(from, to, 0.75) - to;
    assert.ok(primeiroQuarto > ultimoQuarto * 3, 'a descida desacelera até pousar');
});

test('descer um degrau é planeio: o corpo fica no ar com as asas abertas', () => {
    const clock = { t: 0 };
    // Chão em 11 (pé em 12) até x = 2; a partir de x = 3 o chão desce um bloco.
    const world = makeWorld({ heightAt: x => (x >= 3 ? GROUND - 1 : GROUND) });
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 1.5; creature.z = 0; creature.y = GROUND + 1;
    const frames = [];
    for (let i = 0; i < 60; i++) {
        clock.t += 0.05;
        creature.targetX = 6; creature.targetZ = 0;
        system.update(0.05, player, true);
        frames.push({
            above: creature.group.position.y - creature.y,
            wing: Math.abs(creature.leftWing.rotation.z),
            pitch: creature.group.rotation.x,
        });
    }

    assert.equal(creature.y, GROUND, 'o nível lógico desceu');
    assert.ok(creature.x > 3, `atravessou o degrau (x = ${creature.x.toFixed(2)})`);

    const planejando = frames.filter(f => f.above > 0.3);
    assert.ok(planejando.length > 0, 'em algum quadro o corpo estava acima do chão novo');
    assert.ok(
        planejando.every(f => f.wing < 0.12),
        'com as asas abertas na horizontal enquanto planeia',
    );
    assert.ok(
        Math.max(...frames.map(f => f.pitch)) > 0.1,
        'o corpo inclina para a frente no planeio',
    );

    // No fim, assentou no chão e voltou à pose de passeio.
    clock.t += GLIDE_DURATION;
    system.update(GLIDE_DURATION, player, true);
    assert.ok(Math.abs(creature.group.position.y - creature.y) < 0.1, 'pousou');
    assert.ok(Math.abs(creature.leftWing.rotation.z) > 0.1, 'asas voltaram ao normal');
});

test('subir e descer em sequência não teleporta o corpo', () => {
    const clock = { t: 0 };
    // Serrilhado: 11, 12, 11... a cada bloco de x.
    const world = makeWorld({ heightAt: x => GROUND + (Math.floor(x) % 2 ? 1 : 0) });
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 1.5; creature.z = 0; creature.y = GROUND + 1;
    let biggestJump = 0;
    let previousY = creature.group.position.y;
    for (let i = 0; i < 80; i++) {
        clock.t += 0.03;
        creature.targetX = 8; creature.targetZ = 0;
        system.update(0.03, player, true);
        biggestJump = Math.max(biggestJump, Math.abs(creature.group.position.y - previousY));
        previousY = creature.group.position.y;
    }

    assert.ok(biggestJump < 0.35, `sem salto seco no desenho (maior variação ${biggestJump.toFixed(2)})`);
});

// ------------------------------------------------ obstáculos no caminho

test('grama alta não prende: fugindo, ele atravessa a touceira', () => {
    const clock = { t: 0 };
    // Toda a área tem grama alta em cima do chão — era o que travava a fuga.
    const world = makeWorld({ above: (x) => (x >= 2 ? ID.TALL_GRASS : 0) });
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 2; creature.z = 0; creature.y = GROUND + 1;
    const runner = walkerPlayer({ x: 0, y: GROUND + 1, z: 0 });
    const before = creature.x;

    for (let i = 0; i < 12; i++) {
        clock.t += 0.05;
        system.update(0.05, runner, true);
    }

    assert.ok(creature.scaredUntil > clock.t, 'continuou assustado');
    assert.ok(creature.x > before + 1, `correu através da grama (${before} → ${creature.x.toFixed(2)})`);
});

test('num campo todo de grama alta ele ainda nasce e passeia', () => {
    const clock = { t: 0 };
    const world = makeWorld({ above: () => ID.TALL_GRASS });
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });

    const creature = spawnOne(system, world, clock, player);
    const before = { x: creature.x, z: creature.z };
    for (let i = 0; i < 80; i++) {
        clock.t += 0.1;
        system.update(0.1, player, true);
    }
    assert.ok(
        Math.hypot(creature.x - before.x, creature.z - before.z) > 0.5,
        'não ficou parado no capim',
    );
});

test('água barra o passo: fugindo para o lado do lago, ele desvia', () => {
    const clock = { t: 0 };
    // Água na célula acima do chão a partir de x = 3 (o lado para onde fugiria).
    const world = makeWorld({ above: (x) => (x >= 3 ? ID.WATER : 0) });
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 2; creature.z = 0; creature.y = GROUND + 1;
    const runner = walkerPlayer({ x: 0, y: GROUND + 1, z: 0 });

    for (let i = 0; i < 20; i++) {
        clock.t += 0.05;
        system.update(0.05, runner, true);
    }

    assert.ok(creature.x < 3, `não entrou na água (x = ${creature.x.toFixed(2)})`);
    assert.ok(Math.abs(creature.z) > 0.3, `desviou para o lado (z = ${creature.z.toFixed(2)})`);
});

test('ele anda em areia e pedra, não só em grama', () => {
    const clock = { t: 0 };
    // Chão de areia a partir de x = 2: antes a coluna era recusada e ele parava ali.
    const world = makeWorld({ groundType: x => (x >= 2 ? ID.SAND : ID.GRASS) });
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 1.5; creature.z = 0; creature.y = GROUND + 1;
    for (let i = 0; i < 40; i++) {
        clock.t += 0.05;
        creature.targetX = 5; creature.targetZ = 0;
        system.update(0.05, player, true);
    }
    assert.ok(creature.x > 2, `andou na areia (x = ${creature.x.toFixed(2)})`);
    assert.equal(creature.y, GROUND + 1);
});

// ------------------------------------------------ golpe x bloco na mira

test('bloco mais perto na mira: o Mofim atrás não leva o golpe', () => {
    const origin = { x: 0, y: 1.45, z: 0 };
    const aim = { x: 1, y: 0, z: 0 };
    const creature = entityAt(3, 1, 0);

    assert.equal(
        creatureInReach([creature], origin, aim, { maxDistance: 2 }),
        null,
        'bloco a 2 blocos: o bicho a 3 está atrás dele',
    );
    assert.equal(
        creatureInReach([creature], origin, aim, { maxDistance: 3.5 }),
        creature,
        'bloco além do bicho: o golpe é do bicho',
    );
    assert.equal(creatureInReach([creature], origin, aim), creature, 'sem bloco na mira, vale a distância');
});

test('mirar de raspão não rouba o golpe do bloco', () => {
    const origin = { x: 0, y: 1.45, z: 0 };
    const aim = { x: 1, y: 0, z: 0 };
    // ~35° fora da mira: dentro do cone antigo (44°), fora do novo (31°).
    const aside = entityAt(Math.cos(0.61) * 2, 1, Math.sin(0.61) * 2);
    assert.equal(creatureInReach([aside], origin, aim), null);
});
