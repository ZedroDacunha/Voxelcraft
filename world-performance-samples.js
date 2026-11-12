// Amostra limitada de intervalos entre quadros. Não estima tempo de GPU.
export function createFrameSamples(capacity = 600) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacidade inválida');
    const values = new Float64Array(capacity);
    let length = 0, next = 0, active = false;
    return {
        record(milliseconds, enabled) {
            if (!enabled) { active = false; return; }
            // Descarta o primeiro intervalo após pausa, aba oculta ou abertura do painel.
            if (!active) { active = true; return; }
            if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
            values[next] = milliseconds;
            next = (next + 1) % capacity;
            length = Math.min(length + 1, capacity);
        },
        reset() { length = 0; next = 0; active = false; },
        summary() {
            if (!length) return null;
            const sorted = Array.from(values.subarray(0, length)).sort((a, b) => a - b);
            const total = sorted.reduce((sum, n) => sum + n, 0);
            return { frames: length, seconds: total / 1000, fps: length * 1000 / total,
                p95: sorted[Math.ceil(length * 0.95) - 1], slow: sorted.filter(n => n > 50).length };
        },
    };
}
