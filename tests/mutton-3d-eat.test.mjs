import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';

import {
    DROP_MUTTON_SCALE,
    createMuttonModel,
    createProgressiveMuttonModel,
    setMuttonBiteStage,
} from '../world-mutton-model.js';
import {
    MUTTON_SPRITE_GRID,
    createMuttonSpritePixels,
} from '../world-meats.js';
import {
    FIRST_PERSON_MUTTON_GRIP,
    THIRD_PERSON_MUTTON_GRIP,
    sampleEatAnimation,
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

test('ícone 16x16 Opção B da carne de ovelha mantém silhueta idêntica e contorno tingido', () => {
    const raw = createMuttonSpritePixels(false);
    const cooked = createMuttonSpritePixels(true);
    assert.equal(raw.length, 16);
    assert.equal(cooked.length, 16);
    assert.equal(MUTTON_SPRITE_GRID.length, 16);

    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            assert.equal(Boolean(raw[y][x]), Boolean(cooked[y][x]), `máscara em (${x},${y})`);
            for (const px of [raw[y][x], cooked[y][x]]) {
                if (!px) continue;
                assert.ok(px[0] + px[1] + px[2] > 60, 'nenhum pixel usa preto puro');
            }
        }
    }
});

test('modelo 3D da carne de ovelha compartilha geometria exata entre crua e assada e clona sem erro', () => {
    withCanvasStub(() => {
        const rawDrop = createMuttonModel(THREE, false, 0);
        const cookedDrop = createMuttonModel(THREE, true, 0);
        assert.equal(rawDrop.userData.isMuttonModel, true);
        assert.equal(rawDrop.userData.isCookedMutton, false);
        assert.equal(cookedDrop.userData.isCookedMutton, true);
        assert.ok(DROP_MUTTON_SCALE > 0.25 && DROP_MUTTON_SCALE < 0.5);

        const rawSize = new THREE.Box3().setFromObject(rawDrop).getSize(new THREE.Vector3());
        const cookedSize = new THREE.Box3().setFromObject(cookedDrop).getSize(new THREE.Vector3());
        assert.ok(Math.abs(rawSize.x - cookedSize.x) < 1e-6);
        assert.ok(Math.abs(rawSize.y - cookedSize.y) < 1e-6);
        assert.ok(Math.abs(rawSize.z - cookedSize.z) < 1e-6);
        const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
        assert.ok(maxDim > 0.95 && maxDim < 1.20, `dimensão normalizada: ${maxDim}`);

        const fpCooked = createProgressiveMuttonModel(THREE, true);
        const tpClone = fpCooked.clone();
        setMuttonBiteStage(fpCooked, 2);
        setMuttonBiteStage(tpClone, 0);

        const fpFace = fpCooked.getObjectByName('muttonFace');
        const tpFace = tpClone.getObjectByName('muttonFace');
        assert.equal(fpFace.children[0].visible, false);
        assert.equal(fpFace.children[2].visible, true, 'original avançou para estágio 2');
        assert.equal(tpFace.children[0].visible, true, 'clone permaneceu independente no estágio 0');
        assert.equal(tpFace.children[2].visible, false);

        setMuttonBiteStage(tpClone, 4);
        assert.ok([0, 1, 2, 3].every(i => !tpFace.children[i].visible), 'estágio 4 oculta o osso consumido');
    });
});

