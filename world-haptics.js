// Vibração (haptics) do toque: padrão de cada acontecimento e a cadência mínima
// entre dois iguais.
//
// A ideia é a mesma do áudio: o celular confirma o que o dedo fez, sem virar
// zumbido. Por isso cada acontecimento tem um padrão próprio (um pulso curto
// para colocar, mais forte para levar dano) e uma **folga mínima**: o mesmo
// acontecimento repetido dentro da folga não vibra de novo.
//
// Este módulo é só a matemática — nada de `navigator.vibrate` aqui, para poder
// testar sem navegador. Quem chama é o `game.js`.
//
// Limite do navegador: `navigator.vibrate` existe no Chrome/Edge/Firefox de
// Android e não existe no Safari do iPhone (nem no Firefox de desktop). Onde não
// existe, nada acontece e o jogo segue igual.

import { GAME_SETTING_FIELDS } from './world-game-settings.js';

// Milissegundos ligados/desligados. Um número só é um pulso; pares alternam.
export const HAPTIC_PATTERNS = Object.freeze({
    step: Object.freeze([4]),
    button: Object.freeze([5]),
    place: Object.freeze([7]),
    break: Object.freeze([12]),
    punch: Object.freeze([15]),
    hurt: Object.freeze([28, 40, 55]),
});

// Folga mínima entre dois pulsos do MESMO acontecimento. O passo é o mais
// frequente (correndo dá ~4/s): 220 ms evita que dois quadros seguidos virem
// uma vibração contínua.
export const HAPTIC_GAPS_MS = Object.freeze({
    step: 220,
    button: 60,
    place: 40,
    break: 40,
    punch: 80,
    hurt: 150,
});

export const HAPTIC_EVENTS = Object.freeze(Object.keys(HAPTIC_PATTERNS));

function defaultNavigator() {
    return typeof navigator === 'undefined' ? null : navigator;
}

/** O aparelho sabe vibrar? (Safari do iPhone e Firefox de desktop: não.) */
export function canVibrate(nav = defaultNavigator()) {
    return typeof nav?.vibrate === 'function';
}

/** A opção "Vibração" está ligada? Qualquer coisa que não seja `off` liga. */
export function vibrationEnabled(settings = {}) {
    return settings?.touchVibration !== 'off';
}

/** Memória da última vez de cada acontecimento (uma por partida). */
export function createHapticState() {
    return { last: Object.create(null) };
}

/**
 * Padrão a vibrar agora, ou `null` se ainda não é hora.
 *
 * `state` é opcional: sem ele a função só responde "qual é o padrão", o que
 * deixa o teste do catálogo independente da cadência.
 */
export function hapticPattern(event, state = null, { now = 0, gaps = HAPTIC_GAPS_MS } = {}) {
    const pattern = HAPTIC_PATTERNS[event];
    if (!pattern) return null;
    const time = Number.isFinite(Number(now)) ? Number(now) : 0;
    if (!state) return pattern;
    const memory = state.last ?? (state.last = Object.create(null));
    const gap = Number(gaps?.[event]) || 0;
    const previous = Number(memory[event]);
    if (Number.isFinite(previous) && time - previous < gap) return null;
    memory[event] = time;
    return pattern;
}

/** Duração total de um padrão, em ms (serve para teste e para o roteiro). */
export function hapticDuration(pattern) {
    if (!Array.isArray(pattern)) return 0;
    return pattern.reduce((total, part) => total + (Number(part) || 0), 0);
}

// O campo das opções é a fonte da verdade do padrão; manter aqui evita que o
// módulo e a tela de opções discordem sobre o que é "ligada".
export const VIBRATION_DEFAULT = GAME_SETTING_FIELDS.touchVibration.default;
