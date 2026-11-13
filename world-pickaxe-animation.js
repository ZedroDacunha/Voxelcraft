// Só acrescenta movimento visual durante a mineração com picareta. A fase e o
// pico de impacto são os mesmos da animação e do som de mineração existentes.
const ease = t => {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
};

export function pickaxeMiningPose(toolType, hand) {
    if (toolType !== 'pickaxe') return { lift: 0, strike: 0 };
    const strength = Math.max(0, Math.min(1, Number(hand?.mining) || 0));
    const phase = Number.isFinite(hand?.phase) ? hand.phase : 0;
    // Cada batida dura π radianos. A subida acontece primeiro; a descida é
    // mais rápida e atinge o bloco exatamente em π/2, onde o som é disparado.
    // A volta ocupa a segunda metade; curvas com inclinação zero evitam
    // mudanças bruscas na emenda entre preparação, impacto e repouso.
    const cycle = ((phase % Math.PI) + Math.PI) % Math.PI / Math.PI;
    const lift = cycle < 0.25 ? ease(cycle / 0.25)
        : cycle < 0.5 ? 1 - ease((cycle - 0.25) / 0.25) : 0;
    const strike = cycle < 0.5 ? ease((cycle - 0.18) / 0.32)
        : 1 - ease((cycle - 0.5) / 0.5);
    return { lift: strength * lift, strike: strength * strike };
}
