/** Distância segura da câmera atrás dos olhos, sem atravessar blocos. */
export const THIRD_PERSON_DISTANCE = 3.2;
export const THIRD_PERSON_CLEARANCE = 0.2;
export const THIRD_PERSON_BODY_MIN_DISTANCE = 0.65;
export function thirdPersonDistance(hitDistance, desired = THIRD_PERSON_DISTANCE) {
    const max = Math.max(0, Number.isFinite(desired) ? desired : THIRD_PERSON_DISTANCE);
    if (!Number.isFinite(hitDistance)) return max;
    return Math.max(0, Math.min(max, hitDistance - THIRD_PERSON_CLEARANCE));
}
/** Ângulos dos membros usam a mesma fase da passada e dos sons do jogador. */
export function thirdPersonLimbSwing(phase, amplitude) {
    return Math.sin(phase) * Math.max(0, amplitude) * 0.55;
}
