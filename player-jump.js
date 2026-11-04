// Janela do "pulo tardio" (coyote time): o direito de pular por um instante
// depois de o pé já ter saído do chão.
//
// Sem isso, sair da borda e apertar o pulo uma fração de segundo depois não faz
// nada — e o jogador culpa o jogo, não o reflexo. É o ajuste clássico de pulo em
// plataforma, e cabe numa regra de tempo só, sem estado global: quem chama
// guarda o `state` e diz a cada quadro se o corpo está apoiado.
//
// Nada aqui conhece Three, mundo ou jogador: só a janela.

/** Quanto tempo depois de sair do chão ainda vale pular (segundos). */
export const COYOTE_TIME = 0.12;

/**
 * Estado da janela. Começa **fechada** de propósito: quem nasce ou cai não ganha
 * um pulo de graça no primeiro quadro.
 */
export function createJumpState() {
    return { coyoteLeft: 0 };
}

/**
 * Atualiza a janela no fim do quadro, quando o apoio no chão já é conhecido.
 *
 * - `jumped`: acabou de pular → fecha (nada de pulo duplo);
 * - `inWater`: nadar tem regra própria → fecha;
 * - `onGround`: pé no chão → recarrega a janela inteira;
 * - senão: escorre com o tempo do quadro, sem ficar negativa.
 */
export function updateJumpWindow(state, { dt = 0, onGround = false, jumped = false, inWater = false } = {}) {
    if (jumped || inWater) {
        state.coyoteLeft = 0;
        return state.coyoteLeft;
    }
    if (onGround) {
        state.coyoteLeft = COYOTE_TIME;
        return state.coyoteLeft;
    }
    const elapsed = Number(dt);
    if (Number.isFinite(elapsed) && elapsed > 0) {
        state.coyoteLeft = Math.max(0, state.coyoteLeft - elapsed);
    }
    return state.coyoteLeft;
}

/** Dá para pular agora: no chão, ou ainda dentro da janela do pulo tardio. */
export function canJumpFrom(state, { onGround = false } = {}) {
    return Boolean(onGround) || state.coyoteLeft > 0;
}
