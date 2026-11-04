// Cachoeira: o som contínuo que depende do **lugar**.
//
// Vento e grilos são ambiente (fases sorteadas, existem em qualquer canto).
// Cachoeira não: ela só existe onde há água caindo, e o volume é a distância —
// quem está longe não ouve, quem está embaixo ouve alto. Por isso ela é um laço
// próprio, ligado e desligado pelo que está em volta do jogador, com histerese
// para não piscar quando o jogador anda na borda do alcance.
//
// Este módulo é só a decisão (puro, sem Three e sem áudio): procurar água
// caindo perto, transformar o achado em ganho e suavizar a transição. O áudio
// (world-audio.js) toca o laço; o jogo liga os dois.
import { BLOCKS } from './world-catalog.js';

/** Caixa da busca em volta do jogador, em blocos. */
export const WATERFALL_SCAN_RANGE = 10;
/** Para cima: a água cai de cima, então vale olhar bem mais alto que largo. */
export const WATERFALL_SCAN_UP = 12;
/** Para baixo: o pé da queda fica abaixo de quem está na beirada. */
export const WATERFALL_SCAN_DOWN = 6;
/** Acima desta distância (blocos) a cachoeira não é mais audível. */
export const WATERFALL_AUDIBLE = 16;
/** Teto do ganho: a cachoeira é fundo, não pode engolir o resto do jogo. */
export const WATERFALL_MAX_GAIN = 0.55;
/** Abaixo disso é ruído de fundo, não vale a pena tocar. */
export const WATERFALL_MIN_GAIN = 0.02;

/** Histerese e fades do laço (segundos). */
export const WATERFALL_START_GAIN = 0.05;
export const WATERFALL_STOP_GAIN = 0.02;
export const WATERFALL_ATTACK_SECONDS = 0.5;
export const WATERFALL_RELEASE_SECONDS = 1.1;

/** O bloco é água caindo? (as correntes horizontais não fazem barulho de queda) */
export function isFallingWater(blockType) {
    return BLOCKS[blockType]?.falling === true;
}

/**
 * Procura água caindo em volta do ponto e devolve o que importa para o som:
 *
 * - `columns`: quantas colunas distintas (x,z) têm queda — uma queda larga tem
 *   mais água caindo que um fio;
 * - `height`: a maior sequência vertical encontrada — uma parede de água de 8
 *   blocos é outra coisa que um degrau de 1;
 * - `distance`: a célula de água caindo mais próxima do jogador (3D).
 *
 * Sem nada por perto devolve `{ columns: 0, height: 0, distance: Infinity }`.
 */
export function scanWaterfall(world, pos, {
    range = WATERFALL_SCAN_RANGE,
    up = WATERFALL_SCAN_UP,
    down = WATERFALL_SCAN_DOWN,
} = {}) {
    const empty = { columns: 0, height: 0, distance: Infinity };
    if (!world || !pos) return empty;
    const px = Math.floor(pos.x), py = Math.floor(pos.y), pz = Math.floor(pos.z);
    const columns = new Set();
    let tallest = 0;
    let distance = Infinity;
    for (let x = px - range; x <= px + range; x++) {
        for (let z = pz - range; z <= pz + range; z++) {
            // De cima para baixo: assim a sequência vertical é contada na ordem
            // em que a água realmente cai.
            let run = 0;
            for (let y = py + up; y >= py - down; y--) {
                if (!isFallingWater(world.getBlock(x, y, z))) { run = 0; continue; }
                run += 1;
                columns.add(`${x},${z}`);
                if (run > tallest) tallest = run;
                const d = Math.hypot(x + 0.5 - pos.x, y + 0.5 - pos.y, z + 0.5 - pos.z);
                if (d < distance) distance = d;
            }
        }
    }
    return { columns: columns.size, height: tallest, distance };
}

/**
 * Ganho (0 a ~0,55) que a cachoeira encontrada merece.
 *
 * Cresce devagar com o tamanho (log2 de colunas × altura, saturado em 4×3) e
 * cai linearmente com a distância até o alcance. Ganho abaixo do piso vira 0:
 * melhor silêncio do que um chiado que o jogador não sabe de onde vem.
 */
export function waterfallGain({ columns = 0, height = 0, distance = Infinity } = {}) {
    const cols = Number(columns), tall = Number(height), dist = Number(distance);
    if (!(cols > 0) || !(tall > 0)) return 0;
    if (!Number.isFinite(dist) || dist > WATERFALL_AUDIBLE) return 0;
    const size = Math.min(1, Math.log2(cols * tall + 1) / Math.log2(13));
    const closeness = Math.max(0, 1 - Math.max(0, dist) / WATERFALL_AUDIBLE);
    const gain = WATERFALL_MAX_GAIN * (0.35 + 0.65 * size) * closeness;
    if (gain < WATERFALL_MIN_GAIN) return 0;
    return Math.min(WATERFALL_MAX_GAIN, gain);
}

/** Quanto tempo o laço fica aberto antes de poder fechar (segundos). */
export const WATERFALL_MIN_ACTIVE_SECONDS = 0.3;

/** Estado do laço da cachoeira (o áudio só obedece ao ganho devolvido). */
export function createWaterfallSoundState() {
    return { active: false, gain: 0, age: 0 };
}

/**
 * Passo do laço: suaviza o ganho em direção ao alvo e abre/fecha o som com
 * histerese (liga em 0,05, desliga em 0,02 — sem piscar no vaivém da beirada).
 *
 * Devolve `{ action, gain }`, com `action` = `'start'`, `'update'`, `'stop'` ou
 * `null` (nada tocando e nada para tocar).
 */
export function updateWaterfallSound(state, target = 0, dt = 0) {
    const wanted = Number(target);
    const goal = Number.isFinite(wanted) ? Math.max(0, wanted) : 0;
    const step = Number(dt);
    const elapsed = Number.isFinite(step) && step > 0 ? step : 0;

    // Rampa linear: o ganho atravessa a faixa inteira no tempo da constante, e
    // **chega** ao alvo (aproximação exponencial nunca chega e nunca fecha).
    const approach = (destination, seconds) => {
        if (elapsed <= 0) return;
        const stepSize = elapsed / seconds;
        const delta = destination - state.gain;
        if (Math.abs(delta) <= stepSize) state.gain = destination;
        else state.gain += Math.sign(delta) * stepSize;
    };

    if (!state.active) {
        if (goal < WATERFALL_START_GAIN) return { action: null, gain: 0 };
        state.active = true;
        state.gain = 0;
        state.age = 0;
        approach(goal, WATERFALL_ATTACK_SECONDS);
        return { action: 'start', gain: state.gain };
    }

    state.age += elapsed;
    approach(goal, goal > state.gain ? WATERFALL_ATTACK_SECONDS : WATERFALL_RELEASE_SECONDS);

    // Só fecha com a cachoeira realmente fora de alcance (abaixo do piso de
    // parada), depois de já ter tocado um instante e com o ganho no chão: no
    // vaivém da beirada do alcance o som fica, não pisca.
    if (goal < WATERFALL_STOP_GAIN
        && state.age >= WATERFALL_MIN_ACTIVE_SECONDS
        && state.gain <= WATERFALL_STOP_GAIN) {
        state.active = false;
        state.gain = 0;
        state.age = 0;
        return { action: 'stop', gain: 0 };
    }
    return { action: 'update', gain: state.gain };
}
