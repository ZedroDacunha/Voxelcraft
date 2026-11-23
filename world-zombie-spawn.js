// Regras conservadoras de nascimento para a primeira integração solo.
export const ZOMBIE_LIMIT = 3;
export const ZOMBIE_SPAWN_INTERVAL = 6;
export const ZOMBIE_SPAWN_MIN_DISTANCE = 24;
export const ZOMBIE_SPAWN_MAX_DISTANCE = 32;
export const ZOMBIE_DESPAWN_DISTANCE = 48;

// block/sky são valores propagados do mundo. O ajuste da luz do céu é uma
// aproximação em função do dia, não uma réplica do ciclo interno de Minecraft.
export function zombieSpawnAllowed({ distance, blockLight, skyLight, day, safe = false, lightReady = false } = {}) {
    if (!safe || !lightReady || !Number.isFinite(distance) || distance < ZOMBIE_SPAWN_MIN_DISTANCE ||
        distance > ZOMBIE_SPAWN_MAX_DISTANCE || !Number.isFinite(blockLight) || blockLight !== 0 ||
        !Number.isFinite(skyLight) || skyLight < 0 || skyLight > 15 || !Number.isFinite(day)) return false;
    const skyDarkening = 11 * (1 - Math.max(0, Math.min(1, day)));
    return skyLight - skyDarkening <= 7;
}

// O catálogo considera sólido por padrão; porta e cama não são blocos
// inteiros e não devem servir como chão para a amostragem voxel.
export function zombieFullBlockSupport(type, blocks) {
    const block = blocks?.[type];
    return type !== 0 && !!block && block.solid !== false && block.render !== 'door' && block.render !== 'bed';
}

// Gerencia entidades sem depender de Three ou do gerador do mundo.
export function createZombiePopulation({ spawnCandidate, createZombie, removeZombie, random = Math.random, limit = ZOMBIE_LIMIT } = {}) {
    const entities = [];
    let nextSpawn = ZOMBIE_SPAWN_INTERVAL;
    return {
        entities,
        add(position) {
            if (entities.length >= limit) return null;
            const entity = createZombie(position);
            entities.push(entity);
            return entity;
        },
        remove(entity) {
            const index = entities.indexOf(entity);
            if (index < 0) return;
            entities.splice(index, 1);
            removeZombie(entity);
        },
        update(dt, player, day, { spawn = true } = {}) {
            if (!Number.isFinite(dt) || dt <= 0) return;
            for (const entity of [...entities]) {
                if (!entity.state.dying && Math.hypot(entity.state.x - player.x, entity.state.y - player.y, entity.state.z - player.z) > ZOMBIE_DESPAWN_DISTANCE) this.remove(entity);
            }
            if (!spawn || entities.length >= limit) return;
            nextSpawn -= dt;
            if (nextSpawn > 0) return;
            nextSpawn = ZOMBIE_SPAWN_INTERVAL;
            for (let i = 0; i < 12; i++) {
                const angle = random() * Math.PI * 2;
                const radius = ZOMBIE_SPAWN_MIN_DISTANCE + random() * (ZOMBIE_SPAWN_MAX_DISTANCE - ZOMBIE_SPAWN_MIN_DISTANCE);
                const x = Math.floor(player.x + Math.cos(angle) * radius) + .5;
                const z = Math.floor(player.z + Math.sin(angle) * radius) + .5;
                const position = spawnCandidate({ x, z, player, day, random });
                if (position && !entities.some(e => Math.hypot(e.state.x - position.x, e.state.y - position.y, e.state.z - position.z) < 2)) {
                    this.add(position); return;
                }
            }
        },
    };
}
