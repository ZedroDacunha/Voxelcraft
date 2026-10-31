// Regras puras de sobrevivência (fome e causa da morte).
//
// Ficam separadas do `game.js` porque são só aritmética sobre números: dá para
// testar fome, carência e título da tela de morte sem DOM, sem three.js e sem
// mundo carregado.
//
// Contexto: a fome zerada não matava nem avisava nada. O `game.js` danificava o
// jogador a cada 4 s, mas parava em 1 de vida (`if (health > 1)`), então o jogo
// ficava num limbo: sem vida, sem regeneração e sem nenhum aviso na tela.

/** Fome máxima (mesma constante de `world-save-settings.js`). */
export const HUNGER_MAX = 20;

/** Fome mínima para a vida regenerar sozinha. */
export const HUNGER_REGEN_MIN = 18;

/** A partir daqui a barra de fome avisa que está baixa. */
export const HUNGER_LOW = 6;

/** Segundos entre cada ponto de dano da fome zerada. */
export const STARVE_INTERVAL = 4;

/** Quanto de vida cada tique de inanição tira. */
export const STARVE_DAMAGE = 1;

/** Avisos mostrados quando a fome muda de faixa. */
export const HUNGER_WARNINGS = {
    low: 'Fome baixa — coma algo antes que acabe.',
    empty: 'Você está morrendo de fome! Coma agora.',
};

/** Títulos da tela de morte por causa. */
export const DEATH_CAUSES = {
    starve: 'Você morreu de fome',
    drown: 'Você morreu afogado',
    fall: 'Você morreu de queda',
    generic: 'Você morreu',
};

/**
 * Faixa da fome: `ok`, `low` (aviso) ou `empty` (dano contínuo).
 * @param {number} hunger
 * @returns {'ok' | 'low' | 'empty'}
 */
export function hungerStage(hunger) {
    if (!(hunger > 0)) return 'empty';
    if (hunger <= HUNGER_LOW) return 'low';
    return 'ok';
}

/**
 * Título da tela de morte para a origem do dano.
 * Origens desconhecidas caem no texto genérico.
 * @param {string} source
 * @returns {string}
 */
export function deathTitle(source) {
    return DEATH_CAUSES[source] || DEATH_CAUSES.generic;
}

/**
 * Avança o relógio da inanição.
 *
 * - Com fome > 0 o relógio zera (comer/regenerar cancela a contagem).
 * - Com fome zerada acumula `dt` e devolve dano a cada `STARVE_INTERVAL`.
 * - No máximo um tique por chamada: um quadro longo (aba em segundo plano) não
 *   pode virar uma rajada de dano e matar o jogador de uma vez.
 *
 * @param {{ hunger: number, timer?: number, dt?: number }} state
 * @returns {{ timer: number, damage: number }}
 */
export function advanceStarvation({ hunger, timer = 0, dt = 0 } = {}) {
    if (hunger > 0) return { timer: 0, damage: 0 };
    const elapsed = timer + Math.max(0, dt);
    if (elapsed < STARVE_INTERVAL) return { timer: elapsed, damage: 0 };
    return { timer: 0, damage: STARVE_DAMAGE };
}
