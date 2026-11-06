// O contrato do golpe: **todo** bicho leva golpe do mesmo jeito.
//
// O golpe nasceu no Mofim e a ovelha herdou importando do arquivo dele. Um bicho
// novo teria de copiar constantes e o `hitFrom` inteiro — e o jeito de esquecer
// uma peça era não notar. Agora o kit mora em `world-mob-hit.js` e quem aplica é
// o `takeHit` da base; este teste cobra o contrato de cada bicho do jogo.
//
// A varredura é **automática**: todo módulo `world-*.js` que estende a base de
// criaturas é um bicho novo aos olhos daqui. Ele precisa declarar a vida, ter uma
// entrada de golpe (`hitFrom`/`hitAt`) e usar o `takeHit` — nada de reescrever o
// golpe por conta própria. Aí o teste roda o mesmo roteiro em cada um: tira vida,
// acende o clarão, empurra, trava o segundo golpe, derruba no último e o corpo
// fica caído antes de sair do mundo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import * as THREE from '../vendor/three/three.module.js';
import { BLOCKS, ID } from '../world-catalog.js';
import {
    HIT_COOLDOWN, HURT_FLASH, HURT_SQUASH, HURT_SPREAD,
    creatureInReach, hurtFlashFor, hurtScaleFor,
} from '../world-mob-hit.js';
import { DYING_TIME } from '../world-creature-base.js';

const ROOT = new URL('..', import.meta.url).pathname;
const CHUNK_SIZE = 16;
const GROUND = 10;

// Mundo plano de grama: chão para todo lado, então o bicho nasce e fica.
function makeWorld() {
    return {
        seed: 4242,
        scene: new THREE.Scene(),
        getChunk: () => ({}),
        generator: { heightAt: () => GROUND },
        getBlock: (x, y) => (y === GROUND ? ID.GRASS : 0),
    };
}

const idlePlayer = pos => ({ pos, vel: { x: 0, z: 0 }, crouching: false });

/**
 * Todos os módulos de bicho do jogo: os `world-*.js` que importam a base de
 * criaturas. A base em si não entra (ela **define** a classe, não a estende).
 */
function modulosDeBicho() {
    return readdirSync(ROOT)
        .filter(nome => nome.startsWith('world-') && nome.endsWith('.js'))
        .filter(nome => {
            if (nome === 'world-creature-base.js') return false;
            const fonte = readFileSync(path.join(ROOT, nome), 'utf8');
            return /import\s*\{[^}]*\bcreateCreatureBaseClass\b[^}]*\}\s*from\s*'\.\/world-creature-base\.js'/.test(fonte);
        })
        .sort();
}

/**
 * Abre um bicho do jogo: importa o módulo, acha a fábrica do sistema, monta o
 * system com o mesmo mundo/relógio de mentira e deixa ele nascer.
 */
async function abrirBicho(arquivo) {
    const modulo = await import(pathToFileURL(path.join(ROOT, arquivo)).href);
    const nomeFabrica = Object.keys(modulo).find(chave => /^create\w+SystemClass$/.test(chave));
    assert.ok(nomeFabrica, `${arquivo}: o módulo não exporta a fábrica do sistema (create…SystemClass)`);

    const nomeVida = Object.keys(modulo).find(chave => /^[A-Z0-9_]*_?HEALTH$/.test(chave) && Number.isFinite(modulo[chave]));
    assert.ok(nomeVida, `${arquivo}: o bicho não declara a vida (export const …_HEALTH)`);

    // O `onDeath` de cada espécie tem a sua assinatura (`entity` ou `{entity,
    // drops}`): o teste guarda o que chegar e lê o corpo por `morte.entity`.
    const mortes = [];
    const clock = { t: 0 };
    const System = modulo[nomeFabrica]({
        THREE, ID, BLOCKS, CHUNK_SIZE, now: () => clock.t,
        // Cada espécie avisa do seu jeito (o Mofim manda o corpo, a ovelha manda
        // `{entity, drops}`); aqui se normaliza para o teste olhar sempre igual.
        onDeath: morte => mortes.push({
            entity: morte?.entity ?? morte,
            killed: true,
            drops: morte?.drops,
        }),
    });
    const system = new System(makeWorld());
    const player = idlePlayer({ x: 0, z: 0 });

    // Deixa nascer (cada espécie tem o seu horário e o seu intervalo).
    for (let i = 0; i < 400 && system.entities.length === 0; i++) {
        clock.t += 5;
        system.update(0.016, player, true, { day: 1 });
    }
    assert.ok(system.entities.length > 0, `${arquivo}: o bicho nunca nasceu`);

    const alvo = system.entities[0];
    // Daqui para baixo o teste manda: sem chegada, sem passeio, no chão.
    alvo.arriving = false;
    alvo.x = 2; alvo.z = 0;
    if (Number.isFinite(alvo.y)) alvo.y = GROUND + 1;
    if (Number.isFinite(alvo.visualY)) alvo.visualY = alvo.y;

    const bater = () => {
        const origem = {
            x: alvo.x - 1,
            y: (Number.isFinite(alvo.visualY) ? alvo.visualY : alvo.y) + (alvo.bodyOffset ?? 0.45),
            z: alvo.z,
        };
        const metodo = system.hitFrom ?? system.hitAt;
        assert.ok(metodo, `${arquivo}: o sistema não tem entrada de golpe (hitFrom/hitAt)`);
        return metodo.call(system, origem, { x: 1, y: 0, z: 0 }, { maxDistance: 5 });
    };

    return {
        arquivo, modulo, system, alvo, mortes, clock, bater,
        vida: modulo[nomeVida],
        correr: (frames, dt = 0.05) => {
            for (let i = 0; i < frames; i++) {
                clock.t += dt;
                // O jogador fica parado onde o bicho está: ninguém despawna.
                system.update(dt, idlePlayer({ x: alvo.x, z: alvo.z }), true, { day: 1 });
            }
        },
    };
}

