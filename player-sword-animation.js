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

// O pivô animado carrega mão e espada. A rotação local da lâmina é sobre o cabo.
export function applyFirstPersonSwordPose(arm, anchor, pose) {
    const { prepare, cut, wrist, direction } = pose;
    // O revés abre menos para a direita para manter a lâmina visível.
    const lateral = direction > 0 ? 1 : -.50;
    arm.position.x += -.10 + lateral * (.045 * prepare - .13 * cut);
    arm.position.y += .045 + .045 * prepare - .035 * cut;
    arm.position.z -= .035 - .025 * prepare + .16 * cut;
    arm.rotation.x += .10 + .09 * prepare - .18 * cut;
    arm.rotation.y += lateral * (-.09 * prepare + .21 * cut);
    arm.rotation.z += lateral * (-.14 * prepare + .36 * cut);
    // A câmera olha para -Z. Compensa a inclinação do braço para que a ponta
    // avance a partir da mão, inclusive durante a preparação do revés.
    anchor.rotation.set(-1.44 + .12 * prepare - .22 * wrist, .10,
        .32 + direction * (-.24 * prepare + .45 * wrist));
}

// A passada e a braçada já foram aplicadas. O peso diminui ao entrar na água.
export function applyThirdPersonSwordPose(model, rig, pose, weight) {
    const { prepare, cut, wrist, direction } = pose;
    const arm = model.rightArm.rotation;
    arm.x += weight * (-.72 + .10 * prepare - .68 * cut - .65 * arm.x);
    arm.y = weight * direction * (.15 * prepare - .43 * cut);
    arm.z = weight * (.20 + direction * (.30 * prepare - .30 * cut));
    const elbow = rig.elbows[1].rotation;
    elbow.x += weight * (-.55 - .26 * prepare + .50 * cut - .7 * elbow.x);
    elbow.z = weight * direction * (.08 * prepare - .22 * wrist);
    model.root.rotation.y += weight * direction * (.12 * prepare - .23 * cut);
    model.leftArm.rotation.x -= weight * (.23 + .15 * cut);
}
