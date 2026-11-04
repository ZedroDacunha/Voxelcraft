// Passos: qual som toca e de quanto em quanto tempo.
//
// A cadência é por **distância**, não por tempo: andar devagar dá passos
// espaçados, correr dá o dobro de passos por segundo (mesma passada, mais
// metros). Assim o som acompanha o corpo em vez de brigar com a animação.
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

export function createStepTracker() {
    return { distance: 0 };
}

// Acumula os metros andados no quadro e devolve quantos passos tocam agora.
// Um quadro muito longo não deve virar rajada de passos: no máximo dois.
export function advanceStepTracker(tracker, distance, { stride = STEP_STRIDE } = {}) {
    if (!(distance > 0)) return 0;
    tracker.distance += distance;
    let steps = 0;
    while (tracker.distance >= stride && steps < 2) {
        tracker.distance -= stride;
        steps++;
    }
    // se ainda sobrou distância (queda de FPS), descarta o excedente: o passo
    // seguinte não pode sair atrasado depois de um congelamento
    if (tracker.distance >= stride) tracker.distance = 0;
    return steps;
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
