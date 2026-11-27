import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createPlayerModel, PLAYER_MODEL_HEIGHT } from '../player-model.js';
import { createPlayerArmor } from '../player-armor.js';
import { createFirstPersonArms } from '../player-first-person-arms.js';
import { createPlayerHeldItem } from '../player-held-item.js';
import { groundPose, rigLocomotion } from '../player-locomotion.js';
import { ID } from '../world-catalog.js';

function fixture() {
    const model = createPlayerModel(THREE);
    const armor = createPlayerArmor(THREE, model, PLAYER_MODEL_HEIGHT / 32);
    createPlayerHeldItem(THREE, model.rightArm);
    const rig = rigLocomotion(THREE, model);
    return { model, armor, arms: createFirstPersonArms(THREE, model, rig) };
}
const stride = (foot, run, amplitude = 1) => groundPose({ foot, run }, 0, amplitude);

test('a primeira pessoa usa a pele, as mangas e as ombreiras reais do personagem', () => {
    const { model, armor, arms } = fixture();
    for (const [view, source] of [[arms.left, model.leftArm], [arms.right, model.rightArm]]) {
        for (const name of ['hand', 'cuff', 'shoulder']) {
            const copy = view.getObjectByName(name), original = source.getObjectByName(name);
            assert.notEqual(copy, original);
            assert.equal(copy.geometry, original.geometry);
            assert.equal(copy.material, original.material);
        }
        assert.equal(view.getObjectByName('heldItem'), undefined);
    }
    for (const id of [ID.COPPER_CHESTPLATE, ID.IRON_CHESTPLATE, ID.GOLD_CHESTPLATE, ID.DIAMOND_CHESTPLATE, null]) {
        armor.setEquipment([null, id ? { id, count: 1 } : null]);
        arms.pose(stride(0, 0, 0), 1);
        const plates = [];
        arms.right.traverseVisible(part => { if (part.name === 'chest-right-pivot') plates.push(part); });
        assert.equal(plates.length, id ? 1 : 0);
        assert.equal(arms.left.getObjectByName('shoulder').visible, !id);
    }
    armor.dispose();
    model.dispose();
});

test('braços alternam, ampliam a passada na corrida e trazem o item junto ao punho', () => {
    const { model, armor, arms } = fixture();
    const item = new THREE.Group();
    item.position.set(0, 0.03, -0.62);
    arms.grip.add(item);
    const position = obj => obj.getWorldPosition(new THREE.Vector3());
    const rightHand = arms.right.getObjectByName('hand');
    const sample = (foot, run, amount) => {
        arms.pose(stride(foot, run, amount), 1);
        return [position(arms.left.getObjectByName('hand')).y, position(rightHand).y];
    };
    const rest = sample(0, 0, 0);
    assert.ok(position(item).distanceTo(item.position) < 1e-8);
    const gap = position(item).distanceTo(position(rightHand));
    const walk = sample(0, 0, 1);
    const run = sample(0, 1, 1);
    const next = sample(1, 1, 1);
    assert.ok(walk[0] > rest[0] && walk[1] < rest[1]);
    assert.ok(run[0] > walk[0] && run[1] < walk[1]);
    assert.ok(next[0] < rest[0] && next[1] > rest[1]);
    assert.ok(Math.abs(position(item).distanceTo(position(rightHand)) - gap) < 1e-8);
    assert.deepEqual(sample(1, 0, 0), rest);
    assert.equal(model.rightArm.rotation.x, 0);
    armor.dispose();
    model.dispose();
});
