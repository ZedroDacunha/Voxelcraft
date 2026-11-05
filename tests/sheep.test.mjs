import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../vendor/three/three.module.js';
import { BLOCKS, ID } from '../world-catalog.js';
import {
    SHEEP_COATS,
    SHEEP_DAY_THRESHOLD,
    SHEEP_DESPAWN_DISTANCE,
    SHEEP_LEG_SWING,
    SHEEP_LIMIT,
    SHEEP_MIN_GAP,
    SHEEP_ROAM_MAX,
    SHEEP_ROAM_MIN,
    SHEEP_SPAWN_MAX_DISTANCE,
    SHEEP_SPAWN_MIN_DISTANCE,
    SHEEP_TURN_MAX,
    SHEEP_TURN_MIN,
    SHEEP_WANDER_SPEED,
    coatFor,
    createSheepSystemClass,
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
    return {
        seed: 4242,
        scene: new THREE.Scene(),
        getChunk: () => ({}),
        generator: { heightAt: (x, z) => heightAt(x, z) },
        getBlock: (x, y, z) => {
            const gx = Math.floor(x), gz = Math.floor(z);
            const ground = heightAt(gx, gz);
            if (y === ground) return groundType(gx, gz);
            return 0;
        },
    };
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

function spawnOne(system, clock, player) {
    for (let i = 0; i < 200 && system.entities.length === 0; i++) {
        clock.t += 5;
        system.update(0.016, player, true, { day: 1 });
    }
    assert.equal(system.entities.length, 1, 'a ovelha deveria ter nascido');
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

test('nasce de dia, no capim, entre 16 e 30 blocos e no máximo quatro por vez', () => {
    const clock = { t: 0 };
    const world = makeWorld();
    const system = makeSystem(world, clock);
    const player = idlePlayer({ x: 0, z: 0 });
    const ovelhas = spawnSome(system, clock, player);

    // Quatro, escrito à mão: um pasto cheio de ovelha vira zoológico.
    assert.equal(ovelhas.length, 4, 'enche o pasto até o limite de quatro');
    assert.equal(SHEEP_LIMIT, 4, 'o limite é quatro');

    for (const sheep of ovelhas) {
        const distance = Math.hypot(sheep.x - player.pos.x, sheep.z - player.pos.z);
        assert.ok(distance >= 15 && distance <= 31, `nasceu a ${distance} blocos`);
        assert.equal(sheep.y, GROUND + 1, '(de pé em cima do bloco de grama)');
        assert.ok(SHEEP_COATS.some(coat => coat.key === sheep.coat), 'nasceu com uma das três cores');
    }

    // Não nascem coladas umas nas outras.
    for (let i = 0; i < ovelhas.length; i++) {
        for (let j = i + 1; j < ovelhas.length; j++) {
            const gap = Math.hypot(ovelhas[i].x - ovelhas[j].x, ovelhas[i].z - ovelhas[j].z);
            assert.ok(gap >= 5, `duas ovelhas a ${gap} blocos uma da outra (nascem espalhadas)`);
        }
    }

    // O limite vale mesmo com o tempo passando.
    for (let i = 0; i < 200; i++) { clock.t += 10; system.update(0.016, player, true, { day: 1 }); }
    assert.equal(system.entities.length, 4, 'continua em quatro');
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

test('duas ovelhas não nascem no mesmo canto do pasto', () => {
    // Pasto pequeno: só um quadrado de 4×4 blocos é grama. Com o afastamento
    // mínimo entre ovelhas, só cabe uma ali — o resto do mundo é pedra.
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

    assert.equal(system.entities.length, 1, 'o pasto de 4×4 não comporta um rebanho');
    const [sheep] = system.entities;
    assert.ok(noPasto(Math.floor(sheep.x), Math.floor(sheep.z)), 'a que nasceu ficou na grama');
    assert.ok(SHEEP_MIN_GAP > 4, 'o afastamento é maior que o próprio canto de pasto');
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

test('ela é mansa: o jogador correndo e colado nela não a espanta', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));

    sheep.turnAt = clock.t + 100;
    sheep.targetX = sheep.x + 1.5;
    sheep.targetZ = sheep.z;
    const alvoX = sheep.targetX, alvoZ = sheep.targetZ;

    // Jogador correndo em cima dela: no Mofim isso bastaria para o susto.
    const correndo = { pos: { x: sheep.x + 0.4, z: sheep.z }, vel: { x: 6, z: 0 }, crouching: false };
    for (let i = 0; i < 40; i++) { clock.t += 0.05; system.update(0.05, correndo, true, { day: 1 }); }

    assert.equal(sheep.targetX, alvoX, 'o alvo continua o mesmo: ela não foge');
    assert.equal(sheep.targetZ, alvoZ);
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

test('o corpo é de caixas com cabeça, orelhas, quatro patas e rabo', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));

    const nomes = sheep.group.children.map(child => child.name);
    assert.equal(nomes.filter(nome => nome === 'leg').length, 4, 'quatro patas');
    assert.equal(nomes.filter(nome => nome === 'ear').length, 2, 'duas orelhas, uma de cada lado');
    assert.equal(nomes.filter(nome => nome === 'eye').length, 2, 'dois olhos');
    for (const parte of ['body', 'head', 'muzzle', 'tail']) {
        assert.ok(nomes.includes(parte), `falta a peça ${parte}`);
    }
});

test('a ovelha pisa no chão: o ponto mais baixo do corpo é o pé', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnOne(system, clock, idlePlayer({ x: 0, z: 0 }));

    let maisBaixo = Infinity;
    for (const child of sheep.group.children) {
        // Cada peça é uma caixa 1×1×1 com escala: o fundo é y - altura/2.
        const fundo = child.position.y - child.scale.y / 2;
        maisBaixo = Math.min(maisBaixo, fundo);
    }
    assert.ok(Math.abs(maisBaixo) < 1e-9, `o ponto mais baixo está em ${maisBaixo}, e devia estar em 0`);
    assert.ok(sheep.group.position.y >= GROUND, 'o grupo está na altura do chão');
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
