/** Pose da ferramenta em primeira pessoa, no espaço do braço.
 * A origem fica no cabo: o sprite diagonal é girado e inclinado para que a
 * ferramenta saia da mão em direção ao alto, sem ocupar o centro da tela.
 * Os valores são adaptação visual, não uma reprodução exata da câmera alheia.
 */
export const FIRST_TOOL_POSE = Object.freeze({
    position: Object.freeze([0, 0.02, -0.59]),
    rotation: Object.freeze([10 * Math.PI / 180, -20 * Math.PI / 180, -25 * Math.PI / 180]),
    scale: 0.85,
    grip: Object.freeze([0.187, 0.204, 0]),
});

export function applyFirstPersonToolPose(anchor) {
    anchor.position.set(...FIRST_TOOL_POSE.position);
    anchor.rotation.set(...FIRST_TOOL_POSE.rotation);
    anchor.scale.setScalar(FIRST_TOOL_POSE.scale);
}