test('empunhadura pelo osso em 1ª e 3ª pessoa não obstrui a mira e alinha a carne à boca até o osso roído', () => {
    withCanvasStub(() => {
        // 1ª pessoa: verifica que o topo da carne inteira (estágio 0) fica abaixo da mira central (+)
        const handCam = new THREE.PerspectiveCamera(70, 16 / 9, 0.01, 5);
        const handPivot = new THREE.Group();
        const heldAnchor = new THREE.Group();
        heldAnchor.position.set(0, 0.03, -0.62);
        const fpMutton = createProgressiveMuttonModel(THREE, true);
        heldAnchor.add(fpMutton);
        handPivot.add(heldAnchor);
        handCam.add(handPivot);

        applyFirstPersonEatPose(handPivot, fpMutton, sampleEatAnimation(0));
        assert.deepEqual(
            fpMutton.position.toArray().map(n => +n.toFixed(4)),
            FIRST_PERSON_MUTTON_GRIP.pos,
        );

        handPivot.position.set(0.42, -0.50, -0.25);
        handPivot.rotation.set(0.35, 0.25, 0);
        const firstBitePeak = sampleEatAnimation(0.14 + (0.28 / 4) * 0.72);
        setMuttonBiteStage(fpMutton, 0);
        applyFirstPersonEatPose(handPivot, fpMutton, firstBitePeak);
        handCam.updateMatrixWorld(true);
        const fpTop = fpMutton.getObjectByName('biteTarget').getWorldPosition(new THREE.Vector3());
        const ndc = fpTop.clone().project(handCam);
        assert.ok(ndc.y < -0.05, `topo da carne fica abaixo da mira central (+): ndc.y=${ndc.y}`);

        // 3ª pessoa: verifica cotovelo puro em X e alinhamento da carne à boca nos estágios 0 e 3
        const model = createPlayerModel(THREE);
        const held = createPlayerHeldItem(THREE, model.rightArm);
        const rig = rigLocomotion(THREE, model);
        const loco = createLocomotion();

        held.update(101, fpMutton, null, true, false);
        const tpMutton = held.anchor.children[0];
        assert.ok(tpMutton, 'carne 3D clonada na mão em 3ª pessoa');
        assert.deepEqual(
            tpMutton.position.toArray().map(n => +n.toFixed(4)),
            THIRD_PERSON_MUTTON_GRIP.pos,
        );

        for (const [pSample, stg] of [[0.14 + (0.28 / 4) * 0.72, 0], [0.14 + (3.28 / 4) * 0.72, 3]]) {
            for (const p of [model.root, model.head, model.torso, model.leftArm, model.rightArm, rig.elbows[0], rig.elbows[1]]) {
                p.rotation.set(0, 0, 0);
            }
            applyGroundPose(model, rig, groundPose(loco, 0, 0), 1);
            const eatSample = sampleEatAnimation(pSample);
            setMuttonBiteStage(tpMutton, stg);
            applyThirdPersonEatPose(model, rig, tpMutton, eatSample, 1);

            assert.equal(rig.elbows[1].rotation.y, 0, 'cotovelo sem torção Y');
            assert.equal(rig.elbows[1].rotation.z, 0, 'cotovelo sem torção Z');

            model.root.updateMatrixWorld(true);
            const mouth = model.head.getObjectByName('mouth').getWorldPosition(new THREE.Vector3());
            const bitePos = tpMutton.getObjectByName('biteTarget').getWorldPosition(new THREE.Vector3());
            assert.ok(Math.abs(bitePos.x - mouth.x) < 0.08, `estágio ${stg} alinhado em X: dx=${bitePos.x - mouth.x}`);
            assert.ok(Math.abs(bitePos.y - mouth.y) < 0.09, `estágio ${stg} na altura da boca: dy=${bitePos.y - mouth.y}`);
            assert.ok(bitePos.z - mouth.z > 0.06 && bitePos.z - mouth.z < 0.26, `estágio ${stg} à frente do rosto: dz=${bitePos.z - mouth.z}`);
        }

        model.dispose();
    });
});

test('migalhas de carne crua e assada usam paletas distintas e receitas de áudio existem', () => {
    const parent = new THREE.Group();
    const crumbs = createAppleCrumbSystem(THREE, parent);
    crumbs.burst(new THREE.Vector3(0, 1.4, 0.3), 1, 1, 'mutton-cooked');
    const cookedHex = crumbs.group.children[0].material.color.getHexString();
    crumbs.clear();
    crumbs.burst(new THREE.Vector3(0, 1.4, 0.3), 1, 1, 'mutton-raw');
    const rawHex = crumbs.group.children[0].material.color.getHexString();
    assert.notEqual(cookedHex, rawHex, 'migalhas assadas e cruas têm cores distintas');
    crumbs.update(1.0);
    assert.equal(crumbs.group.children.length, 0);

    assert.ok(SOUND_RECIPES['eat-chew'], 'som eat-chew registrado');
    assert.ok(SOUND_RECIPES['eat-swallow'], 'som eat-swallow registrado');
});
