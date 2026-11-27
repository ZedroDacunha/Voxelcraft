// A câmera e a colisão ficam nos olhos e nos pés reais. Apenas o avatar local
// recua o suficiente para enxergar a frente da túnica, da calça e das botas.
export function createFirstPersonBody(model) {
    const hidden = [model.head, model.leftArm, model.rightArm];
    // As ombreiras articuladas pertencem ao peitoral, fora dos pivôs dos braços.
    model.root.traverse(part => {
        if (part.name === 'chest-left-pivot' || part.name === 'chest-right-pivot') hidden.push(part);
    });
    const leftRest = model.leftLeg.rotation.z, rightRest = model.rightLeg.rotation.z;
    let firstPerson = false;
    return {
        setFirstPerson(active) {
            if (active === firstPerson) return;
            firstPerson = active;
            for (const part of hidden) part.visible = !active;
            if (!active) {
                model.leftLeg.rotation.z = leftRest;
                model.rightLeg.rotation.z = rightRest;
            }
        },
        align(position, yaw, groundWeight = 1) {
            // Uma pequena abertura nos quadris separa as botas vistas de cima.
            // A passada em X já foi aplicada pelo mesmo rig da terceira pessoa.
            model.leftLeg.rotation.z = leftRest - 0.055 * groundWeight;
            model.rightLeg.rotation.z = rightRest + 0.055 * groundWeight;

            // Corrida e nado inclinam o peito para a frente. Mantém o topo
            // dele atrás dos olhos sem mudar a altura dos pés ou girar o horizonte.
            const shoulderHeight = model.leftArm.position.y * model.root.scale.y;
            const setback = 0.38 + shoulderHeight * Math.sin(model.root.rotation.x);
            model.root.position.x = position.x - Math.sin(yaw) * setback;
            model.root.position.z = position.z - Math.cos(yaw) * setback;
        },
    };
}
