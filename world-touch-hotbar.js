// A hotbar compacta fica centrada entre os controles inferiores. Quando não
// cabe uma área de toque minimamente utilizável, voltamos ao HUD elevado.
export function compactTouchHotbar({ width, height, controls, margin = 8 } = {}) {
    if (!(width > height && height > 0) || !Array.isArray(controls) || !controls.length) return null;
    const center = width / 2;
    let left = margin;
    let right = width - margin;
    for (const rect of controls) {
        if (!rect || !(rect.right > rect.left)) return null;
        // Um controle cruzando o centro deixa a posição central indisponível.
        if (rect.left < center && rect.right > center) return null;
        if (rect.right <= center) left = Math.max(left, rect.right + margin);
        else right = Math.min(right, rect.left - margin);
    }
    const available = 2 * Math.min(center - left, right - center);
    // Fundo: 6px de padding em cada lado, 8 vãos de 3px e 9 casas.
    const slot = Math.min(38, Math.floor((available - 12 - 8 * 3) / 9));
    return slot >= 28 ? { slot } : null;
}
