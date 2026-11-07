import { BLOCKS, ID, ITEMS } from './world-catalog.js';
import { LEGACY_MINERAL_ITEM_MAP } from './world-minerals.js';
import { parseBlockFacings } from './world-block-orientation.js';
import { chunkKey, floorDiv, idx } from './world-grid.js';
import {
    CHUNK_SIZE, DEATH_DROP_TTL, MAX_BREATH, MAX_HEALTH, MAX_HUNGER,
    PLAYER_INVENTORY_SIZE, START_TIME, WORLD_HEIGHT,
} from './world-save-settings.js';

export const WORLD_SAVE_VERSION = 1;

// Converte o estado do jogo para o formato persistido e valida saves antes
// que qualquer dado carregado seja aplicado ao mundo.
export function createWorldSaveCodec({ version = WORLD_SAVE_VERSION } = {}) {
    const packStack = stack => stack
        ? { id: stack.id, count: stack.count, damage: stack.damage || 0 }
        : null;

    function build(state) {
        const edits = [];
        for (const [key, chunkEdits] of state.world.edits) {
            let flat = state.world.editCache.get(key);
            if (!flat) {
                flat = new Uint16Array(chunkEdits.size * 2);
                let cursor = 0;
                for (const [index, type] of chunkEdits) {
                    flat[cursor++] = index;
                    flat[cursor++] = type;
                }
                state.world.editCache.set(key, flat);
            }
            edits.push([key, flat]);
        }

        return {
            v: version,
            seed: state.seed,
            time: Date.now(),
            worldTime: state.worldTime,
            blockFacings: state.world.blockFacings.serialize(WORLD_HEIGHT),
            player: state.player,
            selectedSlot: state.selectedSlot,
            inventory: state.inventory.map(packStack),
            drops: state.drops.filter(drop => drop.age < drop.ttl).map(drop => ({
                id: drop.id, count: drop.count, damage: drop.damage || 0,
                x: drop.pos.x, y: drop.pos.y, z: drop.pos.z, age: drop.age, ttl: drop.ttl,
            })),
            chests: Array.from(state.chests, ([key, chest]) => [key, chest.inv.slots.map(packStack)]),
            furnaces: Array.from(state.furnaces, ([key, furnace]) => [key, {
                slots: furnace.inv.slots.map(packStack),
                burn: furnace.burn,
                burnMax: furnace.burnMax,
                cook: furnace.cook,
            }]),
            edits,
            // Célula da cama em que o jogador dormiu por último (o ponto de
            // renascimento). Sem cama, o campo vai nulo.
            bedSpawn: state.bedSpawn ?? null,
        };
    }

    function sanitizeStack(stack) {
        if (!stack) return null;
        if (stack.id === ID.WATER) return null;
        const id = LEGACY_MINERAL_ITEM_MAP[stack.id] ?? stack.id;
        const item = ITEMS[id];
        if (!item || !Number.isInteger(stack.count) || stack.count < 1 || stack.count > item.maxStack) {
            console.warn('Pilha inválida descartada durante o carregamento do save:', stack);
            return null;
        }
        const clean = { id, count: stack.count };
        if (item.maxDurability && stack.damage > 0 && stack.damage < item.maxDurability) clean.damage = stack.damage;
        return clean;
    }

    function parseChests(list) {
        const chests = new Map();
        if (!Array.isArray(list)) return chests;
        for (const entry of list) {
            if (!Array.isArray(entry)) continue;
            const [key, slots] = entry;
            if (typeof key !== 'string' || !/^-?\d+,\d+,-?\d+$/.test(key) || !Array.isArray(slots) || slots.length !== 27) continue;
            const cleanSlots = slots.map(stack => {
                try { return sanitizeStack(stack); }
                catch { return null; }
            });
            chests.set(key, { slots: cleanSlots });
        }
        return chests;
    }

    function parseDrops(list) {
        const drops = [];
        if (!Array.isArray(list)) return drops;
        for (const entry of list) {
            const id = entry && (LEGACY_MINERAL_ITEM_MAP[entry.id] ?? entry.id);
            const item = entry && ITEMS[id];
            if (!item || !Number.isInteger(entry.count) || entry.count < 1 || entry.count > item.maxStack) continue;
            if (![entry.x, entry.y, entry.z].every(Number.isFinite)) continue;
            const damage = item.maxDurability && entry.damage > 0 && entry.damage < item.maxDurability ? entry.damage : 0;
            drops.push({
                id, count: entry.count, damage,
                x: entry.x, y: entry.y, z: entry.z,
                age: Math.max(0, +entry.age || 0),
                ttl: Math.min(DEATH_DROP_TTL, Math.max(1, +entry.ttl || 300)),
            });
        }
        return drops;
    }

    // A célula da cama é só um endereço: inteiro, dentro do mundo. Se a cama
    // não estiver mais lá, quem carrega descarta (o jogo confere o bloco).
    function parseBedSpawn(value) {
        if (!value || typeof value !== 'object') return null;
        const { x, y, z } = value;
        if (![x, y, z].every(Number.isInteger)) return null;
        if (y < 0 || y >= WORLD_HEIGHT) return null;
        return { x, y, z };
    }

    function validate(data, expectedSeed) {
        try {
            if (!data || data.v !== version || data.seed !== expectedSeed) return null;
            const player = data.player;
            if (![player.x, player.y, player.z, player.health, player.hunger].every(Number.isFinite)) return null;
            if (player.breath !== undefined && !Number.isFinite(player.breath)) return null;
            if (!Array.isArray(data.inventory) || data.inventory.length !== PLAYER_INVENTORY_SIZE) return null;
            const inventory = data.inventory.map(sanitizeStack);

            const edits = new Map();
            const maxIndex = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;
            for (const [key, list] of data.edits) {
                const flat = Array.isArray(list[0]) ? list.flat() : list;
                if (flat.length % 2) throw new Error('lista de edições inválida');
                const chunkEdits = new Map();
                for (let cursor = 0; cursor < flat.length; cursor += 2) {
                    const index = flat[cursor], type = flat[cursor + 1];
                    if (!Number.isInteger(index) || index < 0 || index >= maxIndex) throw new Error('índice inválido');
                    if (type !== 0 && !BLOCKS[type]) throw new Error('bloco inválido');
                    chunkEdits.set(index, type);
                }
                edits.set(String(key), chunkEdits);
            }

            const blockFacings = parseBlockFacings(data.blockFacings, WORLD_HEIGHT, (x, y, z) => {
                const cx = floorDiv(x, CHUNK_SIZE), cz = floorDiv(z, CHUNK_SIZE);
                const localIndex = idx(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
                const type = edits.get(chunkKey(cx, cz))?.get(localIndex);
                // A cama guarda a direção sem ter face frontal: sem esta
                // exceção ela voltava do save sempre virada para o sul.
                return BLOCKS[type]?.tiles.front !== undefined || BLOCKS[type]?.render === 'bed';
            });

            const furnaces = new Map();
            for (const [key, furnace] of (data.furnaces || [])) {
                if (!/^-?\d+,\d+,-?\d+$/.test(key) || !Array.isArray(furnace.slots) || furnace.slots.length !== 3) {
                    throw new Error('forno inválido');
                }
                const slots = furnace.slots.map(sanitizeStack);
                furnaces.set(key, {
                    slots,
                    burn: Math.max(0, +furnace.burn || 0),
                    burnMax: Math.max(0, +furnace.burnMax || 0),
                    cook: Math.max(0, +furnace.cook || 0),
                });
            }

            return {
                player: {
                    x: player.x, y: player.y, z: player.z,
                    health: Math.min(MAX_HEALTH, Math.max(1, player.health)),
                    hunger: Math.min(MAX_HUNGER, Math.max(0, player.hunger)),
                    saturation: Math.min(MAX_HUNGER, Math.max(0, Number.isFinite(player.saturation) ? player.saturation : 5)),
                    breath: Math.min(MAX_BREATH, Math.max(0, Number.isFinite(player.breath) ? player.breath : MAX_BREATH)),
                },
                selectedSlot: data.selectedSlot >= 0 && data.selectedSlot < 9 ? data.selectedSlot | 0 : 0,
                inventory,
                edits,
                blockFacings,
                furnaces,
                drops: parseDrops(data.drops),
                chests: parseChests(data.chests),
                worldTime: Number.isFinite(data.worldTime) ? ((data.worldTime % 1) + 1) % 1 : START_TIME,
                bedSpawn: parseBedSpawn(data.bedSpawn),
            };
        } catch {
            return null;
        }
    }

    return { build, validate };
}
