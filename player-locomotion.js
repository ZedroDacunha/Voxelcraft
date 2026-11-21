// A fase avança meia volta por contato no chão. O relógio é o dos passos.
export function createLocomotion() {
    return { foot: 0, run: 0 };
}

export function advanceLocomotion(state, steps, running, dt) {
    state.foot = (state.foot + steps) % 2;
    state.run += (Number(running) - state.run) * (1 - Math.exp(-9 * dt));
}

export function groundPose(state, phase, amplitude) {
    const weight = Math.min(1, Math.max(0, amplitude));
    const angle = state.foot * Math.PI + phase / 2;
    const run = state.run;
    const reach = Math.cos(angle);
    const passing = Math.sin(angle);
    const stride = weight * (0.48 + 0.39 * run);
    const armSwing = weight * (0.39 + 0.32 * run) * Math.cos(angle - 0.16);

    return {
        leg: stride * reach,
        arm: armSwing,
        // A perna de retorno sobe enquanto a de apoio passa sob o quadril.
        liftLeft: weight * Math.max(0, passing) ** 2 * (0.038 + 0.105 * run),
        liftRight: weight * Math.max(0, -passing) ** 2 * (0.038 + 0.105 * run),
        elbowLeft: -weight * (0.14 + 0.73 * run + 0.11 * reach),
        elbowRight: -weight * (0.14 + 0.73 * run - 0.11 * reach),
        lean: weight * (0.035 + 0.15 * run),
        twist: weight * (0.045 + 0.07 * run) * reach,
        roll: weight * 0.031 * passing,
        // Compensação vertical pelo arco da perna rígida e suspensão da corrida.
        height: -0.675 * (1 - Math.cos(stride * reach)) + weight * run * 0.048 * passing ** 2,
    };
}

// A divisão acompanha a junção entre o ombro verde e a manga de linho.
export function rigLocomotion(THREE, model) {
    const elbows = [model.leftArm, model.rightArm].map(arm => {
        const sleeve = arm.getObjectByName('sleeve-3d-preview');
        const elbow = new THREE.Group();
        elbow.position.y = -5 * 1.8 / 32;
        arm.add(elbow);
        for (const mesh of [sleeve?.getObjectByName('sleeve'), sleeve?.getObjectByName('cuff'),
            arm.getObjectByName('hand'), arm.getObjectByName('heldItem')]) {
            if (mesh) elbow.attach(mesh);
        }
        return elbow;
    });
    return { elbows, hipY: model.leftLeg.position.y };
}

// A base (nado, golpe, posição e orientação) é aplicada pelo chamador por quadro.
export function applyGroundPose(model, rig, pose, weight = 1) {
    model.leftLeg.rotation.x += pose.leg * weight;
    model.rightLeg.rotation.x -= pose.leg * weight;
    model.leftArm.rotation.x -= pose.arm * weight;
    model.rightArm.rotation.x += pose.arm * weight;
    model.leftLeg.position.y = rig.hipY + pose.liftLeft * weight;
    model.rightLeg.position.y = rig.hipY + pose.liftRight * weight;
    rig.elbows[0].rotation.x = pose.elbowLeft * weight;
    rig.elbows[1].rotation.x = pose.elbowRight * weight;
    model.root.rotation.x += pose.lean * weight;
    model.root.rotation.z = pose.roll * weight;
    model.root.position.y += pose.height * weight * model.root.scale.y;
    model.torso.rotation.y = pose.twist * weight;
    model.head.rotation.x = -pose.lean * weight * 0.74;
}
