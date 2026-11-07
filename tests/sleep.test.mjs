// A CAMA, PARTE 2 — dormir e renascer nela.
//
// Dormir tem três peças que erram fácil e não dão erro nenhum quando erram:
//
// 1. a **hora** — se a cama aceitar de dia, o jogador dorme no sol;
// 2. a **linha do tempo** — a noite tem de virar no escuro, e não antes (o
//    corpo apareceria em pé com o mundo ainda visível) nem depois (a tela
//    clarearia mostrando o jogador ainda deitado);
// 3. o **ponto de renascimento** — em cima do colchão, não dentro dele nem
//    flutuando, e esquecido quando a cama é quebrada.
//
// As três contas moram em `world-sleep.js` (puro, sem THREE/DOM); aqui se testa
// a conta e as duas ligações: o clique direito que escolhe a cama e o save.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ID } from '../world-catalog.js';
import { BED_COLLISION_HEIGHT, bedCells, bedOtherCell, bedTypeForPart } from '../world-bed.js';
import {
    DAWN_TIME,
    SLEEP_NIGHT_THRESHOLD,
    SLEEP_TIMING,
    SLEEP_TOTAL,
    bedRespawnPoint,
    canSleepAt,
    sleepPhaseAt,
} from '../world-sleep.js';
import { rightClickIntent } from '../world-interaction-rules.js';
import { createWorldClock } from '../world-clock.js';

// --- a hora de dormir ------------------------------------------------------

test('só dá para dormir com a noite fechada', () => {
    // Meio-dia, crepúsculo e começo da noite ainda não valem.
    assert.equal(canSleepAt(0), false);
    assert.equal(canSleepAt(0.3), false);
    assert.equal(canSleepAt(SLEEP_NIGHT_THRESHOLD - 0.01), false);
    // Noite alta vale.
    assert.equal(canSleepAt(SLEEP_NIGHT_THRESHOLD), true);
    assert.equal(canSleepAt(1), true);
    // Sem número, não dorme.
    assert.equal(canSleepAt(undefined), false);
    assert.equal(canSleepAt(NaN), false);
});

test('o corte de dormir é mais exigente que o do Mofim', () => {
    // O bicho usa `dia < 0,35` para aparecer (noite >= 0,65): a cama usa o mesmo
    // ponto, então quem vê o Mofim já pode dormir — e não o contrário.
    assert.equal(SLEEP_NIGHT_THRESHOLD, 0.65);
});

// --- a linha do tempo ------------------------------------------------------

test('a dormida soma as três fases', () => {
    const { lie, black, wake } = SLEEP_TIMING;
    assert.equal(SLEEP_TOTAL, lie + black + wake);
    // Curta o bastante para não prender o jogador, longa o bastante para ler.
    assert.ok(SLEEP_TOTAL > 2 && SLEEP_TOTAL < 4);
});

test('a dormida começa clara, escurece e volta a clarear', () => {
    assert.deepEqual(sleepPhaseAt(0), { phase: 'lie', fade: 0, changed: false, done: false });
    const meioDoDeitar = sleepPhaseAt(SLEEP_TIMING.lie / 2);
    assert.equal(meioDoDeitar.phase, 'lie');
    assert.ok(meioDoDeitar.fade > 0.4 && meioDoDeitar.fade < 0.6);
    // Só no escuro a tela fica inteira preta.
    assert.equal(sleepPhaseAt(SLEEP_TIMING.lie + 0.01).fade, 1);
    const quaseAcordado = sleepPhaseAt(SLEEP_TOTAL - 0.01);
    assert.equal(quaseAcordado.phase, 'wake');
    assert.ok(quaseAcordado.fade > 0 && quaseAcordado.fade < 0.05);
    assert.deepEqual(sleepPhaseAt(SLEEP_TOTAL), { phase: 'done', fade: 0, changed: true, done: true });
});

test('a noite passa no começo do escuro, não no fim', () => {
    // Antes do preto o mundo continua sendo o da noite.
    assert.equal(sleepPhaseAt(SLEEP_TIMING.lie - 0.01).changed, false);
    // O primeiro quadro preto já é a virada: o corpo aparece em pé na cama
    // enquanto a tela está fechada.
    assert.equal(sleepPhaseAt(SLEEP_TIMING.lie).changed, true);
    // Depois disso, `changed` nunca volta atrás (a virada é uma só).
    for (let t = SLEEP_TIMING.lie; t <= SLEEP_TOTAL + 1; t += 0.05) {
        assert.equal(sleepPhaseAt(t).changed, true, `changed caiu em t=${t}`);
    }
});

test('a dormida nunca anda para trás', () => {
    const ordem = ['lie', 'sleep', 'wake', 'done'];
    let anterior = 0;
    for (let t = 0; t <= SLEEP_TOTAL + 0.5; t += 0.02) {
        const atual = ordem.indexOf(sleepPhaseAt(t).phase);
        assert.ok(atual >= anterior, `fase voltou em t=${t.toFixed(2)}`);
        anterior = atual;
    }
    // Tempo inválido não quebra o quadro: conta como o começo.
    assert.equal(sleepPhaseAt(NaN).phase, 'lie');
    assert.equal(sleepPhaseAt(-3).phase, 'lie');
});

// --- o amanhecer do relógio do jogo ----------------------------------------

test('acordar cai às 06:00 no relógio do jogo', () => {
    const clock = createWorldClock({ dayLength: 600, initialTime: 0.8 });
    clock.time = DAWN_TIME;
    assert.equal(clock.format(), '06:00');
});

