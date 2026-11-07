import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorldSaveCodec, WORLD_SAVE_VERSION } from '../world-save-codec.js';
import { BlockFacingStore } from '../world-block-orientation.js';
import { ID } from '../world-catalog.js';
import { Inventory } from '../inventory-model.js';
import { PLAYER_INVENTORY_SIZE } from '../world-save-settings.js';

function makeState() {
    const edits = new Map([['0,0', new Map([[5, ID.STONE], [6, 0]])]]);
    const world = { edits, editCache: new Map(), blockFacings: new BlockFacingStore() };
    world.blockFacings.set(2, 30, 2, 'east');
    // A orientação só é persistida para blocos que também estão nas edições.
    edits.get('0,0').set(2 + 2 * 16 + 30 * 256, ID.CHEST);
    return {
        seed: 7,
        worldTime: 0.4,
        world,
        player: { x: 1.5, y: 30, z: 2.5, health: 20, hunger: 20, saturation: 5, breath: 20 },
        selectedSlot: 0,
        inventory: new Inventory(PLAYER_INVENTORY_SIZE).slots,
        drops: [],
        chests: new Map(),
        furnaces: new Map(),
        bedSpawn: null,
    };
}

test('ida e volta do save preserva edições e orientação', () => {
    const codec = createWorldSaveCodec({ version: WORLD_SAVE_VERSION });
    const built = codec.build(makeState());
    const loaded = codec.validate(built, 7);
    assert.ok(loaded);
    assert.deepEqual(loaded.edits.get('0,0').get(5), ID.STONE);
    assert.equal(loaded.edits.get('0,0').get(6), 0);
    assert.equal(loaded.blockFacings.get('2,30,2'), 'east');
});

test('save de outra seed ou versão é rejeitado', () => {
    const codec = createWorldSaveCodec({ version: WORLD_SAVE_VERSION });
    const built = codec.build(makeState());
    assert.equal(codec.validate(built, 8), null);
    assert.equal(codec.validate({ ...built, v: 999 }, 7), null);
    assert.equal(codec.validate({ ...built, inventory: [] }, 7), null);
});

test('save válido nunca aceita itens inexistentes', () => {
    const codec = createWorldSaveCodec({ version: WORLD_SAVE_VERSION });
    const state = makeState();
    state.inventory[0] = { id: 250, count: 1 };
    const loaded = codec.validate(codec.build(state), 7);
    assert.equal(loaded.inventory[0], null);
});

test('a cama do último sonho vai e volta no save', () => {
    const codec = createWorldSaveCodec({ version: WORLD_SAVE_VERSION });
    const state = makeState();
    // A célula dos pés da cama onde o jogador dormiu (ponto de renascimento).
    state.bedSpawn = { x: -3, y: 33, z: 8 };
    const built = codec.build(state);
    assert.deepEqual(built.bedSpawn, { x: -3, y: 33, z: 8 });
    assert.deepEqual(codec.validate(built, 7).bedSpawn, { x: -3, y: 33, z: 8 });
});

test('save sem cama (ou com cama estragada) não guarda renascimento', () => {
    const codec = createWorldSaveCodec({ version: WORLD_SAVE_VERSION });
    // Sem cama: o campo vai nulo e volta nulo.
    assert.equal(codec.build(makeState()).bedSpawn, null);
    assert.equal(codec.validate(codec.build(makeState()), 7).bedSpawn, null);
    // Cama estragada no arquivo é descartada sem derrubar o save inteiro.
    const estragada = (bedSpawn) => {
        const state = makeState();
        state.bedSpawn = bedSpawn;
        return codec.validate(codec.build(state), 7);
    };
    for (const ruim of [{ x: 1.5, y: 20, z: 3 }, { x: 1, y: -2, z: 3 }, { x: 1, y: 9999, z: 3 },
        { x: 1, y: 20 }, 'cama', 42, [1, 20, 3]]) {
        const carregado = estragada(ruim);
        assert.ok(carregado, `save derrubado por ${JSON.stringify(ruim)}`);
        assert.equal(carregado.bedSpawn, null, `cama inválida aceita: ${JSON.stringify(ruim)}`);
    }
});
