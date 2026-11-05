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
    HURT_FLASH,
    KNOCKBACK_DISTANCE,
    LEAVE_DURATION,
    MOFIM_HEALTH,
    NIGHT_SPAWN_THRESHOLD,
    SCARE_DURATION,
    SCARE_RADIUS,
    SPAWN_MIN_DISTANCE,
    SPAWN_MAX_DISTANCE,
    FLIGHT_DISTANCE,
    FLIGHT_DURATION,
    FLIGHT_HEIGHT,
    ARRIVE_MIN_GAP,
    ARRIVE_SPEED,
    ARRIVE_SPREAD,
    ARRIVE_STOP_DISTANCE,
    ARRIVE_TIMEOUT,
    arrivalDone,
    CROSS_COOLDOWN,
    CROSS_DISTANCE,
    CROSS_HEIGHT,
    CROSS_RISE,
    crossFlightFor,
    crossHeightAt,
    flightFor,
    flightHeightAt,
    SCARE_SPEED,
    WANDER_SPEED,
    chirpFor,
    createCreatureSystemClass,
    creatureInReach,
    glideHeightAt,
    isMofimTime,
    leaveProgress,
    nightGlow,
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

function makeSystem(world, clock, { onChirp = () => {}, onDeath = () => {} } = {}) {
    const CreatureSystem = createCreatureSystemClass({
        THREE, ID, BLOCKS, CHUNK_SIZE, now: () => clock.t, onChirp, onDeath,
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
    // Daqui para baixo quem manda é o teste: ele posiciona o bicho e escolhe os
    // alvos, então a chegada (que caminha na direção do jogador) sai de cena.
    system.entities[0].arriving = false;
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
    // A distância que importa é a do **nascimento**: depois ele passeia e voa,
    // e cobrar isso ao fim de 200 s de mundo seria cobrar do passeio.
    const nascimentos = [];
    let vistos = 0;

    for (let i = 0; i < 200; i++) {
        clock.t += 1;
        system.update(0.016, player, true);
        for (const e of system.entities.slice(vistos)) {
            nascimentos.push({ distance: Math.hypot(e.x, e.z), y: e.y });
        }
        vistos = system.entities.length;
    }

    assert.equal(system.entities.length, CREATURE_LIMIT, 'enche até o limite e para');
    assert.ok(nascimentos.length >= CREATURE_LIMIT, 'nasceram pelo menos três');
    for (const { distance, y } of nascimentos) {
        assert.ok(distance >= SPAWN_MIN_DISTANCE && distance <= SPAWN_MAX_DISTANCE,
            `nasceu a ${distance.toFixed(1)} do jogador`);
        assert.equal(y, GROUND + 1, 'em cima da grama');
    }
    for (const e of system.entities) {
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
    assert.equal(hit.entity, creature, 'o golpe achou o Mofim');
    assert.equal(hit.killed, false, 'um golpe só não derruba');
    assert.equal(creature.scaredUntil, 100 + SCARE_DURATION);

    // Botão segurado não vira uma saraivada de golpes: o mesmo Mofim fica em
    // cooldown por um instante.
    assert.equal(system.hitFrom(origin, { x: 1, y: 0, z: 0 }), null);
    clock.t = 100 + HIT_COOLDOWN + 0.001;
    const again = system.hitFrom(origin, { x: 1, y: 0, z: 0 });
    assert.equal(again.entity, creature, 'depois do cooldown volta a valer');
    assert.equal(again.killed, false);
});

test('o golpe empurra o Mofim para longe de quem bateu', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 2; creature.z = 0; creature.y = GROUND + 1;
    clock.t = 70;
    const antes = creature.x;
    system.hitFrom({ x: 0, y: GROUND + 1.45, z: 0 }, { x: 1, y: 0, z: 0 });

    assert.ok(creature.x > antes + KNOCKBACK_DISTANCE * 0.9, 'recuou na direção do golpe');
    assert.equal(creature.z, 0, 'sem escorregar para o lado');
});

test('o dano acende o corpo do Mofim e apaga sozinho', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);

    // Material próprio: o clarão não pode pintar de vermelho todos os Mofins.
    assert.notEqual(creature.bodyMaterial, system.materials.body);

    creature.x = 2; creature.z = 0; creature.y = GROUND + 1;
    clock.t = 60;
    system.update(0.016, player, true);
    const descansando = creature.bodyMaterial.emissive.r;
    assert.ok(descansando < 0.12, 'sem levar golpe fica só com o brilho da noite');
    assert.ok(creature.bodyMaterial.emissive.g > descansando, 'e esse brilho é verde');

    system.hitFrom({ x: 0, y: GROUND + 1.45, z: 0 }, { x: 1, y: 0, z: 0 });
    system.update(0.016, player, true);
    assert.ok(creature.bodyMaterial.emissive.r > 0.5, 'acende no golpe');

    clock.t += HURT_FLASH + 0.01;
    system.update(0.016, player, true);
    assert.ok(creature.bodyMaterial.emissive.r < 0.12, 'e volta ao brilho da noite');
});

