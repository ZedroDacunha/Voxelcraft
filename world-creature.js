// Mofim: a criatura passiva do jogo.
//
// O que ele faz é simples de propósito — vaga pelo capim, flutua, bate as asas e
// **se assusta**. Medo é o que dá sentido à presença dele: sem isso ele é cenário
// animado, andando em círculos que o jogador não influencia.
//
// Regras do susto (o resto do arquivo é animação):
//
// - chegou perto **andando ou correndo**: foge;
// - chegou perto **agachado**: não percebe (é o modo furtivo do jogador);
// - levou um golpe: foge na hora, de qualquer distância e postura.
//
// A decisão é uma função pura (`shouldFlee`) e o "levou golpe" é outra
// (`creatureInReach`), para poder testar a regra sem THREE, sem mundo e sem
// relógio de verdade.

import { floorDiv as defaultFloorDiv } from './world-grid.js';
import { hash2 as defaultHash2 } from './world-math.js';

/** Linhas de spawn por vez (o resto do mundo continua vazio: é bicho, não enxame). */
export const CREATURE_LIMIT = 3;
/** Distância em que ele nasce e em que desaparece. */
export const SPAWN_MIN_DISTANCE = 9;
export const SPAWN_MAX_DISTANCE = 24;
export const DESPAWN_DISTANCE = 38;
/** Velocidade vagando e fugindo (blocos por segundo). */
export const WANDER_SPEED = 0.72;
export const FLEE_SPEED = 3.1;
/** Até onde o jogador assusta o Mofim só por chegar. */
export const SCARE_RADIUS = 7;
/**
 * Velocidade horizontal do jogador que conta como "chegando correndo".
 * Fica entre o passo agachado (1,3) e o caminhada (4,3): agachado passa
 * desapercebido, qualquer passo normal assusta.
 */
export const SCARE_SPEED = 2.2;
/** Quanto tempo ele continua fugindo depois do susto (segundos). */
export const SCARE_DURATION = 4.5;
/** Alcance e abertura do golpe: o corpo cabe numa caixa de ~1 bloco a 3,5. */
export const HIT_REACH = 3.5;
export const HIT_MIN_DOT = 0.72; // ~44° de abertura a partir da mira
/** Um mesmo Mofim não leva dois golpes no mesmo instante (evita spam com o botão segurado). */
export const HIT_COOLDOWN = 0.35;
/** Altura que ele pula para subir um degrau e duração do pulo (visual e curto). */
export const STEP_UP = 1;
export const HOP_DURATION = 0.26;
export const HOP_HEIGHT = 0.42;
/** Descida: em vez de cair seco, ele planeja com as asas abertas. */
export const GLIDE_DURATION = 0.42;
/** Chilreio: alcance, ritmo e o silêncio entre um chamado e outro. */
export const CHIRP_RANGE = 16;
export const CHIRP_COOLDOWN = 1.2;
export const CHIRP_IDLE_MIN = 7;
export const CHIRP_IDLE_MAX = 15;

/**
 * O jogador assusta o Mofim agora?
 *
 * `playerSpeed` é a velocidade horizontal (m/s) e `crouching` é o estado real de
 * agachar — não o botão. Agachado nunca assusta: é a regra que faz o modo furtivo
 * valer algo.
 */
export function shouldFlee({
    distance,
    playerSpeed = 0,
    crouching = false,
    scareRadius = SCARE_RADIUS,
    scareSpeed = SCARE_SPEED,
} = {}) {
    if (crouching) return false;
    if (!(distance <= scareRadius)) return false;
    return playerSpeed >= scareSpeed;
}

/**
 * Qual Mofim está na mira do golpe? Devolve o mais próximo que estiver dentro do
 * alcance e da abertura, ou `null`.
 *
 * Aceita posições simples (`{x, y, z}`) — nada de Three aqui.
 */
export function creatureInReach(entities, origin, direction, {
    reach = HIT_REACH,
    minDot = HIT_MIN_DOT,
} = {}) {
    if (!entities?.length || !direction) return null;
    const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
    const dx = direction.x / length, dy = direction.y / length, dz = direction.z / length;
    let best = null;
    let bestScore = Infinity;
    for (const entity of entities) {
        // O corpo do Mofim fica a ~0,45 do chão onde está a origem dele.
        const ex = entity.x - origin.x;
        const ey = entity.y + 0.45 - origin.y;
        const ez = entity.z - origin.z;
        const distance = Math.hypot(ex, ey, ez);
        if (distance > reach || distance === 0) continue;
        const dot = (ex * dx + ey * dy + ez * dz) / distance;
        if (dot < minDot) continue;
        // Mais perto e mais alinhado ganha; distância domina.
        const score = distance - dot;
        if (score < bestScore) { bestScore = score; best = entity; }
    }
    return best;
}

