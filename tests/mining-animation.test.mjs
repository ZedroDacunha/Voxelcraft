import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    PUNCH_SECONDS,
    advanceHandAnimation,
    createHandAnimation,
    handSwingAmount,
    startPunch,
} from '../world-hand-animation.js';

const FRAME = 1 / 60;

// Roda n quadros e devolve o maior `swing` visto.
function simulate(hand, frames, { mining = false, from = 0 } = {}) {
    let peak = 0;
    const swings = [];
    for (let i = 0; i < frames; i++) {
        advanceHandAnimation(hand, FRAME, { mining });
        const { swing } = handSwingAmount(hand);
        swings.push(swing);
        peak = Math.max(peak, swing);
    }
    return { peak, swings, last: swings.at(-1) ?? from };
}

test('o estado inicial é braço parado', () => {
    const hand = createHandAnimation();
    assert.deepEqual(
        { mining: hand.mining, phase: hand.phase, punch: hand.punch, sw: hand.sw },
        { mining: 0, phase: 0, punch: 0, sw: 1 },
    );
    assert.equal(handSwingAmount(hand).swing, 0);
    assert.equal(handSwingAmount(hand).dip, 0, 'sem troca de item não há mergulho');
});

test('quebrar instantaneamente ainda produz um golpe visível', () => {
    // Grama alta: o bloco cai no mesmo quadro, o laço de mineração nunca aparece.
    const hand = createHandAnimation();
    startPunch(hand);
    assert.equal(handSwingAmount(hand).swing, 0, 'o golpe começa do repouso');

    const { peak, swings } = simulate(hand, Math.ceil(PUNCH_SECONDS / FRAME) + 4);
    assert.ok(peak > 0.9, `o braço precisa chegar perto do fim do golpe (pico ${peak})`);
    assert.ok(swings.filter(swing => swing > 0.2).length >= 3, 'o golpe dura vários quadros');
    assert.ok(swings.at(-1) < 0.02, 'e volta ao repouso no fim');
});

test('o golpe passa pelo meio do balanço na metade do tempo', () => {
    const hand = createHandAnimation();
    startPunch(hand);
    advanceHandAnimation(hand, PUNCH_SECONDS / 2);
    assert.ok(Math.abs(handSwingAmount(hand).punch - 1) < 1e-9, 'pico no meio do golpe');
    advanceHandAnimation(hand, PUNCH_SECONDS / 2);
    assert.equal(hand.punch, 0, 'termina exatamente no fim');
});

test('golpes repetidos não somam: só reiniciam o balanço', () => {
    const hand = createHandAnimation();
    startPunch(hand);
    advanceHandAnimation(hand, PUNCH_SECONDS / 2);
    startPunch(hand);
    assert.equal(hand.punch, 1);
    assert.ok(handSwingAmount(hand).swing < 0.05, 'reiniciar não deixa o braço travado no alto');
});

test('o laço de mineração oscila enquanto o botão está pressionado', () => {
    const hand = createHandAnimation();
    const { swings } = simulate(hand, 120, { mining: true });
    const peak = Math.max(...swings);
    const valley = Math.min(...swings.slice(30));
    assert.ok(peak > 0.85, 'vai até o fim do movimento');
    assert.ok(valley < 0.2, 'e volta, senão a mão fica tremendo no alto');
    assert.ok(hand.mining > 0.99, 'a mistura chega ao laço depois de alguns quadros');
});

test('ao soltar o botão o braço volta ao repouso', () => {
    const hand = createHandAnimation();
    simulate(hand, 60, { mining: true });
    const { last } = simulate(hand, 60, { mining: false });
    assert.ok(last < 0.02, `parou em ${last}`);
    assert.ok(hand.mining < 0.01);
});

test('a troca de item mergulha o braço e volta', () => {
    const hand = createHandAnimation();
    hand.sw = 0; // trocou de item neste quadro
    assert.equal(handSwingAmount(hand).dip, 0.5);
    simulate(hand, 30);
    assert.equal(handSwingAmount(hand).dip, 0);
});

test('game.js golpeia em toda quebra e mantém a grama no ritmo do braço', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');

    // Toda quebra passa por breakBlock(): é lá que o golpe é disparado.
    const breakBlock = source.slice(source.indexOf('function breakBlock('));
    const body = breakBlock.slice(0, breakBlock.indexOf('\n}'));
    assert.match(body, /startPunch\(handAnim\)/, 'quebrar precisa disparar o golpe');

    // Grama alta: mesma cadência de uma quebra normal, sem soltar o botão.
    assert.match(source, /if \(currentHit\.type === ID\.TALL_GRASS\) \{[\s\S]{0,400}?mining\.cooldown = 0\.2;/);
    const grassPath = source.slice(source.indexOf('if (currentHit.type === ID.TALL_GRASS)'));
    assert.doesNotMatch(grassPath.slice(0, 400), /leftHeld = false/, 'segurar o botão deve continuar cortando');

    // A animação em si mora no módulo puro e é usada pelo updateHand.
    assert.match(source, /const handAnim = createHandAnimation\(\)/);
    assert.match(source, /advanceHandAnimation\(handAnim, dt, \{ mining: miningNow \}\)/);
    assert.match(source, /const \{ swing, dip \} = handSwingAmount\(handAnim\)/);
});
