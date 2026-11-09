// Retângulos são a área tocável real (inclusive joystick), não só o ícone.
export const TOUCH_CONTROL_GAP = 2;

export function touchOverlapArea(a, b, gap = TOUCH_CONTROL_GAP) {
    const half = gap / 2;
    const width = Math.max(0, Math.min(a.right + half, b.right + half) - Math.max(a.left - half, b.left - half));
    const height = Math.max(0, Math.min(a.bottom + half, b.bottom + half) - Math.max(a.top - half, b.top - half));
    return width * height;
}

// Posições antigas já podem estar sobrepostas. Permite sair delas, mas nunca
// criar outra sobreposição ou aumentar qualquer uma que já existia.
export function touchMoveAllowed(current, candidate, others, gap = TOUCH_CONTROL_GAP) {
    return others.every(other => touchOverlapArea(candidate, other, gap) <= touchOverlapArea(current, other, gap) + 0.01);
}

export function findFreeTouchRect(rect, bounds, others, gap = TOUCH_CONTROL_GAP) {
    const width = rect.right - rect.left, height = rect.bottom - rect.top;
    const minX = bounds.left, minY = bounds.top;
    const maxX = bounds.right - width, maxY = bounds.bottom - height;
    if (!(width > 0 && height > 0) || maxX < minX || maxY < minY) return null;
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const xs = [rect.left, minX, maxX];
    const ys = [rect.top, minY, maxY];
    for (const other of others) {
        xs.push(other.left - width - gap, other.right + gap);
        ys.push(other.top - height - gap, other.bottom + gap);
    }
    let best = null, bestDistance = Infinity;
    for (const x of xs) for (const y of ys) {
        const left = clamp(x, minX, maxX), top = clamp(y, minY, maxY);
        const candidate = { left, top, right: left + width, bottom: top + height };
        if (others.some(other => touchOverlapArea(candidate, other, gap) > 0.01)) continue;
        const distance = (left - rect.left) ** 2 + (top - rect.top) ** 2;
        if (distance < bestDistance) { bestDistance = distance; best = candidate; }
    }
    return best;
}

export function overlappingTouchPieces(pieces, gap = TOUCH_CONTROL_GAP) {
    const result = new Set();
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
        if (touchOverlapArea(pieces[i].rect, pieces[j].rect, gap) > 0.01) {
            result.add(pieces[i].piece); result.add(pieces[j].piece);
        }
    }
    return result;
}
