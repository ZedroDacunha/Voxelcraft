// A passada: uma cadência só para o som do passo, o braço e o balanço da visão.
//
// O que se testa aqui é a **sincronia**: o passo soa exatamente no ponto baixo
// do balanço, o vai e vem lateral e a microinclinação cruzam o zero ali, e a
// amplitude entra e sai suave (nada de tranco ao começar ou parar de andar).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { STEP_STRIDE } from '../world-step-sounds.js';
import {
    GAIT_BOB_X,
    GAIT_BOB_Y,
    GAIT_CROUCH_SCALE,
    GAIT_FADE,
    GAIT_MAX_STEPS,
    GAIT_ROLL,
    GAIT_SPRINT_SCALE,
    GAIT_SWIM_SCALE,
    advanceGait,
    createGait,
    gaitAmplitudeFor,
    gaitPhase,
    gaitPose,
} from '../world-gait.js';

const FRAME = 1 / 60;

// Anda `metros` em passos de quadro (60 fps) e devolve quantos passos soaram.
function andar(gait, metros, { velocidade = 4, ...opcoes } = {}) {
    const porQuadro = velocidade * FRAME;
    let restante = metros;
    let passos = 0;
    while (restante > 1e-9) {
        const passo = Math.min(porQuadro, restante);
        passos += advanceGait(gait, { distance: passo, dt: FRAME, onGround: true, ...opcoes });
        restante -= passo;
    }
    return passos;
}

// ------------------------------------------------ a cadência

test('um passo a cada STEP_STRIDE metros, com o resto acumulado entre quadros', () => {
    const gait = createGait();

    assert.equal(advanceGait(gait, { distance: 0, dt: FRAME, onGround: true }), 0, 'parado não dá passo');
    assert.equal(advanceGait(gait, { distance: STEP_STRIDE * 0.5, dt: FRAME, onGround: true }), 0,
        'meio passo ainda não soa');
    assert.equal(advanceGait(gait, { distance: STEP_STRIDE * 0.5, dt: FRAME, onGround: true }), 1,
        'na metade que faltava, soa');
    assert.equal(advanceGait(gait, { distance: STEP_STRIDE * 0.45, dt: FRAME, onGround: true }), 0);
    assert.equal(advanceGait(gait, { distance: STEP_STRIDE * 0.6, dt: FRAME, onGround: true }), 1,
        'o resto acumula entre quadros');
});

test('correr dá mais passos por segundo que andar', () => {
    const contar = velocidade => andar(createGait(), velocidade * 2, { velocidade });
    const andando = contar(4);
    const correndo = contar(7.5);
    assert.ok(andando >= 4, `andando: ${andando} passos em 2 s`);
    assert.ok(correndo > andando, `correndo (${correndo}) > andando (${andando})`);
    assert.ok(correndo / andando < 2.5, 'a relação acompanha a velocidade, sem exagero');
});

test('um quadro engasgado não vira rajada de passos', () => {
    const gait = createGait();
    assert.equal(advanceGait(gait, { distance: STEP_STRIDE * 10, dt: FRAME, onGround: true }), GAIT_MAX_STEPS);
    assert.equal(GAIT_MAX_STEPS, 2, 'no máximo dois, escrito à mão');
    assert.equal(gait.distance, 0, 'o excedente é descartado, não fica para depois');
});

test('a fase fecha a volta exatamente no passo', () => {
    const gait = createGait();
    assert.equal(gaitPhase(gait), 0);
    advanceGait(gait, { distance: STEP_STRIDE / 2, dt: FRAME, onGround: true });
    assert.ok(Math.abs(gaitPhase(gait) - Math.PI) < 1e-9, 'meia passada = π');
    const passos = advanceGait(gait, { distance: STEP_STRIDE / 2, dt: FRAME, onGround: true });
    assert.equal(passos, 1, 'e ali o passo soa');
    assert.ok(Math.abs(gaitPhase(gait)) < 1e-9, 'a fase volta a zero, sem degrau');
});

// ------------------------------------------------ a pose

