// Animação visual de comer (maçã, carne de ovelha e outros alimentos). As câmeras em 1ª e 3ª pessoa amostram a mesma fase.
import { clamp01, smoothstep } from './world-math.js';
import { APPLE_PALETTE } from './world-apple-model.js';
import { MUTTON_RAW_3D_PALETTE, MUTTON_COOKED_3D_PALETTE } from './world-mutton-model.js';

export const EAT_DURATION = 1.54;

export const FIRST_PERSON_APPLE_GRIP = {
    pos: [-0.012, 0.075, 0.042],
    rot: [-0.28, -0.34, 0.04],
    scale: 0.29,
};

export const THIRD_PERSON_APPLE_GRIP = {
    pos: [-0.01, -0.04, 0.02],
    rot: [-0.22, -0.25, 0.06],
    scale: 0.27,
};

export const FIRST_PERSON_MUTTON_GRIP = {
    pos: [-0.015, 0.022, -0.005],
    rot: [-0.14, -0.24, 0.10],
    scale: 0.36,
};

export const THIRD_PERSON_MUTTON_GRIP = {
    pos: [0.03, -0.11, -0.058],
    rot: [1.22, 0.0, -0.20],
    faceYaw: -0.95,
    scale: 0.35,
};

const CRUMB_PALETTES = {
    apple: [
        APPLE_PALETTE.fleshHi,
        APPLE_PALETTE.fleshLight,
        APPLE_PALETTE.fleshMid,
        APPLE_PALETTE['2'],
        APPLE_PALETTE['3'],
        APPLE_PALETTE.rindRed,
    ],
    'mutton-cooked': [
        MUTTON_COOKED_3D_PALETTE.biteHi,
        MUTTON_COOKED_3D_PALETTE.biteMid,
        MUTTON_COOKED_3D_PALETTE['3'],
        MUTTON_COOKED_3D_PALETTE['2'],
        MUTTON_COOKED_3D_PALETTE['1'],
        MUTTON_COOKED_3D_PALETTE.F,
    ],
    'mutton-raw': [
        MUTTON_RAW_3D_PALETTE.biteHi,
        MUTTON_RAW_3D_PALETTE['3'],
        MUTTON_RAW_3D_PALETTE['2'],
        MUTTON_RAW_3D_PALETTE['1'],
        MUTTON_RAW_3D_PALETTE.F,
        MUTTON_RAW_3D_PALETTE.f,
    ],
};

function easeInOutSine(t) {
    return 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
}

function calmBitePulse(u) {
    u = clamp01(u);
    if (u < 0.28) return 0.5 - 0.5 * Math.cos(Math.PI * (u / 0.28));
    if (u < 0.72) return 0.5 + 0.5 * Math.cos(Math.PI * ((u - 0.28) / 0.44));
    return 0;
}

