// Animação visual da espada. As duas câmeras amostram a mesma fase do golpe.
import { smoothstep } from './world-math.js';
import { ATTACK_COOLDOWN } from './world-creature.js';

export function createSwordSwing() {
    return { itemId: null, startedAt: -Infinity, direction: 1 };
}

export function beginSwordSwing(state, itemId, now) {
    const elapsed = now - state.startedAt;
    const sameSword = state.itemId === itemId;
    if (sameSword && elapsed < ATTACK_COOLDOWN) return;
    // Só inverte o corte se o jogador emendar o próximo ataque.
    state.direction = sameSword && elapsed < ATTACK_COOLDOWN * 2 ? -state.direction : 1;
    state.itemId = itemId;
    state.startedAt = now;
}

export function swordPose(state, now) {
    const phase = state.itemId === null ? 1 : Math.min(1, Math.max(0, (now - state.startedAt) / ATTACK_COOLDOWN));
    const prepare = smoothstep(0, .20, phase) * (1 - smoothstep(.20, .48, phase));
    const cut = smoothstep(.16, .54, phase) * (1 - smoothstep(.58, 1, phase));
    // O punho termina o arco depois do ombro e volta mais devagar à guarda.
    const wrist = smoothstep(.24, .63, phase) * (1 - smoothstep(.68, 1, phase));
    return { prepare, cut, wrist, direction: state.direction };
}

// O jogo já aplicou a pose da ferramenta. Cada deslocamento volta a zero no fim do corte.
export function applyFirstPersonSwordPose(arm, anchor, pose) {
    const { prepare, cut, wrist, direction } = pose;
    const lateral = direction > 0 ? 1 : -.55;
    arm.position.x += lateral * (.035 * prepare - .12 * cut);
    arm.position.y += .035 * prepare - .045 * cut;
    arm.position.z += .025 * prepare - .13 * cut;
    arm.rotation.x += .07 * prepare - .25 * cut;
    arm.rotation.y += lateral * (-.10 * prepare + .23 * cut);
    arm.rotation.z += lateral * (-.13 * prepare + .32 * cut);
    anchor.rotateX(.11 * prepare - .38 * wrist);
    anchor.rotateZ(direction * (-.19 * prepare + .37 * wrist));
}

// Sobrepõe o corte à pose corrente, inclusive quando a passada flexiona o cotovelo.
export function applyThirdPersonSwordPose(model, rig, pose, weight) {
    const { prepare, cut, wrist, direction } = pose;
    const arm = model.rightArm.rotation;
    arm.x += weight * (-.22 * prepare - .70 * cut);
    arm.y += weight * direction * (.18 * prepare - .40 * cut);
    arm.z += weight * direction * (.15 * prepare - .22 * cut);
    const elbow = rig.elbows[1].rotation;
    elbow.x += weight * (-.22 * prepare + .12 * cut);
    elbow.z += weight * direction * (.08 * prepare - .21 * wrist);
    model.root.rotation.y += weight * direction * (.12 * prepare - .23 * cut);
    model.leftArm.rotation.x -= weight * .16 * cut;
}
