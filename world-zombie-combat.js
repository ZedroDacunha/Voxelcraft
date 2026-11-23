// Referência: Minecraft Bedrock 1.20.50, alcance da melee_box_attack.
// https://www.minecraft.net/en-us/article/minecraft-bedrock-edition-1-20-50
// A aplicação de dano é responsabilidade do sistema de jogo.
export const ZOMBIE_ATTACK_DAMAGE = 3; // 1,5 coração antes da armadura (normal).
export const ZOMBIE_ATTACK_INTERVAL = 1; // segundos
export const ZOMBIE_ATTACK_BOX_INCREASE = 0.8; // blocos, somente nos eixos horizontais

// Caixas em coordenadas do mundo, com min/max em x, y e z. A linha de visão
// deve ser conferida pelo chamador, usando as colisões do mundo.
export function zombieAttackInReach(zombieBox, targetBox, hasLineOfSight) {
    if (hasLineOfSight !== true || !validBox(zombieBox) || !validBox(targetBox)) return false;
    const r = ZOMBIE_ATTACK_BOX_INCREASE;
    return zombieBox.min.x - r < targetBox.max.x && zombieBox.max.x + r > targetBox.min.x &&
        zombieBox.min.z - r < targetBox.max.z && zombieBox.max.z + r > targetBox.min.z &&
        zombieBox.min.y < targetBox.max.y && zombieBox.max.y > targetBox.min.y;
}

function validBox(box) {
    return box && ['x', 'y', 'z'].every(axis =>
        Number.isFinite(box.min?.[axis]) && Number.isFinite(box.max?.[axis]) && box.min[axis] < box.max[axis]);
}