export function sampleEatAnimation(progress) {
    const p = clamp01(progress);
    if (p <= 0 || p >= 1) {
        return {
            active: false,
            p,
            lift: 0,
            bite: 0,
            turnStep: 0,
            wristYaw: 0,
            stage: 0,
            biteIndex: -1,
            consumeShrink: 1,
            swallow: 0,
            camNod: 0,
            pivotPos: [0, 0, 0],
            pivotRot: [0, 0, 0],
            itemPos: [0, 0, 0],
            itemRot: [0, 0, 0],
        };
    }

    const enter = p < 0.135 ? easeInOutSine(Math.pow(p / 0.135, 0.78)) : 1;
    const exit = p > 0.865 ? 1 - easeInOutSine((p - 0.865) / 0.135) : 1;
    const lift = enter * exit;

    const biteStart = 0.14;
    const biteEnd = 0.86;
    const biteSpan = biteEnd - biteStart;
    const bites = 4;

    let bite = 0;
    let turnGlide = 0;
    let biteIndex = -1;
    let stage = 0;

    if (p >= biteStart && p < biteEnd) {
        const bp = ((p - biteStart) / biteSpan) * bites;
        biteIndex = Math.min(bites - 1, Math.floor(bp));
        const u = bp - biteIndex;
        bite = calmBitePulse(u);
        turnGlide = biteIndex < bites - 1 ? smoothstep(0.44, 0.88, u) : 0;
        stage = biteIndex + (u >= 0.26 ? 1 : 0);
    } else if (p >= biteEnd) {
        stage = 4;
    }

    const turnStep = biteIndex >= 0
        ? Math.min(bites - 1, biteIndex + turnGlide)
        : (p >= biteEnd ? bites - 1 : 0);
    const wristYaw = (-0.02 + 0.34 * (turnStep / 3)) * lift;

    const finalHitP = biteStart + (3.26 / bites) * biteSpan;
    const consumeShrink = stage < 4 ? 1 : Math.max(0, 1 - smoothstep(finalHitP, finalHitP + 0.055, p));

    let swallow = 0;
    if (p > 0.84 && p < 0.93) {
        swallow = Math.sin(Math.PI * ((p - 0.84) / 0.09));
    }

    const turnPulse = Math.sin(Math.PI * turnGlide);

    return {
        active: true,
        p,
        lift,
        bite,
        turnStep,
        wristYaw,
        stage,
        biteIndex,
        consumeShrink,
        swallow,
        camNod: 0.011 * bite * lift + 0.008 * swallow,
        pivotPos: [
            -0.180 * lift - 0.013 * bite,
            0.036 * lift + 0.024 * bite - 0.008 * swallow,
            0.130 * lift + 0.028 * bite,
        ],
        pivotRot: [
            0.010 * lift + 0.098 * bite - 0.024 * swallow,
            0.084 * lift + 0.022 * bite,
            0.148 * lift + 0.032 * bite - 0.018 * turnPulse,
        ],
        itemPos: [
            0.004 * turnPulse,
            0.006 * bite,
            0.010 * bite,
        ],
        itemRot: [
            0.16 * lift + 0.075 * bite,
            wristYaw,
            -0.06 * lift + 0.045 * turnPulse,
        ],
    };
}

export function eatBitePitch(biteNum) {
    return [1.0, 0.96, 1.03, 1.09, 1.15][biteNum] ?? 1.0;
}

export function applyFirstPersonAppleGrip(itemRoot, scale = FIRST_PERSON_APPLE_GRIP.scale) {
    if (!itemRoot) return;
    itemRoot.visible = true;
    itemRoot.position.set(...FIRST_PERSON_APPLE_GRIP.pos);
    itemRoot.rotation.set(...FIRST_PERSON_APPLE_GRIP.rot);
    itemRoot.scale.setScalar(scale);
}

export function applyFirstPersonMuttonGrip(itemRoot, scale = FIRST_PERSON_MUTTON_GRIP.scale) {
    if (!itemRoot) return;
    itemRoot.visible = true;
    itemRoot.position.set(...FIRST_PERSON_MUTTON_GRIP.pos);
    itemRoot.rotation.set(...FIRST_PERSON_MUTTON_GRIP.rot);
    itemRoot.scale.setScalar(scale);
    const face = itemRoot.getObjectByName?.('muttonFace');
    if (face) face.rotation.set(0, 0, 0);
}

