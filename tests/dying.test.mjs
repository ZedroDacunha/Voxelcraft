// A morte não é um sumiço de quadro: o corpo tomba, fica caído e só então sai
// do mundo (`dyingPoseFor`, `startDying`, `stepDying`).
//
// A conta da pose é pura (tempo → giro/escala) e mora na base comum aos dois
// bichos; o resto é o que os `update` fazem com ela. Aqui se testa as duas
// pontas: a curva e o corpo do Mofim e da ovelha caindo de verdade.

import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../vendor/three/three.module.js';
import { BLOCKS, ID } from '../world-catalog.js';
import {
    DYING_FADE,
    DYING_TIME,
    DYING_TIP,
    dyingPoseFor,
} from '../world-creature-base.js';
import {
    HIT_COOLDOWN,
    MOFIM_HEALTH,
    createCreatureSystemClass,
    creatureInReach,
} from '../world-creature.js';
import {
    SHEEP_BODY_OFFSET,
    SHEEP_HEALTH,
    SHEEP_HIT_COOLDOWN,
    createSheepSystemClass,
} from '../world-sheep.js';

const CHUNK_SIZE = 16;
const GROUND = 10;

// Mundo plano de grama com relógio controlado pelo teste.
function makeWorld() {
    return {
        seed: 4242,
        scene: new THREE.Scene(),
        getChunk: () => ({}),
        generator: { heightAt: () => GROUND },
        getBlock: (x, y) => (y === GROUND ? ID.GRASS : 0),
    };
}

const idlePlayer = (pos = { x: 0, z: 0 }) => ({ pos, vel: { x: 0, z: 0 }, crouching: false });

// ------------------------------------------------ a curva da queda (pura)

test('a queda começa em pé e termina tombada de lado', () => {
    const inicio = dyingPoseFor(0);
    assert.equal(inicio.roll, 0, 'em pé no instante do golpe');
    assert.equal(inicio.scale, 1, 'inteiro');
    assert.equal(inicio.progress, 0);
    assert.equal(inicio.done, false, 'ainda não pode sair do mundo');

    const fim = dyingPoseFor(DYING_TIME);
    assert.ok(Math.abs(fim.roll - Math.PI / 2) < 1e-9, 'deitado: giro de 90°');
    assert.ok(fim.scale <= 0.02 + 1e-9, 'e já encolheu até sumir');
    assert.equal(fim.progress, 1);
    assert.equal(fim.done, true, 'agora sim ele sai');
});

test('o corpo tomba rápido e assenta: o giro nunca volta atrás', () => {
    assert.ok(DYING_TIP > 0 && DYING_TIP < 1, 'a queda gasta só uma parte do tempo');
    let anterior = -1;
    for (let i = 0; i <= 40; i++) {
        const pose = dyingPoseFor((DYING_TIME * i) / 40);
        assert.ok(pose.roll >= anterior - 1e-9, `o giro não recua (t=${i}/40: ${pose.roll})`);
        assert.ok(pose.roll <= Math.PI / 2 + 1e-9, 'e não passa de 90°');
        anterior = pose.roll;
    }

    // Em `DYING_TIP` do tempo ele já está no chão — o resto é o corpo caído.
    const naMetade = dyingPoseFor(DYING_TIME * DYING_TIP);
    assert.ok(Math.abs(naMetade.roll - Math.PI / 2) < 1e-9, 'caiu dentro do tempo de tombar');
    assert.equal(naMetade.scale, 1, 'e ainda não encolheu');
    assert.equal(naMetade.done, false, 'ainda no chão, visível');

    // A curva é a da queda (acelera), não uma reta: no primeiro quarto do
    // tombo ele já virou mais da metade do caminho.
    const cedo = dyingPoseFor(DYING_TIME * DYING_TIP * 0.5);
    assert.ok(cedo.roll > Math.PI / 4, `tombou mais da metade no meio do tombo (${cedo.roll})`);
});

