// A CAMA, PARTE 2: dormir e renascer nela.
//
// Aqui ficam só as **regras** (sem THREE, sem DOM): a hora em que dá para
// dormir, a linha do tempo da dormida (deitar → escuro → acordar) e onde o
// corpo aparece quando acorda — em cima do colchão. O jogo cuida do resto
// (câmera, tela escura, relógio do mundo).
import { BED_COLLISION_HEIGHT } from './world-bed.js';

/**
 * Noite a partir da qual a cama aceita.
 *
 * A conta da noite é a mesma do resto do jogo — `noite = 1 - dia do céu`, e o
 * Mofim já usa `dia < 0,35` para dizer que anoiteceu. Dormir só vale com o céu
 * **escuro de verdade** (0,65 de noite): no crepúsculo, com o sol ainda no
 * horizonte, ainda é dia para quem está jogando.
 */
export const SLEEP_NIGHT_THRESHOLD = 0.65;

export function canSleepAt(night) {
    return Number.isFinite(night) && night >= SLEEP_NIGHT_THRESHOLD;
}

/** Hora em que o jogador acorda: 0 é o amanhecer no relógio do jogo (06:00). */
export const DAWN_TIME = 0;

/**
 * A dormida em três tempos, em segundos: deitar (a tela escurece enquanto a
 * câmera desce até o travesseiro), escuro (a noite passa) e acordar (a tela
 * clareia). Os três somam a dormida inteira.
 */
export const SLEEP_TIMING = Object.freeze({ lie: 1.1, black: 0.85, wake: 0.9 });
export const SLEEP_TOTAL = SLEEP_TIMING.lie + SLEEP_TIMING.black + SLEEP_TIMING.wake;

/**
 * Em que ponto da dormida estamos, dado o tempo decorrido.
 *
 * Devolve a fase (`lie`, `sleep`, `wake` ou `done`), o `fade` da tela (0 = jogo
 * visível, 1 = preto) e `changed`: o instante em que a noite já passou e o
 * jogador pode ser movido — é o **começo do escuro**, não o fim, para o corpo
 * aparecer em pé na cama antes de a tela clarear.
 */
export function sleepPhaseAt(seconds) {
    const t = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const { lie, black, wake } = SLEEP_TIMING;
    if (t < lie) return { phase: 'lie', fade: t / lie, changed: false, done: false };
    if (t < lie + black) return { phase: 'sleep', fade: 1, changed: true, done: false };
    if (t < lie + black + wake) return { phase: 'wake', fade: 1 - (t - lie - black) / wake, changed: true, done: false };
    return { phase: 'done', fade: 0, changed: true, done: true };
}

/**
 * Onde o jogador aparece ao acordar (e ao renascer): no meio da cama, em pé
 * **em cima do colchão**. A altura é a mesma da colisão (9/16), então o corpo
 * fica apoiado na cama em vez de flutuar ou afundar nela.
 */
export function bedRespawnPoint(cell) {
    if (!cell || ![cell.x, cell.y, cell.z].every(Number.isFinite)) return null;
    return { x: cell.x + 0.5, y: cell.y + BED_COLLISION_HEIGHT, z: cell.z + 0.5 };
}