test('no passo o corpo está no ponto baixo, e o balanço nunca sobe acima do olho', () => {
    // Estado explícito (distância dentro da passada + amplitude cheia): a pose é
    // função pura dos dois, então o número é exato.
    const noPasso = gaitPose({ distance: 0, amplitude: 1 });
    assert.ok(Math.abs(noPasso.bobY + GAIT_BOB_Y) < 1e-9, `no passo desce ${GAIT_BOB_Y} m (${noPasso.bobY})`);
    assert.ok(Math.abs(noPasso.sway) < 1e-9, 'e o corpo está reto: sem vai e vem no instante do passo');
    assert.ok(Math.abs(noPasso.roll) < 1e-9, 'e o horizonte também está reto');

    // Meia passada depois: o ponto mais alto, no nível do olho.
    const noAlto = gaitPose({ distance: STEP_STRIDE / 2, amplitude: 1 });
    assert.ok(Math.abs(noAlto.bobY) < 1e-9, 'no alto o corpo volta ao nível do olho');
    assert.ok(Math.abs(noAlto.sway) < 1e-9, 'e o vai e vem cruza o zero de novo');

    // Varrendo a passada inteira: nunca sobe acima do olho e nunca passa do
    // vai e vem previsto.
    for (let i = 0; i < 120; i++) {
        const pose = gaitPose({ distance: (STEP_STRIDE * i) / 120, amplitude: 1 });
        assert.ok(pose.bobY <= 1e-9, `o balanço só desce (${pose.bobY})`);
        assert.ok(pose.bobY >= -GAIT_BOB_Y - 1e-9, `no máximo ${GAIT_BOB_Y} m para baixo`);
        assert.ok(Math.abs(pose.sway) <= GAIT_BOB_X + 1e-9, `lateral até ${GAIT_BOB_X} m`);
        assert.ok(Math.abs(pose.roll) <= GAIT_ROLL + 1e-9, 'microinclinação até o limite');
    }
});

test('as intensidades escolhidas: 5 cm para baixo, 3 cm de lado, ~0,3° de rolagem', () => {
    assert.equal(GAIT_BOB_Y, 0.05);
    assert.equal(GAIT_BOB_X, 0.03);
    // 0,0055 rad em graus: ~0,32°.
    assert.ok(Math.abs(GAIT_ROLL * 180 / Math.PI - 0.32) < 0.02, `${GAIT_ROLL * 180 / Math.PI}°`);
    assert.ok(GAIT_BOB_Y < 0.1 && GAIT_BOB_X < 0.05, 'é balanço sutil, não um barco');
});

test('a pose é periódica e escala com a amplitude', () => {
    const p0 = gaitPose({ distance: 0, amplitude: 1 });
    const p1 = gaitPose({ distance: STEP_STRIDE, amplitude: 1 });
    assert.ok(Math.abs(p0.bobY - p1.bobY) < 1e-9, 'um passo depois, a mesma pose');
    assert.ok(Math.abs(p0.sway - p1.sway) < 1e-9);

    // E a volta da fase, andando de verdade, cai no mesmo lugar.
    const gait = createGait();
    andar(gait, STEP_STRIDE * 2);
    const depois = gaitPose(gait);
    assert.ok(Math.abs(depois.bobY + GAIT_BOB_Y * gait.amplitude) < 1e-9, 'a fase volta ao passo');

    const meia = { distance: STEP_STRIDE, amplitude: 0.5 };
    const pose = gaitPose(meia);
    assert.ok(Math.abs(pose.bobY + GAIT_BOB_Y * 0.5) < 1e-9, 'metade da amplitude, metade do balanço');

    const parada = { distance: STEP_STRIDE, amplitude: 0 };
    const zero = gaitPose(parada);
    // Sem amplitude a pose é zero (o `-0` do cosseno também conta como zero).
    for (const [nome, valor] of Object.entries({ bobY: zero.bobY, sway: zero.sway, roll: zero.roll })) {
        assert.ok(Math.abs(valor) < 1e-12, `sem amplitude, ${nome} fica parado (${valor})`);
    }
});

test('o braço lê a mesma fase: desce no passo e vai e vem com ele', () => {
    const gait = createGait();
    andar(gait, STEP_STRIDE, { velocidade: 60 });
    const noPasso = gaitPose(gait);
    assert.ok(Math.abs(noPasso.handY + 1) < 1e-9, 'no passo o braço está no ponto baixo');

    advanceGait(gait, { distance: STEP_STRIDE / 4, dt: FRAME, onGround: true });
    const noQuarto = gaitPose(gait);
    assert.ok(Math.abs(noQuarto.handX - 1) < 1e-9, 'no quarto de passada ele está todo para um lado');
    assert.ok(Math.abs(noQuarto.handY + 0.5) < 1e-9, 'e na metade da descida');
});

