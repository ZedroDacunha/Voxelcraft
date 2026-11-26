// Parte 2: movimentos ilustrativos para comparar na prévia. Não há emissão,
// vento real, colisão nem partículas de jogo nesta etapa.
export const FALLING_LEAF_MOTIONS = [
    {
        id: 'suave', badge: 'Movimento 1 · Suave', tag: 'Queda tranquila',
        title: '1 — Flutuar suave', recommended: true,
        description: 'Desce devagar com um pequeno balanço e inclinação discreta.',
        duration: 4.8, sway: 0.12, drift: 0.18, turns: 0.08, flutter: 0.06,
    },
    {
        id: 'balanco', badge: 'Movimento 2 · Balanço', tag: 'Lento · Lateral',
        title: '2 — Balanço de lado',
        description: 'Queda mais lenta com um balanço lateral amplo, como uma folha planando.',
        duration: 5.6, sway: 0.36, drift: 0.12, turns: 0.12, flutter: 0.12,
    },
    {
        id: 'brisa', badge: 'Movimento 3 · Brisa', tag: 'Deslocamento lateral',
        title: '3 — Levadas pela brisa',
        description: 'A folha desce enquanto deriva suavemente para o mesmo lado, com pouco balanço.',
        duration: 4.4, sway: 0.08, drift: 0.85, turns: 0.05, flutter: 0.08,
    },
    {
        id: 'giro', badge: 'Movimento 4 · Giro', tag: 'Rodopio discreto',
        title: '4 — Giro e planeio',
        description: 'Combina uma queda suave com um giro lento e uma leve mudança de largura para sugerir rotação.',
        duration: 5.0, sway: 0.22, drift: 0.25, turns: 0.8, flutter: 0.35,
    },
];

const ORIGINS = [
    [-1.25, 1.15], [-0.78, 1.38], [-0.26, 1.20],
    [0.26, 1.48], [0.79, 1.22], [1.25, 1.36],
];

// A posição é repetida em ciclo com desaparecimento nas pontas para estudar
// só o movimento. O posicionamento definitivo e o chão são etapas posteriores.
export function sampleFallingLeafMotion(profile, time, index) {
    const i = ((Math.trunc(index) % ORIGINS.length) + ORIGINS.length) % ORIGINS.length;
    const seconds = Number.isFinite(time) ? Math.max(0, time) : 0;
    const progress = ((seconds / profile.duration + i / ORIGINS.length) % 1);
    const phase = i * 1.73;
    const wave = Math.sin(progress * Math.PI * 4 + phase);
    const waveZ = Math.sin(progress * Math.PI * 3 + phase * 0.7);
    const fade = Math.max(0, Math.min(1, progress / 0.12, (1 - progress) / 0.12));
    return {
        x: ORIGINS[i][0] + profile.sway * wave + profile.drift * progress,
        y: 3.12 - progress * 2.04,
        z: ORIGINS[i][1] + 0.08 * waveZ,
        rotation: wave * 0.22 + profile.turns * Math.PI * 2 * progress,
        width: 1 - profile.flutter * (0.5 + 0.5 * Math.sin(progress * Math.PI * 4 + phase)),
        opacity: fade,
    };
}
