import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as THREE from '../vendor/three/three.module.js';
import { BLOCKS, ID } from '../world-catalog.js';
import {
    SHEEP_COATS,
    SHEEP_GRAZE_BITE,
    SHEEP_GRAZE_FIRST_MAX,
    SHEEP_GRAZE_FIRST_MIN,
    SHEEP_GRAZE_REST_MAX,
    SHEEP_GRAZE_REST_MIN,
    SHEEP_GRAZE_REACH,
    SHEEP_GRAZE_TIME_MAX,
    SHEEP_GRAZE_TIME_MIN,
    SHEEP_HEAD_REST,
    headPoseFor,
    woolCountFor,
    SHEEP_NECK_Y,
    SHEEP_REGROW_LIMIT,
    SHEEP_REGROW_MIN,
    SHEEP_WOOL_GRAZE_BONUS,
    SHEEP_WOOL_ITEMS,
    SHEEP_WOOL_MAX,
    SHEEP_WOOL_MIN,
    SHEEP_WOOL_REGROW_MIN,
    SHEEP_BLEAT_COOLDOWN,
    SHEEP_BLEAT_IDLE_MAX,
    SHEEP_BLEAT_IDLE_MIN,
    SHEEP_BLEAT_NEAR_COOLDOWN,
    SHEEP_BLEAT_NEAR_RADIUS,
    SHEEP_BLEAT_RANGE,
    bleatFor,
    SHEEP_DAY_THRESHOLD,
    SHEEP_DESPAWN_DISTANCE,
    SHEEP_LEG_SWING,
    SHEEP_LIMIT,
    SHEEP_HERD_MIN,
    SHEEP_HERD_MAX,
    SHEEP_HERD_SPREAD_MIN,
    SHEEP_HERD_SPREAD_MAX,
    SHEEP_FOLLOW_GAP,
    SHEEP_SLOT_MIN,
    SHEEP_SLOT_MAX,
    SHEEP_PACE_SPREAD,
    walkSpeedFor,
    herdSlotFor,
    herdSlotSpot,
    SHEEP_ALERT_RADIUS,
    SHEEP_ALERT_SPEED,
    SHEEP_ALERT_TIME,
    SHEEP_ALERT_HEAD_LIFT,
    SHEEP_FLEE_TIME,
    SHEEP_FLEE_SPEED,
    SHEEP_HIT_COOLDOWN,
    SHEEP_SCARE_SPREAD,
    herdSizeFor,
    herdSpotFor,
    SHEEP_BODY_TURN_SPEED,
    SHEEP_LOOK_MAX_YAW,
    SHEEP_LOOK_TILT,
    SHEEP_NECK_ANCHOR_Y,
    SHEEP_NECK_ANCHOR_Z,
    SHEEP_NECK_HEAD_Y,
    SHEEP_NECK_HEAD_Z,
    SHEEP_NECK_WIDTH,
    SHEEP_NECK_DEPTH,
    SHEEP_RUFF_PARTS,
    SHEEP_NECK_Z,
    SHEEP_NOTICE_CHANCE,
    SHEEP_NOTICE_DELAY_MAX,
    SHEEP_NOTICE_DELAY_MIN,
    SHEEP_NOTICE_RADIUS,
    SHEEP_VIEW_MIN_DOT,
    angleTo,
    neckPoseFor,
    noticeDelayFor,
    sheepNotices,
    turnTowardAngle,
    wrapAngle,
    SHEEP_MIN_GAP,
    SHEEP_ROAM_MAX,
    SHEEP_ROAM_MIN,
    SHEEP_SPAWN_MAX_DISTANCE,
    SHEEP_SPAWN_MIN_DISTANCE,
    SHEEP_TURN_MAX,
    SHEEP_TUFTS,
    SHEEP_TURN_MIN,
    SHEEP_WANDER_SPEED,
    SHEEP_ACCEL,
    SHEEP_BRAKE,
    SHEEP_STRIDE_PER_BLOCK,
    SHEEP_TURN_RATE,
    SHEEP_TURN_DEADZONE,
    approachSpeed,
    strideAdvance,
    walkStep,
    idlePoseFor,
    SHEEP_BREATH_LIFT,
    SHEEP_TAIL_SWAY,
    SHEEP_IDLE_LOOK,
    coatFor,
    createSheepSystemClass,
    grazeCellFor,
    grazeDelayFor,
    grazeEnvelope,
    isPastureTime,
    legPose,
    spawnPointFor,
    wanderTargetFor,
} from '../world-sheep.js';

const CHUNK_SIZE = 16;
const GROUND = 10; // `heightAt` devolve o bloco do topo; a ovelha anda em GROUND + 1

