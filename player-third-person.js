/** Ordem das vistas tanto no teclado quanto no toque. */
export const CAMERA_VIEWS = Object.freeze(['first', 'rear', 'front']);
export function nextCameraView(view) {
    const index = CAMERA_VIEWS.indexOf(view);
    return CAMERA_VIEWS[(index + 1) % CAMERA_VIEWS.length];
}
/** Sinal do deslocamento em relação ao olhar do jogador. */
export function cameraOffsetSign(view) {
    return view === 'front' ? 1 : -1;
}

/** Distância segura da câmera a partir dos olhos, sem atravessar blocos. */
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
