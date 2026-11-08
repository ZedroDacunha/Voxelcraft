/** Animação exclusivamente visual; não altera a física nem a câmera do jogador. */
export const SWIM_FADE_RATE = 6;
export const SWIM_MOVE_THRESHOLD = 0.12;
export function createSwimState() { return { blend: 0, phase: 0 }; }

/** A água rasa com apoio nos pés é caminhada, não nado. */
export function advanceSwim(state, { dt = 0, feetInWater = false, headInWater = false, onGround = false, gaitAmplitude = 0 } = {}) {
    const time = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    const moving = Number.isFinite(gaitAmplitude) && gaitAmplitude > SWIM_MOVE_THRESHOLD;
    const swimming = moving && (headInWater || (feetInWater && !onGround));
    const factor = 1 - Math.exp(-SWIM_FADE_RATE * time);
    state.blend += ((swimming ? 1 : 0) - state.blend) * factor;
    if (state.blend < 0.001) state.blend = 0;
    if (swimming) state.phase = (state.phase + time * 7) % (Math.PI * 2);
    return state;
}

/** Rotação do corpo em torno do centro e membros em braçadas alternadas. */
export function swimPose(state, { yaw = 0, height = 1.8, walkSwing = 0, punch = 0 } = {}) {
    const blend = Math.max(0, Math.min(1, state.blend));
    const tilt = blend * Math.PI / 2;
    const midpoint = height / 2;
    const shift = -midpoint * Math.sin(tilt);
    const stroke = Math.sin(state.phase);
    const mix = (a, b) => a + (b - a) * blend;
    return {
        tilt,
        offsetX: Math.sin(yaw) * shift,
        offsetY: midpoint * (1 - Math.cos(tilt)),
        offsetZ: Math.cos(yaw) * shift,
        leftLeg: mix(walkSwing, stroke * 0.48),
        rightLeg: mix(-walkSwing, -stroke * 0.48),
        leftArm: mix(-walkSwing, -2.25 + stroke * 0.55),
        rightArm: mix(walkSwing, -2.25 - stroke * 0.55) - punch,
    };
}

/** Braço e câmera visuais: mesma fase do braço direito em terceira pessoa.
 * Sem alterar direção, mira, posição física ou câmera usada pelas interações.
 */
export function swimFirstPersonPose(state) {
    const blend = Math.max(0, Math.min(1, Number(state?.blend) || 0));
    if (blend === 0) return { handX: 0, handY: 0, handZ: 0, handPitch: 0, cameraY: 0, walkWeight: 1 };
    const phase = Number.isFinite(state?.phase) ? state.phase : 0;
    const stroke = Math.sin(phase) * blend;
    return {
        handX: -0.035 * stroke,
        handY: -0.025 * Math.cos(phase) * blend,
        handZ: -0.035 * stroke,
        handPitch: -0.14 * stroke,
        cameraY: 0.015 * Math.cos(phase * 2) * blend,
        walkWeight: 1 - blend,
    };
}