export function applyFirstPersonEatPose(handPivot, itemRoot, eat) {
    const isApple = Boolean(itemRoot?.userData?.isAppleModel);
    const isMutton = Boolean(itemRoot?.userData?.isMuttonModel);
    if (!eat || !eat.active) {
        if (isApple) applyFirstPersonAppleGrip(itemRoot);
        else if (isMutton) applyFirstPersonMuttonGrip(itemRoot);
        return;
    }

    if (isMutton) {
        const { lift, bite, turnStep, consumeShrink, swallow } = eat;
        const stageNorm = Math.min(3, turnStep) / 3;
        handPivot.position.x += -0.175 * lift - 0.012 * bite;
        handPivot.position.y += -0.175 * lift + 0.022 * bite - 0.008 * swallow;
        handPivot.position.z += 0.115 * lift + 0.024 * bite;
        handPivot.rotation.x += 0.02 * lift + 0.08 * bite - 0.02 * swallow;
        handPivot.rotation.y += 0.08 * lift;
        handPivot.rotation.z += 0.14 * lift + 0.03 * bite;

        const s = FIRST_PERSON_MUTTON_GRIP.scale * consumeShrink;
        if (s <= 0.003) {
            itemRoot.visible = false;
            return;
        }
        itemRoot.visible = true;
        itemRoot.scale.setScalar(s);
        itemRoot.position.set(
            FIRST_PERSON_MUTTON_GRIP.pos[0],
            FIRST_PERSON_MUTTON_GRIP.pos[1] + (0.095 * stageNorm) * lift + 0.010 * bite,
            FIRST_PERSON_MUTTON_GRIP.pos[2] + 0.014 * bite,
        );
        itemRoot.rotation.set(
            FIRST_PERSON_MUTTON_GRIP.rot[0] + 0.16 * lift + 0.08 * bite,
            FIRST_PERSON_MUTTON_GRIP.rot[1] + (0.28 * stageNorm) * lift,
            FIRST_PERSON_MUTTON_GRIP.rot[2] - 0.05 * lift,
        );
        const face = itemRoot.getObjectByName?.('muttonFace');
        if (face) face.rotation.set(0, 0, 0);
        return;
    }

    handPivot.position.x += eat.pivotPos[0];
    handPivot.position.y += eat.pivotPos[1];
    handPivot.position.z += eat.pivotPos[2];
    handPivot.rotation.x += eat.pivotRot[0];
    handPivot.rotation.y += eat.pivotRot[1];
    handPivot.rotation.z += eat.pivotRot[2];

    if (!isApple) return;
    const s = FIRST_PERSON_APPLE_GRIP.scale * eat.consumeShrink;
    if (s <= 0.003) {
        itemRoot.visible = false;
        return;
    }
    itemRoot.visible = true;
    itemRoot.scale.setScalar(s);
    itemRoot.position.set(
        FIRST_PERSON_APPLE_GRIP.pos[0] + eat.itemPos[0],
        FIRST_PERSON_APPLE_GRIP.pos[1] + eat.itemPos[1],
        FIRST_PERSON_APPLE_GRIP.pos[2] + eat.itemPos[2],
    );
    itemRoot.rotation.set(
        FIRST_PERSON_APPLE_GRIP.rot[0] + eat.itemRot[0],
        FIRST_PERSON_APPLE_GRIP.rot[1] + eat.itemRot[1],
        FIRST_PERSON_APPLE_GRIP.rot[2] + eat.itemRot[2],
    );
}

export function applyThirdPersonAppleGrip(itemRoot, scale = THIRD_PERSON_APPLE_GRIP.scale) {
    if (!itemRoot) return;
    itemRoot.visible = true;
    itemRoot.position.set(...THIRD_PERSON_APPLE_GRIP.pos);
    itemRoot.rotation.set(...THIRD_PERSON_APPLE_GRIP.rot);
    itemRoot.scale.setScalar(scale);
}

export function applyThirdPersonMuttonGrip(itemRoot, scale = THIRD_PERSON_MUTTON_GRIP.scale) {
    if (!itemRoot) return;
    itemRoot.visible = true;
    itemRoot.position.set(...THIRD_PERSON_MUTTON_GRIP.pos);
    itemRoot.rotation.set(...THIRD_PERSON_MUTTON_GRIP.rot);
    itemRoot.scale.setScalar(scale);
    const face = itemRoot.getObjectByName?.('muttonFace');
    if (face) face.rotation.set(0, THIRD_PERSON_MUTTON_GRIP.faceYaw, 0);
}

