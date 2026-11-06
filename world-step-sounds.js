// Passos: qual som toca e em que situação.
//
// A cadência é por **distância**, não por tempo: andar devagar dá passos
// espaçados, correr dá o dobro de passos por segundo (mesma passada, mais
// metros). Quem conta os passos é `world-gait.js` — a mesma fase que balança o
// braço e a visão —, e este módulo guarda o que é do som: qual material soa,
// quanto se anda entre um passo e outro e qual variação de tom usar.
import { BLOCK_MATERIALS, blockMaterialFor, materialSoundName } from './world-block-materials.js';

export const STEP_MATERIALS = BLOCK_MATERIALS;

// Distância entre dois passos, em metros (≈ duas passadas curtas).
export const STEP_STRIDE = 1.7;

// Abaixo disso o jogador está "parado" e não faz barulho.
export const STEP_MIN_SPEED = 0.1;

// Material pisado, ou null quando o bloco não produz passo (ar, tocha, água).
// A família do bloco é a mesma usada pelos sons de quebrar e colocar.
export function stepMaterialFor(blockType) {
    return blockMaterialFor(blockType);
}

export function stepSoundFor(blockType) {
    return materialSoundName(blockType, 'step');
}

// Acima disso o deslocamento do quadro é teleporte (respawn, carregamento),
// não caminhada — mesmo em um quadro engasgado dá para descartar com folga.
export const STEP_MAX_MOVED = 2;

// Distância pisada no quadro, ou 0 quando o jogador não está apoiado no chão
// (pulando, caindo ou dentro da água, que tem som próprio de natação).
//
// Recebe o **deslocamento real**, não a velocidade: empurrando uma parede a
// velocidade continua, a posição não — e o som não pode acompanhar o desejo.
export function stepDistanceThisFrame({ moved = 0, dt = 0, onGround = false, inWater = false } = {}) {
    if (!onGround || inWater) return 0;
    if (!(moved > 0) || !(dt > 0) || !(moved <= STEP_MAX_MOVED)) return 0;
    return moved / dt > STEP_MIN_SPEED ? moved : 0;
}

// Variação de tom de cada passo: sem isso a repetição soa mecânica.
export function stepPitch(random = Math.random) {
    return 0.9 + random() * 0.2;
}
