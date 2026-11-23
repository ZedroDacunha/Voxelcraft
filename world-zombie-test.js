// Regras do experimento; o caminho é limitado ao terreno plano neste recorte.
export * from './world-zombie-awareness.js';
export * from './world-zombie-combat.js';
export * from './world-zombie-navigation.js';
export * from './world-zombie-pursuit.js';

import { zombieNoticesPlayer } from './world-zombie-awareness.js';
import { ZOMBIE_ATTACK_DAMAGE, ZOMBIE_ATTACK_INTERVAL, zombieAttackInReach } from './world-zombie-combat.js';
import { zombiePursuitStep } from './world-zombie-pursuit.js';
import { zombieFindPath } from './world-zombie-navigation.js';
import { dyingPoseFor, KNOCK_TIME } from './world-creature-base.js';
import { KNOCKBACK_DISTANCE } from './world-mob-hit.js';
import { planZombieStep, planZombieDescent, zombieStepPosition } from './world-zombie-step.js';

// Um único zumbi de teste, sem spawn natural nem loot.
// A busca é plana; subida e descida locais de um bloco exigem espaço e apoio.
export function createZombieTest({ model, position, canStand, canOccupy = () => false, speed = 0.55, chaseSpeed = 1, onHit = () => {}, onDeathComplete = () => {} }) {
    const state = { x: position.x, y: position.y, z: position.z, heading: Math.PI, time: 0, turnTime: 4, attention: 0, noticing: false, attackTime: -1, attackCooldown: 0, hitDone: false, health: 20, dying: false, bodyOffset: 0.9, hurtTime: 0, dieTime: 0, removed: false, jump: null, knock: null, chaseTime: 0 };
    let route = [], routeGoal = null, retry = 0;
    model.root.position.set(state.x, state.y, state.z);
    model.root.rotation.y = state.heading;
    return {
        state,
        hit(damage = 1, from = null) {
            if (state.dying || state.hurtTime > 0 || !Number.isFinite(damage) || damage <= 0) return null;
            state.health = Math.max(0, state.health - damage);
            state.hurtTime = .35;
            state.dying = state.health <= 0;
            state.attackTime = -1;
            if (!state.dying && !state.jump && Number.isFinite(from?.x) && Number.isFinite(from?.z)) {
                const dx = state.x - from.x, dz = state.z - from.z, distance = Math.hypot(dx, dz);
                if (distance > 1e-6) state.knock = { x: dx / distance, z: dz / distance, elapsed: 0 };
            }
            model.setHurt?.(true);
            return { entity: state, killed: state.dying };
        },
        update(dt, player = null) {
            if (!Number.isFinite(dt) || dt <= 0) return;
            dt = Math.min(dt, 0.05);
            if (state.dying) {
                if (state.removed) return;
                state.dieTime += dt;
                if (state.dieTime >= .22) model.setHurt?.(false);
                const pose = dyingPoseFor(state.dieTime);
                model.animateDeath?.(pose);
                if (pose.done) { state.removed = true; onDeathComplete(); }
                return;
            }
            state.hurtTime = Math.max(0, state.hurtTime - dt);
            if (state.hurtTime === 0) model.setHurt?.(false);
            state.time += dt;
            state.attackCooldown = Math.max(0, state.attackCooldown - dt);
            if (state.knock) {
                const knock = state.knock, part = Math.min(dt, KNOCK_TIME - knock.elapsed);
                const start = knock.elapsed / KNOCK_TIME, end = (knock.elapsed + part) / KNOCK_TIME;
                const distance = KNOCKBACK_DISTANCE * ((1 - start) ** 2 - (1 - end) ** 2);
                const nx = state.x + knock.x * distance, nz = state.z + knock.z * distance;
                if (canStand(nx, state.y, nz)) { state.x = nx; state.z = nz; knock.elapsed += part; }
                else knock.elapsed = KNOCK_TIME;
                if (knock.elapsed >= KNOCK_TIME - 1e-9) state.knock = null;
                model.root.position.set(state.x, state.y, state.z);
                model.animate(state.time, false, state.attention, 0);
                return;
            }
            if (state.jump) {
                const jump = state.jump, nextTime = Math.min(.65, jump.time + dt);
                const next = zombieStepPosition(jump, nextTime / .65);
                if (!canOccupy(next.x, next.y, next.z) || (nextTime >= .65 && !canStand(next.x, next.y, next.z))) {
                    // Se o cenário mudou, só volta quando a origem ainda é segura.
                    if (canStand(jump.from.x, jump.from.y, jump.from.z)) {
                        Object.assign(state, jump.from); state.jump = null;
                    }
                } else {
                    Object.assign(state, next); jump.time = nextTime;
                    if (nextTime >= .65) state.jump = null;
                }
                model.root.position.set(state.x, state.y, state.z);
                model.animate(state.time, false, state.attention, 0);
                return;
            }
            const validTarget = player && Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.z);
            const dx = validTarget ? player.x - state.x : 0;
            const dz = validTarget ? player.z - state.z : 0;
            const distance = validTarget ? Math.hypot(dx, player.y - (state.y + 1.55), dz) : Infinity;
            state.noticing = !!validTarget && zombieNoticesPlayer({ distance, hasLineOfSight: player.hasLineOfSight,
                creative: player.creative, dead: player.dead });
            state.attention = Math.max(0, Math.min(1, state.attention + dt * (state.noticing ? 1 : -1) / 1.5));
            const bounds = (x, y, z, radius, height) => ({ min: { x: x - radius, y, z: z - radius }, max: { x: x + radius, y: y + height, z: z + radius } });
            const inReach = state.noticing && player.box && zombieAttackInReach(
                bounds(state.x, state.y, state.z, .3, 1.8), player.box, player.hasLineOfSight);
            let headTurn = 0, walking = false;
            retry = Math.max(0, retry - dt);
            if (!state.noticing) { state.attackTime = -1; route = []; routeGoal = null; }
            if (state.noticing) {
                const targetHeading = Math.atan2(dx, dz);
                const delta = Math.atan2(Math.sin(targetHeading - state.heading), Math.cos(targetHeading - state.heading));
                // A cabeça reage primeiro; o corpo acompanha gradualmente.
                const headWeight = Math.min(1, state.attention * 3);
                const bodyWeight = Math.max(0, (state.attention - .32) / .68);
                const turn = Math.sign(delta) * Math.min(Math.abs(delta), dt * 2.5 * bodyWeight);
                state.heading += turn;
                headTurn = Math.max(-1.2, Math.min(1.2, delta - turn)) * headWeight;
                if (state.attention >= 1) {
                    if (state.attackTime >= 0) {
                        const before = state.attackTime;
                        state.attackTime += dt;
                        if (!state.hitDone && before < .45 && state.attackTime >= .45) {
                            state.hitDone = true;
                            if (inReach) onHit(ZOMBIE_ATTACK_DAMAGE);
                        }
                        if (state.attackTime >= .9) state.attackTime = -1;
                    } else if (inReach && state.attackCooldown <= 0) {
                        state.attackTime = 0; state.hitDone = false;
                        state.attackCooldown = ZOMBIE_ATTACK_INTERVAL;
                    } else if (!inReach) {
                        const goalKey = `${Math.floor(player.x)},${Math.floor(player.z)}`;
                        if (routeGoal && routeGoal !== goalKey) { route = []; routeGoal = null; }
                        while (route.length && Math.hypot(route[0].x - state.x, route[0].z - state.z) < .025) route.shift();
                        const waypoint = route[0] || player;
                        let step = zombiePursuitStep({ position: state, target: waypoint, speed: chaseSpeed, dt });
                        let nx = state.x + step.dx, nz = state.z + step.dz;
                        walking = step.moving && canStand(nx, state.y, nz);
                        if (!walking && retry === 0) {
                            const direction = { x: step.dx, z: step.dz };
                            const jump = planZombieStep(state, direction, canOccupy, canStand)
                                || planZombieDescent(state, direction, canOccupy, canStand);
                            if (jump) { state.jump = jump; route = []; routeGoal = null; retry = .75; }
                        }
                        if (!walking && !state.jump && retry === 0) {
                            const start = { x: Math.floor(state.x), y: 0, z: Math.floor(state.z) };
                            const goal = { x: Math.floor(player.x), y: 0, z: Math.floor(player.z) };
                            const path = zombieFindPath(start, goal, (p, previous) => p.y === 0 &&
                                canStand(p.x + .5, state.y, p.z + .5) &&
                                canStand((p.x + previous.x) / 2 + .5, state.y, (p.z + previous.z) / 2 + .5),
                            { maxVisited: 512, maxDistance: 20 });
                            route = path ? [{ x: start.x + .5, z: start.z + .5 },
                                ...path.map(p => ({ x: p.x + .5, z: p.z + .5 }))] : [];
                            routeGoal = path ? goalKey : null;
                            retry = .75;
                            const next = route[0];
                            if (next) {
                                step = zombiePursuitStep({ position: state, target: next, speed: chaseSpeed, dt });
                                nx = state.x + step.dx; nz = state.z + step.dz;
                                walking = step.moving && canStand(nx, state.y, nz);
                            }
                        }
                        if (walking) {
                            state.x = nx; state.z = nz;
                            const desired = Math.atan2(step.dx, step.dz);
                            const angle = Math.atan2(Math.sin(desired - state.heading), Math.cos(desired - state.heading));
                            state.heading += Math.sign(angle) * Math.min(Math.abs(angle), dt * 2.5);
                        }
                    }
                }
            } else if (state.attention === 0) {
                state.turnTime -= dt;
                if (state.turnTime <= 0) { state.heading += Math.PI / 2; state.turnTime = 4; }
                const nx = state.x + Math.sin(state.heading) * speed * dt;
                const nz = state.z + Math.cos(state.heading) * speed * dt;
                walking = canStand(nx, state.y, nz);
                if (walking) { state.x = nx; state.z = nz; }
                else { state.heading += Math.PI / 2; state.turnTime = 4; }
            }
            state.chaseTime = state.noticing && walking ? state.chaseTime + dt : 0;
            model.root.position.set(state.x, state.y, state.z);
            model.root.rotation.y = state.heading;
            model.animate(state.time, walking, state.attention, headTurn, state.attackTime, state.chaseTime);
        },
    };
}
