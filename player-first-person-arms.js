// Cópias articuladas do avatar local para a câmera da mão.
// Geometrias, texturas e materiais são compartilhados com a roupa equipada.
export function createFirstPersonArms(THREE, model, rig) {
    const shoulders = [];
    const arms = [model.leftArm, model.rightArm].map((source, index) => {
        const pivot = new THREE.Group();
        const arm = source.clone();
        arm.visible = true;
        arm.position.set(0, 0, 0);
        arm.rotation.set(Math.PI / 2, 0, 0);
        pivot.add(arm);
        const elbow = arm.children[source.children.indexOf(rig.elbows[index])];
        elbow.getObjectByName('heldItem')?.removeFromParent();

        // As ombreiras do peitoral têm pivôs próprios no modelo externo.
        const name = index === 0 ? 'chest-left-pivot' : 'chest-right-pivot';
        model.root.traverse(part => {
            if (part.name !== name) return;
            const plate = part.clone();
            plate.position.set(0, 0, 0);
            plate.rotation.set(0, 0, 0);
            arm.add(plate);
            shoulders.push({ visual: plate, source: part.parent });
        });
        // O peitoral cobre só a parte verde da manga.
        const sleeve = source.getObjectByName('sleeve-3d-preview');
        const copy = arm.getObjectByName('sleeve-3d-preview');
        sleeve.children.forEach((part, i) => shoulders.push({ visual: copy.children[i], source: part }));
        return { pivot, arm, elbow };
    });

    const [left, right] = arms;
    const grip = new THREE.Group();
    // Na postura de ação o item coincide com o espaço original da mão.
    // Ao dobrar o cotovelo, a empunhadura segue o mesmo osso que a palma.
    right.pivot.add(grip);
    right.elbow.attach(grip);

    let actionLift = 0;
    function pose(ground, walkWeight, { dt = 0, acting = false, rightWeight = 1 } = {}) {
        // Sobe no início do gesto e desce mais devagar ao soltar. A janela
        // da ação cobre também o intervalo entre duas batidas de mineração.
        actionLift = acting
            ? Math.min(1, actionLift + dt / 0.09)
            : Math.max(0, actionLift - dt / 0.24);
        const easedLift = actionLift * actionLift * (3 - 2 * actionLift);
        const restPitch = 0.23 * (1 - easedLift) * walkWeight;
        const shoulderPitch = Math.PI / 2 - restPitch;
        const stride = ground.arm * walkWeight;
        left.arm.rotation.x = shoulderPitch + 0.75 * stride;
        right.arm.rotation.x = shoulderPitch - 0.75 * stride * rightWeight;
        left.elbow.rotation.x = -0.48 * ground.elbowLeft * walkWeight;
        right.elbow.rotation.x = -0.48 * ground.elbowRight * walkWeight * rightWeight;
        for (const { visual, source } of shoulders) visual.visible = source.visible;
    }

    return { left: left.pivot, right: right.pivot, grip, pose };
}
