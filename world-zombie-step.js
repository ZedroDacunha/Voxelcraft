// Planeja uma subida vertical e depois horizontal de até um bloco. As amostras
// incluem o corpo inteiro; canOccupy e canStand são fornecidos pelo mundo.
export function planZombieStep(position, direction, canOccupy, canStand) {
    if (!position || !direction || typeof canOccupy !== 'function' || typeof canStand !== 'function' ||
        ![position.x, position.y, position.z, direction.x, direction.z].every(Number.isFinite)) return null;
    const length = Math.hypot(direction.x, direction.z);
    if (length < 1e-6) return null;
    const dx = direction.x / length, dz = direction.z / length;
    const target = { x: position.x + dx * .8, y: position.y + 1, z: position.z + dz * .8 };
    if (!canStand(target.x, target.y, target.z)) return null;
    // Subida primeiro, sem subir através de teto; depois move sobre a borda.
    for (let i = 1; i <= 8; i++) {
        if (!canOccupy(position.x, position.y + i / 8, position.z)) return null;
        if (!canOccupy(position.x + dx * .8 * i / 8, target.y, position.z + dz * .8 * i / 8)) return null;
    }
    return { from: { x: position.x, y: position.y, z: position.z }, to: target, time: 0 };
}

// Sai da borda na altura atual e só então desce até apoio um bloco abaixo.
export function planZombieDescent(position, direction, canOccupy, canStand) {
    if (!position || !direction || typeof canOccupy !== 'function' || typeof canStand !== 'function' ||
        ![position.x, position.y, position.z, direction.x, direction.z].every(Number.isFinite)) return null;
    const length = Math.hypot(direction.x, direction.z);
    if (length < 1e-6) return null;
    const dx = direction.x / length, dz = direction.z / length;
    const target = { x: position.x + dx * .8, y: position.y - 1, z: position.z + dz * .8 };
    if (!canStand(target.x, target.y, target.z)) return null;
    for (let i = 1; i <= 8; i++) {
        if (!canOccupy(position.x + dx * .8 * i / 8, position.y, position.z + dz * .8 * i / 8)) return null;
        if (!canOccupy(target.x, position.y - i / 8, target.z)) return null;
    }
    return { from: { x: position.x, y: position.y, z: position.z }, to: target, time: 0, descending: true };
}

export function zombieStepPosition(step, progress) {
    const p = Math.max(0, Math.min(1, progress));
    if (p === 1) return { ...step.to };
    const vertical = step.descending ? Math.max(0, (p - .55) / .45) : Math.min(1, p / .45);
    const forward = step.descending ? Math.min(1, p / .55) : Math.max(0, (p - .45) / .55);
    return { x: step.from.x + (step.to.x - step.from.x) * forward,
        y: step.from.y + (step.to.y - step.from.y) * vertical,
        z: step.from.z + (step.to.z - step.from.z) * forward };
}