test('o balanço entra e sai suave: nenhum quadro dá um pulo', () => {
    const gait = createGait();
    // Começando a andar, a amplitude sobe aos poucos (não salta para 1).
    const primeiro = advanceGait(gait, { distance: 0.07, dt: FRAME, onGround: true });
    assert.equal(primeiro, 0);
    assert.ok(gait.amplitude > 0 && gait.amplitude < 0.2, `primeiro quadro: ${gait.amplitude}`);
    assert.ok(GAIT_FADE * FRAME <= 0.2, 'a suavização é lenta o bastante para não dar tranco');

    // Andando um tempo, chega a 1.
    andar(gait, STEP_STRIDE * 3);
    assert.ok(Math.abs(gait.amplitude - 1) < 1e-3, `depois de andar, amplitude ${gait.amplitude}`);

    // Parou: a amplitude cai aos poucos, sem zerar de um quadro para o outro.
    advanceGait(gait, { distance: 0, dt: FRAME, onGround: true });
    assert.ok(gait.amplitude > 0.8, 'parar não corta o balanço de uma vez');
    for (let i = 0; i < 120; i++) advanceGait(gait, { distance: 0, dt: FRAME, onGround: true });
    assert.equal(gait.amplitude, 0, 'parado, o balanço some de vez');
});

test('quanto balança em cada situação: chão, corrida, água e agachado', () => {
    assert.equal(gaitAmplitudeFor({ onGround: true }), 1);
    assert.equal(gaitAmplitudeFor({ onGround: false }), 0, 'no ar não balança');
    assert.equal(gaitAmplitudeFor({ onGround: false, inWater: true }), GAIT_SWIM_SCALE, 'nadando, menos');
    assert.equal(gaitAmplitudeFor({ onGround: true, crouching: true }), GAIT_CROUCH_SCALE, 'agachado, menos');
    assert.equal(gaitAmplitudeFor({ onGround: true, sprinting: true }), GAIT_SPRINT_SCALE, 'correndo, mais');
    assert.ok(GAIT_SWIM_SCALE < 1 && GAIT_CROUCH_SCALE < 1 && GAIT_SPRINT_SCALE > 1);

    // No ar a amplitude vai a zero: a fase até pode andar, mas não aparece (o
    // pulo tem o próprio desenho).
    const gait = createGait();
    for (let i = 0; i < 60; i++) advanceGait(gait, { distance: 0.07, dt: FRAME, onGround: false });
    assert.equal(gait.amplitude, 0);
    const arejado = gaitPose(gait);
    assert.ok(Math.abs(arejado.bobY) < 1e-12);
    assert.ok(Math.abs(arejado.sway) < 1e-12);
});

// ------------------------------------------------ a ligação no jogo

test('game.js lê a passada para o balanço, o braço e o som', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /import \{ advanceGait, createGait, gaitPose \} from '\.\/world-gait\.js'/);
    assert.match(source, /const gait = createGait\(\)/);
    assert.doesNotMatch(source, /bobTimer/, 'o cronômetro paralelo do braço saiu de cena');

    // Câmera: desce, vai de lado e inclina, sempre pela pose da passada.
    assert.match(source, /const pose = gaitPose\(gait\)/);
    assert.match(source, /camera\.position\.addScaledVector\(cameraRight, pose\.sway\)/);
    assert.match(source, /camera\.position\.y \+= pose\.bobY/);
    assert.match(source, /lookEuler\.set\(look\.pitch, look\.yaw, gaitPose\(gait\)\.roll, 'YXZ'\)/);
    // Braço e som na mesma fase.
    assert.match(source, /const gaitNow = gaitPose\(gait\)/);
    assert.match(source, /gaitNow\.handX \* 0\.012 \* ba/);
    assert.match(source, /gaitNow\.handY \* 0\.010 \* ba/);
    assert.match(source, /const passos = updateGait\(dt, inWater\)/);
    assert.match(source, /return pisa > 0 \? passos : 0/, 'o som do passo só com o pé no chão');
    assert.match(source, /playFootsteps\(passos\)/);
});
