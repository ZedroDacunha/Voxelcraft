import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickaxeMiningPose } from '../world-pickaxe-animation.js';
import { ITEMS } from '../world-catalog.js';
import { countStrikes, createHandAnimation, startPunch } from '../world-hand-animation.js';

test('todas as picaretas usam o tipo lógico, sem alterar outras ferramentas', () => {
    const picks = Object.values(ITEMS).filter(item => item?.sprite?.kind === 'pickaxe');
    assert.ok(picks.length >= 5);
    for (const item of picks) assert.equal(item.tool.type, 'pickaxe');
    for (const type of [undefined, 'axe', 'shovel', 'shears'])
        assert.deepEqual(pickaxeMiningPose(type, { mining: 1, phase: Math.PI / 4 }), { lift: 0, strike: 0 });
});
test('levanta antes do impacto e termina no repouso, no compasso do som', () => {
    const pose = phase => pickaxeMiningPose('pickaxe', { mining: 1, phase });
    assert.deepEqual(pose(0), { lift: 0, strike: 0 });
    assert.ok(pose(Math.PI / 4).lift > .99);
    assert.ok(pose(Math.PI / 2).lift < 1e-10);
    assert.equal(pose(Math.PI / 2).strike, 1);
    assert.equal(countStrikes(0, Math.PI / 2), 1);
    assert.ok(pose(Math.PI).strike < 1e-10);
    assert.ok(pose(5 * Math.PI / 4).lift > .99);
});
test('golpe genérico sem mineração não dispara a nova pose; intensidade acompanha suavização', () => {
    const hand = createHandAnimation(); startPunch(hand);
    assert.deepEqual(pickaxeMiningPose('pickaxe', hand), { lift: 0, strike: 0 });
    hand.mining = .5; hand.phase = Math.PI / 4;
    assert.ok(Math.abs(pickaxeMiningPose('pickaxe', hand).lift - .5) < 1e-10);
});
test('as duas visões utilizam a mesma fase sem mexer na pose de repouso', () => {
    const src = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(src, /pickaxeMiningPose\(item\?\.tool\?\.type, handAnim\)/);
    assert.match(src, /pickaxeMiningPose\(ITEMS\[heldId\]\?\.tool\?\.type, handAnim\)/);
    assert.match(src, /rightArm\.rotation\.x = pose\.rightArm - 0\.65 \* pickaxe\.lift/);
});