const ARQUIVOS = modulosDeBicho();

// ------------------------------------------------ o contrato (estático)

test('a varredura acha os bichos do jogo (não é um teste que sempre passa)', () => {
    assert.ok(ARQUIVOS.includes('world-creature.js'), 'o Mofim entrou na varredura');
    assert.ok(ARQUIVOS.includes('world-sheep.js'), 'a ovelha entrou na varredura');
    assert.ok(!ARQUIVOS.includes('world-creature-base.js'), 'a base não é um bicho');
});

for (const arquivo of ARQUIVOS) {
    test(`${arquivo}: usa o kit do golpe em vez de reescrever o seu`, () => {
        const fonte = readFileSync(path.join(ROOT, arquivo), 'utf8');
        assert.match(fonte, /this\.takeHit\(/, 'o golpe é aplicado pelo `takeHit` da base');
        assert.match(fonte, /\bhitFrom\s*\(|\bhitAt\s*\(/, 'tem uma entrada de golpe (hitFrom/hitAt)');
        assert.match(fonte, /from\s*'\.\/world-mob-hit\.js'/, 'importa o kit (`world-mob-hit.js`)');
        // Quem faz a conta do amassado é o kit: nada de `HURT_SPREAD *` solto.
        assert.doesNotMatch(fonte, /HURT_SPREAD\s*\*/, 'a reação do corpo vem do `hurtScaleFor`');
    });
}

// ------------------------------------------------ o kit (puro)

test('hurtScaleFor: amassado no golpe, corpo inteiro fora dele', () => {
    const inteiro = hurtScaleFor(0);
    assert.deepEqual(inteiro, { x: 1, y: 1, z: 1 });

    const impacto = hurtScaleFor(1);
    assert.ok(Math.abs(impacto.y - (1 - HURT_SQUASH)) < 1e-9, 'fica mais baixo');
    assert.ok(Math.abs(impacto.x - (1 + HURT_SPREAD)) < 1e-9, 'e mais largo');
    assert.deepEqual([impacto.x, impacto.z], [1 + HURT_SPREAD, 1 + HURT_SPREAD], 'alarga nos dois lados');

    // Valores fora da faixa não deformam o corpo: o clarão é 0..1.
    assert.deepEqual(hurtScaleFor(-5), { x: 1, y: 1, z: 1 });
    assert.deepEqual(hurtScaleFor(9), impacto);
    assert.deepEqual(hurtScaleFor(Number.NaN), { x: 1, y: 1, z: 1 });
});

test('creatureInReach: o corpo caído não é alvo, seja qual for o bicho', () => {
    const origem = { x: 0, y: 1.45, z: 0 };
    const mira = { x: 1, y: 0, z: 0 };
    const vivo = { x: 2, y: 1, z: 0 };
    assert.equal(creatureInReach([vivo], origem, mira), vivo);
    assert.equal(creatureInReach([{ ...vivo, dying: true }], origem, mira), null, 'caindo');
    assert.equal(creatureInReach([{ ...vivo, leaving: true }], origem, mira), null, 'saindo de cena');
});

// ------------------------------------------------ o contrato (no mundo)

for (const arquivo of ARQUIVOS) {
    test(`${arquivo}: o mesmo roteiro de golpe em qualquer bicho`, async () => {
        const caso = await abrirBicho(arquivo);
        const { alvo, bater, mortes, system } = caso;
        assert.ok(caso.vida > 0, 'declarou a vida');

        // --- tirando vida: clarão, recuo e a vida descendo
        const antes = alvo.health;
        const primeiro = bater();
        assert.ok(primeiro, 'o primeiro golpe pega');
        assert.equal(primeiro.killed, false, 'e não derruba um bicho inteiro');
        assert.equal(alvo.health, antes - 1, 'tira um de vida');
        assert.ok(Math.abs(alvo.hurtUntil - (caso.clock.t + HURT_FLASH)) < 1e-9, 'acende o clarão do kit');
        assert.ok(hurtFlashFor(alvo.hurtUntil, caso.clock.t) > 0, 'e o clarão está aceso agora');
        assert.ok(alvo.knockFor > 0, 'armou o recuo (não pulou no mesmo quadro)');
        assert.equal(system.entities.includes(alvo), true, 'continua no mundo');
        // --- a trava do bicho: dois golpes no mesmo instante não valem dois
        // (`assert.ok(!…)` e não `equal(…, null)`: uma falha aqui imprimiria o
        // bicho inteiro — com THREE dentro — e o teste morreria sem mensagem.)
        assert.ok(!bater(), 'o segundo golpe no mesmo instante não entra');
        caso.clock.t += HIT_COOLDOWN + 0.01;
        assert.ok(bater(), 'passado o cooldown, o golpe volta a entrar');
        // --- até a morte
        let golpes = 2;
        while (alvo.health > 0 && golpes < 20) {
            caso.clock.t += HIT_COOLDOWN + 0.01;
            const golpe = bater();
            assert.ok(golpe, `o golpe ${golpes + 1} pega`);
            golpes++;
            assert.equal(golpe.killed, alvo.health <= 0, 'avisa a morte só no último');
        }
        assert.equal(golpes, caso.vida, 'morre no golpe da vida dele, nem antes nem depois');
        assert.equal(alvo.health, 0, 'sem vida');
        assert.equal(alvo.dying, true, 'o corpo cai');
        assert.ok(system.entities.includes(alvo), 'e continua no mundo enquanto cai');
        assert.ok(mortes.length >= 1, 'avisou quem chamou (os itens caem na hora)');
        const morte = mortes[mortes.length - 1];
        // Identidade, não `deepEqual`: uma falha aqui imprimiria o bicho inteiro
        // (com THREE dentro) e o teste morreria sem mensagem.
        assert.ok(morte.entity === alvo, 'com o bicho que morreu');
        assert.equal(morte.killed, true);
        assert.ok('drops' in morte, 'e o que ele soltou (mesmo que nada)');
        // --- o corpo caído não é alvo nem leva outro golpe
        caso.clock.t += HIT_COOLDOWN + 0.01;
        assert.ok(!bater(), 'corpo caído não é alvo');
        assert.ok(!system.takeHit(alvo, { at: caso.clock.t }), 'nem o kit derruba de novo');
        // --- o corpo tomba e só então sai do mundo
        const cena = system.world.scene.children.length;
        let quadros = 0;
        while (system.entities.includes(alvo) && quadros < 200) { // no máx. 10 s
            caso.correr(1);
            quadros++;
            if (quadros === 3) {
                assert.ok(Math.abs(alvo.group.rotation.z) > 0, 'já tombou nos primeiros quadros');
                assert.ok(quadros * 0.05 < DYING_TIME, 'e ainda é cedo para sumir');
            }
        }
        assert.ok(!system.entities.includes(alvo), 'no fim da queda sai da lista');
        assert.ok(Math.abs(quadros * 0.05 - DYING_TIME) < 0.15, `a queda dura ~DYING_TIME (${quadros * 0.05}s)`);
        assert.ok(!system.world.scene.children.includes(alvo.group), 'e sai da cena');
        assert.ok(system.world.scene.children.length <= cena, 'sem duplicar o corpo na cena');
        assert.equal(mortes.filter(m => m.entity === alvo).length, 1, 'morreu uma vez só');
    });
}
