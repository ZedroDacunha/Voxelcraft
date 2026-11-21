import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createPlayerModel, PLAYER_MODEL_HEIGHT, PLAYER_MODEL_COLORS } from '../player-model.js';

test('corpo do jogador tem seis partes articuladas e medidas em blocos', () => {
    const model = createPlayerModel(THREE);
    assert.deepEqual(model.root.children.map(part => part.name), ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']);
    const bounds = new THREE.Box3().setFromObject(model.root);
    assert.ok(Math.abs(bounds.min.y) < 1e-6);
    assert.ok(Math.abs(bounds.max.y - (PLAYER_MODEL_HEIGHT + 2 * PLAYER_MODEL_HEIGHT / 32)) < 1e-6);
    assert.equal(model.leftArm.position.y, 24 * PLAYER_MODEL_HEIGHT / 32);
    assert.equal(model.leftLeg.position.y, 12 * PLAYER_MODEL_HEIGHT / 32);
    assert.ok(model.head.getObjectByName('pupil').position.z > 0);
    model.dispose();
});

test('modelos independentes aceitam cores e liberam recursos', () => {
    const a = createPlayerModel(THREE, { tunic: 0xff0000 });
    const b = createPlayerModel(THREE);
    const mesh = a.torso.getObjectByName('tunic');
    assert.equal(mesh.material.color.getHex(), 0xff0000);
    assert.equal(b.torso.getObjectByName('tunic').material.color.getHex(), PLAYER_MODEL_COLORS.tunic);
    a.leftArm.rotation.x = 0.5;
    assert.equal(b.leftArm.rotation.x, 0);
    let geometriaLiberada = false, materialLiberado = false;
    mesh.geometry.addEventListener('dispose', () => { geometriaLiberada = true; });
    mesh.material.addEventListener('dispose', () => { materialLiberado = true; });
    a.dispose(); b.dispose();
    assert.ok(geometriaLiberada && materialLiberado);
});

test('cabeça tem couro cabeludo completo, cabelo separado e rosto preservado', () => {
    const model = createPlayerModel(THREE); model.root.updateMatrixWorld(true);
    const head = model.head;
    const face = head.getObjectByName('face');
    const bounds = new THREE.Box3().setFromObject(face);
    assert.ok(Math.abs(bounds.max.y - PLAYER_MODEL_HEIGHT) < 1e-6);
    assert.equal(face.geometry.parameters.width, 8 * PLAYER_MODEL_HEIGHT / 32);
    assert.equal(face.geometry.parameters.height, 8 * PLAYER_MODEL_HEIGHT / 32);
    assert.equal(face.geometry.parameters.depth, 8 * PLAYER_MODEL_HEIGHT / 32);
    assert.equal(head.children.filter(p => p.name === 'player-hair').length, 1);
    assert.equal(head.children.filter(p => p.name === 'eyebrow').length, 2);
    assert.equal(head.children.filter(p => p.name === 'eye-white').length, 2);
    assert.equal(head.children.filter(p => p.name === 'pupil').length, 2);
    assert.ok(head.getObjectByName('mouth'));
    let released = false; face.geometry.addEventListener('dispose', () => released = true);
    model.dispose(); assert.equal(released, true);
});

test('olhos da referência têm pupilas simétricas dentro da parte branca e não sobrepõem sobrancelhas', () => {
    const model = createPlayerModel(THREE); model.root.updateMatrixWorld(true);
    const list = name => model.head.children.filter(part => part.name === name).sort((a, b) => a.position.x - b.position.x);
    const whites = list('eye-white'), pupils = list('pupil'), eyebrows = list('eyebrow');
    assert.equal(whites.length, 2); assert.equal(pupils.length, 2);
    for (let i = 0; i < 2; i++) {
        const white = new THREE.Box3().setFromObject(whites[i]);
        const pupil = new THREE.Box3().setFromObject(pupils[i]);
        const brow = new THREE.Box3().setFromObject(eyebrows[i]);
        assert.ok(pupil.min.x > white.min.x && pupil.max.x < white.max.x);
        assert.ok(pupil.min.y > white.min.y && pupil.max.y < white.max.y);
        assert.ok(pupil.max.z > white.max.z, 'pupila à frente do branco');
        assert.ok(white.max.y < brow.min.y, 'olho não atravessa a sobrancelha');
        assert.ok(Math.abs(pupils[i].position.x) < Math.abs(whites[i].position.x));
    }
    assert.ok(Math.abs(pupils[0].position.x + pupils[1].position.x) < 1e-10);
    model.dispose();
});

test('nariz 3D independente fica fora da face e não encobre olhos ou boca', () => {
    const model = createPlayerModel(THREE); model.root.updateMatrixWorld(true);
    const head = model.head, nose = head.getObjectByName('nose');
    assert.ok(nose && nose.parent === head);
    assert.equal(nose.material.color.getHex(), PLAYER_MODEL_COLORS.nose);
    const n = new THREE.Box3().setFromObject(nose);
    const face = new THREE.Box3().setFromObject(head.getObjectByName('face'));
    const mouth = new THREE.Box3().setFromObject(head.getObjectByName('mouth'));
    assert.ok(n.min.z > face.max.z, 'nariz não coincide com a superfície da pele');
    assert.ok(n.min.y > mouth.max.y, 'nariz não encobre a boca');
    for (const eye of head.children.filter(p => p.name === 'eye-white')) {
        const b = new THREE.Box3().setFromObject(eye);
        assert.ok(n.max.x < b.min.x || n.min.x > b.max.x, 'nariz não encobre olhos');
    }
    let released = false; nose.geometry.addEventListener('dispose', () => released = true);
    model.dispose(); assert.equal(released, true);
});

test('roupa 3D articulada substitui peças antigas e libera seus recursos', () => {
    const model=createPlayerModel(THREE), unit=PLAYER_MODEL_HEIGHT/32;
    assert.ok(model.outfit);
    for(const [part,name] of [[model.torso,'tunic-3d-preview'],[model.torso,'v-collar-preview'],[model.torso,'belt-preview'],[model.leftArm,'sleeve-3d-preview'],[model.rightArm,'sleeve-3d-preview'],[model.leftLeg,'trousers-preview'],[model.rightLeg,'boot-preview']]) assert.ok(part.getObjectByName(name),name);
    for(const [part,name] of [[model.torso,'collar'],[model.torso,'belt'],[model.leftArm,'sleeve'],[model.leftLeg,'trousers'],[model.leftLeg,'boot']]) assert.equal(part.getObjectByName(name).visible,false,name);
    assert.equal(model.leftArm.position.x,-6.08*unit);
    assert.equal(model.leftArm.getObjectByName('hand').position.y,-11*unit);
    const sleeve=model.leftArm.getObjectByName('sleeve-3d-preview');model.leftArm.rotation.x=.5;
    assert.equal(sleeve.parent,model.leftArm);
    const mesh=model.leftLeg.getObjectByName('trouser-leg'), texture=mesh.material.map;
    assert.equal(texture.magFilter,THREE.NearestFilter);
    let geo=false,mat=false,tex=false;mesh.geometry.addEventListener('dispose',()=>geo=true);mesh.material.addEventListener('dispose',()=>mat=true);texture.addEventListener('dispose',()=>tex=true);
    model.dispose();assert.ok(geo&&mat&&tex);
});

test('modelo base é opcional para prévias e cor da túnica é aplicada à textura', () => {
    const plain=createPlayerModel(THREE,{}, {outfit:false});assert.equal(plain.outfit,null);assert.equal(plain.leftLeg.getObjectByName('boot').visible,true);plain.dispose();
    const red=createPlayerModel(THREE,{tunic:0xff0000});const panel=red.torso.getObjectByName('tunic-3d-preview').children[0];
    const px=panel.material.map.image.data;assert.ok(px[0]>230 && px[1]<20 && px[2]<20);red.dispose();
});