test('o encolhimento é só na cauda e nunca chega a zero', () => {
    // Antes da cauda o corpo fica inteiro: quem cai não derrete.
    const quaseFim = dyingPoseFor(DYING_TIME * (1 - DYING_FADE) - 1e-6);
    assert.equal(quaseFim.scale, 1, 'inteiro até começar a sumir');

    let anterior = Infinity;
    for (let i = 0; i <= 20; i++) {
        const t = DYING_TIME * (1 - DYING_FADE) + (DYING_TIME * DYING_FADE * i) / 20;
        const pose = dyingPoseFor(t);
        assert.ok(pose.scale <= anterior + 1e-9, 'só encolhe');
        assert.ok(pose.scale >= 0.02 - 1e-9, 'escala zero estoura a matriz do three');
        anterior = pose.scale;
    }
    assert.equal(dyingPoseFor(DYING_TIME * 5).scale, 0.02, 'no fim, o mínimo');
});

test('o lado da queda muda o sinal do giro', () => {
    const meio = DYING_TIME * DYING_TIP;
    const direita = dyingPoseFor(meio, { side: 1 });
    const esquerda = dyingPoseFor(meio, { side: -1 });
    assert.ok(direita.roll > 0, 'para um lado');
    assert.ok(esquerda.roll < 0, 'e para o outro');
    assert.ok(Math.abs(direita.roll + esquerda.roll) < 1e-9, 'o mesmo tombo espelhado');
});

test('o tempo da queda pode ser outro; `done` só no fim dele', () => {
    const curta = dyingPoseFor(0.4, { time: 0.4 });
    assert.equal(curta.done, true);
    assert.equal(dyingPoseFor(0.39, { time: 0.4 }).done, false);
    // Tempo negativo ou lixo não vira pose maluca.
    const zero = dyingPoseFor(-3, { time: 0.4 });
    assert.equal(zero.roll, 0);
    assert.equal(zero.scale, 1);
    assert.equal(dyingPoseFor(Number.NaN).done, false);
});

// ------------------------------------------------ o corpo caindo (mundo)

function makeSheepSystem(clock, options = {}) {
    const SheepSystem = createSheepSystemClass({
        THREE, ID, BLOCKS, CHUNK_SIZE, now: () => clock.t, ...options,
    });
    return new SheepSystem(makeWorld());
}

function spawnSheep(system, clock) {
    const player = idlePlayer();
    for (let i = 0; i < 200 && system.entities.length === 0; i++) {
        clock.t += 5;
        system.update(0.016, player, true, { day: 1 });
    }
    assert.ok(system.entities.length >= 1, 'a ovelha deveria ter nascido');
    return system.entities[0];
}

function baterNaOvelha(system, clock, sheep, options = {}) {
    const origem = { x: sheep.x - 1, y: sheep.y + SHEEP_BODY_OFFSET, z: sheep.z };
    clock.t += SHEEP_HIT_COOLDOWN + 0.01;
    return system.hitAt(origem, { x: 1, y: 0, z: 0 }, { maxDistance: 5, ...options });
}

// Mata a ovelha a golpes e devolve o resultado do último.
function matarOvelha(system, clock, sheep) {
    for (let golpe = 1; golpe < SHEEP_HEALTH; golpe++) baterNaOvelha(system, clock, sheep);
    return baterNaOvelha(system, clock, sheep);
}

// Anda o mundo (e a queda) por `frames` quadros de `dt`.
function correr(system, clock, frames, dt = 0.05, day = 1) {
    for (let i = 0; i < frames; i++) {
        clock.t += dt;
        system.update(dt, idlePlayer(), true, { day });
    }
}

