// Planejamento horizontal isolado: não movimenta entidades nem atravessa blocos.
// O sistema do mundo deve validar colisões, escolher um caminho e aplicar o passo.
// `target` só deve ser fornecido após aquisição/manutenção válida do alvo;
// `inAttackReach` deve vir da caixa de ataque e da linha de visão atuais.
export function zombiePursuitStep({ position, target, speed, dt, inAttackReach = false } = {}) {
    const stop = { dx: 0, dz: 0, moving: false };
    if (!position || !target || !Number.isFinite(position.x) || !Number.isFinite(position.z) ||
        !Number.isFinite(target.x) || !Number.isFinite(target.z) ||
        !Number.isFinite(speed) || speed <= 0 || !Number.isFinite(dt) || dt <= 0 || inAttackReach) return stop;
    const x = target.x - position.x, z = target.z - position.z;
    const distance = Math.hypot(x, z);
    if (!Number.isFinite(distance) || distance <= 1e-9) return stop;
    const step = Math.min(speed * dt, distance);
    return { dx: x / distance * step, dz: z / distance * step, moving: true };
}
