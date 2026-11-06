// Passada do jogador: **uma** cadência para o som do passo, o braço e o
// balanço da visão.
//
// Antes cada coisa tinha o seu relógio: o som andava pela distância
// (`world-step-sounds.js`), o braço por um cronômetro paralelo que subia com a
// velocidade (`bobTimer`) e a câmera não balançava. Dava para ouvir o passo e
// ver a mão fora de fase — e nada garantia que voltassem a casar.
//
// Aqui a fase anda pela **distância real andada** e o passo acontece quando ela
// fecha uma volta (`STEP_STRIDE` metros). Quem quiser saber onde o corpo está na
// passada lê essa fase: o pé toca o chão exatamente no ponto baixo do balanço e
// no extremo do braço. Sincronia por construção, não por ajuste fino.
//
// Tudo puro (sem THREE, sem áudio, sem relógio de verdade): o teste cobre o
// número de passos, a fase e a pose sem navegador.
import { STEP_STRIDE } from './world-step-sounds.js';

/** Quanto o corpo desce no passo, em metros (bem sutil: 5 cm). */
export const GAIT_BOB_Y = 0.05;
/** Vai e vem lateral, em metros (3 cm para cada lado). */
export const GAIT_BOB_X = 0.03;
/** Microinclinação do horizonte, em radianos (~0,32°). */
export const GAIT_ROLL = 0.0055;
/** Quão rápido o balanço entra e sai (1/s): devagar = suave, sem tranco. */
export const GAIT_FADE = 6;
/** Nadando o corpo balança menos (a água segura o passo). */
export const GAIT_SWIM_SCALE = 0.7;
/** Agachado é um andar miúdo: menos balanço. */
export const GAIT_CROUCH_SCALE = 0.6;
/** Correndo o corpo joga mais — mas só um pouco mais. */
export const GAIT_SPRINT_SCALE = 1.25;
/** Um quadro engasgado não pode virar rajada de passos (mesmo limite do som). */
export const GAIT_MAX_STEPS = 2;
const TWO_PI = Math.PI * 2;

export function createGait() {
    // `distance` é o quanto já andou **dentro** da passada atual (0..STRIDE);
    // é ele que dá a fase. `amplitude` é o quanto o balanço está ligado (0..1+).
    return { distance: 0, amplitude: 0 };
}

/**
 * Quanto o corpo deve balançar nesta situação (antes da suavização).
 *
 * Parado é zero — quem manda nisso é o `distance` em `advanceGait`. No ar
 * também: o pulo tem o próprio desenho, e somar balanço de caminhada em cima
 * dele faz a câmera tremer sem motivo.
 */
export function gaitAmplitudeFor({ onGround = false, inWater = false, sprinting = false, crouching = false } = {}) {
    if (!onGround && !inWater) return 0;
    let value = 1;
    if (inWater) value *= GAIT_SWIM_SCALE;
    if (crouching) value *= GAIT_CROUCH_SCALE;
    if (sprinting && !inWater && !crouching) value *= GAIT_SPRINT_SCALE;
    return value;
}

/** A fase da passada em radianos (0 no passo, π no meio, 2π = próximo passo). */
export function gaitPhase(gait) {
    const distance = Number(gait?.distance) || 0;
    return (distance / STEP_STRIDE) * TWO_PI;
}

/**
 * Avança a passada no quadro e devolve **quantos passos** aconteceram (para o
 * som). A amplitude entra e sai suave, então parar de andar não corta o balanço
 * de um quadro para o outro.
 */
export function advanceGait(gait, {
    distance = 0, dt = 0, onGround = false, inWater = false, sprinting = false, crouching = false,
} = {}) {
    const moved = Number(distance);
    const andando = Number.isFinite(moved) && moved > 0;
    const target = andando ? gaitAmplitudeFor({ onGround, inWater, sprinting, crouching }) : 0;
    const passo = Math.min(1, GAIT_FADE * Math.max(0, Number(dt) || 0));
    gait.amplitude += (target - gait.amplitude) * passo;
    if (Math.abs(gait.amplitude) < 1e-4) gait.amplitude = 0;
    if (!andando) return 0;

    gait.distance += moved;
    let steps = 0;
    while (gait.distance >= STEP_STRIDE && steps < GAIT_MAX_STEPS) {
        gait.distance -= STEP_STRIDE;
        steps++;
    }
    // Queda de FPS: o excedente é descartado em vez de sair atrasado depois.
    if (gait.distance >= STEP_STRIDE) gait.distance = 0;
    return steps;
}

/**
 * Onde o corpo está na passada.
 *
 * O passo (fase 0) é o ponto **baixo**: o pé bate no chão no fundo do balanço.
 * O vai e vem lateral e a microinclinação cruzam o zero ali — é o instante em
 * que o corpo está reto, com o peso no pé que acabou de tocar.
 */
export function gaitPose(gait) {
    const phase = gaitPhase(gait);
    const amplitude = Math.max(0, Number(gait?.amplitude) || 0);
    // 1 no passo (fase 0) e 0 no alto (meia passada): o pé bate no chão no fundo
    // do balanço, e o cosseno não tem degrau na emenda da volta.
    const dip = 0.5 + 0.5 * Math.cos(phase);
    const sway = Math.sin(phase);
    return {
        phase,
        amplitude,
        bobY: -GAIT_BOB_Y * amplitude * dip,
        sway: GAIT_BOB_X * amplitude * sway,
        roll: GAIT_ROLL * amplitude * sway,
        // O braço lê a mesma fase: desce junto com o corpo no passo.
        handX: sway,
        handY: -dip,
    };
}