test('a ovelha abatida tomba no lugar e só sai do mundo no fim da queda', () => {
    const clock = { t: 0 };
    const system = makeSheepSystem(clock);
    const sheep = spawnSheep(system, clock);
    const cena = system.world.scene.children.length;
    const ondeEstava = { x: sheep.x, z: sheep.z };

    const morte = matarOvelha(system, clock, sheep);
    assert.equal(morte.killed, true, 'o quarto golpe derruba');
    assert.ok(morte.drops, 'e os itens saem **agora**, com o corpo ainda no chão');

    // Nada de sumir no quadro do golpe.
    assert.ok(system.entities.includes(sheep), 'continua no mundo');
    assert.equal(sheep.dying, true, 'marcada como caída');
    assert.equal(system.world.scene.children.length, cena, 'e ainda na cena');
    assert.equal(sheep.group.rotation.z, 0, 'de pé no instante do golpe');

    // O primeiro quadro já começa a tombar, e o corpo fica onde caiu.
    correr(system, clock, 1);
    const depois1 = sheep.group.rotation.z;
    assert.ok(Math.abs(depois1) > 0, 'começou a tombar');
    assert.ok(Math.abs(depois1) < Math.PI / 2, 'mas ainda não está no chão');
    assert.ok(Math.abs(sheep.x - ondeEstava.x) < 1e-9, 'não anda caindo');
    assert.ok(Math.abs(sheep.z - ondeEstava.z) < 1e-9);

    // No meio da queda: caída de lado, inteira, ainda visível.
    correr(system, clock, Math.round(DYING_TIME * DYING_TIP / 0.05) + 2);
    assert.ok(system.entities.includes(sheep), 'ainda no mundo no meio da queda');
    assert.ok(Math.abs(Math.abs(sheep.group.rotation.z) - Math.PI / 2) < 1e-6, 'deitada no chão');
    assert.equal(sheep.group.scale.x, 1, 'inteira: quem cai não derrete');

    // Antes do fim do tempo ela não sai (a queda tem começo, meio e fim).
    for (let i = 0; i < 40 && sheep.dieT < DYING_TIME - 0.05; i++) correr(system, clock, 1);
    assert.ok(system.entities.includes(sheep), 'e não some antes da hora');
    assert.ok(sheep.group.scale.x < 1, 'no fim já está encolhendo');

    correr(system, clock, 3);
    assert.ok(!system.entities.includes(sheep), 'no fim da queda sai da lista');
    assert.ok(!system.world.scene.children.includes(sheep.group), 'e da cena');
});

test('a queda da ovelha dura `DYING_TIME` de mundo, nem mais nem menos', () => {
    const clock = { t: 0 };
    const system = makeSheepSystem(clock);
    const sheep = spawnSheep(system, clock);
    const removidos = [];
    const original = system.removeEntity.bind(system);
    system.removeEntity = entity => { removidos.push(entity); original(entity); };

    matarOvelha(system, clock, sheep);
    // Meio segundo depois do golpe ela ainda está caindo.
    correr(system, clock, 10); // 10 × 0,05 = 0,5 s
    assert.equal(removidos.includes(sheep), false, 'meio segundo não é o fim');
    assert.ok(Math.abs(sheep.dieT - 0.5) < 1e-9, 'o relógio da queda anda com o do mundo');

    // O quadro que passa do tempo tira — e tira uma vez só.
    correr(system, clock, 10);
    assert.equal(removidos.filter(entity => entity === sheep).length, 1, 'saiu uma vez');
    correr(system, clock, 5);
    assert.equal(removidos.filter(entity => entity === sheep).length, 1, 'e não volta a sair');
});

test('bater de novo num corpo caído não é golpe: a mira o ignora', () => {
    const clock = { t: 0 };
    const system = makeSheepSystem(clock);
    const sheep = spawnSheep(system, clock);

    matarOvelha(system, clock, sheep);
    const vida = sheep.health;

    // A mesma mira que acertava antes agora não acha ninguém.
    const origem = { x: sheep.x - 1, y: sheep.y + SHEEP_BODY_OFFSET, z: sheep.z };
    clock.t += 100;
    assert.equal(creatureInReach(system.entities, origem, { x: 1, y: 0, z: 0 }, { maxDistance: 5 }), null);
    assert.equal(system.hitAt(origem, { x: 1, y: 0, z: 0 }, { maxDistance: 5 }), null, 'sem golpe');
    assert.equal(sheep.health, vida, 'a vida não desce de zero');
    assert.equal(sheep.dieT, 0, 'e o relógio da queda não reinicia');
});

test('quem está caindo não lidera nem ocupa lugar no rebanho', () => {
    const clock = { t: 0 };
    const system = makeSheepSystem(clock);
    const sheep = spawnSheep(system, clock);
    const bando = system.entities.filter(outra => outra.herd === sheep.herd);
    assert.ok(bando.length >= 2, 'o mundo do teste nasce com um bando de verdade');

    assert.equal(system.herdLeaderOf(sheep), null, 'viva, ela lidera (ou é só uma)');
    const outras = bando.filter(outra => outra !== sheep);
    assert.ok(outras.length > 0);

    matarOvelha(system, clock, sheep);
    const nova = system.herdLeaderOf(sheep);
    assert.ok(nova, 'o bando arranja outra cabeça');
    assert.notEqual(nova, sheep, 'e não é o corpo caído');
    assert.equal(nova.dying, undefined, 'nem outra caída');

    // O corpo caído não barra o nascimento de mais ninguém no mesmo lugar.
    assert.equal(system.countNear(sheep.x, sheep.z, 0.5), 0, 'o chão está livre');
});