/**
 * Vale um chilreio agora? Devolve o motivo (`'startle'`, `'panic'`, `'idle'`) ou
 * `null`.
 *
 * O silêncio é o padrão: chilreio de criatura é enfeite, e três bichos chilreando
 * sem parada viram zumbido. Por isso há alcance, espera entre chamados e um
 * sorteio longo para o chamado de quem está só passeando.
 */
export function chirpFor({
    at,
    distance,
    scared = false,
    pending = null,
    lastChirpAt = -Infinity,
    nextIdleAt = Infinity,
    cooldown = CHIRP_COOLDOWN,
    range = CHIRP_RANGE,
} = {}) {
    if (!(distance <= range)) return null;
    if (at - lastChirpAt < cooldown) return null;
    if (pending) return pending;
    if (scared) return 'panic';
    if (at >= nextIdleAt) return 'idle';
    return null;
}

/**
 * Altura do corpo durante o pulo do degrau.
 *
 * Sobe até `altura` acima do destino e desce até pousar nele — um arco de salto,
 * não uma rampa. Rampa (linear + seno) quase não levanta o corpo quando o degrau
 * é de 1 bloco, e o pulo fica invisível.
 */
export function hopHeightAt(from, to, progress, altura = HOP_HEIGHT) {
    if (!(progress > 0)) return from;
    if (progress >= 1) return to;
    const peak = to + altura;
    const subida = 0.6;
    return progress < subida
        ? from + (peak - from) * (progress / subida)
        : peak + (to - peak) * ((progress - subida) / (1 - subida));
}

/**
 * Altura do corpo ao descer um degrau, com as asas abertas.
 *
 * É o inverso do pulo: desce depressa no começo e **pousa devagar** (a curva
 * desacelera até parar no chão). Queda `to + (from - to) * (1 - p)²` — sem
 * "quique", sem passar do chão.
 */
export function glideHeightAt(from, to, progress) {
    if (!(progress > 0)) return from;
    if (progress >= 1) return to;
    const queda = 1 - progress;
    return to + (from - to) * queda * queda;
}

/** Gira um vetor 2D: usado para desviar de encostas enquanto foge. */
function rotate2(x, z, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: x * c - z * s, z: x * s + z * c };
}

