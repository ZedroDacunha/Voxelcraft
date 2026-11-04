// Sons do forno: acender, apagar e o item que ficou pronto.
//
// Sem laço contínuo — forno queimando é um zumbido que cansa em dois minutos e
// briga com todos os outros sons. A água seguiu a mesma decisão: só a
// **transição** soa.
//
// O forno não é espacializado (o áudio do jogo é mono, com ganho), então a
// distância entra como volume: um forno que acende sozinho num chunk carregado
// longe do jogador não pode soar como se estivesse ao lado dele.
// Até aqui o forno está "na sua mão": volume cheio.
export const FURNACE_NEAR_DISTANCE = 3;
// A partir daqui, silêncio. Meia dúzia de blocos já é outro cômodo.
export const FURNACE_AUDIBLE_DISTANCE = 20;

const SOUND_NAMES = { light: 'furnace-light', out: 'furnace-out', done: 'furnace-done' };

/**
 * Volume do forno pela distância (em blocos), de 1 (colado) a 0 (longe).
 *
 * Cai ao quadrado, o que soa mais natural que linear: a diferença entre 3 e 6
 * blocos é pequena, entre 15 e 18 é quase nada. Distância inválida devolve 0 —
 * som é enfeite, e na dúvida é melhor silêncio do que um crepitar fantasma.
 */
export function furnaceGain(distance = 0) {
    const value = Number(distance);
    if (!Number.isFinite(value) || value < 0) return 0;
    if (value <= FURNACE_NEAR_DISTANCE) return 1;
    if (value >= FURNACE_AUDIBLE_DISTANCE) return 0;
    const t = (value - FURNACE_NEAR_DISTANCE) / (FURNACE_AUDIBLE_DISTANCE - FURNACE_NEAR_DISTANCE);
    return Math.round((1 - t) ** 2 * 1000) / 1000;
}

/**
 * Qual som um passo de forno produz, ou `null` quando nada aconteceu.
 *
 * Precedência: acender/apagar vence o item pronto — os dois nunca acontecem no
 * mesmo passo (`stepFurnace` só avança o preparo com o forno já aceso), mas se
 * acontecerem o evento de chama é o mais importante de ouvir.
 */
export function furnaceSoundFor({ lit = false, litChanged = false, smelted = false, distance = 0 } = {}) {
    const gainScale = furnaceGain(distance);
    if (gainScale <= 0) return null;
    if (litChanged) return { name: lit ? SOUND_NAMES.light : SOUND_NAMES.out, gainScale };
    if (smelted) return { name: SOUND_NAMES.done, gainScale };
    return null;
}

/**
 * Distância do centro do forno (chave `"x,y,z"`) até uma posição.
 *
 * Só é chamada quando há evento: quebrar a chave de todo forno a cada quadro
 * foi justamente o custo que `furnaceChunk()` evita com o cache de chunk.
 */
export function furnaceDistance(key, position) {
    const [x, y, z] = String(key).split(',').map(Number);
    if (![x, y, z].every(Number.isFinite)) return Infinity;
    if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) return Infinity;
    return Math.hypot(position.x - (x + 0.5), position.y - (y + 0.5), position.z - (z + 0.5));
}
