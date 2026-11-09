// Um toque curto é uma ação imediata, não um botão apertado por um quadro:
// assim um toque entre dois quadros também acerta criaturas e grama alta.
export function performTouchTapAttack({ updateTarget, strikeCreature, updateMining, punch }) {
    updateTarget();
    if (strikeCreature({ tap: true })) return;
    // dt zero preserva a dureza e o tempo de mineração dos blocos normais,
    // mas permite a quebra imediata de grama alta pelo caminho existente.
    updateMining(0, { tap: true });
    punch();
}

// Fontes independentes: soltar um dedo não encerra outra ação ainda ativa.
export function attackHeld({ mouse = false, button = false, gesture = false } = {}) {
    return Boolean(mouse || button || gesture);
}
