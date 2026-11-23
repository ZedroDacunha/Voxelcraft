import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createZombieTest } from '../world-zombie-test.js';
const make = (canStand = () => true) => {
    const hits = [];
    const model = { root: new THREE.Group(), animate() {} };
    const zombie = createZombieTest({ model, position: { x: 0, y: 0, z: 0 }, canStand, onHit: n => hits.push(n) });
    return { zombie, hits };
};
const playerAt = (x, visible = true) => ({ x, y: 1.55, z: 0, hasLineOfSight: visible,
    box: { min: { x: x-.3, y: 0, z: -.3 }, max: { x: x+.3, y: 1.8, z: .3 } } });
const tick = (z, n, player) => { for (let i=0;i<n;i++) z.update(.05, player); };

test('persegue somente depois da atenção e respeita colisão', () => {
    const a = make(); tick(a.zombie, 50, playerAt(4));
    assert.ok(a.zombie.state.x > 0);
    assert.deepEqual(a.hits, []);
    const b = make(() => false); tick(b.zombie, 50, playerAt(4));
    assert.equal(b.zombie.state.x, 0);
});

test('atinge uma vez por golpe, sem dano depois de sair do alcance', () => {
    const a = make(); tick(a.zombie, 50, playerAt(1));
    assert.deepEqual(a.hits, [3]);
    tick(a.zombie, 20, playerAt(1));
    assert.deepEqual(a.hits, [3, 3]);
    const b = make(); tick(b.zombie, 32, playerAt(1));
    tick(b.zombie, 20, playerAt(5));
    assert.deepEqual(b.hits, []);
});

test('perder visão ou entrar no criativo cancela dano pendente', () => {
    for (const change of [{ hasLineOfSight: false }, { creative: true }, { dead: true }]) {
        const a = make(); tick(a.zombie, 32, playerAt(1));
        tick(a.zombie, 20, { ...playerAt(1), ...change });
        assert.deepEqual(a.hits, []);
    }
});

test('desvia de obstáculo baixo em terreno plano sem atravessá-lo', () => {
    // Obstáculo 2..3 por 0..1; o raio do corpo não pode tocá-lo.
    const allowed = (x, _y, z) => !(x + .3 > 2 && x - .3 < 3 && z + .3 > 0 && z - .3 < 1);
    const model = { root: new THREE.Group(), animate() {} };
    const z = createZombieTest({ model, position: { x: .5, y: 0, z: .5 }, canStand: allowed });
    const player = { ...playerAt(5.5), z: .5, box: { min: { x: 5.2, y: 0, z: .2 }, max: { x: 5.8, y: 1.8, z: .8 } } };
    let desviou = false;
    for (let i = 0; i < 240; i++) {
        z.update(.05, player);
        assert.ok(allowed(z.state.x, z.state.y, z.state.z));
        if (Math.abs(z.state.z - .5) > .8) desviou = true;
    }
    assert.ok(desviou);
    assert.ok(z.state.x > 3, `posição x=${z.state.x}`);
});

test('zumbi tem vida, respeita intervalo entre golpes e morre sem soltar itens', () => {
    const a = make();
    assert.equal(a.zombie.state.health, 20);
    assert.equal(a.zombie.hit().killed, false);
    assert.equal(a.zombie.hit(), null);
    for (let i = 0; i < 18; i++) { tick(a.zombie, 8, null); assert.equal(a.zombie.hit().killed, false); }
    tick(a.zombie, 8, null);
    assert.equal(a.zombie.hit().killed, true);
    assert.equal(a.zombie.state.health, 0);
    assert.equal(a.zombie.hit(), null);
});

test('morte deixa de atacar e só remove o corpo depois da animação', () => {
    let removals = 0, hits = 0, latestPose = null;
    const model = { root: new THREE.Group(), animate() {}, animateDeath(pose) { latestPose = pose; } };
    const z = createZombieTest({ model, position: { x: 0, y: 0, z: 0 }, canStand: () => true,
        onHit: () => hits++, onDeathComplete: () => removals++ });
    z.hit(20);
    tick(z, 8, playerAt(1));
    assert.ok(latestPose.roll > 0);
    assert.equal(removals, 0);
    assert.equal(hits, 0);
    tick(z, 20, playerAt(1));
    assert.equal(removals, 1);
    assert.equal(z.state.removed, true);
});

test('golpe afasta zumbi do jogador, gradualmente, sem ultrapassar parede', () => {
    const a = make(); a.zombie.hit(1, { x: -1, z: 0 });
    assert.equal(a.zombie.state.x, 0);
    tick(a.zombie, 4, null);
    assert.ok(Math.abs(a.zombie.state.x - .35) < 1e-8);
    const b = make(x => x < .1); b.zombie.hit(1, { x: -1, z: 0 });
    tick(b.zombie, 4, null);
    assert.ok(b.zombie.state.x < .1);
});

test('golpe interrompe ataque pendente e não aplica empurrão durante salto', () => {
    const a = make(); tick(a.zombie, 32, playerAt(1));
    assert.ok(a.zombie.state.attackTime >= 0);
    a.zombie.hit(1, { x: -1, z: 0 });
    assert.equal(a.zombie.state.attackTime, -1);
    tick(a.zombie, 10, { ...playerAt(1), hasLineOfSight: false });
    assert.deepEqual(a.hits, []);
    const b = make(); b.zombie.state.jump = { from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 1, z: 0 }, time: 0 };
    b.zombie.hit(1, { x: -1, z: 0 });
    assert.equal(b.zombie.state.knock, null);
});