test('três golpes derrubam o Mofim e avisam quem chamou', () => {
    const clock = { t: 0 };
    const deaths = [];
    const world = makeWorld();
    const system = makeSystem(world, clock, { onDeath: entity => deaths.push(entity) });
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);
    const cenas = world.scene.children.length;

    creature.x = 2; creature.z = 0; creature.y = GROUND + 1;
    clock.t = 50;
    const origin = { x: 0, y: GROUND + 1.45, z: 0 };
    for (let golpe = 1; golpe < MOFIM_HEALTH; golpe++) {
        const hit = system.hitFrom(origin, { x: 1, y: 0, z: 0 });
        assert.equal(hit.killed, false, `o golpe ${golpe} ainda não derruba`);
        assert.equal(system.entities.length, 1, 'e ele continua no mundo');
        clock.t += HIT_COOLDOWN + 0.001;
    }

    const ultimo = system.hitFrom(origin, { x: 1, y: 0, z: 0 });
    assert.equal(ultimo.killed, true, 'o último golpe derruba');
    assert.equal(system.entities.length, 0, 'saiu da lista de bichos');
    assert.equal(world.scene.children.length, cenas - 1, 'e saiu da cena');
    assert.equal(deaths.length, 1, 'avisou uma vez só');
    assert.equal(deaths[0].id, creature.id, 'com o Mofim que morreu');
    assert.equal(deaths[0].y, GROUND + 1, 'no lugar do corpo');
    assert.ok(deaths[0].x > 1.9, 'onde ele caiu');

    // Morto, ele não volta a andar no quadro seguinte (outro pode nascer no
    // lugar, mas não esse).
    system.update(0.016, player, true);
    assert.ok(!system.entities.includes(creature), 'o Mofim derrubado não volta');
    assert.equal(deaths.length, 1, 'e ninguém mais morre');
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

// ------------------------------------------------ noite (aparição)

test('o Mofim é bicho de noite: a regra da hora', () => {
    assert.equal(isMofimTime(1), true, 'noite fechada');
    assert.equal(isMofimTime(NIGHT_SPAWN_THRESHOLD), true, 'no limite já é noite');
    assert.equal(isMofimTime(NIGHT_SPAWN_THRESHOLD - 0.01), false, 'um tico mais claro e ele não vem');
    assert.equal(isMofimTime(0), false, 'dia claro, nenhum Mofim');
    assert.equal(isMofimTime(), true, 'sem saber a hora, assume noite');
    assert.equal(isMofimTime(NaN), true);
});

test('o brilho da noite cresce com o escuro e é zero de dia', () => {
    assert.equal(nightGlow(0, 5), 0, 'de dia ele não brilha');
    assert.ok(nightGlow(1, 5) > nightGlow(0.5, 5), 'quanto mais escuro, mais brilho');
    assert.ok(nightGlow(1, 5) < 0.2, 'é brilho, não holofote');
    assert.notEqual(nightGlow(1, 0), nightGlow(1, 1.2), 'e respira');
    assert.equal(nightGlow(2, 5), nightGlow(1, 5), 'satura na noite fechada');
});

test('o sumiço tem progresso 0 → 1 e trava nas pontas', () => {
    assert.equal(leaveProgress(0), 0);
    const meio = leaveProgress(LEAVE_DURATION / 2);
    assert.ok(meio > 0.4 && meio < 0.6, 'meio encolhido na metade do tempo');
    assert.equal(leaveProgress(LEAVE_DURATION), 1);
    assert.equal(leaveProgress(LEAVE_DURATION * 3), 1, 'não passa de 1');
    assert.equal(leaveProgress(-1), 0);
    assert.equal(leaveProgress(1, 0), 1, 'duração inválida não trava o jogo');
});

test('com o sol alto ele não nasce', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    for (let i = 0; i < 40; i++) {
        clock.t += 5;
        system.update(0.016, player, true, { night: 0.1 });
    }
    assert.equal(system.entities.length, 0, 'nenhum Mofim durante o dia');
});