// --- o ponto de renascimento ----------------------------------------------

test('o corpo acorda em cima do colchão', () => {
    const p = bedRespawnPoint({ x: 12, y: 64, z: -5 });
    // No meio da célula, não na quina.
    assert.equal(p.x, 12.5);
    assert.equal(p.z, -4.5);
    // Em cima do colchão: a altura é a da colisão da cama (9/16), então o pé
    // fica apoiado nela em vez de afundar ou flutuar.
    assert.equal(p.y, 64 + BED_COLLISION_HEIGHT);
    assert.ok(p.y > 64.5 && p.y < 64.6);
});

test('as duas metades da cama dão o mesmo par de células', () => {
    // Dormir pela cabeceira ou pelos pés tem de guardar a mesma cama: a célula
    // dos pés, que é a que o save carrega.
    for (const facing of ['north', 'south', 'east', 'west']) {
        const cabeca = bedCells(4, 7, facing).head;
        const pes = bedOtherCell(cabeca.x, cabeca.z, 'head', facing);
        const deVolta = bedOtherCell(pes.x, pes.z, 'foot', facing);
        assert.deepEqual({ x: deVolta.x, z: deVolta.z }, { x: cabeca.x, z: cabeca.z }, facing);
        // E as duas células são vizinhas — a cama ocupa exatamente duas.
        assert.equal(Math.abs(deVolta.x - pes.x) + Math.abs(deVolta.z - pes.z), 1);
    }
});

test('ponto de renascimento inválido não vira posição', () => {
    assert.equal(bedRespawnPoint(null), null);
    assert.equal(bedRespawnPoint({}), null);
    assert.equal(bedRespawnPoint({ x: 1, y: Infinity, z: 2 }), null);
});

// --- o clique direito na cama ---------------------------------------------

test('olhar para a cama e clicar é dormir', () => {
    assert.equal(rightClickIntent({ bed: true }), 'bed');
    // A cama ganha da comida na mão...
    assert.equal(rightClickIntent({ bed: true, food: true }), 'bed');
    // ...e perde para baú/forno/bancada e porta, que são interações mais finas.
    assert.equal(rightClickIntent({ bed: true, station: 'chest' }), 'station');
    assert.equal(rightClickIntent({ bed: true, door: true }), 'door');
    // Agachado, o clique é do item (colocar bloco), como no gênero.
    assert.equal(rightClickIntent({ bed: true, sneaking: true }), 'place');
    // Sem cama, nada mudou.
    assert.equal(rightClickIntent({}), 'place');
    assert.equal(rightClickIntent({ food: true }), 'eat');
});

// --- a cama no chão --------------------------------------------------------

test('a cama guardada é a dos pés, em cima de um bloco', () => {
    // O save guarda a célula dos pés; o renascimento é o centro dela. Se a
    // célula guardada fosse a cabeceira, o jogador nasceria no travesseiro.
    const cabeca = bedCells(0, 0, 'south').head;
    assert.equal(bedTypeForPart('head'), ID.BED_HEAD);
    assert.equal(bedTypeForPart('foot'), ID.BED_FOOT);
    const pes = bedOtherCell(cabeca.x, cabeca.z, 'head', 'south');
    const p = bedRespawnPoint({ x: pes.x, y: 10, z: pes.z });
    assert.equal(p.x, pes.x + 0.5);
    assert.equal(p.z, pes.z + 0.5);
});

// --- a ligação com o jogo --------------------------------------------------
//
// `world-sleep.js` é conta pura: se ninguém a chamar, ela passa nos testes e o
// jogador continua sem dormir. Estes três casos conferem os fios no `game.js` e
// o véu preto na página — o que some sem dar erro.

const raiz = new URL('..', import.meta.url).pathname;
const jogo = readFileSync(new URL('game.js', `file://${raiz}`), 'utf8');

test('o jogo usa as regras da dormida', () => {
    assert.match(jogo, /from '\.\/world-sleep\.js'/);
    for (const nome of ['canSleepAt', 'sleepPhaseAt', 'bedRespawnPoint', 'DAWN_TIME']) {
        assert.match(jogo, new RegExp(`\\b${nome}\\b`), `game.js não usa ${nome}`);
    }
    // O clique direito na cama vai para dormir, e a dormida roda no laço.
    assert.match(jogo, /intent === 'bed'\) \{ trySleep\(/);
    assert.match(jogo, /if \(sleep\.active\) updateSleep\(dt\);/);
    // Morrer leva o corpo para o ponto de renascimento (cama ou início).
    assert.match(jogo, /const spawnAt = respawnOrigin\(\);/);
});

test('quebrar a cama esquece o renascimento', () => {
    // Sem isso o jogador renasceria flutuando onde a cama existia.
    assert.match(jogo, /clearBedSpawn\(\);/);
    assert.match(jogo, /bedSpawnStanding\(\)/);
});

test('a tela da dormida existe na página e no estilo', () => {
    const html = readFileSync(new URL('index.html', `file://${raiz}`), 'utf8');
    const css = readFileSync(new URL('styles.css', `file://${raiz}`), 'utf8');
    assert.match(html, /id="sleep"/);
    assert.match(css, /#sleep \{/);
    // O véu não pode bloquear clique nem cobrir o aviso (`toast` fica acima).
    const regra = css.slice(css.indexOf('#sleep {'));
    assert.match(regra.slice(0, 220), /pointer-events: none/);
    assert.match(regra.slice(0, 220), /z-index: 5/);
});