test('o Mofim também tomba antes de sumir', () => {
    const clock = { t: 0 };
    const mortes = [];
    const CreatureSystem = createCreatureSystemClass({
        THREE, ID, BLOCKS, CHUNK_SIZE, now: () => clock.t, onDeath: entity => mortes.push(entity),
    });
    const system = new CreatureSystem(makeWorld());
    const player = idlePlayer();
    for (let i = 0; i < 40 && system.entities.length === 0; i++) {
        clock.t += 5;
        system.update(0.016, player, true);
    }
    assert.equal(system.entities.length, 1, 'o Mofim deveria ter nascido');
    const mofim = system.entities[0];
    mofim.arriving = false;
    mofim.x = 2; mofim.z = 0; mofim.y = GROUND + 1;
    const cena = system.world.scene.children.length;
    const origem = { x: 0, y: GROUND + 1.45, z: 0 };
    const mira = { x: 1, y: 0, z: 0 };

    for (let golpe = 1; golpe < MOFIM_HEALTH; golpe++) {
        const hit = system.hitFrom(origem, mira);
        assert.equal(hit.killed, false, `o golpe ${golpe} ainda não derruba`);
        assert.equal(system.entities.length, 1, 'e ele continua no mundo');
        clock.t += HIT_COOLDOWN + 0.001;
    }

    const ultimo = system.hitFrom(origem, mira);
    assert.equal(ultimo.killed, true, 'o terceiro derruba');
    assert.equal(mortes.length, 1, 'avisou quem chamou');
    assert.ok(system.entities.includes(mofim), 'mas o corpo continua no mundo, caindo');
    assert.equal(mofim.dying, true);
    assert.equal(system.world.scene.children.length, cena, 'e na cena');

    // Caindo, ele não é alvo: o golpe seguinte passa reto (e não minera).
    clock.t += HIT_COOLDOWN + 0.001;
    assert.equal(creatureInReach(system.entities, origem, mira), null, 'fora da mira');
    assert.equal(system.hitFrom(origem, mira), null, 'sem golpe');
    assert.equal(mortes.length, 1, 'ninguém morre de novo');

    // E o corpo tomba: no meio da queda está deitado.
    for (let i = 0; i < 8; i++) {
        clock.t += 0.05;
        system.update(0.05, player, true);
    }
    assert.ok(Math.abs(mofim.group.rotation.z) > 0.3, `já tombou (${mofim.group.rotation.z})`);
    assert.ok(system.entities.includes(mofim), 'ainda no mundo');

    // No fim, sai — uma vez só.
    let saidas = 0;
    const original = system.removeEntity.bind(system);
    system.removeEntity = entity => { if (entity === mofim) saidas++; original(entity); };
    for (let i = 0; i < 20 && system.entities.includes(mofim); i++) {
        clock.t += 0.05;
        system.update(0.05, player, true);
    }
    assert.ok(!system.entities.includes(mofim), 'no fim da queda ele sai');
    assert.ok(!system.world.scene.children.includes(mofim.group), 'e sai da cena');
    assert.equal(saidas, 1, 'uma saída só');
    assert.equal(mortes.length, 1, 'e uma morte só');
});

test('o Mofim caído não anda, não foge e não grita', () => {
    const clock = { t: 0 };
    const CreatureSystem = createCreatureSystemClass({
        THREE, ID, BLOCKS, CHUNK_SIZE, now: () => clock.t,
    });
    const system = new CreatureSystem(makeWorld());
    const player = idlePlayer();
    for (let i = 0; i < 40 && system.entities.length === 0; i++) {
        clock.t += 5;
        system.update(0.016, player, true);
    }
    const mofim = system.entities[0];
    mofim.arriving = false;
    mofim.x = 2; mofim.z = 0; mofim.y = GROUND + 1;

    // Cai pelo caminho curto: o `startDying` direto, sem gastar três golpes.
    assert.equal(system.startDying(mofim, clock.t), true, 'começa a cair');
    assert.equal(system.startDying(mofim, clock.t), false, 'o segundo pedido não reinicia');

    const { x, z } = mofim;
    // Jogador colado e correndo: nem assim o corpo caído se levanta e foge.
    const perto = { pos: { x: mofim.x - 0.5, z: mofim.z }, vel: { x: 6, z: 0 }, crouching: false };
    for (let i = 0; i < 5; i++) {
        clock.t += 0.05;
        system.update(0.05, perto, true);
    }
    assert.ok(Math.abs(mofim.x - x) < 1e-9, 'o corpo não anda');
    assert.ok(Math.abs(mofim.z - z) < 1e-9);
    assert.equal(mofim.fleeUntil, 0, 'sem fuga armada');
});

