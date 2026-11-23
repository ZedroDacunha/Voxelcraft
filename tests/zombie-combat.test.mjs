import test from 'node:test';
import assert from 'node:assert/strict';
import { ZOMBIE_ATTACK_DAMAGE, ZOMBIE_ATTACK_INTERVAL, zombieAttackInReach } from '../world-zombie-combat.js';
import { damageAfterArmor } from '../world-armor-protection.js';

const box = (x, y, z, width = 0.6, height = 1.8) => ({
    min: { x: x - width / 2, y, z: z - width / 2 },
    max: { x: x + width / 2, y: y + height, z: z + width / 2 },
});
const zombie = box(0, 0, 0, 0.6, 1.9);

test('zumbi: dano normal e intervalo de ataque', () => {
    assert.equal(ZOMBIE_ATTACK_DAMAGE, 3);
    assert.equal(ZOMBIE_ATTACK_INTERVAL, 1);
    assert.equal(damageAfterArmor(ZOMBIE_ATTACK_DAMAGE, 0, 'mob'), 3);
    assert.ok(damageAfterArmor(ZOMBIE_ATTACK_DAMAGE, 10, 'mob') < 3);
});

test('alcance Bedrock expande a caixa horizontal, não um raio central', () => {
    assert.equal(zombieAttackInReach(zombie, box(1.39, 0, 0), true), true);
    assert.equal(zombieAttackInReach(zombie, box(1.41, 0, 0), true), false);
    assert.equal(zombieAttackInReach(zombie, box(1.39, 0, 1.39), true), true);
    assert.equal(zombieAttackInReach(zombie, box(0, 2, 0), true), false);
    assert.equal(zombieAttackInReach(zombie, box(0, 0, 0), false), false);
    assert.equal(zombieAttackInReach(zombie, box(0, 0, 0)), false);
    assert.equal(zombieAttackInReach(null, box(0, 0, 0), true), false);
});
