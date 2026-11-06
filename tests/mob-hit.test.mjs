// Golpe nos bichos: vida, clarão, empurrão, morte e o que a ovelha solta.
//
// O Mofim já tinha isso desde a primeira versão (`world-creature.js`); aqui o
// que se testa é o **lado da ovelha** e as peças que os dois passaram a
// compartilhar (altura do corpo na mira e o clarão do dano).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as THREE from '../vendor/three/three.module.js';
import { BLOCKS, ID, ITEMS } from '../world-catalog.js';
import {
    ATTACK_COOLDOWN, creatureInReach, hurtFlashFor, attackReady,
    HURT_EAR_FLAT, HURT_FLASH, HURT_HEAD_KICK, HURT_SPREAD, HURT_SQUASH, MOFIM_HEALTH,
} from '../world-creature.js';
import { KNOCK_TIME, knockSpeedFor } from '../world-creature-base.js';
import { createBreakParticleSystem } from '../world-break-particles.js';
import { resolveItem } from '../world-chat-commands.js';
import {
    SHEEP_BODY_OFFSET,
    SHEEP_HEALTH,
    SHEEP_HIT_COOLDOWN,
    SHEEP_HURT_FLASH,
    SHEEP_KNOCKBACK,
    SHEEP_MUTTON_MAX,
    SHEEP_MUTTON_MIN,
    SHEEP_WOOL_MAX,
    SHEEP_WOOL_MIN,
    SHEEP_WOOL_ITEMS,
    createSheepSystemClass,
    sheepDropsFor,
} from '../world-sheep.js';

const CHUNK_SIZE = 16;
const GROUND = 10;