test('ao amanhecer ele sobe, encolhe e some — e não deixa pó', () => {
    const clock = { t: 0 };
    const deaths = [];
    const world = makeWorld();
    const system = makeSystem(world, clock, { onDeath: entity => deaths.push(entity) });
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);
    const cenas = world.scene.children.length;

    clock.t += 1;
    system.update(0.1, player, true, { night: 0.9 });
    assert.equal(creature.leaving, false, 'de noite ele fica');

    const yAntes = creature.group.position.y;
    const xAntes = creature.x;
    system.update(0.1, player, true, { night: 0 });
    assert.equal(creature.leaving, true, 'o dia chegou e ele começou a ir embora');
    assert.ok(creature.group.position.y > yAntes, 'subindo');
    assert.ok(creature.group.scale.x < 1, 'e encolhendo');
    assert.equal(creature.x, xAntes, 'sem andar para o lado');
    assert.equal(system.entities.length, 1, 'ainda não sumiu de vez');

    for (let i = 0; i < 20 && system.entities.length; i++) system.update(0.1, player, true, { night: 0 });
    assert.equal(system.entities.length, 0, 'passado o sumiço, sai da lista');
    assert.equal(world.scene.children.length, cenas - 1, 'e da cena');
    assert.deepEqual(deaths, [], 'não morreu: foi embora');
});

test('quem está indo embora não leva golpe', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    const creature = spawnOne(system, world, clock, player);
    creature.x = 2; creature.z = 0; creature.y = GROUND + 1;

    system.update(0.016, player, true, { night: 0 });
    assert.equal(creature.leaving, true);

    const origin = { x: 0, y: GROUND + 1.45, z: 0 };
    assert.equal(creatureInReach(system.entities, origin, { x: 1, y: 0, z: 0 }), null);
    assert.equal(system.hitFrom(origin, { x: 1, y: 0, z: 0 }), null, 'e o golpe atravessa');
});

// ------------------------------------------------ voo curto

test('o arco do voo sobe no meio e pousa onde foi pedido', () => {
    const from = 11, to = 11;
    assert.equal(flightHeightAt(from, to, 0), from);
    assert.equal(flightHeightAt(from, to, 1), to);
    assert.ok(Math.abs(flightHeightAt(from, to, 0.5) - (from + FLIGHT_HEIGHT)) < 1e-9,
        'o pico fica no meio do trajeto, uma altura acima');
    for (let p = 0; p <= 1; p += 0.05) {
        assert.ok(flightHeightAt(from, to, p) >= from - 1e-9, `não desce abaixo do chão (p = ${p.toFixed(2)})`);
    }
    // descendo de um lugar mais alto para um mais baixo, o arco fica acima da reta
    const reta = (14 + 10) / 2;
    assert.ok(flightHeightAt(14, 10, 0.5) > reta + FLIGHT_HEIGHT * 0.9, 'voa em arco, não em rampa');
    assert.equal(flightHeightAt(14, 10, 1), 10, 'e pousa exatamente no destino');
});

test('a regra do voo: encurralado escapa, o passeio é de vez em quando', () => {
    // fugindo com o chão barrado: sai voando na hora, sem esperar sorteio
    assert.equal(flightFor({ at: 0, nextFlightAt: 50, fleeing: true, blocked: true }), 'escape');
    // fugindo com o caminho livre: corre, não voa (senão a fuga ficava fácil)
    assert.equal(flightFor({ at: 99, nextFlightAt: 100, fleeing: true }), null);
    // passeando: só depois do relógio do próximo voo
    assert.equal(flightFor({ at: 30, nextFlightAt: 20 }), 'wander');
    assert.equal(flightFor({ at: 10, nextFlightAt: 20 }), null);
    // barrado sem estar fugindo não é motivo para voar
    assert.equal(flightFor({ at: 30, nextFlightAt: 20, blocked: true }), null);
});

