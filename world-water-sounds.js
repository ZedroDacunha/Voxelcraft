// Sons da água: entrar, sair, submergir e a braçada.
//
// A água não tem laço contínuo de propósito: fluxo constante em loop cansa em
// dois minutos. O que informa é a **transição** — o corpo batendo na superfície
// e o barulho abafado de ficar embaixo d'água.

// Queda (m/s) a partir da qual o splash já é o mais forte possível.
export const SPLASH_MAX_FALL_SPEED = 12;

// Ganho do splash conforme a velocidade da queda: entrar caminhando num
// lago raso é bem mais discreto que despencar 10 blocos.
export function splashGain(fallSpeed = 0) {
    // velocidade inválida (NaN) não pode virar ganho NaN: sem som, sem erro
    const speed = Number(fallSpeed);
    const magnitude = Number.isFinite(speed)
        ? Math.min(SPLASH_MAX_FALL_SPEED, Math.max(0, Math.abs(speed)))
        : 0;
    return 0.7 + (magnitude / SPLASH_MAX_FALL_SPEED) * 0.8;
}

export function createWaterAudioState() {
    return { inWater: false, submerged: false };
}

// Som da transição deste quadro, ou null. A ordem importa:
// 1. entrar na água (pé/molho inteiro) vence — o splash cobre o mergulho;
// 2. sair da água;
// 3. só a cabeça afundou (nadando na superfície e mergulhando).
export function waterSoundFor(state, { inWater = false, headInWater = false, fallSpeed = 0 } = {}) {
    const wasInWater = state.inWater;
    const wasSubmerged = state.submerged;
    state.inWater = Boolean(inWater);
    state.submerged = Boolean(headInWater);

    if (state.inWater && !wasInWater) {
        return { name: 'water-splash', gainScale: splashGain(fallSpeed) };
    }
    if (!state.inWater && wasInWater) {
        return { name: 'water-exit', gainScale: 1 };
    }
    if (state.submerged && !wasSubmerged) {
        return { name: 'water-dive', gainScale: 1 };
    }
    return null;
}