function makeWorld({ heightAt = () => GROUND, groundType = () => ID.GRASS } = {}) {
    const overrides = new Map();
    const chave = (x, y, z) => `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    return {
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
        setBlock: (x, y, z, type) => { overrides.set(chave(x, y, z), type); return true; },
    };
}

function makeSystem(world, clock, options = {}) {
    const SheepSystem = createSheepSystemClass({
        THREE, ID, BLOCKS, CHUNK_SIZE, now: () => clock.t, ...options,
    });
    return new SheepSystem(world);
}

// Nasce um bando e devolve a primeira ovelha (a líder).
function spawnSheep(system, clock) {
    const player = { pos: { x: 0, z: 0 } };
    for (let i = 0; i < 200 && system.entities.length === 0; i++) {
        clock.t += 5;
        system.update(0.016, player, true, { day: 1 });
    }
    assert.ok(system.entities.length >= 1, 'a ovelha deveria ter nascido');
    return system.entities[0];
}

// Origem do golpe ao lado dela, na altura do lombo, mirando no corpo.
function golpeDeLado(sheep) {
    return {
        origem: { x: sheep.x - 1, y: sheep.y + SHEEP_BODY_OFFSET, z: sheep.z },
        direcao: { x: 1, y: 0, z: 0 },
    };
}

function bater(system, clock, sheep, options = {}) {
    const { origem, direcao } = golpeDeLado(sheep);
    clock.t += SHEEP_HIT_COOLDOWN + 0.01;
    return system.hitAt(origem, direcao, { maxDistance: 5, ...options });
}

// ------------------------------------------------ a vida da ovelha

test('a ovelha tem quatro golpes de vida; o Mofim, três', () => {
    // Escrito à mão: a ovelha é maior e mais resistente que o bicho voador.
    assert.equal(SHEEP_HEALTH, 4);
    assert.equal(MOFIM_HEALTH, 3);

    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnSheep(system, clock);
    assert.equal(sheep.health, SHEEP_HEALTH, 'nasce com a vida cheia');

    for (let golpe = 1; golpe < 4; golpe++) {
        const batida = bater(system, clock, sheep);
        assert.ok(batida, `o golpe ${golpe} pegou`);
        assert.equal(batida.killed, false, `o golpe ${golpe} ainda não derruba`);
        assert.equal(batida.drops, null, 'viva, não solta nada');
        assert.equal(sheep.health, SHEEP_HEALTH - golpe);
        assert.ok(system.entities.includes(sheep), 'e continua no mundo');
    }

    const ultimo = bater(system, clock, sheep);
    assert.ok(ultimo, 'o quarto golpe pega');
    assert.equal(ultimo.killed, true, 'o quarto derruba');
    assert.equal(sheep.health, 0);

    // O corpo tomba antes de sair do mundo.
    assert.ok(system.entities.includes(sheep), 'continua no mundo, caindo');
    assert.ok(sheep.dying, 'marcado como caído');
    for (let i = 0; i < 40 && system.entities.includes(sheep); i++) {
        clock.t += 0.05;
        system.update(0.05, { pos: { x: 0, z: 0 } }, true, { day: 1 });
    }
    assert.ok(!system.entities.includes(sheep), 'e só depois sai do mundo');
});

test('cada golpe acende o corpo por um instante e empurra ela para trás', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnSheep(system, clock);
    const player = { pos: { x: 0, z: 0 } };
    const antes = sheep.x;

    const batida = bater(system, clock, sheep);
    assert.ok(batida);
    assert.ok(sheep.hurtUntil > clock.t, 'o clarão está aceso');
    assert.ok(Math.abs(sheep.hurtUntil - (clock.t + SHEEP_HURT_FLASH)) < 1e-9, 'pelo tempo da constante');

    // O golpe não teleporta: o recuo é uma velocidade que freia por ~0,16 s.
    assert.ok(Math.abs(sheep.x - antes) < 1e-9, 'no quadro do golpe o corpo ainda está no lugar');

    // Um quadro depois: a lã dela brilha — e ela já começou a recuar.
    system.update(0.016, player, true, { day: 1 });
    assert.ok(sheep.woolMaterial.emissive.r > 0.3, `a lã acendeu (${sheep.woolMaterial.emissive.r})`);
    const recuo = sheep.x - antes;
    assert.ok(recuo > 0, `o corpo recuou na direção contrária ao golpe (${recuo})`);
    assert.ok(recuo < SHEEP_KNOCKBACK, `mas aos poucos, não de um pulo (${recuo})`);
    assert.ok(SHEEP_KNOCKBACK > 0.2 && SHEEP_KNOCKBACK < 1, 'empurrão curto: é um recuo, não um voo');

    // Passado o clarão, a lã volta ao normal.
    clock.t += SHEEP_HURT_FLASH + 0.01;
    system.update(0.016, player, true, { day: 1 });
    assert.equal(sheep.woolMaterial.emissive.r, 0, 'o clarão apagou');
});

test('o clarão é só dela: o resto do rebanho não pisca', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnSheep(system, clock);
    const outras = system.entities.filter(outra => outra !== sheep);
    if (!outras.length) return;

    // A lã dela é um **clone** da cor: se fosse o material compartilhado, o
    // clarão pintava o rebanho inteiro (e toda ovelha daquela cor no mundo).
    const compartilhada = system.coatMaterials.get(sheep.coat);
    assert.notEqual(sheep.woolMaterial, compartilhada, 'a lã é clone, não o material da cor');

    bater(system, clock, sheep);
    system.update(0.016, { pos: { x: 0, z: 0 } }, true, { day: 1 });

    assert.ok(sheep.woolMaterial.emissive.r > 0.3, 'a que levou o golpe pisca');
    assert.equal(compartilhada.emissive.r, 0, 'o material da cor fica apagado');
    for (const outra of outras) {
        assert.equal(outra.woolMaterial.emissive.r, 0, 'companheira apagada');
    }
});

test('hurtFlashFor: 1 no instante do golpe, 0 quando o tempo acaba', () => {
    // O golpe marca `hurtUntil = at + duração`: no mesmo quadro o clarão é 1 e
    // vai apagando até zero no fim.
    assert.ok(Math.abs(hurtFlashFor(10.2, 10, 0.2) - 1) < 1e-9);
    assert.ok(Math.abs(hurtFlashFor(10, 9.9, 0.2) - 0.5) < 1e-9);
    assert.equal(hurtFlashFor(10, 10, 0.2), 0, 'no fim do prazo já apagou');
    assert.equal(hurtFlashFor(10, 99, 0.2), 0);
    assert.equal(hurtFlashFor(-Infinity, 0, 0.2), 0, 'quem nunca levou golpe não brilha');
    assert.equal(hurtFlashFor(10, 10, 0), 0, 'duração inválida não acende');
    assert.equal(HURT_FLASH, SHEEP_HURT_FLASH, 'os dois bichos usam o mesmo tempo de clarão');
});

// ------------------------------------------------ o que ela solta

test('morta, ela solta lã (se tinha velo) e carne (sempre)', () => {
    // Sorteios escritos à mão: 0 é o mínimo, 0.99 é o máximo.
    const cheia = sheepDropsFor({ coat: 'gray', sheared: false, woolRoll: 0, meatRoll: 0 });
    assert.deepEqual(cheia, { coat: 'gray', wool: SHEEP_WOOL_MIN, mutton: SHEEP_MUTTON_MIN });
    const sortuda = sheepDropsFor({ coat: 'black', sheared: false, woolRoll: 0.99, meatRoll: 0.99 });
    assert.equal(sortuda.wool, SHEEP_WOOL_MAX, 'a lã vai até três');
    assert.equal(sortuda.mutton, SHEEP_MUTTON_MAX, 'a carne vai até dois');
    assert.equal(SHEEP_MUTTON_MIN, 1);
    assert.equal(SHEEP_MUTTON_MAX, 2);

    // Tosquiada: nada de lã, mas a carne sai igual.
    const tosquiada = sheepDropsFor({ coat: 'white', sheared: true, woolRoll: 0.99, meatRoll: 0 });
    assert.equal(tosquiada.wool, 0, 'sem velo, sem lã');
    assert.equal(tosquiada.mutton, SHEEP_MUTTON_MIN, 'a carne não depende da lã');
});

test('o jogo recebe o que ela soltou (onDeath) e a lã é da cor dela', () => {
    const clock = { t: 0 };
    const mortes = [];
    const system = makeSystem(makeWorld(), clock, { onDeath: morte => mortes.push(morte) });
    const sheep = spawnSheep(system, clock);

    for (let golpe = 0; golpe < SHEEP_HEALTH - 1; golpe++) assert.ok(bater(system, clock, sheep));
    const ultimo = bater(system, clock, sheep);

    assert.equal(mortes.length, 1, 'avisou uma vez só');
    assert.equal(mortes[0].entity, sheep);
    assert.equal(mortes[0].drops.coat, sheep.coat, 'a lã sai na cor da ovelha');
    assert.ok(mortes[0].drops.wool >= SHEEP_WOOL_MIN && mortes[0].drops.wool <= SHEEP_WOOL_MAX);
    assert.ok(mortes[0].drops.mutton >= SHEEP_MUTTON_MIN);
    assert.equal(ultimo.drops, mortes[0].drops, 'o mesmo pacote volta para quem bateu');
});

test('a carne de ovelha é item comestível do catálogo', () => {
    const carne = ITEMS[ID.MUTTON];
    assert.ok(carne, 'a carne existe');
    assert.equal(carne.name, 'Carne de ovelha');
    assert.equal(carne.maxStack, 64, 'stacka como a maçã');
    assert.ok(carne.food && carne.food.hunger > 0, 'alimenta');
    assert.ok(carne.food.hunger < ITEMS[ID.APPLE].food.hunger, 'carne crua alimenta menos que a maçã');
    assert.equal(carne.sprite.kind, 'mutton');
    assert.equal(ID.MUTTON, 100, 'o id não colide com a tesoura (99)');
    // `/give carne` acha o item (é o atalho que o roteiro manda digitar).
    for (const nome of ['carne', 'mutton', 'carne de ovelha']) {
        assert.equal(resolveItem(nome, { ITEMS, ID })?.id, ID.MUTTON, `/${nome} devia dar a carne`);
    }
    // As três lãs continuam sendo itens separados.
    assert.deepEqual(Object.keys(SHEEP_WOOL_ITEMS).sort(), ['black', 'gray', 'white']);
    for (const key of Object.keys(SHEEP_WOOL_ITEMS)) {
        assert.ok(ITEMS[ID[SHEEP_WOOL_ITEMS[key]]], `falta a lã ${key}`);
    }
});

// ------------------------------------------------ a mira

test('a mira acerta o lombo: a altura do corpo é do bicho, não fixa', () => {
    const alta = { x: 2, z: 0, y: 0, visualY: 0, bodyOffset: 1.5 };
    const baixa = { x: 2, z: 0, y: 0, visualY: 0 }; // sem bodyOffset: usa o padrão do Mofim
    const origem = { x: 0, y: 1.5, z: 0 };
    const direcao = { x: 1, y: 0, z: 0 };

    // Com a abertura bem fechada, só quem tem o centro ali é atingido.
    assert.equal(creatureInReach([alta], origem, direcao, { minDot: 0.999 }), alta,
        'o centro do corpo alto está na linha da mira');
    assert.equal(creatureInReach([baixa], origem, direcao, { minDot: 0.999 }), null,
        'o mesmo tiro passa por cima de um corpo baixo');
});

test('a ovelha declara a altura do corpo e o golpe acha o lombo', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnSheep(system, clock);
    assert.equal(sheep.bodyOffset, SHEEP_BODY_OFFSET);
    assert.ok(SHEEP_BODY_OFFSET > 0.45, 'mais alta que o Mofim (0,45)');

    const { origem } = golpeDeLado(sheep);
    const direcao = { x: 1, y: 0, z: 0 };
    // Mira fechada na altura do lombo: pega.
    assert.equal(system.hitAt(origem, direcao, { maxDistance: 5, minDot: 0.999 })?.entity, sheep);
});

// ------------------------------------------------ as lascas do impacto

test('as lascas do golpe usam a cor do bicho e um punhado pequeno', () => {
    const scene = new THREE.Scene();
    const particles = createBreakParticleSystem({
        THREE,
        getScene: () => scene,
        getBlockColor: () => 0x00ff00,
        getImmersionAt: () => 0,
    });

    particles.spawn(1, 2, 3, null, { color: 0x884422, count: 5, spread: 0.3, speed: 0.6 });
    const meshes = scene.children.filter(child => child.isMesh);
    assert.equal(meshes.length, 5, 'cinco lascas, não as doze de um bloco');
    assert.equal(meshes[0].material.color.getHex(), 0x884422, 'a cor vem do bicho');

    // A quebra de bloco continua como era: doze lascas na cor do bloco.
    particles.spawn(1, 2, 3, 7);
    assert.equal(scene.children.filter(child => child.isMesh).length, 17, 'doze a mais');
    const novas = scene.children.filter(child => child.isMesh).slice(5);
    assert.equal(novas[0].material.color.getHex(), 0x00ff00, 'a cor vem do catálogo');
});

// ------------------------------------------------ a ligação no jogo

test('game.js bate nos dois bichos com som, lascas e o item da morte', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');

    assert.match(source, /const golpe = sheepSystem\.hitAt\(camera\.position, creatureAim, aim\)/);
    assert.match(source, /const mofim = creatureSystem\.hitFrom\(camera\.position, creatureAim, aim\)/);
    assert.match(source, /audio\.play\('mob-hit'/, 'o baque do golpe');
    assert.match(source, /mobHitPuff\(golpe\.entity, golpe\.killed \? 12 : 6\)/, 'lascas na ovelha');
    assert.match(source, /mobHitPuff\(mofim\.entity, mofim\.killed \? 12 : 6\)/, 'lascas no Mofim');
    assert.match(source, /breakParticles\.spawn\(entity\.x, y, entity\.z, null, \{ color, count/,
        'lascas com a cor do bicho');
    // A folga do bloco na mira é o que fazia o golpe "não fazer nada".
    assert.match(source, /const MOB_HIT_BLOCK_SLACK = 0\.75/);
    assert.match(source, /maxDistance: currentHit \? currentHit\.dist \+ MOB_HIT_BLOCK_SLACK/);
    // A morte da ovelha põe os itens no chão.
    assert.match(source, /onDeath: \(\{ entity, drops \}\) => \{/);
    assert.match(source, /spawnItemEntity\(ID\[SHEEP_WOOL_ITEMS\[drops\.coat\]\], drops\.wool/);
    assert.match(source, /spawnItemEntity\(ID\.MUTTON, drops\.mutton/);
});

// ------------------------------------------------ o peso do golpe

test('o recuo do golpe desliza, freia e para (não é teleporte)', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const bicho = { x: 0, z: 0, y: GROUND, visualY: GROUND, heading: 0 };

    assert.ok(system.pushAway(bicho, 1, 0, SHEEP_KNOCKBACK));
    assert.equal(bicho.x, 0, 'empurrar não move o corpo na hora');
    assert.ok(knockSpeedFor(SHEEP_KNOCKBACK) > SHEEP_KNOCKBACK / KNOCK_TIME, 'a velocidade sai da conta do tempo');

    const primeiro = system.stepKnock(bicho, 0.016);
    assert.ok(primeiro > 0, 'o primeiro quadro já desliza');
    assert.ok(primeiro < SHEEP_KNOCKBACK * 0.25, `mas é um fio, não o pulo inteiro (${primeiro})`);

    let total = primeiro;
    for (let i = 0; i < 20; i++) total += system.stepKnock(bicho, 0.016);
    assert.ok(Math.abs(total - SHEEP_KNOCKBACK) < 0.02, `o recuo total é o empurrão (${total})`);
    assert.ok(Math.abs(bicho.x - SHEEP_KNOCKBACK) < 0.02, 'e o corpo foi junto');
    const fim = bicho.x;
    assert.equal(system.stepKnock(bicho, 0.016), 0, 'o recuo acaba');
    assert.equal(bicho.x, fim, 'sem continuar andando sozinho depois');

    // Barrado (parede/água): o recuo para ali em vez de atravessar. O mundo do
    // teste arredonda o chão para o bloco, então a parede começa no bloco x = 1.
    const contraParede = makeSystem(makeWorld({ heightAt: (x) => (x >= 1 ? GROUND + 4 : GROUND) }), { t: 0 });
    const preso = { x: 0, z: 0, y: GROUND, visualY: GROUND, heading: 0 };
    contraParede.pushAway(preso, 1, 0, 2);
    for (let i = 0; i < 20; i++) contraParede.stepKnock(preso, 0.016);
    assert.ok(preso.x < 1, `o corpo não atravessa a parede (${preso.x})`);
    assert.ok(preso.x > 0.5, `mas recua até encostar nela (${preso.x})`);
});

test('o braço tem a sua cadência: um swing, um golpe', () => {
    assert.ok(ATTACK_COOLDOWN >= 0.35 && ATTACK_COOLDOWN <= 0.7, `cadência de braço (${ATTACK_COOLDOWN})`);
    assert.ok(attackReady(-Infinity, 10), 'no primeiro golpe, pronto');
    assert.ok(!attackReady(10, 10 + ATTACK_COOLDOWN * 0.5), 'no meio do swing, não');
    assert.ok(attackReady(10, 10 + ATTACK_COOLDOWN), 'passado o tempo, sim');
    // A cadência é do jogador, não do bicho: trocar de alvo não fura a espera.
    assert.ok(!attackReady(10, 10 + 0.05), 'outro bicho na frente não acelera o braço');
});

test('o golpe amassa o corpo, deita as orelhas e sacode a cabeça', () => {
    const clock = { t: 0 };
    const system = makeSystem(makeWorld(), clock);
    const sheep = spawnSheep(system, clock);
    const player = { pos: { x: 0, z: 0 } };
    const baseOrelhas = sheep.ears.map(orelha => orelha.userData.baseZ);

    assert.ok(bater(system, clock, sheep));
    system.update(0.016, player, true, { day: 1 });

    // Corpo: encolhe na altura e alarga nos lados.
    assert.ok(sheep.group.scale.y < 1 - HURT_SQUASH * 0.5, `amassa na altura (${sheep.group.scale.y})`);
    assert.ok(sheep.group.scale.x > 1 + HURT_SPREAD * 0.5, `alarga nos lados (${sheep.group.scale.x})`);

    // As duas orelhas deitam de vez no impacto.
    sheep.ears.forEach((orelha, i) => {
        const lado = orelha.userData.side ?? (i === 0 ? 1 : -1);
        const desvio = (orelha.rotation.z - baseOrelhas[i]) * -lado;
        assert.ok(desvio > HURT_EAR_FLAT * 0.5, `a orelha deitou (${desvio})`);
    });

    // E a cabeça dá um tranco para cima. Comparado com o mesmo instante um
    // pouco depois (a fuga é a mesma), sobra só o tranco.
    const comTranco = sheep.head.rotation.x;
    clock.t += SHEEP_HURT_FLASH + 0.01;
    system.update(0.016, player, true, { day: 1 });
    const semTranco = sheep.head.rotation.x;
    assert.ok(comTranco - semTranco > HURT_HEAD_KICK * 0.4,
        `a cabeça subiu no golpe (${comTranco} vs ${semTranco})`);

    assert.ok(Math.abs(sheep.group.scale.y - 1) < 1e-9, 'o corpo volta ao tamanho de sempre');
    assert.ok(Math.abs(sheep.group.scale.x - 1) < 1e-9, 'e à largura de sempre');
});