test('voo de passeio: sai do chão, cruza o ar e pousa adiante', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 14 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 0.5; creature.z = 0.5; creature.y = GROUND + 1; creature.visualY = GROUND + 1;
    creature.targetX = 6; creature.targetZ = 0.5;
    creature.nextFlightAt = clock.t; // chegou a hora do passeio voador

    clock.t += 0.05;
    system.update(0.05, player, true);
    assert.ok(creature.flight, 'levantou voo');
    assert.equal(creature.flight.duration, FLIGHT_DURATION, 'voo curto: menos de um segundo no ar');

    let pico = -Infinity;
    for (let i = 0; i < 40 && creature.flight; i++) {
        clock.t += 0.05;
        system.update(0.05, player, true);
        pico = Math.max(pico, creature.group.position.y);
    }

    assert.equal(creature.flight, null, 'pousou');
    assert.equal(creature.y, GROUND + 1, 'de volta ao chão');
    assert.ok(creature.x > 0.5 + FLIGHT_DISTANCE * 0.7, `avançou no ar (x = ${creature.x.toFixed(2)})`);
    assert.ok(pico > GROUND + 1 + FLIGHT_HEIGHT * 0.5, `o corpo subiu (pico em ${pico.toFixed(2)})`);
});

test('encurralado no meio do lago, ele voa até a margem em vez de tremer parado', () => {
    const clock = { t: 0 };
    const seco = makeWorld();
    // Ilhota de uma célula na origem; a outra margem começa em x = 3.
    const margem = (x, z) => (x === 0 && z === 0) || (x >= 3 && x <= 6 && Math.abs(z) <= 2);
    const lago = makeWorld({ above: (x, z) => (margem(x, z) ? 0 : ID.WATER) });

    const perseguidor = walkerPlayer({ x: -1.5, y: GROUND + 1, z: 0.5 });
    const system = makeSystem(seco, clock);
    const creature = spawnOne(system, seco, clock, perseguidor);
    // Daqui para baixo o chão é a ilhota: água em volta em todas as direções.
    system.world = lago;

    creature.x = 0.5; creature.z = 0.5; creature.y = GROUND + 1; creature.visualY = GROUND + 1;
    creature.targetX = 0.5; creature.targetZ = 0.5;

    // Ele anda até a beirada da ilhota; quando o passo para longe cai na água,
    // levanta voo.
    for (let i = 0; i < 30 && !creature.flight; i++) {
        clock.t += 0.05;
        system.update(0.05, perseguidor, true);
    }
    assert.ok(creature.flight, 'sem chão para correr, ele levantou voo');

    for (let i = 0; i < 40 && creature.flight; i++) {
        clock.t += 0.05;
        system.update(0.05, perseguidor, true);
    }

    assert.equal(creature.flight, null, 'pousou');
    assert.ok(creature.x >= 3, `pousou na outra margem (x = ${creature.x.toFixed(2)})`);
    assert.equal(creature.y, GROUND + 1, 'em cima da grama da margem');
});

test('parede de dois blocos barra o voo: ele não atravessa a encosta', () => {
    const clock = { t: 0 };
    // Chão plano e, a partir de x = 2, uma parede de dois blocos.
    const world = makeWorld({ heightAt: x => (x >= 2 ? GROUND + 2 : GROUND) });
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 14 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 0.5; creature.z = 0.5; creature.y = GROUND + 1; creature.visualY = GROUND + 1;
    creature.nextFlightAt = clock.t;

    for (let i = 0; i < 60; i++) {
        clock.t += 0.05;
        creature.targetX = 6; creature.targetZ = 0.5;
        creature.nextFlightAt = Math.min(creature.nextFlightAt, clock.t);
        system.update(0.05, player, true);
        assert.ok(creature.x < 2, `parou antes da parede (x = ${creature.x.toFixed(2)})`);
    }
    assert.equal(creature.y, GROUND + 1, 'nunca subiu a parede');
});

// ------------------------------------------------ travessia (voo maior)

