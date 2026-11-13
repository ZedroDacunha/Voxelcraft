// Só acrescenta movimento visual durante a mineração com picareta. A fase e o
// pico de impacto são os mesmos da animação e do som de mineração existentes.
export function pickaxeMiningPose(toolType, hand) {
    if (toolType !== 'pickaxe') return { lift: 0, strike: 0 };
    const strength = Math.max(0, Math.min(1, Number(hand?.mining) || 0));
    const phase = Number.isFinite(hand?.phase) ? hand.phase : 0;
    return {
        // Na primeira metade de cada batida a ferramenta é levantada; no pico
        // (π/2 + kπ), a preparação já terminou e acontece o impacto.
        lift: strength * Math.max(0, Math.sin(phase * 2)),
        strike: strength * Math.abs(Math.sin(phase)),
    };
}