test('o clarão do golpe apaga com o corpo caindo, não fica aceso', () => {
    // O clarão dura 0,22 s e a queda, 0,8 s: se o corpo caído parasse de ser
    // desenhado, o cadáver ficaria brilhando até sumir.
    const clock = { t: 0 };
    const system = makeSheepSystem(clock);
    const sheep = spawnSheep(system, clock);

    matarOvelha(system, clock, sheep);
    correr(system, clock, 1);
    const aceso = sheep.woolMaterial.emissive.r;
    assert.ok(aceso > 0.3, `acendeu no golpe (${aceso})`);

    correr(system, clock, 6); // ~0,35 s: o clarão já passou
    assert.ok(sheep.dying, 'ainda caindo');
    assert.equal(sheep.woolMaterial.emissive.r, 0, 'e apagada como deve');
});

test('a luzinha do Mofim apaga junto com o corpo', () => {
    const clock = { t: 0 };
    const CreatureSystem = createCreatureSystemClass({
        THREE, ID, BLOCKS, CHUNK_SIZE, now: () => clock.t,
    });
    const system = new CreatureSystem(makeWorld());
    const player = idlePlayer();
    for (let i = 0; i < 40 && system.entities.length === 0; i++) {
        clock.t += 5;
        system.update(0.016, player, true);
    }
    const mofim = system.entities[0];
    mofim.arriving = false;

    // Aceso como num golpe: o corpo apaga o clarão e a lanterna encolhe junto
    // com o corpo, em vez de ficarem acesas até ele sumir.
    mofim.hurtUntil = clock.t + 0.22;
    assert.equal(system.startDying(mofim, clock.t), true);
    const lanternaAntes = mofim.glowMesh.scale.x;

    clock.t += 0.05;
    system.update(0.05, player, true);
    assert.ok(mofim.bodyMaterial.emissive.r > 0.3, 'o clarão do golpe está aceso');
    assert.ok(mofim.glowMesh.scale.x < lanternaAntes, 'a lanterna encolhe com o corpo');

    for (let i = 0; i < 5; i++) { // + 0,25 s: o clarão acabou
        clock.t += 0.05;
        system.update(0.05, player, true);
    }
    assert.ok(mofim.dying, 'ainda caindo');
    assert.equal(mofim.bodyMaterial.emissive.r, 0, 'o corpo não fica aceso');
    assert.deepEqual([mofim.eyeMaterial.emissive.r, mofim.eyeMaterial.emissive.g], [0, 0], 'nem os olhos');
    assert.ok(mofim.glowMesh.scale.x < lanternaAntes, 'e a lanterna segue encolhendo');
});

test('o segundo golpe no mesmo quadro não derruba duas vezes', () => {
    // A morte acontece uma vez: quem já está caindo devolve `null` do golpe, e
    // o `onDeath` (que solta os itens) não repete.
    const clock = { t: 0 };
    const mortes = [];
    const system = makeSheepSystem(clock, { onDeath: morte => mortes.push(morte) });
    const sheep = spawnSheep(system, clock);

    matarOvelha(system, clock, sheep);
    assert.equal(mortes.length, 1, 'morreu uma vez');
    const itens = mortes[0].drops;
    assert.ok(itens.wool > 0 || itens.meat > 0, 'e soltou o que tinha');

    assert.equal(system.hitAt(
        { x: sheep.x - 1, y: sheep.y + SHEEP_BODY_OFFSET, z: sheep.z },
        { x: 1, y: 0, z: 0 },
        { maxDistance: 5 },
    ), null, 'o corpo caído não leva outro golpe');
    assert.equal(mortes.length, 1, 'e não solta item de novo');
});
