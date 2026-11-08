// Layout dos controles de toque: de que lado eles ficam e de que tamanho.
//
// As opções guardam duas preferências (`touchLayout` e `touchButtonSize`) e este
// módulo só traduz isso em números que o jogo e o CSS usam — nada de DOM, para
// poder testar sem navegador.
//
// O tamanho é um multiplicador aplicado a todas as medidas do toque (botão,
// ícone e joystick). Medir em múltiplo e não em
// pixels absolutos é o que faz "150%" querer dizer a mesma coisa em qualquer
// tela.

import { GAME_SETTING_FIELDS } from './world-game-settings.js';

export const TOUCH_MIN_SCALE = GAME_SETTING_FIELDS.touchButtonSize.min;
export const TOUCH_MAX_SCALE = GAME_SETTING_FIELDS.touchButtonSize.max;

// Medidas de referência (escala 1), em px. O `styles.css` repete estas mesmas
// contas com `var(--touch-scale)`; os testes conferem as duas pontas.
export const TOUCH_METRICS = Object.freeze({
    stick: 132,
    stickKnob: 56,
    stickRadius: 58,
    button: 64,
    topButton: 46,
    icon: 34,
    topIcon: 26,
    gap: 10,
});

export function clampTouchScale(value) {
    const scale = Number(value);
    if (!Number.isFinite(scale)) return 1;
    return Math.min(TOUCH_MAX_SCALE, Math.max(TOUCH_MIN_SCALE, scale));
}

/**
 * Preferências → estado do layout.
 *
 * `lefty` existe para o `game.js` e o CSS não precisarem repetir a comparação
 * de string em cada ponta. Valor desconhecido cai no destro, que é o padrão.
 */
export function touchLayoutState(settings = {}) {
    const lefty = settings?.touchLayout === 'left';
    return {
        layout: lefty ? 'left' : 'right',
        lefty,
        size: clampTouchScale(settings?.touchButtonSize),
    };
}

/** Raio em que empurrar o joystick já conta como "fundo" (corrida). */
export function touchStickRadius(scale = 1) {
    return TOUCH_METRICS.stickRadius * clampTouchScale(scale);
}