// Mundo plano de grama com relógio controlado pelo teste — o mesmo molde do
// teste do Mofim. `heightAt` e `groundType` podem ser trocados para montar
// encostas, areia e água.
function makeWorld({ heightAt = () => GROUND, groundType = () => ID.GRASS } = {}) {
    // `overrides` guarda o que o jogo mudou (grama comida, planta removida,
    // terra que voltou a ser grama): o mundo começa plano e vai sendo editado.
    const overrides = new Map();
    const chave = (x, y, z) => `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    const world = {
        seed: 4242,
        scene: new THREE.Scene(),
        overrides,
        getChunk: () => ({}),
        generator: { heightAt: (x, z) => heightAt(x, z) },
        getBlock: (x, y, z) => {
            const gx = Math.floor(x), gz = Math.floor(z);
            const mudado = overrides.get(chave(gx, y, gz));
            if (mudado !== undefined) return mudado;
            return y === heightAt(gx, gz) ? groundType(gx, gz) : 0;
        },
        setBlock: (x, y, z, type) => {
            overrides.set(chave(x, y, z), type);
            return true;
        },
    };
    return world;
}

function makeSystem(world, clock) {
    const SheepSystem = createSheepSystemClass({
        THREE, ID, BLOCKS, CHUNK_SIZE, now: () => clock.t,
    });
    return new SheepSystem(world);
}

const idlePlayer = pos => ({ pos });

// Deixa o nascimento acontecer e devolve as ovelhas que nasceram.
function spawnSome(system, clock, player, { ticks = 200, dt = 0.016, day = 1 } = {}) {
    for (let i = 0; i < ticks && system.entities.length < SHEEP_LIMIT; i++) {
        clock.t += 5;
        system.update(dt, player, true, { day });
    }
    return system.entities;
}

// Depois do P6 ela nasce em bando (2–4): o helper garante **uma** ovelha para
// testar e devolve a primeira do bando.
function spawnOne(system, clock, player) {
    for (let i = 0; i < 200 && system.entities.length === 0; i++) {
        clock.t += 5;
        system.update(0.016, player, true, { day: 1 });
    }
    assert.ok(system.entities.length >= 1, 'a ovelha deveria ter nascido');
    return system.entities[0];
}

// ------------------------------------------------ cor da lã (pura)

test('a lã tem três cores: branca, cinza e preta', () => {
    assert.deepEqual(SHEEP_COATS.map(coat => coat.label), ['branca', 'cinza', 'preta']);
    assert.equal(new Set(SHEEP_COATS.map(coat => coat.key)).size, 3, 'cada cor é uma chave');
    assert.equal(new Set(SHEEP_COATS.map(coat => coat.wool)).size, 3, 'cada cor tem seu tom');
});

test('o sorteio da cor cai nas três faixas, e branca é a mais comum', () => {
    assert.equal(coatFor(0).key, 'white');
    assert.equal(coatFor(0.5).key, 'white', 'metade dos sorteios ainda é branca');
    assert.equal(coatFor(0.7).key, 'gray');
    assert.equal(coatFor(0.89).key, 'black');
    assert.equal(coatFor(0.999).key, 'black');

    // Pesos: 68% branca, 20% cinza, 12% preta (soma 100%).
    const counts = { white: 0, gray: 0, black: 0 };
    for (let i = 0; i < 10000; i++) counts[coatFor((i + 0.5) / 10000).key]++;
    assert.ok(counts.white > counts.gray && counts.gray > counts.black, 'branca > cinza > preta');
    for (const coat of SHEEP_COATS) {
        const esperado = 10000 * (coat.upTo - (SHEEP_COATS[SHEEP_COATS.indexOf(coat) - 1]?.upTo ?? 0));
        assert.ok(Math.abs(counts[coat.key] - esperado) <= 1, `${coat.label} na fatia certa`);
    }
});

test('a mesma semente sorteia sempre a mesma cor', () => {
    for (let i = 0; i < 50; i++) assert.equal(coatFor(i / 50), coatFor(i / 50));
});

// ------------------------------------------------ hora do pasto (pura)

test('ovelha é bicho de dia: nasce com o sol, e não à noite', () => {
    assert.equal(isPastureTime(1), true, 'dia claro');
    assert.equal(isPastureTime(SHEEP_DAY_THRESHOLD), true, 'no limiar já é dia de ovelha');
    assert.equal(isPastureTime(SHEEP_DAY_THRESHOLD - 0.01), false);
    assert.equal(isPastureTime(0.1), false, 'noite fechada');
    assert.equal(isPastureTime(0), false);
    assert.equal(isPastureTime(undefined), false, 'sem céu, não nasce');
    assert.equal(isPastureTime(Number.NaN), false);
});

// ------------------------------------------------ onde nasce (pura)

test('o ponto de nascimento fica entre 16 e 30 blocos do jogador', () => {
    // Números escritos à mão de propósito: a regra é "nasce longe, fora do campo
    // de visão, e não do outro lado do mundo". Se as constantes mudarem, é aqui
    // que a mudança precisa ser justificada — o teste não pode só repetir a
    // constante que está sendo testada.
    for (let attempt = 0; attempt < 200; attempt++) {
        const point = spawnPointFor({ origin: { x: 5, z: -3 }, seed: 99, attempt });
        const distance = Math.hypot(point.x - 5, point.z + 3);
        assert.ok(distance >= 15, `perto demais: ${distance} blocos`);
        assert.ok(distance <= 31, `longe demais: ${distance} blocos`);
        assert.ok(Math.abs(point.distance - distance) < 1e-9, 'a distância devolvida é a real');
    }
    // E as constantes continuam dentro da intenção.
    assert.ok(SHEEP_SPAWN_MIN_DISTANCE >= 14 && SHEEP_SPAWN_MAX_DISTANCE <= 32);
    assert.ok(SHEEP_SPAWN_MIN_DISTANCE < SHEEP_SPAWN_MAX_DISTANCE);
});

test('tentativas diferentes sorteiam lados diferentes', () => {
    const lados = new Set();
    for (let attempt = 0; attempt < 40; attempt++) {
        const point = spawnPointFor({ origin: { x: 0, z: 0 }, seed: 7, attempt });
        lados.add(Math.round(point.angle * 4));
    }
    assert.ok(lados.size >= 6, 'não nascem todas do mesmo lado');
});

// ------------------------------------------------ passeio (puro)

test('o alvo do passeio fica no raio do pasto e dura entre 3 e 8 segundos', () => {
    for (let i = 0; i < 100; i++) {
        const target = wanderTargetFor({ x: 3, z: 4, seed: 1234, id: i, at: i * 0.7 });
        const distance = Math.hypot(target.x - 3, target.z - 4);
        assert.ok(distance >= SHEEP_ROAM_MIN - 1e-9 && distance <= SHEEP_ROAM_MAX + 1e-9,
            `alvo fora do pasto: ${distance}`);
        assert.ok(target.duration >= SHEEP_TURN_MIN - 1e-9 && target.duration <= SHEEP_TURN_MAX + 1e-9,
            `tempo fora da faixa: ${target.duration}`);
    }
});

test('o mesmo instante sorteia sempre o mesmo alvo', () => {
    const a = wanderTargetFor({ x: 0, z: 0, seed: 5, id: 3, at: 12.3 });
    const b = wanderTargetFor({ x: 0, z: 0, seed: 5, id: 3, at: 12.3 });
    assert.deepEqual(a, b);
});

// ------------------------------------------------ passada das patas (pura)

test('as patas andam em diagonal, duas para frente e duas para trás', () => {
    const [fl, fr, bl, br] = legPose(Math.PI / 2);
    assert.ok(fl > 0 && fr < 0 && bl < 0 && br > 0, 'frente-esquerda junto com trás-direita');
    assert.equal(fl, br);
    assert.equal(fr, bl);
    assert.ok(Math.abs(fl - SHEEP_LEG_SWING) < 1e-9, 'a amplitude é a da constante');
    // No início do ciclo as quatro estão no chão.
    for (const rotation of legPose(0)) assert.ok(Math.abs(rotation) < 1e-12, 'pata no chão');
});

// ------------------------------------------------ nascimento no mundo

test('nasce de dia, no capim, entre 16 e 30 blocos e no máximo seis por vez', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const ovelhas = spawnSome(system, clock, player);

    // Seis, escrito à mão: um pasto cheio de ovelha vira zoológico.
    assert.equal(ovelhas.length, 6, 'enche o pasto até o limite de seis');
    assert.equal(SHEEP_LIMIT, 6, 'o limite é seis');

    for (const sheep of ovelhas) {
        const distance = Math.hypot(sheep.x - player.pos.x, sheep.z - player.pos.z);
        assert.ok(distance >= 15 && distance <= 33, `nasceu a ${distance} blocos`);
        assert.equal(sheep.y, GROUND + 1, '(de pé em cima do bloco de grama)');
        assert.ok(SHEEP_COATS.some(coat => coat.key === sheep.coat), 'nasceu com uma das três cores');
    }

    // O limite vale mesmo com o tempo passando.
    for (let i = 0; i < 200; i++) { clock.t += 10; system.update(0.016, player, true, { day: 1 }); }
    assert.equal(system.entities.length, 6, 'continua em seis');
});

test('de noite não nasce nenhuma ovelha', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const player = idlePlayer({ x: 0, z: 0 });
    for (let i = 0; i < 200; i++) {
        clock.t += 5;
        system.update(0.016, player, true, { day: 0.05 });
    }
    assert.equal(system.entities.length, 0, 'o pasto é coisa do dia');
});

test('só nasce em grama: areia e pedra ficam de fora', () => {
    for (const ground of [ID.SAND, ID.STONE]) {
        const clock = { t: 0 };
        const system = makeSystem(makeWorld({ groundType: () => ground }), clock);
        for (let i = 0; i < 200; i++) {
            clock.t += 5;
            system.update(0.016, idlePlayer({ x: 0, z: 0 }), true, { day: 1 });
        }
        assert.equal(system.entities.length, 0, `nasceu em chão que não é pasto (${ground})`);
    }
});

test('no meio de um lago não nasce ovelha', () => {
    // Água: o bloco do topo é líquido, então não há chão firme.
    const clock = { t: 0 };
    const system = makeSystem(makeWorld({ groundType: () => ID.WATER }), clock);
    for (let i = 0; i < 120; i++) {
        clock.t += 5;
        system.update(0.016, idlePlayer({ x: 0, z: 0 }), true, { day: 1 });
    }
    assert.equal(system.entities.length, 0);
});

test('dois bandos não nascem no mesmo canto do pasto', () => {
    // Pasto pequeno: só um quadrado de 4×4 blocos é grama. Um bando cabe ali,
    // dois não — o afastamento entre bandos é maior que a diagonal do pasto.
    const noPasto = (x, z) => x >= 20 && x <= 23 && z >= 0 && z <= 3;
    const clock = { t: 0 };
    const system = makeSystem(
        makeWorld({ groundType: (x, z) => (noPasto(x, z) ? ID.GRASS : ID.STONE) }),
        clock,
    );
    const player = idlePlayer({ x: 0, z: 0 });
    for (let i = 0; i < 400; i++) {
        clock.t += 5;
        system.update(0.016, player, true, { day: 1 });
    }

    assert.ok(system.entities.length >= 1, 'pelo menos a líder nasceu');
    const bandos = new Set(system.entities.map(sheep => sheep.herd));
    assert.equal(bandos.size, 1, 'só um bando no pasto pequeno');
    for (const sheep of system.entities) {
        assert.ok(noPasto(Math.floor(sheep.x), Math.floor(sheep.z)), 'todas ficaram na grama');
    }
    assert.ok(SHEEP_MIN_GAP >= 6 && SHEEP_MIN_GAP > Math.hypot(4, 4),
        `o afastamento entre bandos (${SHEEP_MIN_GAP}) é maior que a diagonal do pasto (5,66)`);
});

// ------------------------------------------------ passeio no mundo

test('vaga devagar: anda para o alvo e não sai do raio do pasto', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    // Um alvo à frente, escolhido pelo teste.
    sheep.targetX = sheep.x + 4;
    sheep.targetZ = sheep.z;
    sheep.turnAt = clock.t + 100;

    const startX = sheep.x, startZ = sheep.z;
    // 3 segundos de jogo: a 0,55 bloco/s ela faz ~1,65 — devagar, sem correr.
    for (let i = 0; i < 30; i++) { clock.t += 0.1; system.update(0.1, player, true, { day: 1 }); }

    const andou = Math.hypot(sheep.x - startX, sheep.z - startZ);
    assert.ok(andou > 1.2, `deveria ter andado (andou ${andou})`);
    assert.ok(andou < 2.2, `andou ${andou} em 3 s: ovelha não corre`);
    assert.ok(SHEEP_WANDER_SPEED < 0.7, 'o passo do pasto é mais devagar que o do Mofim (0,72)');
});

test('barrada por uma encosta, ela desiste e sorteia outro caminho', () => {
    // Degrau de três blocos: alto demais para subir (o limite é um).
    const clock = { t: 0 };
    const world = makeWorld({ heightAt: x => (x >= 1 ? GROUND + 3 : GROUND) });
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: -20, z: -20 });
    const sheep = spawnOne(system, clock, player);

    sheep.x = 0.5; sheep.z = 0.5; sheep.y = GROUND + 1; sheep.visualY = sheep.y;
    sheep.targetX = 6; sheep.targetZ = 0.5;
    sheep.turnAt = clock.t + 100;

    system.update(1, player, true, { day: 1 });

    assert.equal(sheep.x, 0.5, 'não atravessa a encosta');
    assert.ok(sheep.turnAt <= clock.t, 'desiste na hora, em vez de insistir contra a parede');
});

test('jogador correndo perto: ela para, ergue a cabeça e encara (sem fugir)', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));

    sheep.turnAt = clock.t + 100;
    sheep.targetX = sheep.x + 1.5;
    sheep.targetZ = sheep.z;
    // Atenção zero = ela **percebe** (a percepção é sorteada; aqui é o teste).
    sheep.attention = 0;

    // Jogador correndo em cima dela, de pé: é o susto de chegada.
    const correndo = { pos: { x: sheep.x + 0.4, z: sheep.z }, vel: { x: 6, z: 0 }, crouching: false };
    // Ela começa virada meio radiano fora do jogador: dá para ver o corpo
    // girando devagar e a cabeça chegando antes.
    const rumo = Math.atan2(correndo.pos.x - sheep.x, correndo.pos.z - sheep.z);
    sheep.heading = rumo + 0.5;

    const startX = sheep.x, startZ = sheep.z;
    const cabecaAntes = sheep.head.position.y;
    let maiorPulo = 0;
    let anterior = sheep.heading;
    let meioX = 0, meioZ = 0;
    for (let i = 0; i < 20; i++) {
        clock.t += 0.05;
        system.update(0.05, correndo, true, { day: 1 });
        // Só vale o giro do **encarar**: andando, a ovelha vira para o alvo do
        // passo (comportamento antigo, não é o que este teste mede).
        if (clock.t >= sheep.alertAt) {
            maiorPulo = Math.max(maiorPulo, Math.abs(wrapAngle(sheep.heading - anterior)));
        }
        anterior = sheep.heading;
        // Depois da reação (0,5 s no pior caso) ela já parou de andar.
        if (i === 11) { meioX = sheep.x; meioZ = sheep.z; }
    }

    assert.ok(sheep.alertUntil > clock.t, 'ela está assustada (alerta ligado)');
    assert.ok(sheep.alertAt > 0, 'e a reação tem hora para começar');
    assert.equal(sheep.fleeUntil, 0, 'susto de chegada não é fuga: ela não corre');
    // Ela continua andando só até **reagir** (a reação é uma animação, não um
    // interruptor); depois disso fica parada de verdade.
    const parou = Math.hypot(sheep.x - meioX, sheep.z - meioZ);
    assert.ok(parou < 0.05, `depois da reação ficou parada (andou ${parou})`);
    assert.ok(Math.hypot(sheep.x - startX, sheep.z - startZ) < 0.4, 'e o passo até reagir é curto');
    // A cabeça sobe: o focinho sai do chão e a cara aponta para quem chegou.
    assert.ok(Math.abs(SHEEP_HEAD_REST - SHEEP_ALERT_HEAD_LIFT - sheep.head.rotation.x) <= 0.12,
        `cabeça erguida (${sheep.head.rotation.x}, esperado ~${SHEEP_HEAD_REST - SHEEP_ALERT_HEAD_LIFT})`);
    assert.ok(sheep.head.position.y >= cabecaAntes - 1e-9, 'o pescoço não desce no susto');
    // O corpo girou devagar (nunca de um quadro para o outro) e chegou perto.
    assert.ok(maiorPulo <= SHEEP_BODY_TURN_SPEED * 0.05 + 1e-9,
        `o corpo nunca dá um pulo de ${maiorPulo} rad num quadro`);
    assert.ok(Math.abs(wrapAngle(sheep.heading - rumo)) < 0.25, `o corpo encarou (${sheep.heading} vs ${rumo})`);
    // E a cabeça inclinou de curiosidade.
    assert.ok(Math.abs(sheep.head.rotation.z) > 0.05, `a cabeça inclinou (${sheep.head.rotation.z})`);
});

test('perto, mas agachado (ou devagar), ela não se assusta', () => {
    for (const [nome, player] of [
        ['agachado', { vel: { x: 6, z: 0 }, crouching: true }],
        ['andando devagar', { vel: { x: 1.2, z: 0 }, crouching: false }],
    ]) {
        const clock = { t: 0 };
        const system = makeSystem(makeWorld(), clock);
        const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));
        sheep.turnAt = clock.t + 100;
        sheep.targetX = sheep.x + 1.5;
        sheep.targetZ = sheep.z;

        const perto = { pos: { x: sheep.x + 0.4, z: sheep.z }, ...player };
        for (let i = 0; i < 20; i++) { clock.t += 0.05; system.update(0.05, perto, true, { day: 1 }); }
        assert.equal(sheep.alertUntil, 0, `${nome} não assusta`);
        assert.equal(sheep.fleeUntil, 0, `${nome} não faz fugir`);
    }
    assert.ok(SHEEP_ALERT_SPEED > 1.2, 'o limiar de velocidade é maior que o passo lento (1,2)');
    assert.ok(SHEEP_ALERT_RADIUS > 0, 'o raio do susto é positivo');
});

test('passado o susto, ela volta a pastar', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));

    system.alert(sheep, clock.t, { x: sheep.x + 1, z: sheep.z });
    assert.ok(sheep.alertUntil > clock.t);
    // Um passo a mais que o tempo do susto, ainda com o jogador colado:
    // ele já foi embora (longe), então nada rearma o alerta.
    const longe = idlePlayer({ x: sheep.x + 30, z: sheep.z + 30 });
    clock.t += SHEEP_ALERT_TIME + 0.1;
    system.update(0.05, longe, true, { day: 1 });
    assert.ok(sheep.alertUntil <= clock.t, 'o susto acabou');
});

test('golpe: ela corre para longe de quem bateu, mais rápido que o pasto', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));

    // Quem bateu está a oeste: a fuga é para leste.
    const de = { x: sheep.x - 1, y: sheep.y + 0.5, z: sheep.z };
    const golpe = system.hitAt(de, { x: 1, y: 0, z: 0 }, { maxDistance: 5 });
    assert.ok(golpe, 'o golpe pegou a ovelha');
    assert.equal(golpe.entity, sheep);
    assert.ok(sheep.fleeUntil > clock.t, 'ela está fugindo');
    assert.equal(sheep.alertUntil, 0, 'fuga não é encarada');

    const startX = sheep.x;
    // Longe o bastante para não assustar de novo — e dentro do despawn.
    const longe = idlePlayer({ x: sheep.x + 20, z: sheep.z + 20 });
    for (let i = 0; i < 10; i++) { clock.t += 0.1; system.update(0.1, longe, true, { day: 1 }); }
    const andou = sheep.x - startX;
    assert.ok(andou > 0.6, `correu para longe do golpe (${andou} blocos)`);
    assert.ok(SHEEP_FLEE_SPEED > SHEEP_WANDER_SPEED * 2, 'a fuga é bem mais rápida que o pasto');

    // Passado o tempo da fuga, o passo volta ao normal.
    clock.t += SHEEP_FLEE_TIME;
    system.update(0.05, longe, true, { day: 1 });
    assert.ok(sheep.fleeUntil <= clock.t, 'a fuga acaba');
});

test('o golpe não pega duas vezes no mesmo instante (cooldown)', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));
    const de = { x: sheep.x - 1, y: sheep.y + 0.5, z: sheep.z };
    const dir = { x: 1, y: 0, z: 0 };

    assert.ok(system.hitAt(de, dir, { maxDistance: 5 }), 'o primeiro golpe vale');
    assert.equal(system.hitAt(de, dir, { maxDistance: 5 }), null, 'o segundo, no mesmo instante, não');
    clock.t += SHEEP_HIT_COOLDOWN + 0.01;
    assert.ok(system.hitAt(de, dir, { maxDistance: 5 }), 'passado o cooldown, vale de novo');
});

test('o golpe longe da mira não pega ninguém', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));
    const de = { x: 0, y: 0, z: 0 };
    // Mirando para o lado oposto ao da ovelha.
    assert.equal(system.hitAt(de, { x: -1, y: 0, z: 0 }, { maxDistance: 5 }), null, 'mirou para o outro lado');
    assert.equal(system.hitAt(de, { x: 1, y: 0, z: 0 }, { maxDistance: 5 }), null, 'longe demais');
    assert.equal(system.hitAt(de, null, { maxDistance: 5 }), null, 'sem direção não há golpe');
});

test('longe demais, a ovelha sai da cena', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    const childCount = world_childCount(system);
    const longe = SHEEP_DESPAWN_DISTANCE + 2;
    system.update(0.016, idlePlayer({ x: sheep.x + longe, z: sheep.z + longe }), true, { day: 1 });
    assert.equal(system.entities.length, 0, 'saiu do mundo');
    assert.ok(world_childCount(system) < childCount, 'saiu também da cena');
});

function world_childCount(system) {
    return system.world.scene.children.length;
}

test('parada, ela não mexe as patas; andando, mexe', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    // Alvo em cima dela: não anda, então as patas ficam em repouso.
    sheep.targetX = sheep.x; sheep.targetZ = sheep.z;
    sheep.turnAt = clock.t + 100;
    for (let i = 0; i < 20; i++) { clock.t += 0.1; system.update(0.1, player, true, { day: 1 }); }
    for (const leg of sheep.legs) assert.ok(Math.abs(leg.rotation.x) < 1e-6, 'parada, pata no chão');

    // Agora com um alvo à frente: as quatro entram no passo.
    sheep.targetX = sheep.x + 3; sheep.targetZ = sheep.z;
    for (let i = 0; i < 10; i++) { clock.t += 0.1; system.update(0.1, player, true, { day: 1 }); }
    const mexidas = sheep.legs.filter(leg => Math.abs(leg.rotation.x) > 1e-3).length;
    assert.equal(mexidas, 4, 'as quatro patas andam');
});

// ------------------------------------------------ o corpo

test('o corpo é de caixas: miolo de lã com tufos, cara, orelhas, quatro patas e rabo', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));

    const nomes = sheep.group.children.map(child => child.name);
    assert.equal(nomes.filter(nome => nome === 'leg').length, 4, 'quatro patas');
    assert.equal(nomes.filter(nome => nome === 'tuft').length, SHEEP_TUFTS.length, 'a lã é feita de tufos');
    assert.ok(SHEEP_TUFTS.length >= 6, 'a silhueta fofinha precisa de vários tufos, não de um');
    for (const parte of ['body', 'head', 'tail']) {
        assert.ok(nomes.includes(parte), `falta a peça ${parte}`);
    }
    // A cabeça é um grupo com o pivô no pescoço: é o que deixa o focinho descer
    // para pastar sem a cara se desmontar.
    const cara = sheep.head.children.map(child => child.name);
    for (const parte of ['skull', 'topknot', 'muzzle']) assert.ok(cara.includes(parte), `falta a peça ${parte}`);
    assert.equal(cara.filter(nome => nome === 'ear').length, 2, 'duas orelhas, uma de cada lado');
    assert.equal(cara.filter(nome => nome === 'eye').length, 2, 'dois olhos');
    assert.equal(cara.filter(nome => nome === 'glint').length, 2, 'um brilho em cada olho');
    // Cada pata leva a canela e o casco dentro (e é isso que gira no passo).
    for (const leg of sheep.legs) {
        const dentro = leg.children.map(child => child.name).sort();
        assert.deepEqual(dentro, ['hoof', 'shin'], 'pata = canela + casco');
    }
});

test('as orelhas são caídas, e os cascos são mais escuros que a lã', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));

    for (const ear of sheep.ears) assert.ok(Math.abs(ear.rotation.z) > 0.2, 'orelha deitada, não em pé');

    const hoof = sheep.legs[0].children.find(child => child.name === 'hoof');
    const coat = SHEEP_COATS.find(item => item.key === sheep.coat).wool;
    assert.notEqual(hoof.material.color.getHex(), coat, 'o casco não é da cor da lã');

    // Os tufos são da mesma lã do corpo: a ovelha é uma peça só de cor.
    const body = sheep.group.children.find(child => child.name === 'body');
    for (const tuft of sheep.tufts) assert.equal(tuft.material.color.getHex(), body.material.color.getHex());
});

/**
 * Fundo da caixa mais baixa do corpo, em coordenadas de dentro do grupo (o pé
 * é 0). Atravessa os grupos das patas: a canela e o casco ficam pendurados no
 * quadril, e é o casco que toca o chão.
 */
function lowestPoint(object, offsetY = 0) {
    const y = offsetY + object.position.y;
    let lowest = object.isMesh ? y - object.scale.y / 2 : Infinity;
    for (const child of object.children) lowest = Math.min(lowest, lowestPoint(child, y));
    return lowest;
}

test('a ovelha pisa no chão: o ponto mais baixo do corpo é o casco', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));

    const maisBaixo = lowestPoint(sheep.group, -sheep.group.position.y);
    assert.ok(Math.abs(maisBaixo) < 1e-9, `o ponto mais baixo está em ${maisBaixo}, e devia estar em 0`);
    assert.ok(sheep.group.position.y >= GROUND, 'o grupo está na altura do chão');
    // O casco é quem encosta: se ele subisse junto com a lã, a ovelha flutuaria.
    for (const leg of sheep.legs) {
        const hoof = leg.children.find(child => child.name === 'hoof');
        const fundo = leg.position.y + hoof.position.y - hoof.scale.y / 2;
        assert.ok(Math.abs(fundo) < 1e-9, `casco a ${fundo} do chão`);
    }
    // Altura total de uma ovelha adulta de caixa: perto de um bloco (o topo do
    // topete fica em 1,05 — o jogador tem 1,8 e vê por cima dela).
    const topete = sheep.head.children.find(child => child.name === 'topknot');
    const topo = sheep.head.position.y + topete.position.y + topete.scale.y / 2;
    assert.ok(Math.abs(topo - 1.05) < 0.02, `o topo da ovelha está em ${topo}, e devia ser ~1,05`);
});

test('cada cor pinta o corpo com o tom da sua lã', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const tons = new Map();
    for (const coat of SHEEP_COATS) {
        const model = system.createModel(coat.key);
        const body = model.group.children.find(child => child.name === 'body');
        tons.set(coat.key, body.material.color.getHex());
        assert.equal(tons.get(coat.key), coat.wool, `a lã ${coat.label} devia ser ${coat.wool.toString(16)}`);
    }
    assert.equal(new Set(tons.values()).size, 3, 'as três lãs são tons diferentes');
});

test('as ovelhas nascem com cores variadas, e todas as três aparecem', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const vistas = new Set();
    // 60 nascimentos: com 68/20/12, a chance de faltar uma cor é desprezível.
    for (let ciclo = 0; ciclo < 15; ciclo++) {
        for (const sheep of spawnSome(system, clock, player)) vistas.add(sheep.coat);
        while (system.entities.length) system.removeEntity(system.entities[0]);
    }
    assert.deepEqual([...vistas].sort(), ['black', 'gray', 'white'], 'as três cores aparecem no mundo');
});

test('cada ovelha é um corpo separado na cena', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const ovelhas = spawnSome(system, clock, idlePlayer({ x: 0, z: 0 }));
    const grupos = new Set(ovelhas.map(sheep => sheep.group));
    assert.equal(grupos.size, ovelhas.length, 'nada de corpo compartilhado');
    assert.equal(new Set(ovelhas.map(sheep => sheep.id)).size, ovelhas.length, 'ids únicos');
});

test('sem o jogo rodando, ela não se mexe', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const player = idlePlayer({ x: 0, z: 0 });
    for (let i = 0; i < 100; i++) {
        clock.t += 5;
        system.update(0.016, player, false, { day: 1 });
    }
    assert.equal(system.entities.length, 0, 'em pausa, nem nasce');
});

test('a ovelha não herda o susto do Mofim', () => {
    // O sistema da ovelha não tem medo: nem `shouldFlee`, nem estado de fuga.
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));
    assert.equal(sheep.scaredUntil, undefined);
    for (let i = 0; i < 20; i++) { clock.t += 0.05; system.update(0.05, idlePlayer({ x: sheep.x, z: sheep.z }), true, { day: 1 }); }
    assert.equal(sheep.scaredUntil, undefined, 'nada de pânico: ela é mansa');
});

// ------------------------------------------------ pastar (puro)

test('o focinho alcança a célula da frente, conforme o rumo dela', () => {
    // O modelo olha para +z, e o rumo é o mesmo do `rotation.y`.
    assert.deepEqual(grazeCellFor({ x: 0.5, z: 0.5, heading: 0 }), { x: 0, z: 1 }, 'rumo +z, come a célula de z+1');
    const leste = grazeCellFor({ x: 0.5, z: 0.5, heading: Math.PI / 2 });
    assert.deepEqual(leste, { x: 1, z: 0 }, 'rumo +x, come a célula de x+1');

    // A célula é a do chão, não a do corpo: o alcance é menor que um bloco.
    assert.ok(SHEEP_GRAZE_REACH > 0.5 && SHEEP_GRAZE_REACH < 1.2);
    assert.deepEqual(
        grazeCellFor({ x: 0.5, z: 0.5, heading: Math.PI }),
        { x: 0, z: 0 - 1 },
        'de costas, come a célula de trás (o focinho está virado para lá)',
    );
});

test('a cabeça desce, fica embaixo e sobe: o envelope da pastagem', () => {
    assert.equal(grazeEnvelope(0), 0, 'começa em pé');
    assert.equal(grazeEnvelope(1), 0, 'termina em pé');
    assert.equal(grazeEnvelope(0.5), 1, 'no meio do pasto, a cabeça está no chão');
    assert.ok(grazeEnvelope(0.1) > 0 && grazeEnvelope(0.1) < 1, 'desce aos poucos, não de estalo');
    assert.ok(grazeEnvelope(0.9) > 0 && grazeEnvelope(0.9) < 1, 'sobe aos poucos');
    // Desce até o meio e sobe depois: o fundo é plano (é onde ela mastiga).
    for (let p = 0.2; p <= 0.8; p += 0.1) assert.equal(grazeEnvelope(p), 1, `plano em ${p}`);
});

test('a primeira pastagem vem cedo; as outras, de vez em quando', () => {
    assert.equal(grazeDelayFor(0, true), SHEEP_GRAZE_FIRST_MIN);
    assert.equal(grazeDelayFor(1, true), SHEEP_GRAZE_FIRST_MAX);
    assert.equal(grazeDelayFor(0, false), SHEEP_GRAZE_REST_MIN);
    assert.equal(grazeDelayFor(1, false), SHEEP_GRAZE_REST_MAX);
    assert.ok(SHEEP_GRAZE_FIRST_MIN < SHEEP_GRAZE_REST_MIN, 'a primeira é mais cedo que as seguintes');
    assert.ok(SHEEP_GRAZE_REST_MIN >= 30, 'pastar é raro: pelo menos meio minuto entre uma vez e outra');
    assert.ok(SHEEP_GRAZE_TIME_MIN >= 4 && SHEEP_GRAZE_TIME_MAX <= 6, 'cada pastagem dura 4–6 s');
    assert.ok(SHEEP_GRAZE_BITE > 0 && SHEEP_GRAZE_BITE < 1, 'a mordida acontece dentro da pastagem');
});

// ------------------------------------------------ pastar (no mundo)

// Põe a pastagem para começar neste instante e confirma que começou.
function grazeNow(system, clock, player, sheep) {
    sheep.grazeAt = clock.t;
    system.update(0.016, player, true, { day: 1 });
    assert.notEqual(sheep.grazeT, null, 'a ovelha deveria ter começado a pastar');
    return grazeCellFor({ x: sheep.x, z: sheep.z, heading: sheep.heading });
}

// Roda até a mordida (ou desiste), devolvendo o tempo que passou.
function grazeUntilBite(system, clock, player, sheep) {
    for (let i = 0; i < 400 && !sheep.bit; i++) {
        clock.t += 0.05;
        system.update(0.05, player, true, { day: 1 });
    }
    assert.equal(sheep.bit, true, 'a mordida deveria ter acontecido');
}

test('pastando, ela para, baixa a cabeça e come a grama da frente', () => {
    const world = makeWorld();
    const clock = { t: 0 };
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    const cell = grazeNow(system, clock, player, sheep);
    assert.equal(world.getBlock(cell.x, GROUND, cell.z), ID.GRASS, 'antes, é grama');

    const ondeEstava = { x: sheep.x, z: sheep.z };
    grazeUntilBite(system, clock, player, sheep);

    assert.equal(world.getBlock(cell.x, GROUND, cell.z), ID.DIRT, 'a grama da frente virou terra');
    assert.equal(world.getBlock(cell.x, GROUND + 1, cell.z), 0, 'e a célula de cima continua vazia');
    assert.equal(sheep.x, ondeEstava.x, 'pastando, ela não anda');
    assert.equal(sheep.z, ondeEstava.z, 'pastando, ela não anda');
    // Cabeça baixa de verdade: o grupo do pescoço desceu e inclinou.
    assert.ok(sheep.head.position.y < SHEEP_NECK_Y - 0.3, 'a cabeça desce quase meio bloco');
    assert.ok(sheep.head.rotation.x > SHEEP_HEAD_REST + 0.8, 'o focinho inclina para o chão');
});

test('terminada a pastagem, a cabeça volta a subir e ela volta a andar', () => {
    const world = makeWorld();
    const clock = { t: 0 };
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    grazeNow(system, clock, player, sheep);
    for (let i = 0; i < 400 && sheep.grazeT !== null; i++) {
        clock.t += 0.05;
        system.update(0.05, player, true, { day: 1 });
    }
    assert.equal(sheep.grazeT, null, 'a pastagem termina');
    // A subida é suavizada, então ela chega a poucos centímetros do repouso no
    // mesmo quadro em que a pastagem acaba (e termina de subir logo depois).
    assert.ok(Math.abs(sheep.head.position.y - SHEEP_NECK_Y) < 0.05,
        `a cabeça volta ao lugar (${sheep.head.position.y} vs ${SHEEP_NECK_Y})`);
    for (let i = 0; i < 10; i++) { clock.t += 0.05; system.update(0.05, player, true, { day: 1 }); }
    assert.ok(Math.abs(sheep.head.position.y - SHEEP_NECK_Y) < 1e-3, 'e assenta no repouso (menos de 1 mm)');
    assert.ok(Math.abs(sheep.head.rotation.x - SHEEP_HEAD_REST) < 0.1, 'e volta a inclinação de repouso');
    assert.ok(sheep.grazeAt > clock.t, 'e fica um tempo sem pastar de novo');
});

test('ela morde uma vez por pastagem, não a cada quadro', () => {
    const world = makeWorld();
    const clock = { t: 0 };
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    grazeNow(system, clock, player, sheep);
    grazeUntilBite(system, clock, player, sheep);
    const primeira = system.regrow.length;
    for (let i = 0; i < 40; i++) {
        clock.t += 0.05;
        system.update(0.05, player, true, { day: 1 });
    }
    assert.equal(system.regrow.length, primeira, 'a mesma pastagem não come duas células');
    assert.ok(primeira <= 1, 'no máximo uma célula por mordida');
});

test('só come grama: areia e pedra ficam onde estão', () => {
    const world = makeWorld();
    const clock = { t: 0 };
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    const cell = grazeCellFor({ x: sheep.x, z: sheep.z, heading: sheep.heading });
    world.setBlock(cell.x, GROUND, cell.z, ID.SAND);
    assert.equal(world.getBlock(cell.x, GROUND, cell.z), ID.SAND);

    grazeNow(system, clock, player, sheep);
    grazeUntilBite(system, clock, player, sheep);
    assert.equal(world.getBlock(cell.x, GROUND, cell.z), ID.SAND, 'areia não se come');
    assert.equal(system.regrow.length, 0, 'e nada entra na fila de crescimento');
});

test('a touceira de grama alta em cima da grama comida sai junto', () => {
    const world = makeWorld();
    const clock = { t: 0 };
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    const cell = grazeCellFor({ x: sheep.x, z: sheep.z, heading: sheep.heading });
    world.setBlock(cell.x, GROUND + 1, cell.z, ID.TALL_GRASS);

    grazeNow(system, clock, player, sheep);
    grazeUntilBite(system, clock, player, sheep);
    assert.equal(world.getBlock(cell.x, GROUND, cell.z), ID.DIRT, 'a grama virou terra');
    assert.equal(world.getBlock(cell.x, GROUND + 1, cell.z), 0, 'e a touceira foi comida');
});

test('a terra comida volta a ser grama entre cinco e dez minutos, e não antes', () => {
    const world = makeWorld();
    const clock = { t: 0 };
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    const cell = grazeNow(system, clock, player, sheep);
    grazeUntilBite(system, clock, player, sheep);
    assert.equal(system.regrow.length, 1, 'a célula comida entrou na fila');

    // O prazo é sorteado entre cinco e dez minutos (valores escritos à mão de
    // propósito: repetir a constante aqui não provaria nada).
    const espera = system.regrow[0].at - clock.t;
    assert.ok(espera > 298 && espera <= 601, `o crescimento demora ${espera.toFixed(1)} s, e devia ser 300–600`);
    assert.ok(SHEEP_REGROW_MIN >= 300, 'cinco minutos é o mínimo');

    // Um segundo antes do prazo, continua terra.
    clock.t = system.regrow[0].at - 1;
    system.update(0.016, player, true, { day: 1 });
    assert.equal(world.getBlock(cell.x, GROUND, cell.z), ID.DIRT, 'antes do prazo, ainda é terra');

    // No prazo, volta a ser grama e a célula sai da fila.
    clock.t = system.regrow[0].at + 0.01;
    system.update(0.016, player, true, { day: 1 });
    assert.equal(world.getBlock(cell.x, GROUND, cell.z), ID.GRASS, 'no prazo, volta a ser grama');
    assert.equal(system.regrow.length, 0, 'e a fila fica vazia');
});

test('onde o jogador construiu, a grama não volta', () => {
    const world = makeWorld();
    const clock = { t: 0 };
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    const cell = grazeNow(system, clock, player, sheep);
    grazeUntilBite(system, clock, player, sheep);

    // O jogador põe pedra no lugar da terra comida.
    world.setBlock(cell.x, GROUND, cell.z, ID.STONE);
    clock.t = system.regrow[0].at + 1;
    system.update(0.016, player, true, { day: 1 });
    assert.equal(world.getBlock(cell.x, GROUND, cell.z), ID.STONE, 'o bloco do jogador manda');
    assert.equal(system.regrow.length, 0, 'e a célula sai da fila (não fica tentando para sempre)');
});

test('a fila de crescimento tem teto: pasto infinito não vira memória infinita', () => {
    const world = makeWorld();
    const clock = { t: 0 };
    const system = makeSystem(world, clock);

    for (let i = 0; i < SHEEP_REGROW_LIMIT + 40; i++) system.queueRegrow(i, GROUND, 0, clock.t);
    assert.equal(system.regrow.length, SHEEP_REGROW_LIMIT, 'a fila para no teto');
    assert.equal(system.regrow[system.regrow.length - 1].x, SHEEP_REGROW_LIMIT + 39, 'e as mais novas ficam');
});

test('com a cabeça no chão, o focinho encosta na grama da frente (sem entrar no bloco)', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 })); // ovelha virada para +z do modelo

    // Põe a cabeça na pose de pastagem completa, pela mesma função que o jogo usa.
    const pose = headPoseFor(1);
    sheep.head.rotation.x = pose.rotationX;
    sheep.head.position.y = pose.y;
    sheep.head.position.z = pose.z;
    // Referência limpa: a ovelha na origem e virada para +z (sem o rumo do passeio).
    sheep.group.position.set(0, 0, 0);
    sheep.group.rotation.y = 0;
    sheep.group.updateMatrixWorld(true);

    const focinho = sheep.head.children.find(child => child.name === 'muzzle');
    const onde = new THREE.Vector3();
    focinho.getWorldPosition(onde);

    // Encostado, não enterrado: o centro do focinho fica a meia altura dele.
    assert.ok(onde.y > -0.02 && onde.y < 0.12, `o focinho está em y = ${onde.y.toFixed(3)}`);
    // E à frente, sobre a célula que ela come (0,8 bloco à frente do centro).
    assert.ok(onde.z > 0.45 && onde.z < 0.85, `o focinho está em z = ${onde.z.toFixed(3)}`);

    // Em pé, o focinho está bem acima disso (é a diferença que se vê pastar).
    const emPe = headPoseFor(0);
    sheep.head.rotation.x = emPe.rotationX;
    sheep.head.position.y = emPe.y;
    sheep.head.position.z = emPe.z;
    sheep.group.updateMatrixWorld(true);
    const ondeEmPe = new THREE.Vector3();
    focinho.getWorldPosition(ondeEmPe);
    assert.ok(ondeEmPe.y - onde.y > 0.5, 'pastando, o focinho desce mais de meio bloco');
});

// ------------------------------------------------ a lã e a tesoura

test('cada cor de lã tem o seu fardo no catálogo', () => {
    assert.deepEqual(Object.keys(SHEEP_WOOL_ITEMS).sort(), ['black', 'gray', 'white']);
    for (const coat of SHEEP_COATS) {
        assert.ok(SHEEP_WOOL_ITEMS[coat.key], `a lã ${coat.label} precisa de um item`);
    }
    // Uma cor não aponta para o item de outra.
    assert.equal(new Set(Object.values(SHEEP_WOOL_ITEMS)).size, 3);
});

test('tosquiada, ela fica com uma camada de lã baixa e lisa: sem tufos, sem topete', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const comLa = system.createModel('white');
    const tosada = system.createModel('white', { sheared: true });

    assert.equal(comLa.tufts.length, SHEEP_TUFTS.length, 'com lã, os tufos existem');
    assert.equal(tosada.tufts.length, 0, 'tosquiada, não sobra tufo');

    const caraComLa = comLa.head.children.map(child => child.name);
    const caraTosada = tosada.head.children.map(child => child.name);
    assert.ok(caraComLa.includes('topknot'));
    assert.ok(!caraTosada.includes('topknot'), 'o topete vai junto com a lã');
    // Continua sendo a mesma ovelha: cara e quatro patas no lugar.
    for (const parte of ['skull', 'muzzle', 'eye', 'glint', 'ear']) {
        assert.ok(caraTosada.includes(parte), `a peça ${parte} fica`);
    }
    assert.equal(caraTosada.filter(nome => nome === 'ear').length, 2);
    assert.equal(tosada.legs.length, 4);

    // E o corpo encolhe: a camada de lã tosada é mais baixa e mais curta.
    const corpoComLa = comLa.group.children.find(child => child.name === 'body');
    const corpoTosado = tosada.group.children.find(child => child.name === 'body');
    assert.ok(corpoTosado.scale.y < corpoComLa.scale.y, 'a lã tosada é mais baixa');
    assert.ok(corpoTosado.scale.z < corpoComLa.scale.z, 'e mais curta');
    assert.equal(tosada.sheared, true);
    assert.equal(comLa.sheared, false);

    // O casco e o brilho do olho continuam: não são lã.
    const casco = tosada.legs[0].children.find(child => child.name === 'hoof');
    assert.ok(casco, 'o casco fica');
});

// Mira de teste: dois blocos atrás da ovelha, na altura do corpo, olhando para ela.
function aimAt(sheep) {
    return {
        origin: { x: sheep.x, y: sheep.visualY + 0.45, z: sheep.z - 2 },
        direction: { x: 0, y: 0, z: 1 },
    };
}

test('a tesoura tira a lã: de um a três fardos, na cor da ovelha', () => {
    const world = makeWorld();
    const clock = { t: 0 };
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    const { origin, direction } = aimAt(sheep);
    const tosado = system.shearAt(origin, direction, { reach: 3 });
    assert.ok(tosado, 'a ovelha na mira é tosquiada');
    assert.equal(tosado.entity, sheep);
    assert.equal(tosado.coat, sheep.coat, 'a lã sai na cor dela');
    assert.ok(tosado.count >= SHEEP_WOOL_MIN && tosado.count <= SHEEP_WOOL_MAX,
        `saiu ${tosado.count} fardo(s), e devia ser de 1 a 3`);

    assert.equal(sheep.sheared, true, 'ela fica tosquiada');
    assert.equal(sheep.tufts.length, 0, 'e o corpo é o tosado');
    assert.ok(sheep.woolAt > clock.t, 'e fica com a lã marcada para voltar');
    // A tosquiada continua na cena, no mesmo lugar.
    assert.ok(system.world.scene.children.includes(sheep.group));

    // Sem lã, a tesoura não tem o que cortar.
    assert.equal(system.shearAt(origin, direction, { reach: 3 }), null, 'não se tosquia duas vezes');
});

test('a tesoura só pega a ovelha que está na mira', () => {
    const world = makeWorld();
    const clock = { t: 0 };
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    // De costas para ela, a mira não é ovelha nenhuma.
    const deCostas = system.shearAt(
        { x: sheep.x, y: sheep.visualY + 0.45, z: sheep.z - 2 },
        { x: 0, y: 0, z: -1 },
        { reach: 3 },
    );
    assert.equal(deCostas, null, 'mirar para o lado não tosquia');
    // E longe demais também não.
    const longe = system.shearAt(
        { x: sheep.x, y: sheep.visualY + 0.45, z: sheep.z - 8 },
        { x: 0, y: 0, z: 1 },
        { reach: 3 },
    );
    assert.equal(longe, null, 'fora do alcance não tosquia');
    assert.equal(sheep.sheared, false, 'e ela continua com lã');
});

test('a lã volta em cinco a oito minutos, e pastar adianta o relógio', () => {
    const world = makeWorld();
    const clock = { t: 0 };
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, player);

    const { origin, direction } = aimAt(sheep);
    system.shearAt(origin, direction, { reach: 3 });
    const espera = sheep.woolAt - clock.t;
    assert.ok(espera > 298 && espera <= 481, `a lã volta em ${espera.toFixed(1)} s, e devia ser 300–480`);
    assert.ok(SHEEP_WOOL_REGROW_MIN >= 300, 'cinco minutos é o mínimo');

    // Uma pastagem adianta o relógio da lã.
    const antes = sheep.woolAt;
    grazeNow(system, clock, player, sheep);
    grazeUntilBite(system, clock, player, sheep);
    assert.equal(sheep.woolAt, antes - SHEEP_WOOL_GRAZE_BONUS, 'cada pastagem adianta 90 s');
    assert.equal(sheep.sheared, true, 'mas ainda não voltou');

    // No prazo, a lã volta e o modelo é o de sempre.
    clock.t = sheep.woolAt + 0.01;
    system.update(0.016, player, true, { day: 1 });
    assert.equal(sheep.sheared, false, 'a lã voltou');
    assert.equal(sheep.tufts.length, SHEEP_TUFTS.length, 'com os tufos de volta');
    assert.ok(sheep.head.children.some(child => child.name === 'topknot'), 'e o topete');
    assert.ok(system.world.scene.children.includes(sheep.group), 'continua na cena');
});

test('a tosquia dá de um a três fardos, e as três quantias acontecem', () => {
    assert.equal(woolCountFor(0), 1);
    assert.equal(woolCountFor(0.4), 2);
    assert.equal(woolCountFor(0.9), 3, 'o terço de cima dá três');
    const vistos = new Set();
    for (let i = 0; i < 3000; i++) vistos.add(woolCountFor(i / 3000));
    assert.deepEqual([...vistos].sort(), [1, 2, 3], 'não é sempre a mesma quantia');
    for (const roll of [0, 0.5, 1, -1, 2, Number.NaN]) {
        const count = woolCountFor(roll);
        assert.ok(count >= 1 && count <= 3, `${roll} deu ${count}`);
    }
});

// ------------------------------------------------ o balido

test('sem ninguém por perto, o balido de passeio sai no relógio dela', () => {
    assert.equal(bleatFor({ at: 0, distance: 18, nextIdleAt: 10 }), null, 'ainda cedo');
    assert.equal(bleatFor({ at: 10, distance: 18, nextIdleAt: 10 }), 'call', 'chegou a hora');
    // Longe demais, nem o chamado é ouvido.
    assert.equal(bleatFor({ at: 10, distance: SHEEP_BLEAT_RANGE + 1, nextIdleAt: 0 }), null);
    assert.ok(SHEEP_BLEAT_IDLE_MIN >= 10 && SHEEP_BLEAT_IDLE_MAX <= 60, 'o chamado é de vez em quando');
});

test('quando o jogador chega perto ela bale uma vez, não a cada quadro', () => {
    const perto = 2;
    assert.equal(bleatFor({ at: 100, distance: perto, near: true, wasNear: false }), 'near');
    // Continuar perto não repete o balido.
    assert.equal(bleatFor({ at: 105, distance: perto, near: true, wasNear: true, nextIdleAt: Infinity }), null,
        'parado do lado dela, silêncio');
    // Sair e voltar antes da espera também não.
    assert.equal(bleatFor({
        at: 100 + SHEEP_BLEAT_NEAR_COOLDOWN - 1,
        distance: perto, near: true, wasNear: false, lastBleatAt: 100,
    }), null, 'sair e voltar rápido não vira metralhadora');
    // Depois da espera, sim.
    assert.equal(bleatFor({
        at: 100 + SHEEP_BLEAT_NEAR_COOLDOWN + 1,
        distance: perto, near: true, wasNear: false, lastBleatAt: 100,
    }), 'near');
    assert.ok(SHEEP_BLEAT_NEAR_COOLDOWN > SHEEP_BLEAT_COOLDOWN, 'o "chegou perto" espera bem mais');
});

test('dois balidos da mesma ovelha nunca saem colados', () => {
    // Um deles acabou de acontecer: nem o "chegou perto" nem o chamado passam.
    assert.equal(bleatFor({
        at: 50, distance: 1, near: true, wasNear: false, lastBleatAt: 49, nextIdleAt: 0,
    }), null);
    // O chamado de passeio também respeita a espera curta: dois "bé" seguidos
    // não podem sair colados só porque o relógio sorteou cedo.
    assert.equal(bleatFor({
        at: 100, distance: 10, near: false, lastBleatAt: 98, nextIdleAt: 0,
    }), null, 'o chamado espera a pausa mínima');
    assert.equal(bleatFor({
        at: 98 + SHEEP_BLEAT_COOLDOWN, distance: 10, near: false, lastBleatAt: 98, nextIdleAt: 0,
    }), 'call', 'passada a pausa, ele sai');

    // Passada a espera curta, o balido que estava engatilhado sai.
    assert.equal(bleatFor({
        at: 49 + SHEEP_BLEAT_COOLDOWN, distance: 1, near: true, wasNear: false,
        lastBleatAt: 49, nextIdleAt: 0, nearCooldown: 0,
    }), 'near');
    // Um balido já pedido por outra regra tem prioridade.
    assert.equal(bleatFor({
        at: 0, distance: 1, near: false, pending: 'near', nextIdleAt: 0,
    }), 'near');
    assert.ok(SHEEP_BLEAT_NEAR_RADIUS > 0 && SHEEP_BLEAT_NEAR_RADIUS < SHEEP_BLEAT_RANGE,
        'o raio do "chegou perto" é menor que o alcance do som');
});

// Sistema com um bisbilhoteiro no lugar do áudio.
function makeBleatSystem(world, clock) {
    const ouvidos = [];
    const SheepSystem = createSheepSystemClass({
        THREE, ID, BLOCKS, CHUNK_SIZE,
        now: () => clock.t,
        onBleat: evento => ouvidos.push(evento),
    });
    return { system: new SheepSystem(world), ouvidos };
}

test('a ovelha bale quando o jogador chega perto, e avisa a distância', () => {
    const clock = { t: 0 };
    const { system, ouvidos } = makeBleatSystem(makeWorld(), clock);
    const longe = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, longe);
    // P6: ela nasce em bando, então o teste escuta **esta** ovelha.
    const meus = () => ouvidos.filter(ouvido => ouvido.entity === sheep);
    assert.equal(meus().length, 0, 'nascendo longe, ela não bale');

    // O jogador aparece do lado dela.
    const perto = idlePlayer({ x: sheep.x, z: sheep.z });
    clock.t += 0.05;
    system.update(0.05, perto, true, { day: 1 });
    assert.equal(meus().length, 1, 'um balido');
    assert.equal(meus()[0].reason, 'near');
    assert.ok(meus()[0].distance < SHEEP_BLEAT_NEAR_RADIUS + 0.01);

    // Ficando lá, ela não repete.
    for (let i = 0; i < 10; i++) { clock.t += 0.05; system.update(0.05, perto, true, { day: 1 }); }
    assert.equal(meus().length, 1, 'e não vira zumbido');
});

test('de vez em quando ela bale sozinha, mesmo com o jogador longe', () => {
    const clock = { t: 0 };
    const { system, ouvidos } = makeBleatSystem(makeWorld(), clock);
    const longe = idlePlayer({ x: 0, z: 0 });
    const sheep = spawnOne(system, clock, longe);

    // Longe, mas ainda dentro do alcance do som (10 blocos; o raio do "chegou
    // perto" é 5): é a situação do chamado de passeio.
    const aDezBlocos = idlePlayer({ x: sheep.x + 10, z: sheep.z });

    // Adianta o relógio do chamado.
    sheep.nextBleatAt = clock.t;
    clock.t += 0.05;
    system.update(0.05, aDezBlocos, true, { day: 1 });
    assert.equal(ouvidos.length, 1);
    assert.equal(ouvidos[0].reason, 'call');
    assert.ok(ouvidos[0].distance > SHEEP_BLEAT_NEAR_RADIUS, 'é o chamado de longe');
    // E o próximo fica para daqui a um tempo.
    assert.ok(sheep.nextBleatAt > clock.t + SHEEP_BLEAT_IDLE_MIN - 1);
});

test('game.js toca os dois balidos com o volume caindo pela distância', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /onBleat: \(\{ reason, distance \}\) => \{/);
    assert.match(source, /const falloff = clamp01\(1 - distance \/ SHEEP_BLEAT_RANGE\)/);
    assert.match(source, /audio\.play\(near \? 'sheep-bleat-near' : 'sheep-bleat'/);
    assert.match(source, /gainScale: falloff \*/, 'o volume cai com a distância');
    assert.match(source, /import \{ SHEEP_BLEAT_RANGE/, 'o alcance vem do módulo da ovelha, não é número solto');
});

// ------------------------------------------------ o rebanho (P6)

test('o bando nasce junto: de duas a quatro ovelhas, todas do mesmo herd', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const ovelhas = spawnOne(system, clock, player) && system.entities;

    // Duas a quatro, escrito à mão: ovelha sozinha não é rebanho, e mais que
    // quatro vira nuvem de lã.
    assert.ok(ovelhas.length >= 2 && ovelhas.length <= 4, `nasceram ${ovelhas.length}`);
    const bandos = new Set(ovelhas.map(sheep => sheep.herd));
    assert.equal(bandos.size, 1, 'todas do mesmo bando');
    assert.equal(ovelhas.filter(sheep => sheep.leader).length, 1, 'uma líder, e só uma');
    assert.ok(ovelhas[0].leader, 'a primeira que nasce é a líder');

    // Nascem juntas, não empilhadas.
    for (let i = 1; i < ovelhas.length; i++) {
        const gap = Math.hypot(ovelhas[i].x - ovelhas[0].x, ovelhas[i].z - ovelhas[0].z);
        assert.ok(gap >= SHEEP_HERD_SPREAD_MIN - 0.01, `companheira a ${gap} blocos (não nasce dentro)`);
        assert.ok(gap <= SHEEP_HERD_SPREAD_MAX + 0.01, `companheira a ${gap} blocos (não nasce no outro pasto)`);
    }
    assert.ok(SHEEP_HERD_MIN === 2 && SHEEP_HERD_MAX === 4, 'o bando é de duas a quatro');
});

test('herdSizeFor sorteia de dois a quatro, e herdSpotFor fica no raio do bando', () => {
    // Valores escritos à mão (e não a constante de novo).
    assert.equal(herdSizeFor(0), 2);
    assert.equal(herdSizeFor(0.33), 2);
    assert.equal(herdSizeFor(0.34), 3);
    assert.equal(herdSizeFor(0.66), 3);
    assert.equal(herdSizeFor(0.67), 4);
    assert.equal(herdSizeFor(1), 4);
    assert.equal(herdSizeFor(-5), 2, 'sorteio fora da faixa não quebra');
    assert.equal(herdSizeFor(9), 4);

    const pontos = new Set();
    for (let member = 1; member <= 3; member++) {
        const spot = herdSpotFor({ x: 10, z: -4, seed: 77, attempt: 2, member });
        const raio = Math.hypot(spot.x - 10, spot.z + 4);
        assert.ok(raio >= SHEEP_HERD_SPREAD_MIN - 1e-9, `raio ${raio} menor que o mínimo`);
        assert.ok(raio <= SHEEP_HERD_SPREAD_MAX + 1e-9, `raio ${raio} maior que o máximo`);
        pontos.add(`${spot.x.toFixed(4)},${spot.z.toFixed(4)}`);
    }
    assert.equal(pontos.size, 3, 'cada companheira em um canto diferente');
});

test('a seguidora vai atrás da líder quando fica para trás', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const ovelhas = spawnOne(system, clock, player) && system.entities;
    const lider = ovelhas.find(sheep => sheep.leader);
    const seguidora = ovelhas.find(sheep => !sheep.leader);
    if (!seguidora) return; // bando de uma só não existe (o mínimo é 2)

    // A líder "andou" para longe da seguidora.
    lider.x = seguidora.x + SHEEP_FOLLOW_GAP + 3;
    lider.z = seguidora.z;
    seguidora.turnAt = clock.t;

    system.update(0.016, idlePlayer({ x: lider.x + 20, z: lider.z + 20 }), true, { day: 1 });

    // A líder se mexe no mesmo quadro: o alvo é o **lugar** da seguidora em
    // volta dela (perto, mas não em cima do corpo dela).
    const dalider = Math.hypot(seguidora.targetX - lider.x, seguidora.targetZ - lider.z);
    assert.ok(dalider >= SHEEP_SLOT_MIN - 0.02 && dalider <= SHEEP_SLOT_MAX + 0.02,
        `o alvo é o lugar dela no bando (ficou a ${dalider})`);
});

test('a seguidora pastoreia em volta da líder, não de si mesma', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const ovelhas = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 })) && system.entities;
    const lider = ovelhas.find(sheep => sheep.leader);
    const seguidora = ovelhas.find(sheep => !sheep.leader);
    if (!seguidora) return;

    // Colada na líder: o alvo sorteado tem de cair perto **dela**.
    seguidora.x = lider.x + 0.5;
    seguidora.z = lider.z;
    seguidora.turnAt = clock.t;
    system.update(0.016, idlePlayer({ x: lider.x + 20, z: lider.z + 20 }), true, { day: 1 });

    const dalider = Math.hypot(seguidora.targetX - lider.x, seguidora.targetZ - lider.z);
    assert.ok(dalider <= SHEEP_ROAM_MAX * 2, `o alvo ficou a ${dalider} da líder`);
});

test('sumindo a líder, a próxima do bando assume', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const ovelhas = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 })) && system.entities;
    const lider = ovelhas.find(sheep => sheep.leader);
    const seguidora = ovelhas.find(sheep => !sheep.leader);
    if (!seguidora) return;

    system.removeEntity(lider);
    const nova = system.herdLeaderOf(seguidora);
    assert.equal(nova, null, 'sozinha no comando, ela não persegue ninguém');
    assert.ok(seguidora.leader, 'ela virou a líder');
});

test('o susto alcança as vizinhas que percebem, mas não o bando do lado', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const ovelhas = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 })) && system.entities;
    const [primeira, segunda] = ovelhas;
    if (!segunda) return;
    // `entities` é a mesma lista: guarda o bando antes de entrar as estranhas.
    const bando = [...ovelhas];

    // Duas estranhas coladas na primeira: uma de outro bando e uma distraída do
    // **mesmo** bando (atenção alta = não sente a vizinha).
    const outraBando = { ...segunda, id: 9999, herd: 424242, leader: true, alertUntil: 0, fleeUntil: 0 };
    outraBando.x = primeira.x + 0.5;
    outraBando.z = primeira.z;
    const distraida = { ...segunda, id: 9998, herd: primeira.herd, leader: false, alertUntil: 0, fleeUntil: 0, attention: 0.95 };
    distraida.x = primeira.x - 0.5;
    distraida.z = primeira.z;
    system.entities.push(outraBando, distraida);

    // As companheiras "sentem" a vizinha (atenção baixa).
    for (const outra of bando.slice(1)) outra.attention = 0;

    system.alert(primeira, clock.t, { x: primeira.x + 1, z: primeira.z });

    assert.ok(primeira.alertUntil > clock.t, 'a assustada está alerta');
    for (const outra of bando.slice(1)) {
        assert.ok(outra.alertUntil > clock.t, 'a companheira que sente a vizinha encara junto');
        assert.ok(outra.alertAt > clock.t, 'mas entra no susto **depois**, com atraso');
    }
    assert.equal(distraida.alertUntil, 0, 'a distraída não entra no susto alheio');
    assert.equal(outraBando.alertUntil, 0, 'o bando do lado não é contaminado');
    assert.ok(SHEEP_SCARE_SPREAD >= SHEEP_HERD_SPREAD_MAX, 'o contágio alcança o bando inteiro');
    assert.ok(SHEEP_ALERT_TIME > 0, 'o susto dura um tempo');
});

test('o golpe também se espalha: o bando foge junto', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const ovelhas = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 })) && system.entities;
    const alvo = ovelhas[0];
    const de = { x: alvo.x - 1, y: alvo.y + 0.5, z: alvo.z };

    const golpe = system.hitAt(de, { x: 1, y: 0, z: 0 }, { maxDistance: 5 });
    assert.ok(golpe);
    for (const outra of ovelhas) {
        assert.ok(outra.fleeUntil > clock.t, `a ovelha ${outra.id} fugiu junto`);
    }
    assert.ok(SHEEP_FLEE_TIME > SHEEP_ALERT_TIME, 'a fuga dura mais que o susto de chegada');
});

test('o rebanho não passa de seis no mundo, com o tempo passando', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const player = idlePlayer({ x: 0, z: 0 });
    spawnSome(system, clock, player);
    assert.equal(system.entities.length, SHEEP_LIMIT);
    assert.equal(SHEEP_LIMIT, 6, 'seis é o limite escrito à mão');

    for (let i = 0; i < 500; i++) {
        clock.t += 5;
        system.update(0.05, player, true, { day: 1 });
        assert.ok(system.entities.length <= SHEEP_LIMIT, `passou do limite (${system.entities.length})`);
    }
});

test('game.js dá velocidade e agachamento à ovelha e liga o golpe nela', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /sheepSystem\.update\(dt, \{ pos: player\.pos, vel: player\.vel, crouching: isCrouching \}/,
        'o susto precisa saber a velocidade e se o jogador está agachado');
    assert.match(source, /const golpe = sheepSystem\.hitAt\(camera\.position, creatureAim, aim\)/,
        'o golpe do jogador assusta a ovelha');
    assert.match(source, /audio\.play\('sheep-bleat-near', \{ gainScale:[^}]*\}\)/, 'e ela bale assustada');
});

// ------------------------------------------------ o pescoço e o olhar (P7)

test('o pescoço liga o corpo à cabeça: em pé é curto, pastando estica', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));

    const pescoco = sheep.group.children.find(child => child.name === 'neck');
    assert.ok(pescoco, 'o modelo tem uma peça de pescoço');

    const emPe = neckPoseFor(SHEEP_NECK_Y, SHEEP_NECK_Z);
    const pastando = neckPoseFor(headPoseFor(1).y, headPoseFor(1).z);
    assert.ok(pastando.length > emPe.length + 0.2,
        `pastando o pescoço estica (${emPe.length} → ${pastando.length})`);

    // As pontas do pescoço: uma dentro do corpo, outra no pivô da cabeça.
    for (const [pose, rotulo] of [[emPe, 'em pé'], [pastando, 'pastando']]) {
        const meia = pose.length / 2;
        const ponta = (sinal) => ({
            y: pose.y + sinal * meia * Math.cos(pose.rotationX),
            z: pose.z + sinal * meia * Math.sin(pose.rotationX),
        });
        const baixo = ponta(-1), alto = ponta(1);
        assert.ok(Math.abs(baixo.y - SHEEP_NECK_ANCHOR_Y) < 1e-9 && Math.abs(baixo.z - SHEEP_NECK_ANCHOR_Z) < 1e-9,
            `${rotulo}: o pé do pescoço fica no ombro`);
        // O ombro está dentro do corpo? (corpo: centro y 0,62 e meio 0,23; z ±0,39)
        assert.ok(SHEEP_NECK_ANCHOR_Y < 0.85 && SHEEP_NECK_ANCHOR_Y > 0.39, 'o ombro fica dentro da lã');
        assert.ok(Math.abs(SHEEP_NECK_ANCHOR_Z) < 0.39, 'e na frente do corpo, não na lateral');
    }
});

test('pastando, o pescoço acompanha a cabeça e não sobra vão', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));
    const pose = headPoseFor(1);
    sheep.head.rotation.x = pose.rotationX;
    sheep.head.position.y = pose.y;
    sheep.head.position.z = pose.z;
    sheep.group.position.set(0, 0, 0);
    sheep.group.rotation.y = 0;
    sheep.group.updateMatrixWorld(true);

    const pescoco = sheep.group.children.find(child => child.name === 'neck');
    // O jogo posiciona o pescoço com `neckPoseFor` todo quadro; o teste faz o
    // mesmo e confere o encaixe.
    const ajuste = neckPoseFor(sheep.head.position.y, sheep.head.position.z);
    pescoco.position.y = ajuste.y;
    pescoco.position.z = ajuste.z;
    pescoco.rotation.x = ajuste.rotationX;
    pescoco.scale.y = ajuste.length;
    // A ponta de cima do pescoço tem de estar na cabeça (é o encaixe).
    const comprimento = pescoco.scale.y;
    const alto = new THREE.Vector3(0, comprimento / 2, 0)
        .applyEuler(pescoco.rotation).add(pescoco.position);
    assert.ok(Math.abs(alto.y - (sheep.head.position.y + SHEEP_NECK_HEAD_Y)) < 1e-6,
        `topo do pescoço na altura do encaixe (${alto.y} vs ${sheep.head.position.y + SHEEP_NECK_HEAD_Y})`);
    assert.ok(Math.abs(alto.z - (sheep.head.position.z + SHEEP_NECK_HEAD_Z)) < 1e-6);

    // E a cabeça desceu de verdade (o motivo de precisar do pescoço).
    assert.ok(sheep.head.position.y < SHEEP_NECK_Y - 0.3, 'a cabeça desce para pastar');
});

test('cada ovelha repara por conta própria: visão, raio e atenção', () => {
    // Valores escritos à mão (e não a constante de novo).
    const perto = { distance: 3, viewDot: 1 };
    assert.equal(sheepNotices({ ...perto, attention: 0 }), true);
    assert.equal(sheepNotices({ ...perto, attention: 0.3 }), true);
    assert.equal(sheepNotices({ ...perto, attention: 0.9 }), false, 'distraída não repara');
    assert.equal(sheepNotices({ distance: SHEEP_NOTICE_RADIUS + 1, viewDot: 1, attention: 0 }), false, 'longe demais');
    assert.equal(sheepNotices({ distance: 3, viewDot: SHEEP_VIEW_MIN_DOT - 0.01, attention: 0 }), false,
        'de costas não vê');
    assert.equal(sheepNotices({ distance: 3, viewDot: SHEEP_VIEW_MIN_DOT, attention: 0 }), true,
        'na borda do campo de visão ainda vê');
    assert.equal(SHEEP_NOTICE_RADIUS > SHEEP_ALERT_RADIUS, true, 'ela repara antes de se assustar');
    assert.ok(SHEEP_NOTICE_CHANCE > 0 && SHEEP_NOTICE_CHANCE < 1, 'nem todas reparam');
});

test('a reação tem atraso sorteado, dentro da faixa', () => {
    for (let id = 0; id < 30; id++) {
        const atraso = noticeDelayFor(id, 12.3);
        assert.ok(atraso >= SHEEP_NOTICE_DELAY_MIN && atraso <= SHEEP_NOTICE_DELAY_MAX,
            `atraso ${atraso} fora da faixa`);
    }
    assert.ok(SHEEP_NOTICE_DELAY_MAX > SHEEP_NOTICE_DELAY_MIN, 'a faixa tem largura');
    assert.equal(noticeDelayFor(5, 12.3), noticeDelayFor(5, 12.3), 'a mesma ovelha, o mesmo instante, o mesmo atraso');
});

test('pastando de costas, o jogador passa correndo e ela nem levanta a cabeça', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));
    sheep.attention = 0;
    // De costas para o jogador (que está em +x).
    sheep.heading = -Math.PI / 2;
    sheep.turnAt = clock.t + 100;
    sheep.targetX = sheep.x; sheep.targetZ = sheep.z;

    const correndo = { pos: { x: sheep.x + 0.4, z: sheep.z }, vel: { x: 6, z: 0 }, crouching: false };
    for (let i = 0; i < 20; i++) { clock.t += 0.05; system.update(0.05, correndo, true, { day: 1 }); }

    assert.equal(sheep.alertUntil, 0, 'não viu: não se assusta');
    assert.ok(Math.abs(sheep.lookYaw) < 1e-9, 'e a cabeça não vira');
});

test('duas ovelhas do mesmo bando reagem diferente ao mesmo jogador', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const ovelhas = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 })) && system.entities;
    const [atenta, distraida] = ovelhas;
    if (!distraida) return;

    atenta.attention = 0;
    distraida.attention = 0.95;
    for (const ovelha of [atenta, distraida]) {
        // As duas de cara para o jogador, e paradas.
        ovelha.heading = Math.atan2(1, 0);
        ovelha.turnAt = clock.t + 100;
        ovelha.targetX = ovelha.x; ovelha.targetZ = ovelha.z;
        ovelha.x = atenta.x + (ovelha === distraida ? 0.6 : 0);
        ovelha.z = atenta.z;
    }

    const correndo = { pos: { x: atenta.x + 0.4, z: atenta.z }, vel: { x: 6, z: 0 }, crouching: false };
    for (let i = 0; i < 20; i++) { clock.t += 0.05; system.update(0.05, correndo, true, { day: 1 }); }

    assert.ok(atenta.alertUntil > clock.t, 'a atenta encara o jogador');
    assert.equal(distraida.alertUntil, 0, 'a distraída continua no pasto');
});

test('o olhar entra suave: a cabeça vira aos poucos e volta ao repouso', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));
    sheep.attention = 0;
    sheep.x = 0; sheep.z = 0;
    sheep.heading = 0;            // olhando para +z
    sheep.turnAt = clock.t + 100;
    sheep.targetX = 0; sheep.targetZ = 0;

    // Jogador ao lado (0,6; 0,2): a cabeça tem de virar quase 90°.
    const correndo = { pos: { x: 0.6, z: 0.2 }, vel: { x: 6, z: 0 }, crouching: false };
    system.update(0.05, correndo, true, { day: 1 });
    system.alert(sheep, clock.t, correndo.pos, { delay: 0 });

    let maiorSalto = 0;
    let anterior = sheep.lookYaw;
    let primeiro = null;
    let pico = 0;
    for (let i = 0; i < 40; i++) {
        clock.t += 0.05;
        system.update(0.05, correndo, true, { day: 1 });
        maiorSalto = Math.max(maiorSalto, Math.abs(sheep.lookYaw - anterior));
        anterior = sheep.lookYaw;
        if (primeiro === null && sheep.lookYaw !== 0) primeiro = Math.abs(sheep.lookYaw);
        pico = Math.max(pico, Math.abs(sheep.lookYaw));
    }

    // Num quadro (0,05 s aqui) ela dá no máximo metade do caminho — é o que faz
    // a virada parecer animação em vez de teleporte.
    assert.ok(primeiro !== null && primeiro < SHEEP_LOOK_MAX_YAW * 0.5,
        `no primeiro quadro a cabeça só começa (${primeiro})`);
    assert.ok(maiorSalto < SHEEP_LOOK_MAX_YAW * 0.5, `nenhum quadro vira de uma vez (${maiorSalto} rad)`);
    assert.ok(pico > 0.4, `a cabeça chegou a virar (${pico} rad)`);
    assert.ok(pico <= SHEEP_LOOK_MAX_YAW + 1e-9, 'sem passar do limite do pescoço');
    assert.ok(SHEEP_LOOK_TILT > 0, 'e inclina de lado');
    // A cabeça chega primeiro; o corpo acompanha e a cabeça volta a alinhar com
    // ele (é o que se vê: ela vira a cara, depois o corpo inteiro).
    const rumoJogador = angleTo(sheep.x, sheep.z, correndo.pos.x, correndo.pos.z);
    assert.ok(Math.abs(wrapAngle(sheep.heading - rumoJogador)) < 0.2, 'o corpo acabou encarando o jogador');
    assert.ok(Math.abs(sheep.lookYaw) < Math.abs(pico), 'e a cabeça voltou a alinhar com o corpo');

    // Passado o susto, cabeça e corpo voltam ao repouso.
    clock.t += SHEEP_ALERT_TIME + 1;
    const longe = idlePlayer({ x: sheep.x + 25, z: sheep.z + 25 });
    for (let i = 0; i < 30; i++) { clock.t += 0.05; system.update(0.05, longe, true, { day: 1 }); }
    assert.ok(Math.abs(sheep.lookYaw) < 0.02, 'a cabeça volta a olhar para a frente');
    assert.ok(sheep.lookAmount < 0.02, 'e o susto saiu de cena');
});

test('wrapAngle, angleTo e turnTowardAngle fazem a conta do rumo', () => {
    assert.ok(Math.abs(Math.abs(wrapAngle(Math.PI * 3)) - Math.PI) < 1e-9, '3π cai na emenda');
    assert.ok(Math.abs(Math.abs(wrapAngle(-Math.PI * 3)) - Math.PI) < 1e-9, 'e -3π também');
    assert.ok(Math.abs(wrapAngle(0.3) - 0.3) < 1e-12, 'ângulo pequeno passa igual');
    assert.ok(Math.abs(wrapAngle(-0.3) + 0.3) < 1e-12);

    assert.ok(Math.abs(angleTo(0, 0, 0, 1)) < 1e-12, 'para +z é 0');
    assert.ok(Math.abs(angleTo(0, 0, 1, 0) - Math.PI / 2) < 1e-12, 'para +x é π/2');

    // Gira na direção certa, pelo passo permitido, atravessando a emenda.
    const quase = turnTowardAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.05);
    assert.ok(quase > Math.PI - 0.06 || quase < -Math.PI + 0.06, `atravessou a emenda (${quase})`);
    assert.ok(Math.abs(wrapAngle(turnTowardAngle(0, 0.01, 1))) < 0.02, 'chega no alvo sem passar');
});

test('o contágio dá um passo só: quem sente a vizinha não passa adiante', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const bicho = (id, x, attention) => ({
        id, herd: 1, x, z: 0, attention,
        alertUntil: 0, alertAt: 0, grazeT: 0, alertFrom: null,
    });
    const susto = bicho(1, 0, 0);      // viu o jogador
    const vizinha = bicho(2, 5, 0);    // sente a vizinha (dentro do raio do susto)
    const longe = bicho(3, 10.5, 0);   // só alcançaria se o contágio passasse adiante
    system.entities.push(susto, vizinha, longe);

    system.alert(susto, 10, { x: 0, z: 3 });

    assert.equal(susto.alertAt, 10, 'quem viu reage na hora');
    assert.ok(vizinha.alertAt > 10, 'a vizinha reage, mas depois');
    assert.ok(vizinha.alertAt - 10 >= SHEEP_NOTICE_DELAY_MIN * 0 - 1 + 0.18 - 1e-9,
        'com o atraso do contágio');
    assert.ok(vizinha.alertAt - 10 <= 0.45 + 1e-9, 'sem demorar demais');
    assert.equal(longe.alertAt, 0, 'e o susto não sai em cadeia pelo bando');
});

test('no modelo, o pescoço estica no pasto e encolhe em pé', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    // Jogador longe: ninguém assusta, ela pode pastar à vontade.
    const longe = idlePlayer({ x: 400, z: 400 });
    const sheep = spawnOne(system, clock, longe);
    assert.ok(sheep.neck, 'a ovelha tem a peça do pescoço');

    const comprimento = () => sheep.neck.scale.y;
    const topo = () => sheep.neck.position.y + Math.cos(sheep.neck.rotation.x) * comprimento() / 2;

    // Em pé: o pescoço é um toco escondido na lã.
    sheep.grazeT = null;
    system.update(0.001, longe, true, { day: 1 });
    const emPe = comprimento();
    assert.ok(emPe < 0.15, `em pé é curto (${emPe})`);

    // Pastando no ponto mais fundo: estica até a cabeça, sem vão.
    sheep.grazeFor = 4;
    sheep.grazeT = 2;                 // meio do pasto: focinho no chão
    system.update(0.001, longe, true, { day: 1 });
    const pastando = comprimento();
    assert.ok(pastando > emPe * 3, `pastando estica (${pastando} vs ${emPe})`);
    assert.ok(Math.abs(topo() - (sheep.head.position.y + SHEEP_NECK_HEAD_Y)) < 0.02,
        'e a ponta de cima continua na cabeça');

    // Com a cabeça no chão, o pescoço vai junto: o vão é zero.
    const vao = Math.hypot(
        sheep.neck.position.y + Math.cos(sheep.neck.rotation.x) * comprimento() / 2
            - (sheep.head.position.y + SHEEP_NECK_HEAD_Y),
        sheep.neck.position.z + Math.sin(sheep.neck.rotation.x) * comprimento() / 2
            - (sheep.head.position.z + SHEEP_NECK_HEAD_Z),
    );
    assert.ok(vao < 0.02, `sem vão entre pescoço e cabeça (${vao})`);
});

test('levantar a cabeça do pasto é animação, não pulo', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const longe = idlePlayer({ x: 400, z: 400 });
    const sheep = spawnOne(system, clock, longe);

    sheep.grazeFor = 4;
    sheep.grazeT = 2;                 // meio do pasto: focinho no chão
    system.update(0.001, longe, true, { day: 1 });
    const noChao = sheep.head.position.y;

    system.alert(sheep, clock.t, { x: sheep.x, z: sheep.z + 1 }, { delay: 0 });
    clock.t += 0.05;
    system.update(0.05, longe, true, { day: 1 });
    const meio = sheep.head.position.y;
    const repouso = SHEEP_NECK_Y;

    assert.ok(sheep.lookAmount > 0 && sheep.lookAmount < 1, `o susto entra aos poucos (${sheep.lookAmount})`);
    assert.ok(meio > noChao + 0.01, 'a cabeça já subiu um pouco');
    assert.ok(meio < repouso - 0.01, 'mas ainda não deu o pulo até em cima');
});

test('o pescoço é grosso e assenta numa gola de lã no ombro', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 400, z: 400 }));

    const pescoco = sheep.group.children.find(child => child.name === 'neck');
    // Grosso: quase a largura do crânio (0,36) — antes eram 0,2 e, esticado,
    // virava um cano fino saindo da lã.
    assert.ok(pescoco.scale.x >= 0.3, `largo o bastante (${pescoco.scale.x})`);
    assert.ok(pescoco.scale.z >= 0.3, `e fundo o bastante (${pescoco.scale.z})`);
    assert.equal(pescoco.scale.x, SHEEP_NECK_WIDTH);
    assert.equal(pescoco.scale.z, SHEEP_NECK_DEPTH);

    // Ainda cabe embaixo da cabeça: mais estreito que o crânio.
    const cranio = sheep.head.children.find(child => child.name === 'skull');
    assert.ok(pescoco.scale.x < cranio.scale.x, 'mais estreito que o crânio');
    assert.ok(pescoco.scale.z < cranio.scale.z, 'e mais raso que o crânio');

    // A gola: três peças em volta do ombro, mais largas que o pescoço.
    const gola = sheep.group.children.filter(child => child.name === 'ruff');
    assert.equal(gola.length, SHEEP_RUFF_PARTS.length, 'a gola é feita de peças');
    assert.ok(gola.length >= 3, 'três peças dão volume ao peito');
    const principal = gola[0];
    assert.ok(principal.scale.x > pescoco.scale.x, 'a gola é mais larga que o pescoço');
    assert.ok(Math.abs(principal.position.y - SHEEP_NECK_ANCHOR_Y) < 0.1, 'sentada no ombro');
    assert.ok(Math.abs(principal.position.z - SHEEP_NECK_ANCHOR_Z) < 0.1, 'e na frente dele');

    // É da mesma lã do corpo: a ovelha continua uma peça só de cor.
    const corpo = sheep.group.children.find(child => child.name === 'body');
    for (const pedaco of gola) {
        assert.equal(pedaco.material.color.getHex(), corpo.material.color.getHex());
        assert.equal(pedaco.material, pescoco.material, 'a gola é da mesma lã do pescoço');
    }
});

test('em pé o pescoço some na gola; pastando ele sai por baixo dela', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const longe = idlePlayer({ x: 400, z: 400 });
    const sheep = spawnOne(system, clock, longe);

    const pescoco = sheep.group.children.find(child => child.name === 'neck');
    const gola = sheep.group.children.filter(child => child.name === 'ruff');
    const baseDaGola = Math.min(...gola.map(pedaco => pedaco.position.y - pedaco.scale.y / 2));
    const topoDoPescoco = () => pescoco.position.y
        + Math.cos(pescoco.rotation.x) * pescoco.scale.y / 2;

    sheep.grazeT = null;
    system.update(0.001, longe, true, { day: 1 });
    assert.ok(topoDoPescoco() > baseDaGola, 'em pé, o pescoço não aparece abaixo da gola');

    sheep.grazeFor = 4;
    sheep.grazeT = 2;
    system.update(0.001, longe, true, { day: 1 });
    assert.ok(topoDoPescoco() < baseDaGola - 0.1,
        `pastando, ele sai por baixo da gola (${topoDoPescoco()} vs ${baseDaGola})`);
    // E continua ligado na cabeça, com a gola parada no ombro.
    assert.ok(Math.abs(topoDoPescoco() - (sheep.head.position.y + SHEEP_NECK_HEAD_Y)) < 0.02);
    assert.ok(Math.abs(gola[0].position.y - SHEEP_RUFF_PARTS[0].y) < 1e-12, 'a gola não segue a cabeça');
});

test('o passo vira o corpo aos poucos e nunca anda de lado', () => {
    // Alvo nas costas: em um quadro ela gira no máximo `turnRate * dt` e, como
    // está muito fora do rumo, **não anda** — gira parada.
    const deCostas = walkStep(0, 0, -1, SHEEP_WANDER_SPEED, 0.05);
    assert.ok(Math.abs(wrapAngle(deCostas.heading)) <= SHEEP_TURN_RATE * 0.05 + 1e-9,
        `girou no máximo o passo do quadro (${deCostas.heading})`);
    assert.ok(Math.abs(Math.abs(wrapAngle(deCostas.heading)) - Math.PI) > 2.5, 'ainda longe de virar');
    assert.equal(deCostas.distance, 0, 'não anda de costas');
    assert.ok(deCostas.turning, 'e está girando');

    // Alvo pequeno de lado (dentro da zona morta): já anda, virando.
    const deLado = walkStep(0, Math.sin(SHEEP_TURN_DEADZONE * 0.5), Math.cos(SHEEP_TURN_DEADZONE * 0.5),
        SHEEP_WANDER_SPEED, 0.05);
    assert.ok(deLado.distance > 0, 'desvio pequeno não impede o passo');
    assert.ok(Math.abs(wrapAngle(deLado.heading)) > 1e-6, 'mas o corpo ainda está virando');

    // Alinhada: anda exatamente velocidade × tempo, e o rumo não muda.
    const reto = walkStep(0.4, Math.sin(0.4), Math.cos(0.4), 0.6, 0.1);
    assert.ok(Math.abs(reto.heading - 0.4) < 1e-12);
    assert.ok(Math.abs(reto.distance - 0.06) < 1e-12);
    assert.ok(!reto.turning);

    // Parada (velocidade 0): não anda, mas continua virando para o alvo.
    const parada = walkStep(0, 1, 0, 0, 0.1);
    assert.equal(parada.distance, 0);
    assert.ok(parada.heading > 0, 'o rumo segue o alvo mesmo sem andar');
});

test('a velocidade entra e sai por rampa, sem pulo', () => {
    // Do zero: no primeiro quadro ela ainda está arrancando.
    const primeiro = approachSpeed(0, SHEEP_WANDER_SPEED, 0.05);
    assert.ok(primeiro > 0 && primeiro < SHEEP_WANDER_SPEED, `arranca devagar (${primeiro})`);
    assert.ok(Math.abs(primeiro - SHEEP_ACCEL * 0.05) < 1e-12, 'acelera a SHEEP_ACCEL');

    // Em meio segundo chega na velocidade de cruzeiro (e não passa dela).
    let v = 0;
    for (let i = 0; i < 20; i++) v = approachSpeed(v, SHEEP_WANDER_SPEED, 0.05);
    assert.ok(Math.abs(v - SHEEP_WANDER_SPEED) < 1e-12, `chega no cruzeiro (${v})`);
    assert.equal(approachSpeed(SHEEP_WANDER_SPEED, 0, 0.05), SHEEP_WANDER_SPEED - SHEEP_BRAKE * 0.05);

    // O freio é mais curto que o arranque: parar é mais rápido que sair.
    assert.ok(SHEEP_BRAKE > SHEEP_ACCEL);

    // Nunca negativo: velocidade negativa conta como parada.
    assert.equal(approachSpeed(0, 0, 1), 0);
    assert.equal(approachSpeed(-3, 1, 0.5), 1);
});

test('a passada anda pela distância, não pelo tempo', () => {
    const meiaVolta = strideAdvance(0, 1);
    assert.ok(Math.abs(meiaVolta - SHEEP_STRIDE_PER_BLOCK) < 1e-12);
    assert.ok(Math.abs(strideAdvance(0, 2) - 2 * SHEEP_STRIDE_PER_BLOCK) < 1e-12);
    assert.ok(Math.abs(strideAdvance(1.5, 0) - 1.5) < 1e-12, 'parada, a fase não anda');
    assert.ok(Math.abs(strideAdvance(0, -1)) < 1e-12, 'distância negativa não volta a fase');
});

test('andando, o corpo não vira num quadro só', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const longe = idlePlayer({ x: 400, z: 400 });
    const sheep = spawnOne(system, clock, longe);

    // Alvo atrás dela: o rumo tem de chegar aos poucos.
    sheep.heading = 0;
    sheep.speed = 0;
    sheep.targetX = sheep.x;
    sheep.targetZ = sheep.z - 5;
    sheep.turnAt = clock.t + 100;

    clock.t += 0.05;
    system.update(0.05, longe, true, { day: 1 });
    const depoisDeUmQuadro = Math.abs(wrapAngle(sheep.heading));
    assert.ok(depoisDeUmQuadro <= SHEEP_TURN_RATE * 0.05 + 1e-6,
        `virou no máximo o passo do quadro (${depoisDeUmQuadro} rad)`);
    assert.ok(depoisDeUmQuadro < Math.PI / 2, 'nada de 180° num quadro');

    // Um segundo e meio depois ela terminou de virar e já anda para lá.
    const antesZ = sheep.z;
    for (let i = 0; i < 30; i++) { clock.t += 0.05; system.update(0.05, longe, true, { day: 1 }); }
    assert.ok(Math.abs(wrapAngle(sheep.heading - Math.PI)) < 0.25, `acabou encarando o alvo (${sheep.heading})`);
    assert.ok(sheep.z < antesZ - 0.05, `e andou para trás dela (${antesZ - sheep.z})`);
});

test('correndo, a perna acompanha o chão: a fase casa com a distância', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const longe = idlePlayer({ x: 400, z: 400 });
    const sheep = spawnOne(system, clock, longe);

    // Susto de golpe: ela corre para longe de quem bateu.
    sheep.heading = 0;
    sheep.turnAt = clock.t + 100;
    sheep.alertUntil = 0;
    sheep.alertAt = 0;
    sheep.fleeFrom = { x: sheep.x, z: sheep.z + 2 };
    sheep.fleeUntil = clock.t + 5;

    const faseInicial = sheep.stride;
    let andado = 0;
    let x = sheep.x, z = sheep.z;
    for (let i = 0; i < 60; i++) {
        clock.t += 0.05;
        system.update(0.05, longe, true, { day: 1 });
        andado += Math.hypot(sheep.x - x, sheep.z - z);
        x = sheep.x; z = sheep.z;
    }
    const totalFase = sheep.stride - faseInicial;

    assert.ok(andado > 3, `ela correu (${andado} blocos)`);
    // A fase é a distância vezes a cadência — em qualquer velocidade.
    assert.ok(Math.abs(totalFase - andado * SHEEP_STRIDE_PER_BLOCK) < 1e-6,
        `fase ${totalFase} para ${andado} blocos`);
    // E o ritmo na fuga é bem maior do que no passo: os pés não escorregam.
    assert.ok(SHEEP_STRIDE_PER_BLOCK * SHEEP_FLEE_SPEED > SHEEP_STRIDE_PER_BLOCK * SHEEP_WANDER_SPEED * 2);
});

test('saindo do pasto, ela arranca devagar em vez de sair a toda', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const longe = idlePlayer({ x: 400, z: 400 });
    const sheep = spawnOne(system, clock, longe);

    // Parada, com um alvo à frente — e sem pastar no meio do caminho.
    sheep.grazeT = null;
    sheep.grazeAt = clock.t + 100;
    sheep.speed = 0;
    sheep.heading = 0;
    sheep.targetX = sheep.x;
    sheep.targetZ = sheep.z + 4;
    sheep.turnAt = clock.t + 100;

    const x0 = sheep.x, z0 = sheep.z;
    clock.t += 0.05;
    system.update(0.05, longe, true, { day: 1 });

    assert.ok(sheep.speed > 0, 'já está andando');
    assert.ok(sheep.speed < sheep.walkSpeed,
        `mas ainda arrancando (${sheep.speed} < ${sheep.walkSpeed})`);
    const andou = Math.hypot(sheep.x - x0, sheep.z - z0);
    assert.ok(andou < sheep.walkSpeed * 0.05, `e o passo é curto (${andou})`);

    // Meio segundo depois: velocidade de cruzeiro **dela**.
    for (let i = 0; i < 10; i++) { clock.t += 0.05; system.update(0.05, longe, true, { day: 1 }); }
    assert.ok(Math.abs(sheep.speed - sheep.walkSpeed) < 1e-9, `chegou no cruzeiro (${sheep.speed})`);
});

test('a vida parada: respira, balança a cauda, treme a orelha e espia', () => {
    // Respiração: dentro da faixa e mudando com o tempo.
    const um = idlePoseFor(0, 3);
    const outro = idlePoseFor(1.2, 3);
    assert.ok(Math.abs(um.breath) <= SHEEP_BREATH_LIFT + 1e-12);
    assert.ok(Math.abs(um.breath - outro.breath) > 0.001, 'a respiração muda com o tempo');
    // Cada ovelha respira na sua fase: o bando não é um coral.
    assert.ok(Math.abs(idlePoseFor(0.7, 3).breath - idlePoseFor(0.7, 4).breath) > 1e-6,
        'cada ovelha tem a sua fase');

    // Cauda: vai e vem, dentro da amplitude.
    let caudaMin = Infinity, caudaMax = -Infinity;
    for (let t = 0; t < 4; t += 0.02) {
        const v = idlePoseFor(t, 5).tail;
        caudaMin = Math.min(caudaMin, v);
        caudaMax = Math.max(caudaMax, v);
    }
    assert.ok(caudaMax > 0.05 && caudaMin < -0.05, `a cauda vai e volta (${caudaMin} a ${caudaMax})`);
    assert.ok(caudaMax <= SHEEP_TAIL_SWAY + 1e-12 && caudaMin >= -SHEEP_TAIL_SWAY - 1e-12);

    // Orelha: quieta na maior parte do tempo, mas treme em janelas curtas.
    let quieta = 0, tremendo = 0;
    const lados = new Set();
    for (let t = 0; t < 14; t += 0.02) {
        const v = idlePoseFor(t, 9);
        if (v.ear > 0.01) { tremendo++; lados.add(v.earSide); } else quieta++;
    }
    assert.ok(quieta > tremendo * 8, `a orelha fica quieta quase sempre (${quieta} × ${tremendo})`);
    assert.ok(tremendo > 0, 'mas treme de vez em quando');

    // Espiar: cabeça reta na maior parte do tempo, virando de vez em quando.
    let reta = 0, virada = 0;
    for (let t = 0; t < 14; t += 0.05) {
        const v = idlePoseFor(t, 9);
        if (Math.abs(v.look) > 0.05) virada++; else reta++;
    }
    assert.ok(reta > virada, `a cabeça fica reta a maior parte do tempo (${reta} × ${virada})`);
    assert.ok(virada > 0, 'mas espia');
    assert.ok(Math.abs(idlePoseFor(0, 9).look) <= SHEEP_IDLE_LOOK + 1e-12);

    // Focinho na grama: nada de espiar com a cabeça lá embaixo.
    for (let t = 0; t < 14; t += 0.3) {
        assert.ok(Math.abs(idlePoseFor(t, 9, { pasto: 1 }).look) < 1e-12);
    }
});

test('parada, ela respira e mexe a cauda sem tirar as patas do chão', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const longe = idlePlayer({ x: 400, z: 400 });
    const sheep = spawnOne(system, clock, longe);

    // Parada: sem alvo, sem pasto.
    sheep.grazeT = null;
    sheep.grazeAt = clock.t + 100;
    sheep.speed = 0;
    sheep.targetX = sheep.x;
    sheep.targetZ = sheep.z;
    sheep.turnAt = clock.t + 100;

    let corpoMin = Infinity, corpoMax = -Infinity;
    let caudaMin = Infinity, caudaMax = -Infinity;
    let olharMin = Infinity, olharMax = -Infinity;
    // Orelhas: guarda a pose de repouso para ver quem sai dela.
    const repousoOrelhas = sheep.ears.map(orelha => orelha.userData.baseZ);
    let vezesComDuas = 0;
    let vezesComAlguma = 0;
    const patas = sheep.legs.map(leg => leg.rotation.x);
    const posY = sheep.legs.map(leg => leg.position.y);
    const x0 = sheep.x, z0 = sheep.z;

    for (let i = 0; i < 120; i++) {
        clock.t += 0.05;
        system.update(0.05, longe, true, { day: 1 });
        corpoMin = Math.min(corpoMin, sheep.body.position.y);
        corpoMax = Math.max(corpoMax, sheep.body.position.y);
        caudaMin = Math.min(caudaMin, sheep.tail.rotation.y);
        caudaMax = Math.max(caudaMax, sheep.tail.rotation.y);
        olharMin = Math.min(olharMin, sheep.head.rotation.y);
        olharMax = Math.max(olharMax, sheep.head.rotation.y);
        const mexidas = sheep.ears.filter((orelha, i) => Math.abs(orelha.rotation.z - repousoOrelhas[i]) > 1e-6);
        if (mexidas.length > 1) vezesComDuas++;
        if (mexidas.length === 1) vezesComAlguma++;
    }

    assert.ok(corpoMax - corpoMin > 0.01, `a lã sobe e desce (${corpoMax - corpoMin})`);
    assert.ok(corpoMax - corpoMin <= SHEEP_BREATH_LIFT * 2 + 1e-9, 'sem inflar demais');
    assert.ok(caudaMax - caudaMin > 0.05, 'a cauda balança');

    // As patas ficam exatamente onde estavam: respiração não é flutuação.
    sheep.legs.forEach((leg, i) => {
        assert.equal(leg.rotation.x, patas[i], 'pata parada');
        assert.equal(leg.position.y, posY[i], 'e plantada no chão');
    });
    assert.ok(Math.abs(sheep.x - x0) < 1e-9 && Math.abs(sheep.z - z0) < 1e-9, 'ela não anda parada');

    // Orelha: treme uma de cada vez, nunca as duas juntas.
    assert.equal(vezesComDuas, 0, 'as duas orelhas nunca tremem juntas');
    assert.ok(vezesComAlguma > 0, 'mas alguma treme em 6 s');

    // Em 6 s ela espia para os lados em algum momento (a cabeça sai do zero).
    assert.ok(olharMax - olharMin > 0.05 || Math.abs(olharMax) + Math.abs(olharMin) > 0.05,
        `e espia em volta (${olharMin} a ${olharMax})`);
});

test('cada ovelha anda no seu ritmo, dentro de ±12% do passo do pasto', () => {
    const velocidades = [];
    for (let id = 1; id <= 40; id++) velocidades.push(walkSpeedFor(id));
    for (const velocidade of velocidades) {
        assert.ok(velocidade >= SHEEP_WANDER_SPEED * (1 - SHEEP_PACE_SPREAD) - 1e-12,
            `não anda rápido demais (${velocidade})`);
        assert.ok(velocidade <= SHEEP_WANDER_SPEED * (1 + SHEEP_PACE_SPREAD) + 1e-12,
            `nem devagar demais (${velocidade})`);
    }
    // Cada id cai num ritmo diferente — é o que tira o bando do pelotão.
    assert.equal(new Set(velocidades.map(v => v.toFixed(6))).size, velocidades.length);
    assert.ok(Math.max(...velocidades) - Math.min(...velocidades) > 0.08, 'a diferença dá para ver');
    assert.ok(Math.abs(walkSpeedFor(7, { spread: 0 }) - SHEEP_WANDER_SPEED) < 1e-12,
        'sem espalhamento, é o passo do pasto');
    assert.equal(walkSpeedFor(7, { base: 0 }), 0);
});

test('cada seguidora tem o seu lugar em volta da líder', () => {
    const lugares = [1, 2, 3, 4, 5].map(id => herdSlotFor(id));
    for (const lugar of lugares) {
        assert.ok(lugar.radius >= SHEEP_SLOT_MIN - 1e-12 && lugar.radius <= SHEEP_SLOT_MAX + 1e-12,
            `o raio fica entre ${SHEEP_SLOT_MIN} e ${SHEEP_SLOT_MAX} (${lugar.radius})`);
        assert.ok(lugar.angle >= 0 && lugar.angle <= Math.PI * 2 + 1e-12);
    }
    assert.equal(new Set(lugares.map(l => l.angle.toFixed(4))).size, lugares.length,
        'cada uma num ângulo diferente');

    // O ponto do lugar fica exatamente o raio dela longe da líder.
    const ponto = herdSlotSpot(10, -4, 3);
    const distancia = Math.hypot(ponto.x - 10, ponto.z + 4);
    assert.ok(Math.abs(distancia - herdSlotFor(3).radius) < 1e-12);
});

test('o bando não anda em pelotão nem vira um monte atrás da líder', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const longe = idlePlayer({ x: 400, z: 400 });
    const ovelhas = spawnOne(system, clock, longe) && system.entities;
    const bando = ovelhas.filter(sheep => sheep.herd === ovelhas[0].herd);
    const lider = bando.find(sheep => sheep.leader) ?? bando[0];
    const seguidoras = bando.filter(sheep => sheep !== lider);

    // Cada uma no seu ritmo, já no nascimento.
    const ritmos = new Set(bando.map(sheep => sheep.walkSpeed.toFixed(6)));
    assert.equal(ritmos.size, bando.length, 'todas com velocidades diferentes');
    for (const sheep of bando) {
        assert.ok(Math.abs(sheep.walkSpeed - SHEEP_WANDER_SPEED) <= SHEEP_WANDER_SPEED * SHEEP_PACE_SPREAD + 1e-12);
    }

    // A líder "andou" para longe: as seguidoras vão atrás, cada uma no seu lugar.
    const centro = seguidoras[0] ?? lider;
    lider.x = centro.x + SHEEP_FOLLOW_GAP + 1;
    lider.z = centro.z;
    lider.targetX = lider.x; lider.targetZ = lider.z;
    lider.turnAt = clock.t + 1000;
    lider.speed = 0;
    lider.grazeT = null;
    for (const sheep of seguidoras) sheep.turnAt = clock.t;

    for (let i = 0; i < 400; i++) {           // 20 s: tempo de caminhar até lá
        clock.t += 0.05;
        // Ninguém pasta nem troca de alvo sozinha: o teste mede o reencontro.
        lider.grazeT = null; lider.grazeAt = clock.t + 100;
        for (const sheep of seguidoras) { sheep.grazeT = null; sheep.grazeAt = clock.t + 100; }
        system.update(0.05, longe, true, { day: 1 });
    }

    for (const sheep of seguidoras) {
        const dalider = Math.hypot(sheep.x - lider.x, sheep.z - lider.z);
        assert.ok(dalider <= SHEEP_SLOT_MAX + 1, `chegou perto da líder (${dalider})`);
        assert.ok(dalider > 0.5, `sem subir no lombo dela (${dalider})`);
    }
    // E cada uma no seu canto: ninguém em cima de ninguém.
    for (let i = 0; i < seguidoras.length; i++) {
        for (let j = i + 1; j < seguidoras.length; j++) {
            const d = Math.hypot(seguidoras[i].x - seguidoras[j].x, seguidoras[i].z - seguidoras[j].z);
            assert.ok(d > 0.6, `seguidoras ${i} e ${j} longe uma da outra (${d})`);
        }
    }
});

test('na fuga cada uma mantém o seu ritmo', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const longe = idlePlayer({ x: 400, z: 400 });
    const ovelhas = spawnOne(system, clock, longe) && system.entities;
    const bando = ovelhas.filter(sheep => sheep.herd === ovelhas[0].herd).slice(0, 2);
    if (bando.length < 2) return;

    for (const sheep of bando) {
        sheep.x = 0; sheep.z = (sheep.id % 2) * 3;   // lado a lado, sem se atrapalhar
        sheep.heading = 0;                            // já olhando para +z
        sheep.grazeT = null;
        sheep.grazeAt = clock.t + 1000;
        sheep.fleeFrom = { x: 0, z: sheep.z - 2 };
        sheep.fleeUntil = clock.t + 100;
    }

    // Jogador por perto (senão elas saem de cena por distância) e parado.
    const perto = idlePlayer({ x: 0, z: -12 });
    for (let i = 0; i < 60; i++) { clock.t += 0.05; system.update(0.05, perto, true, { day: 1 }); }

    const esperado = bando.map(sheep => SHEEP_FLEE_SPEED * (sheep.walkSpeed / SHEEP_WANDER_SPEED));
    for (let i = 0; i < bando.length; i++) {
        assert.ok(Math.abs(bando[i].speed - esperado[i]) < 1e-6,
            `a fuga dela é ${esperado[i]}, e a velocidade é ${bando[i].speed}`);
    }
    assert.ok(Math.abs(bando[0].speed - bando[1].speed) > 1e-9, 'e não correm no mesmo ritmo');
});
