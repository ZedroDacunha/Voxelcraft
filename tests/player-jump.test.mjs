import test from 'node:test';
import assert from 'node:assert/strict';

import {
    COYOTE_TIME,
    canJumpFrom,
    createJumpState,
    updateJumpWindow,
} from '../player-jump.js';

// ------------------------------------------------ janela do pulo tardio

test('a janela começa fechada: cair não dá pulo de graça', () => {
    const state = createJumpState();
    assert.equal(state.coyoteLeft, 0);
    assert.equal(canJumpFrom(state), false, 'no ar, sem janela, não pula');
    assert.equal(canJumpFrom(state, { onGround: true }), true, 'no chão sempre pula');
});

test('pé no chão recarrega a janela inteira a cada quadro', () => {
    const state = createJumpState();
    for (let i = 0; i < 3; i++) {
        updateJumpWindow(state, { dt: 0.016, onGround: true });
        assert.equal(state.coyoteLeft, COYOTE_TIME);
    }
});

test('sair da borda deixa pular por COYOTE_TIME e depois não', () => {
    const state = createJumpState();
    updateJumpWindow(state, { dt: 0.016, onGround: true });

    // Primeiro quadro no ar: a janela ainda está cheia (o passo do pulo).
    updateJumpWindow(state, { dt: 0.016, onGround: false });
    assert.equal(state.coyoteLeft, COYOTE_TIME - 0.016);
    assert.equal(canJumpFrom(state), true, 'ainda dá');

    // Meia janela depois, ainda dá.
    updateJumpWindow(state, { dt: COYOTE_TIME / 2, onGround: false });
    assert.equal(canJumpFrom(state), true);

    // Passou da janela: não dá mais.
    updateJumpWindow(state, { dt: COYOTE_TIME, onGround: false });
    assert.equal(state.coyoteLeft, 0, 'a janela zera, nunca fica negativa');
    assert.equal(canJumpFrom(state), false);
});

test('um quadro longo consome a janela de uma vez', () => {
    const state = createJumpState();
    updateJumpWindow(state, { onGround: true });
    updateJumpWindow(state, { dt: 1 / 3, onGround: false });
    assert.equal(state.coyoteLeft, 0);
    assert.equal(canJumpFrom(state), false);
});

test('pular fecha a janela: não existe pulo duplo', () => {
    const state = createJumpState();
    updateJumpWindow(state, { onGround: true });
    assert.equal(canJumpFrom(state), true);

    updateJumpWindow(state, { dt: 0.016, onGround: false, jumped: true });
    assert.equal(state.coyoteLeft, 0);
    assert.equal(canJumpFrom(state), false, 'no meio do pulo não pula de novo');

    // E não reabre sozinho enquanto estiver subindo/caindo.
    for (let i = 0; i < 10; i++) updateJumpWindow(state, { dt: 0.016, onGround: false });
    assert.equal(canJumpFrom(state), false);
});

test('na água a janela fecha: nadar tem regra própria', () => {
    const state = createJumpState();
    updateJumpWindow(state, { onGround: true });
    updateJumpWindow(state, { dt: 0.016, onGround: true, inWater: true });
    assert.equal(state.coyoteLeft, 0, 'entrar na água fecha');
    // E sair da água por cima de um barranco não vira pulo de graça.
    updateJumpWindow(state, { dt: 0.016, onGround: false, inWater: false });
    assert.equal(canJumpFrom(state), false);
});

test('tempo inválido não estraga a janela', () => {
    const state = createJumpState();
    updateJumpWindow(state, { onGround: true });
    updateJumpWindow(state, { dt: NaN, onGround: false });
    updateJumpWindow(state, { dt: -5, onGround: false });
    updateJumpWindow(state, { onGround: false });
    assert.equal(state.coyoteLeft, COYOTE_TIME, 'continua cheia');
    assert.equal(canJumpFrom(state), true);
});

test('a janela é curta de propósito', () => {
    assert.ok(COYOTE_TIME > 0.05, 'tempo de reagir de verdade');
    assert.ok(COYOTE_TIME < 0.2, 'mas não é pulo flutuante');
});
