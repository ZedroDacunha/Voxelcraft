// Sons de dano: o golpe que dói e o fim da linha.
//
// Todo dano do jogo passa por `takeDamage()`, então a decisão de som cabe em uma
// função só — ferimento, queda, fome, afogamento e o golpe fatal.

// Dano a partir do qual o som já está no volume máximo (queda de 6 blocos,
// golpe de criatura, etc.).
export const HURT_FULL_GAIN_DAMAGE = 6;

// Quanto maior o dano, mais alto o gemido — mas não infinito: 0,7 a 1,4.
export function hurtGain(damage = 1) {
    const value = Number(damage);
    if (!Number.isFinite(value) || value <= 0) return 0.7;
    return Math.min(1.4, 0.7 + (value / HURT_FULL_GAIN_DAMAGE) * 0.7);
}

// Som do dano, ou null quando não há dano a anunciar.
export function damageSoundFor({ damage = 0, dead = false } = {}) {
    if (dead) return { name: 'death', gainScale: 1 };
    if (!(damage > 0)) return null;
    return { name: 'hurt', gainScale: hurtGain(damage) };
}
