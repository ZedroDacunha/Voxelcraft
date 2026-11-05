/**
 * Vento: uma direção só, uma intensidade que vem do ambiente.
 *
 * O áudio já tinha vento (`world-ambient-sounds.js`): fases de 15–32 s, mais
 * fortes no alto. Faltava o **visual** — o capim era uma placa estática, e um
 * mundo onde o som diz "está ventando" e nada se mexe é um mundo com metade da
 * informação.
 *
 * Aqui mora o que o vento é, em números testáveis:
 *
 * - **direção**: uma por mundo (sorteada da semente), não muda de fase em fase —
 *   vento que troca de lado a cada rajada parece tremor, não vento;
 * - **intensidade**: segue as fases do áudio (o que o jogador **ouve** é o que
 *   ele **vê**), com subida e descida suaves para a troca de fase não dar um
 *   salto no capim;
 * - **balanço**: a curva que o vertex shader aplica a cada tufo, de raiz presa
 *   e ponta solta.
 *
 * O pó do Mofim vai beber da mesma direção/intensidade — por isso a direção é
 * exportada à parte, e não escondida dentro do shader.
 */

import { hash2 } from './world-math.js';

/** Segundos até o vento "chegar" quando a fase começa. */
export const WIND_ATTACK = 1.6;
/** Segundos até assentar quando a fase acaba — sair de cena é mais lento que entrar. */
export const WIND_RELEASE = 2.6;

/**
 * Amplitude do balanço (unidades do modelo).
 *
 * No tufo alto (~0,78) isso dá ~5% da altura com o vento calado e ~20% com o
 * vento de fase — o suficiente para ler o movimento sem o capim deitar no chão.
 */
export const WIND_SWAY_IDLE = 0.04;
export const WIND_SWAY_FULL = 0.16;

const clamp01 = value => Math.min(1, Math.max(0, Number(value) || 0));

/**
 * Direção do vento de um mundo — vetor unitário no plano XZ.
 *
 * Sai da semente: cada mundo tem o seu, e ele não muda no meio do jogo.
 */
export function windDirectionFor(seed = 0) {
    const angle = hash2(Number(seed) || 0, 0, 9137) * Math.PI * 2;
    return { x: Math.cos(angle), z: Math.sin(angle) };
}

/**
 * Quanto o vento deve soprar, a partir dos ganhos do ambiente.
 *
 * O ganho já vem multiplicado pela disponibilidade do lugar (cume venta mais que
 * vale), então aqui só se recorta em 0..1. Fase de grilos ou silêncio manda 0.
 */
export function windTargetFor(levels = {}) {
    return clamp01(levels?.wind);
}

/**
 * Aproxima a intensidade do alvo, com rampa.
 *
 * Sem rampa, o fim de uma fase de vento faria o capim **parar de um quadro para
 * o outro** — o olho pega isso na hora. Subir é rápido (o vento chega), descer é
 * mais lento (o ar assenta).
 */
export function windStep(current, target, dt, {
    attack = WIND_ATTACK,
    release = WIND_RELEASE,
} = {}) {
    const now = clamp01(current);
    const goal = clamp01(target);
    const step = Number(dt);
    if (!(step > 0) || now === goal) return now;
    const seconds = goal > now ? Number(attack) : Number(release);
    if (!(seconds > 0)) return goal;
    const rate = step / seconds;
    const distance = Math.abs(goal - now);
    const applied = Math.min(distance, rate);
    return clamp01(now + Math.sign(goal - now) * applied);
}

/** Amplitude do balanço para uma intensidade (0..1) — nunca zero: o ar respira. */
export function windSwayAmount(level) {
    return WIND_SWAY_IDLE + (WIND_SWAY_FULL - WIND_SWAY_IDLE) * clamp01(level);
}

/**
 * Faz um material de capim balançar com o vento.
 *
 * O truque é o mesmo do tremular da tocha (`world-lighting-effects.js`): mexer
 * no vertex shader pelo `onBeforeCompile`, sem trocar o material.
 *
 * Duas decisões que não são óbvias:
 *
 * - **raiz presa, ponta solta**: o deslocamento cresce com `uv.y²`, e a placa de
 *   capim tem uv 0 na base e 1 no topo. Sem isso o tufo deslizaria inteiro pelo
 *   chão em vez de vergar.
 * - **vento em espaço de mundo**: cada tufo é uma instância girada para um lado
 *   aleatório. Empurrar em `transformed.x` faria cada um ir para uma direção
 *   diferente (o vento pareceria aleatório). Por isso a direção do mundo é
 *   convertida para o espaço local **daquela** instância, projetando nas colunas
 *   0 e 2 da matriz (os eixos X e Z locais).
 *
 * Instâncias que não sejam do mundo (o tufo na mão do jogador) ficam paradas:
 * o `#ifdef USE_INSTANCING` cobre isso.
 */
export function configureWindSway(material, { direction = { x: 1, z: 0 } } = {}) {
    if (!material) return;
    const dir = { x: Number(direction?.x) || 0, z: Number(direction?.z) || 0 };
    material.onBeforeCompile = shader => {
        shader.uniforms.uWindTime = { value: 0 };
        shader.uniforms.uWindSway = { value: WIND_SWAY_IDLE };
        shader.uniforms.uWindDir = { value: { x: dir.x, y: dir.z } };
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            '#include <common>\nuniform float uWindTime;\nuniform float uWindSway;\nuniform vec2 uWindDir;'
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
#ifdef USE_INSTANCING
    // Fase por tufo: vem da posição da instância, para dois vizinhos não baterem
    // asa no mesmo compasso.
    float windPhase = dot(instanceMatrix[3].xz, vec2(1.7, 2.3));
    // Empurrão sempre no mesmo sentido, com a força pulsando (rajada) e um
    // tremelizinho curto por cima — vento sopra, não vibra.
    float windPush = 0.75 + 0.25 * sin(uWindTime * 1.15 + windPhase);
    float windFlutter = 0.16 * sin(uWindTime * 3.6 + windPhase * 2.1);
    float windBend = uv.y * uv.y * (0.35 + position.y) * (windPush + windFlutter) * uWindSway;
    vec3 windWorld = vec3(uWindDir.x, 0.0, uWindDir.y);
    vec3 windLocal = vec3(dot(instanceMatrix[0].xyz, windWorld), 0.0, dot(instanceMatrix[2].xyz, windWorld));
    transformed += windLocal * windBend;
#endif`
        );
        material.userData.windShader = shader;
    };
    material.customProgramCacheKey = () => 'voxel-grass-wind-v1';
}

/** Um passo por quadro: entrega tempo e intensidade para os materiais do capim. */
export function updateWindSway(materials, time, level) {
    const seconds = Number(time);
    const amount = windSwayAmount(level);
    for (const material of materials ?? []) {
        const shader = material?.userData?.windShader;
        if (!shader) continue;
        shader.uniforms.uWindTime.value = Number.isFinite(seconds) ? seconds : 0;
        shader.uniforms.uWindSway.value = amount;
    }
}
