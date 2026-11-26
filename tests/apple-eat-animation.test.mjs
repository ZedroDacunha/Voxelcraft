import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';

import {
    DROP_APPLE_SCALE,
    createAppleModel,
    createProgressiveAppleModel,
    setAppleBiteStage,
} from '../world-apple-model.js';
import {
    EAT_DURATION,
    FIRST_PERSON_APPLE_GRIP,
    THIRD_PERSON_APPLE_GRIP,
    sampleEatAnimation,
    eatBitePitch,
    applyFirstPersonEatPose,
    applyThirdPersonEatPose,
    createAppleCrumbSystem,
} from '../player-eat-animation.js';
import { createPlayerModel } from '../player-model.js';
import { createLocomotion, groundPose, rigLocomotion, applyGroundPose } from '../player-locomotion.js';
import { createPlayerHeldItem } from '../player-held-item.js';
import { SOUND_RECIPES } from '../world-audio.js';

function withCanvasStub(fn) {
    const prev = globalThis.document;
    globalThis.document = {
        createElement(tag) {
            if (tag !== 'canvas') throw new Error(`Unexpected tag: ${tag}`);
            return {
                width: 0,
                height: 0,
                getContext: () => ({ fillStyle: '#000', fillRect() {} }),
            };
        },
    };
    try {
        return fn();
    } finally {
        if (prev === undefined) delete globalThis.document;
        else globalThis.document = prev;
    }
}

test('modelo 3D da maçã normaliza altura unitária e compartilha estágios independentes no clone', () => {
    withCanvasStub(() => {
        const intact = createAppleModel(THREE, undefined, 0);
        assert.equal(intact.userData.isAppleModel, true);
        const box = new THREE.Box3().setFromObject(intact);
        const size = box.getSize(new THREE.Vector3());
        assert.ok(Math.abs(size.y - 1.0) < 0.02, `altura normalizada: ${size.y}`);
        assert.ok(DROP_APPLE_SCALE > 0.2 && DROP_APPLE_SCALE < 0.5);

        const fpApple = createProgressiveAppleModel(THREE);
        const tpClone = fpApple.clone();
        setAppleBiteStage(fpApple, 2);
        setAppleBiteStage(tpClone, 0);

        assert.equal(fpApple.children[0].visible, false, 'original saiu do estágio 0');
        assert.equal(fpApple.children[2].visible, true, 'original foi para o estágio 2');
        assert.equal(tpClone.children[0].visible, true, 'clone permanece independente no estágio 0');
        assert.equal(tpClone.children[2].visible, false);

        setAppleBiteStage(tpClone, 4);
        assert.ok(tpClone.children.every(c => !c.visible), 'estágio 4 esconde o miolo consumido');
    });
});

test('fase de comer (1.54s) avança monotonicamente pelos 4 estágios de mordida com giro suave no punho', () => {
    assert.equal(EAT_DURATION, 1.54);
    assert.equal(sampleEatAnimation(0).active, false);
    assert.equal(sampleEatAnimation(1).active, false);

    let prevStage = 0;
    const seenStages = new Set();
    let minYaw = Infinity;
    let maxYaw = -Infinity;

    for (let i = 1; i < 200; i++) {
        const s = sampleEatAnimation(i / 200);
        assert.equal(s.active, true);
        assert.ok(s.stage >= prevStage, `estágio não regride em p=${i / 200}`);
        prevStage = s.stage;
        seenStages.add(s.stage);
        if (s.p > 0.16 && s.p < 0.84) {
            minYaw = Math.min(minYaw, s.wristYaw);
            maxYaw = Math.max(maxYaw, s.wristYaw);
        }
    }
    assert.deepEqual([...seenStages], [0, 1, 2, 3, 4]);
    assert.ok(maxYaw - minYaw > 0.25, 'punho gira progressivamente entre as mordidas');
    assert.equal(sampleEatAnimation(0.84).consumeShrink, 0, 'miolo encolhe após a 4ª mordida');
});

test('pose em 1ª e 3ª pessoa leva a maçã 3D até a altura da boca mantendo cotovelo como dobradiça pura', () => {
    withCanvasStub(() => {
        const model = createPlayerModel(THREE);
        const held = createPlayerHeldItem(THREE, model.rightArm);
        const rig = rigLocomotion(THREE, model);
        const loco = createLocomotion();

        const fpApple = createProgressiveAppleModel(THREE);
        const handPivot = new THREE.Group();
        applyFirstPersonEatPose(handPivot, fpApple, sampleEatAnimation(0));
        assert.deepEqual(
            fpApple.position.toArray().map(n => +n.toFixed(4)),
            FIRST_PERSON_APPLE_GRIP.pos,
        );

        held.update(30, fpApple, null, true, false);
        const tpApple = held.anchor.children[0];
        assert.ok(tpApple, 'maçã clonada na mão em 3ª pessoa');
        assert.deepEqual(
            tpApple.position.toArray().map(n => +n.toFixed(4)),
            THIRD_PERSON_APPLE_GRIP.pos,
        );

        // Testa no pico da 2ª mordida
        for (const p of [model.root, model.head, model.torso, model.leftArm, model.rightArm, rig.elbows[0], rig.elbows[1]]) {
            p.rotation.set(0, 0, 0);
        }
        applyGroundPose(model, rig, groundPose(loco, 0, 0), 1);
        const bitePeak = sampleEatAnimation(0.14 + (1.28 / 4) * 0.72);
        assert.ok(bitePeak.bite > 0.95, 'amostra está no pico da mordida');
        applyThirdPersonEatPose(model, rig, tpApple, bitePeak, 1);

        assert.equal(rig.elbows[1].rotation.y, 0, 'cotovelo sem torção Y');
        assert.equal(rig.elbows[1].rotation.z, 0, 'cotovelo sem torção Z');

        model.root.updateMatrixWorld(true);
        const mouth = model.head.getObjectByName('mouth').getWorldPosition(new THREE.Vector3());
        const applePos = tpApple.getWorldPosition(new THREE.Vector3());
        assert.ok(Math.abs(applePos.x - mouth.x) < 0.06, `alinhado ao centro da boca: dx=${applePos.x - mouth.x}`);
        assert.ok(Math.abs(applePos.y - mouth.y) < 0.07, `na altura da boca: dy=${applePos.y - mouth.y}`);
        assert.ok(applePos.z - mouth.z > 0.10 && applePos.z - mouth.z < 0.24, `à frente dos lábios sem atravessar o rosto: dz=${applePos.z - mouth.z}`);

        model.dispose();
    });
});

test('sistema de farelos recicla partículas e receitas de som de comer estão registradas', () => {
    const parent = new THREE.Group();
    const crumbs = createAppleCrumbSystem(THREE, parent);
    crumbs.burst(new THREE.Vector3(0, 1.4, 0.35), 1, 1);
    assert.equal(crumbs.group.children.length, 6);
    crumbs.update(0.1);
    assert.equal(crumbs.group.children.length, 6);
    crumbs.update(1.0);
    assert.equal(crumbs.group.children.length, 0, 'farelos expiram e voltam ao pool');

    assert.ok(SOUND_RECIPES['eat-crunch']);
    assert.ok(SOUND_RECIPES['eat-chew']);
    assert.ok(SOUND_RECIPES['eat-swallow']);
    assert.ok(eatBitePitch(4) > eatBitePitch(1), 'mordida final no miolo é levemente mais aguda/crocante');
});