test('o arco da travessia sobe rápido, plana baixo e pousa no destino', () => {
    const from = 11, to = 11;
    assert.equal(crossHeightAt(from, to, 0), from);
    assert.equal(crossHeightAt(from, to, 1), to);
    // O pico não fica no meio: ele já está no alto a 32% do trajeto...
    assert.ok(Math.abs(crossHeightAt(from, to, CROSS_RISE) - (from + CROSS_HEIGHT)) < 1e-9,
        'sobe rápido: o alto do voo chega cedo');
    // ...e no começo do planeio o corpo continua lá em cima (é a rasante).
    const meioDoPlaneio = CROSS_RISE + (1 - CROSS_RISE) * 0.2;
    assert.ok(crossHeightAt(from, to, meioDoPlaneio) > from + CROSS_HEIGHT * 0.8,
        'plana baixo, sem cair de uma vez');
    // Nunca desce abaixo dos dois pontos e pousa macio (perto do fim, pouco acima do chão).
    for (let p = 0; p <= 1; p += 0.02) {
        const y = crossHeightAt(from, to, p);
        assert.ok(y >= Math.min(from, to) - 1e-9, `não passa do chão (p = ${p.toFixed(2)})`);
    }
    assert.ok(crossHeightAt(from, to, 0.97) < to + 0.15, 'o pouso é macio, não um tombo');
    // Começando mais alto do que pousa, o pico ainda respeita o ponto mais alto.
    assert.ok(crossHeightAt(14, 10, CROSS_RISE) >= 14 + CROSS_HEIGHT - 1e-9);
    assert.equal(crossHeightAt(14, 10, 1), 10);
});

test('a travessia só acontece com o chão barrado e depois da espera', () => {
    assert.equal(crossFlightFor({ at: 10, nextCrossAt: 0, blocked: true }), true);
    assert.equal(crossFlightFor({ at: 3, nextCrossAt: 8, blocked: true }), false,
        'ainda de castigo da última tentativa');
    assert.equal(crossFlightFor({ at: 100, nextCrossAt: 0 }), false,
        'com o caminho livre não há o que atravessar');
    assert.equal(CROSS_DISTANCE > FLIGHT_DISTANCE && CROSS_HEIGHT > FLIGHT_HEIGHT, true,
        'a travessia é o voo maior: mais longe e mais alto que o pulo de asa');
});

test('lago largo no passeio: ele atravessa em vez de contornar a água', () => {
    const clock = { t: 0 };
    const seco = makeWorld();
    // Água de x = 2 até x = 7: seis blocos que o passo não vence.
    const secoOuAgua = x => (x <= 1 || x >= 8);
    const lago = makeWorld({ above: (x) => (secoOuAgua(x) ? 0 : ID.WATER) });

    const player = idlePlayer({ x: 0.5, y: GROUND + 1, z: 20 });
    const system = makeSystem(seco, clock);
    const creature = spawnOne(system, seco, clock, player);
    system.world = lago;

    creature.x = 0.5; creature.z = 0.5; creature.y = GROUND + 1; creature.visualY = GROUND + 1;
    creature.targetX = 40; creature.targetZ = 0.5;
    creature.turnAt = clock.t + 100;

    let voo = null;
    for (let i = 0; i < 200 && !voo; i++) {
        clock.t += 0.05;
        creature.targetX = 40; creature.turnAt = clock.t + 100; // não deixa sortear outro alvo
        system.update(0.05, player, true);
        if (creature.flight) voo = creature.flight;
    }
    assert.ok(voo, 'chegou na beirada e levantou voo');
    assert.equal(voo.kind, 'cross', 'foi travessia, não pulo de asa');
    const alcance = Math.hypot(voo.toX - voo.fromX, voo.toZ - voo.fromZ);
    assert.ok(alcance > FLIGHT_DISTANCE, `cruzou mais longe que o voo curto (${alcance.toFixed(2)} blocos)`);
    assert.ok(alcance >= 8, `foi o mais longe que deu: a margem oposta (${alcance.toFixed(2)})`);
    assert.ok(voo.duration > FLIGHT_DURATION, 'e ficou mais tempo no ar');

    for (let i = 0; i < 60 && creature.flight; i++) {
        clock.t += 0.05;
        system.update(0.05, player, true);
    }
    assert.equal(creature.flight, null, 'pousou');
    assert.ok(creature.x >= 8, `do outro lado do lago (x = ${creature.x.toFixed(2)})`);
    assert.equal(creature.y, GROUND + 1, 'em cima da grama da margem');
});