// Sobrepõe a pose de comer em 3ª pessoa sobre a locomoção corrente (parado ou andando).
export function applyThirdPersonEatPose(model, rig, itemRoot, eat, weight = 1) {
    const isApple = Boolean(itemRoot?.userData?.isAppleModel);
    const isMutton = Boolean(itemRoot?.userData?.isMuttonModel);
    if (!eat || !eat.active || weight <= 0.001) {
        if (isApple) applyThirdPersonAppleGrip(itemRoot);
        else if (isMutton) applyThirdPersonMuttonGrip(itemRoot);
        return;
    }
    const lift = eat.lift * weight;
    const { bite, turnStep, consumeShrink, swallow } = eat;
    const wristNorm = turnStep / 3;

    if (isMutton) {
        const arm = model.rightArm.rotation;
        arm.x = arm.x * (1 - 0.90 * lift) + (-0.38 - 0.05 * bite - 0.18 * wristNorm + 0.03 * swallow) * lift;
        arm.y = arm.y * (1 - lift) + (-0.44 - 0.08 * wristNorm - 0.03 * bite) * lift;
        arm.z = arm.z * (1 - lift) + (-0.22 - 0.02 * bite) * lift;

        const elbow = rig.elbows[1].rotation;
        elbow.x = elbow.x * (1 - lift) + (-0.84 - 0.08 * bite - 0.38 * wristNorm + 0.04 * swallow) * lift;
        elbow.y *= 1 - lift;
        elbow.z *= 1 - lift;

        model.head.rotation.x += (0.10 + 0.09 * bite) * lift + 0.04 * swallow * weight;
        model.head.rotation.y += (-0.05 + 0.02 * bite) * lift;
        model.torso.rotation.x += (0.025 + 0.02 * bite) * lift;
        model.torso.rotation.y += -0.035 * lift;

        const s = THIRD_PERSON_MUTTON_GRIP.scale * consumeShrink;
        if (s <= 0.003) {
            itemRoot.visible = false;
            return;
        }
        itemRoot.visible = true;
        itemRoot.scale.setScalar(s);
        itemRoot.position.set(
            THIRD_PERSON_MUTTON_GRIP.pos[0] * (1 - lift) + 0.01 * lift,
            THIRD_PERSON_MUTTON_GRIP.pos[1] * (1 - lift) + (-0.095) * lift,
            THIRD_PERSON_MUTTON_GRIP.pos[2],
        );
        itemRoot.rotation.set(
            THIRD_PERSON_MUTTON_GRIP.rot[0] * (1 - lift) + (1.12 + 0.08 * bite + 0.26 * wristNorm) * lift,
            0,
            THIRD_PERSON_MUTTON_GRIP.rot[2] * (1 - lift) + 0.20 * lift,
        );
        const face = itemRoot.getObjectByName?.('muttonFace');
        if (face) {
            face.rotation.set(
                0,
                THIRD_PERSON_MUTTON_GRIP.faceYaw * (1 - lift) + (-0.60 + 0.32 * wristNorm) * lift,
                0,
            );
        }
        return;
    }

    // Ombro traz o braço à frente e ao centro mantendo 10% do balanço da caminhada.
    const arm = model.rightArm.rotation;
    arm.x = arm.x * (1 - 0.90 * lift) + (-0.66 - 0.06 * bite + 0.03 * swallow) * lift;
    arm.y = arm.y * (1 - lift) + (-0.40 - 0.04 * bite) * lift;
    arm.z = arm.z * (1 - lift) + (-0.25 - 0.03 * bite) * lift;

    // Cotovelo funciona como dobradiça pura em X para não desalinhar a manga quadrada.
    const elbow = rig.elbows[1].rotation;
    elbow.x = elbow.x * (1 - lift) + (-1.40 - 0.10 * bite + 0.05 * swallow) * lift;
    elbow.y *= 1 - lift;
    elbow.z *= 1 - lift;

    // Aceno calmo da cabeça ao morder + leve engolir no final.
    model.head.rotation.x += (0.08 + 0.11 * bite) * lift + 0.045 * swallow * weight;
    model.head.rotation.y += (-0.05 + 0.02 * bite) * lift;
    model.torso.rotation.x += (0.025 + 0.02 * bite) * lift;
    model.torso.rotation.y += -0.035 * lift;

    if (!isApple) return;
    const s = THIRD_PERSON_APPLE_GRIP.scale * consumeShrink;
    if (s <= 0.003) {
        itemRoot.visible = false;
        return;
    }
    itemRoot.visible = true;
    itemRoot.scale.setScalar(s);
    itemRoot.position.set(
        THIRD_PERSON_APPLE_GRIP.pos[0] - 0.07 * lift,
        THIRD_PERSON_APPLE_GRIP.pos[1] - 0.11 * lift,
        THIRD_PERSON_APPLE_GRIP.pos[2] - 0.09 * lift - 0.012 * bite,
    );
    itemRoot.rotation.set(
        THIRD_PERSON_APPLE_GRIP.rot[0] * (1 - lift) + (1.92 + 0.10 * bite) * lift,
        THIRD_PERSON_APPLE_GRIP.rot[1] * (1 - lift) + (2.40 - 0.68 * wristNorm) * lift,
        THIRD_PERSON_APPLE_GRIP.rot[2] * (1 - lift) + (-0.22) * lift,
    );
}