export function createCreatureSystemClass({
    THREE,
    ID,
    CHUNK_SIZE,
    floorDiv = defaultFloorDiv,
    hash2 = defaultHash2,
    now = () => performance.now() * 0.001,
    onChirp = () => {},
}) {
    class CreatureSystem {
        constructor(world) {
            this.world = world;
            this.entities = [];
            this.nextSpawnAt = 0;
            this.spawnAttempt = 0;
            this.nextId = 1;
            this.cube = new THREE.BoxGeometry(1, 1, 1);
            this.materials = {
                body: new THREE.MeshLambertMaterial({ color: 0x438f78 }),
                belly: new THREE.MeshLambertMaterial({ color: 0xb7d8a1 }),
                wing: new THREE.MeshLambertMaterial({ color: 0xb8e5d8, transparent: true, opacity: 0.78 }),
                eye: new THREE.MeshLambertMaterial({ color: 0x173b42 }),
                glow: new THREE.MeshBasicMaterial({ color: 0xf2c86b }),
            };
        }

        surfaceAt(x, z) {
            const bx = Math.floor(x), bz = Math.floor(z);
            if (!this.world.getChunk(floorDiv(bx, CHUNK_SIZE), floorDiv(bz, CHUNK_SIZE))) return null;
            const y = this.world.generator.heightAt(bx, bz);
            const top = this.world.getBlock(bx, y, bz);
            if (top !== ID.GRASS && top !== ID.DIRT) return null;
            if (this.world.getBlock(bx, y + 1, bz) !== 0 || this.world.getBlock(bx, y + 2, bz) !== 0) return null;
            return y + 1;
        }

        addPart(group, material, x, y, z, sx, sy, sz) {
            const mesh = new THREE.Mesh(this.cube, material);
            mesh.position.set(x, y, z);
            mesh.scale.set(sx, sy, sz);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            group.add(mesh);
            return mesh;
        }

        createModel() {
            const group = new THREE.Group();
            this.addPart(group, this.materials.body, 0, 0.24, 0, 0.46, 0.34, 0.42);
            this.addPart(group, this.materials.belly, 0, 0.18, 0.215, 0.28, 0.18, 0.025);
            this.addPart(group, this.materials.body, 0, 0.43, 0.105, 0.30, 0.28, 0.28);
            this.addPart(group, this.materials.eye, -0.075, 0.46, 0.248, 0.045, 0.06, 0.025);
            this.addPart(group, this.materials.eye, 0.075, 0.46, 0.248, 0.045, 0.06, 0.025);
            const leftWing = this.addPart(group, this.materials.wing, -0.29, 0.32, -0.015, 0.24, 0.12, 0.035);
            const rightWing = this.addPart(group, this.materials.wing, 0.29, 0.32, -0.015, 0.24, 0.12, 0.035);
            leftWing.rotation.z = -0.25;
            rightWing.rotation.z = 0.25;
            this.addPart(group, this.materials.glow, 0, 0.62, 0.08, 0.07, 0.07, 0.07);
            return { group, leftWing, rightWing };
        }

        trySpawn(playerPos, at) {
            if (at < this.nextSpawnAt || this.entities.length >= CREATURE_LIMIT) return;
            this.nextSpawnAt = at + 4.5;
            const seed = this.world.seed + this.spawnAttempt++ * 7919;
            for (let attempt = 0; attempt < 10; attempt++) {
                const angle = hash2(seed, attempt, 41) * Math.PI * 2;
                const distance = SPAWN_MIN_DISTANCE + hash2(seed, attempt, 89) * (SPAWN_MAX_DISTANCE - SPAWN_MIN_DISTANCE);
                const x = playerPos.x + Math.cos(angle) * distance;
                const z = playerPos.z + Math.sin(angle) * distance;
                const y = this.surfaceAt(x, z);
                if (y === null) continue;
                if (this.entities.some(e => (e.x - x) ** 2 + (e.z - z) ** 2 < 64)) continue;
                const model = this.createModel();
                model.group.position.set(x, y, z);
                this.world.scene.add(model.group);
                this.entities.push({
                    id: this.nextId++, x, y, z, targetX: x, targetZ: z, turnAt: at,
                    phase: hash2(seed, attempt, 131) * Math.PI * 2, heading: 0,
                    scaredUntil: 0, lastHitAt: -Infinity,
                    lastChirpAt: -Infinity, chirpPending: null,
                    nextIdleAt: at + CHIRP_IDLE_MIN + hash2(seed, attempt, 211) * (CHIRP_IDLE_MAX - CHIRP_IDLE_MIN),
                    hopFrom: 0, hopTo: 0, hopT: HOP_DURATION,
                    glideFrom: y, glideT: GLIDE_DURATION, visualY: y, glidePitch: 0,
                    ...model,
                });
                return;
            }
        }

        /** Faz o Mofim se assustar: foge do ponto `from` pelos próximos segundos. */
        scare(entity, at, from) {
            entity.scaredUntil = at + SCARE_DURATION;
            entity.lastHitAt = at;
            // O primeiro chilreio do susto é diferente do resto: é o grito, não o
            // chiado de quem está correndo.
            entity.chirpPending = 'startle';
            // Alvo imediato para longe de quem assustou: sem isso ele levaria
            // até 5 s (o sorteio do vagar) para começar a correr.
            const dx = entity.x - (from?.x ?? entity.x);
            const dz = entity.z - (from?.z ?? entity.z);
            const distance = Math.hypot(dx, dz);
            if (distance > 1e-4) {
                entity.targetX = entity.x + (dx / distance) * 3;
                entity.targetZ = entity.z + (dz / distance) * 3;
            }
        }

        /**
         * O jogador deu um golpe? Devolve o Mofim atingido (e o assusta) ou `null`.
         * Chamar a cada quadro com o botão apertado é seguro: `HIT_COOLDOWN`
         * impede que um clique vire vários golpes.
         */
        hitFrom(origin, direction) {
            const at = now();
            const target = creatureInReach(this.entities, origin, direction);
            if (!target || at - target.lastHitAt < HIT_COOLDOWN) return null;
            this.scare(target, at, origin);
            return target;
        }

        update(dt, player, active) {
            if (!active) return;
            const at = now();
            const playerPos = player.pos;
            const playerSpeed = Math.hypot(player.vel?.x ?? 0, player.vel?.z ?? 0);
            const crouching = Boolean(player.crouching);

            this.trySpawn(playerPos, at);

            for (let i = this.entities.length - 1; i >= 0; i--) {
                const e = this.entities[i];
                const dxp = e.x - playerPos.x, dzp = e.z - playerPos.z;
                const distanceToPlayer = Math.hypot(dxp, dzp);
                if (distanceToPlayer > DESPAWN_DISTANCE) {
                    this.world.scene.remove(e.group);
                    this.entities.splice(i, 1);
                    continue;
                }

                if (shouldFlee({ distance: distanceToPlayer, playerSpeed, crouching })) {
                    this.scare(e, at, playerPos);
                }
                const fleeing = at < e.scaredUntil;

                const reason = chirpFor({
                    at,
                    distance: distanceToPlayer,
                    scared: fleeing,
                    pending: e.chirpPending,
                    lastChirpAt: e.lastChirpAt,
                    nextIdleAt: e.nextIdleAt,
                });
                if (reason) {
                    e.lastChirpAt = at;
                    e.chirpPending = null;
                    if (reason === 'idle') {
                        const seed = this.world.seed + e.id * 7919 + Math.floor(at);
                        e.nextIdleAt = at + CHIRP_IDLE_MIN
                            + hash2(seed, e.id, 307) * (CHIRP_IDLE_MAX - CHIRP_IDLE_MIN);
                    }
                    onChirp({ reason, distance: distanceToPlayer, entity: e });
                } else if (distanceToPlayer > CHIRP_RANGE) {
                    // Longe demais para ser ouvido: o grito não fica guardado
                    // para tocar depois, quando o jogador se aproximar.
                    e.chirpPending = null;
                }

                if (fleeing) {
                    // Fugir é recalculado a cada quadro: o jogador pode estar
                    // perseguindo, e o alvo do vagar ficaria para trás.
                    const away = Math.hypot(dxp, dzp);
                    if (away > 1e-4) {
                        e.targetX = e.x + (dxp / away) * 3;
                        e.targetZ = e.z + (dzp / away) * 3;
                    }
                } else if (at >= e.turnAt) {
                    const seed = this.world.seed + e.id * 104729 + Math.floor(at * 0.2);
                    const angle = hash2(seed, e.id, 7) * Math.PI * 2;
                    const distance = 1.5 + hash2(seed, e.id, 13) * 3;
                    e.targetX = e.x + Math.cos(angle) * distance;
                    e.targetZ = e.z + Math.sin(angle) * distance;
                    e.turnAt = at + 2 + hash2(seed, e.id, 23) * 3;
                }

                const dx = e.targetX - e.x, dz = e.targetZ - e.z;
                const distance = Math.hypot(dx, dz);
                if (distance > 0.08) {
                    const speed = fleeing ? FLEE_SPEED : WANDER_SPEED;
                    const step = Math.min(distance, speed * dt);
                    const nx = e.x + dx / distance * step, nz = e.z + dz / distance * step;
                    const ny = this.surfaceAt(nx, nz);
                    if (ny !== null && Math.abs(ny - e.y) <= STEP_UP) {
                        // O corpo muda de nível na hora (é ele que anda); o desenho é
                        // que faz o movimento: pula para cima, planeia para baixo.
                        if (ny > e.y) {
                            // Sai do desenho atual (não do chão): se ele ainda está
                            // no ar de um planeio, o pulo continua de onde o corpo
                            // está, em vez de voltar ao chão e saltar de novo.
                            e.hopFrom = e.visualY;
                            e.hopTo = ny;
                            e.hopT = 0;
                        } else if (ny < e.y) {
                            e.glideFrom = e.visualY;
                            e.glideT = 0;
                        }
                        e.x = nx; e.z = nz; e.y = ny;
                        e.heading = Math.atan2(dx, dz);
                    } else if (fleeing) {
                        // Bateu numa encosta fugindo: desvia em diagonal em vez de
                        // ficar parado encarando o obstáculo até o medo passar.
                        const turned = rotate2(dx, dz, (e.id % 2 ? 1 : -1) * 1.1);
                        e.targetX = e.x + turned.x;
                        e.targetZ = e.z + turned.z;
                    } else {
                        e.turnAt = at;
                    }
                }

                const bob = fleeing ? 0.02 : 0.035;
                e.hopT = Math.min(HOP_DURATION, e.hopT + dt);
                e.glideT = Math.min(GLIDE_DURATION, e.glideT + dt);
                const hopping = e.hopT < HOP_DURATION;
                const gliding = !hopping && e.glideT < GLIDE_DURATION;
                if (hopping) e.visualY = hopHeightAt(e.hopFrom, e.y, e.hopT / HOP_DURATION);
                else if (gliding) e.visualY = glideHeightAt(e.glideFrom, e.y, e.glideT / GLIDE_DURATION);
                else e.visualY = e.y;
                e.group.position.set(e.x, e.visualY + Math.sin(at * 3 + e.phase) * bob, e.z);
                e.group.rotation.y = e.heading;
                // Planando, o corpo inclina um pouco para a frente e as asas
                // abrem na horizontal — é o que faz a descida parecer planeio.
                const pitchTarget = gliding ? 0.2 : 0;
                e.glidePitch += (pitchTarget - e.glidePitch) * Math.min(1, 10 * dt);
                e.group.rotation.x = e.glidePitch;
                const wingBase = gliding ? 0.03 : 0.25;
                const flapSpeed = gliding ? 5 : (fleeing ? 22 : 8);
                const flapAmp = gliding ? 0.07 : (fleeing ? 0.36 : 0.18);
                const flap = Math.sin(at * flapSpeed + e.phase) * flapAmp;
                e.leftWing.rotation.z = -wingBase + flap;
                e.rightWing.rotation.z = wingBase - flap;
            }
        }
    }
    return CreatureSystem;
}