test('encurralado num lago largo, a fuga é a travessia (o voo curto não alcança)', () => {
    const clock = { t: 0 };
    const seco = makeWorld();
    const secoOuAgua = x => (x <= 1 || x >= 8);
    const lago = makeWorld({ above: (x) => (secoOuAgua(x) ? 0 : ID.WATER) });

    const perseguidor = walkerPlayer({ x: -1.5, y: GROUND + 1, z: 0.5 });
    const system = makeSystem(seco, clock);
    const creature = spawnOne(system, seco, clock, perseguidor);
    system.world = lago;

    creature.x = 0.5; creature.z = 0.5; creature.y = GROUND + 1; creature.visualY = GROUND + 1;
    creature.targetX = 0.5; creature.targetZ = 0.5;

    let voo = null;
    for (let i = 0; i < 60 && !voo; i++) {
        clock.t += 0.05;
        system.update(0.05, perseguidor, true);
        if (creature.flight) voo = creature.flight;
    }
    assert.ok(voo, 'sem chão para correr e com a margem longe, ele levantou voo');
    assert.equal(voo.kind, 'cross', 'a margem está a mais de um pulo de asa: foi travessia');

    for (let i = 0; i < 60 && creature.flight; i++) {
        clock.t += 0.05;
        system.update(0.05, perseguidor, true);
    }
    assert.equal(creature.flight, null, 'pousou');
    assert.ok(creature.x >= 8, `pousou na margem oposta (x = ${creature.x.toFixed(2)})`);
});

test('a travessia não atravessa barranco: parede de dois blocos continua barrando', () => {
    const clock = { t: 0 };
    const world = makeWorld({ heightAt: x => (x >= 2 ? GROUND + 2 : GROUND) });
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 20 });
    const creature = spawnOne(system, world, clock, player);

    creature.x = 0.5; creature.z = 0.5; creature.y = GROUND + 1; creature.visualY = GROUND + 1;
    creature.nextCrossAt = 0;

    for (let i = 0; i < 80; i++) {
        clock.t += 0.05;
        creature.targetX = 40; creature.targetZ = 0.5; creature.turnAt = clock.t + 100;
        system.update(0.05, player, true);
        assert.ok(creature.x < 2, `parou antes do barranco (x = ${creature.x.toFixed(2)})`);
        assert.ok(!creature.flight || creature.flight.toX < 2, 'nenhum voo do outro lado');
    }
    assert.equal(creature.y, GROUND + 1, 'nunca subiu o barranco');
    assert.ok(creature.nextCrossAt > clock.t - CROSS_COOLDOWN - 1,
        'e o relógio da travessia anda mesmo quando ela é recusada');
});

// ------------------------------------------------ chegada ao anoitecer

test('a chegada termina ao chegar perto, e não antes', () => {
    assert.equal(arrivalDone({ distance: ARRIVE_STOP_DISTANCE, startedAt: 0, at: 1 }), true,
        'já está perto o bastante');
    assert.equal(arrivalDone({ distance: 25, startedAt: 0, at: 10 }), false,
        'ainda vem vindo, no tempo');
    assert.equal(arrivalDone({ distance: 25, startedAt: 0, at: ARRIVE_TIMEOUT }), true,
        'demorou demais: desiste de vir');
    // O passo da chegada é de passeio: mais rápido que vagar, longe de ser fuga.
    assert.ok(ARRIVE_SPEED > WANDER_SPEED && ARRIVE_SPEED < FLEE_SPEED,
        'passo de passeio, não de corrida');
});

test('o Mofim aparece no crepúsculo, antes da noite fechada', () => {
    assert.ok(NIGHT_SPAWN_THRESHOLD < 0.5, 'entra em cena com o sol ainda no horizonte');
    assert.equal(isMofimTime(NIGHT_SPAWN_THRESHOLD), true, 'no limiar já é hora dele');
    assert.equal(isMofimTime(NIGHT_SPAWN_THRESHOLD - 0.01), false, 'um pouco antes, ainda não');
    assert.equal(isMofimTime(1), true, 'de noite, sim');
});

