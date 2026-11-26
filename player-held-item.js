// A pose da ferramenta toma como referência a transformação handheld clássica:
// escala 0,85 e ângulo de 55° para alinhar a diagonal do sprite ao cabo.
// O modelo do jogador usa +Z como frente; YXZ converte esse plano para o lado.
import { applyThirdPersonAppleGrip, applyThirdPersonMuttonGrip } from './player-eat-animation.js';

export const THIRD_TOOL_POSE = Object.freeze({ yaw: -Math.PI / 2, roll: -55 * Math.PI / 180, scale: 0.85 });
export const THIRD_TOOL_GRIP = Object.freeze({ x: 0.187, y: 0.204 });
export const THIRD_HELD_ARM_POSE = Object.freeze({ shoulderX: -0.28, elbowX: -0.36, swingDamp: 0.45 });

/** Mantém o braço direito meio levantado à frente quando há um item na mão nas visões externas
 * (3ª pessoa costas/frente e prévia do inventário), sem alterar a 1ª pessoa.
 */
export function applyThirdPersonHeldArmPose(model, rig, hasHeldItem, ground = null, weight = 1) {
    if (!hasHeldItem || weight <= 0) return;
    const armSwing = ground ? ground.arm : 0;
    const elbowRun = ground ? ground.elbowRight : 0;
    model.rightArm.rotation.x += (-armSwing * (1 - THIRD_HELD_ARM_POSE.swingDamp) + THIRD_HELD_ARM_POSE.shoulderX) * weight;
    if (rig?.elbows?.[1]) {
        rig.elbows[1].rotation.x = (THIRD_HELD_ARM_POSE.elbowX + 0.55 * elbowRun) * weight;
    }
}

/** Item visual da terceira pessoa. As malhas compartilham geometria e material
 * com a mão em primeira pessoa; só os objetos e transformações são independentes.
 */
export function createPlayerHeldItem(THREE, rightArm) {
    const anchor = new THREE.Group();
    anchor.name = 'heldItem';
    // Perto da mão, na frente do braço (+Z é a frente do personagem).
    anchor.position.set(0, -0.60, 0.18);
    rightArm.add(anchor);
    let lastId = null;

    function update(id, mesh, flame, isSprite, isTool = false) {
        if (id === lastId) return;
        lastId = id;
        anchor.clear();
        if (!id || !mesh) return;
        const copy = mesh.clone();
        if (copy.userData?.isAppleModel) {
            applyThirdPersonAppleGrip(copy);
            anchor.add(copy);
            return;
        }
        if (copy.userData?.isMuttonModel) {
            applyThirdPersonMuttonGrip(copy);
            anchor.add(copy);
            return;
        }
        if (isTool) {
            // Gira o sprite em torno do cabo, não em torno do centro da figura.
            // Assim a ponta fica à frente e a empunhadura permanece na mão.
            const pivot = new THREE.Group();
            pivot.name = 'toolPose';
            pivot.rotation.set(0, THIRD_TOOL_POSE.yaw, THIRD_TOOL_POSE.roll, 'YXZ');
            pivot.scale.setScalar(THIRD_TOOL_POSE.scale);
            if (copy.userData.isSwordModel) {
                // A origem da espada já está no cabo. Sua rotação local alinha a grade ao sprite.
                copy.position.set(0, 0, 0);
            } else {
                copy.position.set(THIRD_TOOL_GRIP.x, THIRD_TOOL_GRIP.y, 0);
                copy.rotation.set(0, 0, 0);
            }
            copy.scale.set(1, 1, 1);
            pivot.add(copy);
            anchor.add(pivot);
            return;
        }
        // Posições de sprite alinham o cabo à mão. As posições de bloco/cama
        // pertencem ao enquadramento da primeira pessoa, então são zeradas.
        if (!isSprite) copy.position.set(0, 0, 0);
        copy.rotation.set(0, 0, 0);
        copy.scale.set(1, 1, 1);
        anchor.add(copy);
        if (flame) {
            const fire = flame.clone();
            anchor.add(fire);
        }
    }
    return { anchor, update };
}
