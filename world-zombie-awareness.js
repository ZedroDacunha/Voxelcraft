// Alcance inicial inspirado no zumbi da Bedrock; não controla perseguição.
export const ZOMBIE_NOTICE_RADIUS = 16; // blocos, distância tridimensional

// O chamador deve calcular a distância e testar a linha de visão no mundo.
// Modo criativo e jogador morto não são alvos. A perda de alvo e a memória da
// perseguição serão tratadas separadamente quando o mob for integrado.
export function zombieNoticesPlayer({ distance, hasLineOfSight, creative = false, dead = false } = {}) {
    return Number.isFinite(distance) && distance >= 0 && distance <= ZOMBIE_NOTICE_RADIUS &&
        hasLineOfSight === true && !creative && !dead;
}