test('ao anoitecer ele nasce longe e vem andando até perto do jogador', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });

    // Nasce no primeiro instante em que é hora dele.
    for (let i = 0; i < 20 && system.entities.length === 0; i++) {
        clock.t += 0.1;
        system.update(0.1, player, true);
    }
    const creature = system.entities[0];
    assert.ok(creature, 'nasceu');
    assert.equal(creature.arriving, true, 'e veio em passeio de chegada');

    const nascimento = Math.hypot(creature.x, creature.z);
    assert.ok(nascimento >= SPAWN_MIN_DISTANCE - 0.5 && nascimento <= SPAWN_MAX_DISTANCE,
        `nasceu longe (${nascimento.toFixed(1)} blocos)`);

    let distancia = nascimento;
    for (let i = 0; i < 400 && creature.arriving; i++) {
        clock.t += 0.1;
        system.update(0.1, player, true);
        const agora = Math.hypot(creature.x, creature.z);
        assert.ok(agora <= distancia + 1e-6, 'vem na direção do jogador, sem dar voltas');
        distancia = agora;
    }

    assert.equal(creature.arriving, false, 'a chegada acabou');
    assert.ok(distancia <= ARRIVE_STOP_DISTANCE + 0.2,
        `parou perto (${distancia.toFixed(2)} blocos) em vez de encostar no jogador`);
    assert.equal(creature.y, GROUND + 1, 'chegou andando, no chão');
});

test('os da mesma noite chegam pelo mesmo lado', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });

    const lados = [];
    let vistos = 0;
    for (let i = 0; i < 300 && lados.length < 2; i++) {
        clock.t += 0.1;
        system.update(0.1, player, true);
        for (const e of system.entities.slice(vistos)) {
            lados.push(Math.atan2(e.z, e.x));
        }
        vistos = system.entities.length;
    }

    assert.equal(lados.length, 2, 'chegaram dois');
    let diferenca = Math.abs(lados[0] - lados[1]);
    if (diferenca > Math.PI) diferenca = Math.PI * 2 - diferenca;
    assert.ok(diferenca <= ARRIVE_SPREAD,
        `vieram pelo mesmo lado (${diferenca.toFixed(3)} rad de diferença)`);
});

test('chegada sem caminho: ele desiste de vir e não fica preso', () => {
    const clock = { t: 0 };
    const seco = makeWorld();
    const system = makeSystem(seco, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    while (system.entities.length === 0) {
        clock.t += 0.1;
        system.update(0.1, player, true);
    }
    const creature = system.entities[0];

    // Ilhota de uma célula em volta dele: todo passo da chegada cai na água.
    const cx = Math.floor(creature.x), cz = Math.floor(creature.z);
    const ilha = makeWorld({ above: (x, z) => (x === cx && z === cz ? 0 : ID.WATER) });
    system.world = ilha;

    for (let i = 0; i < 20 && creature.arriving; i++) {
        clock.t += 0.1;
        system.update(0.1, player, true);
    }
    assert.equal(creature.arriving, false, 'sem caminho, a chegada acaba em vez de travar');
});

test('assustado, o passeio de chegada acaba: ele foge em vez de vir', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    while (system.entities.length === 0) {
        clock.t += 0.1;
        system.update(0.1, player, true);
    }
    const creature = system.entities[0];
    assert.equal(creature.arriving, true, 'vinha em passeio de chegada');

    // O jogador corre até perto dele.
    const perto = walkerPlayer({ x: creature.x + 2, y: GROUND + 1, z: creature.z });
    clock.t += 0.1;
    system.update(0.1, perto, true);

    assert.equal(creature.arriving, false, 'o susto corta a chegada');
    assert.ok(clock.t < creature.scaredUntil, 'e ele está fugindo');
});

test('a fila de chegada cabe no limite: três por noite, um atrás do outro', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, y: GROUND + 1, z: 0 });
    for (let i = 0; i < 300; i++) {
        clock.t += 0.1;
        system.update(0.1, player, true);
    }
    assert.equal(system.entities.length, CREATURE_LIMIT, 'a noite inteira chega');
    // Em fila: dois quaisquer nunca nascem um em cima do outro.
    for (const a of system.entities) {
        for (const b of system.entities) {
            if (a === b) continue;
            assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 1,
                'ninguém apareceu dentro do outro');
        }
    }
    assert.ok(ARRIVE_MIN_GAP < SPAWN_MIN_DISTANCE, 'o espaço entre eles é o da fila, não o do susto');
});