export function createAppleCrumbSystem(THREE, parent, options = {}) {
    const sizeMin = options.sizeMin ?? 0.012;
    const sizeSpan = options.sizeSpan ?? 0.006;
    const gravity = options.gravity ?? -2.4;
    const spread = options.spread ?? 1;

    const group = new THREE.Group();
    parent.add(group);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const matsByKind = Object.fromEntries(
        Object.entries(CRUMB_PALETTES).map(([k, hexes]) => [
            k,
            hexes.map(hex => new THREE.MeshLambertMaterial({ color: hex })),
        ]),
    );
    const pool = [];
    const active = [];

    function acquire(mats, matIndex) {
        const mesh = pool.pop() || new THREE.Mesh(geo, mats[0]);
        mesh.material = mats[matIndex % mats.length];
        mesh.visible = true;
        group.add(mesh);
        return mesh;
    }

    function burst(origin, biteNum = 1, forwardSign = 1, kind = 'apple') {
        const mats = matsByKind[kind] || matsByKind.apple;
        const count = biteNum === 4 ? 8 : 6;
        for (let i = 0; i < count; i++) {
            const mesh = acquire(mats, i + biteNum * 2);
            const baseSize = sizeMin + ((i * 37 + biteNum * 13) % 10) * 0.1 * sizeSpan;
            mesh.scale.setScalar(baseSize);
            const spreadAngle = ((i / count) - 0.5) * 2.1 + (((i * 19) % 7) - 3) * 0.06;
            const speed = (0.34 + ((i * 29 + biteNum * 11) % 9) * 0.036) * spread;
            mesh.position.set(
                origin.x + Math.sin(spreadAngle) * 0.018 * spread,
                origin.y + ((((i * 17) % 5) - 2) * 0.008) * spread,
                origin.z + forwardSign * 0.018 * spread,
            );
            mesh.rotation.set(i * 0.7, biteNum * 1.1 + i * 0.5, i * 0.4);
            active.push({
                mesh,
                baseSize,
                age: 0,
                life: 0.36 + (i % 4) * 0.035,
                vx: Math.sin(spreadAngle) * speed * 0.95,
                vy: (0.18 + (i % 3) * 0.075) * spread,
                vz: forwardSign * (0.14 + (i % 4) * 0.055) * spread,
                rx: (i % 2 === 0 ? 1 : -1) * (5.5 + i * 0.9),
                ry: (i % 3 === 0 ? -1 : 1) * (6.2 + i * 0.7),
            });
        }
    }

    function update(dt) {
        for (let i = active.length - 1; i >= 0; i--) {
            const p = active[i];
            p.age += dt;
            if (p.age >= p.life) {
                p.mesh.visible = false;
                group.remove(p.mesh);
                pool.push(p.mesh);
                active.splice(i, 1);
                continue;
            }
            p.vy += gravity * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            p.mesh.rotation.x += p.rx * dt;
            p.mesh.rotation.y += p.ry * dt;
            const t = p.age / p.life;
            const shrink = t > 0.62 ? 1 - (t - 0.62) / 0.38 : 1;
            p.mesh.scale.setScalar(Math.max(0.001, p.baseSize * shrink));
        }
    }

    function clear() {
        while (active.length) {
            const p = active.pop();
            p.mesh.visible = false;
            group.remove(p.mesh);
            pool.push(p.mesh);
        }
    }

    return { burst, update, clear, group };
}
