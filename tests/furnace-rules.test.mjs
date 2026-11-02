import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { stepFurnace, furnaceChunk } from '../world-furnace-rules.js';
import { CHUNK_SIZE } from '../world-save-settings.js';
import { ID, ITEMS, SMELT, FUEL } from '../world-catalog.js';

const furnace = (slots = []) => ({
    inv: { slots: [slots[0] ?? null, slots[1] ?? null, slots[2] ?? null] },
    burn: slots.burn ?? 0,
    burnMax: 0,
    cook: 0,
});

// Combustível barato de teste: palito queima 5s e funde pedra em 10s.
const withFuel = () => ({ id: ID.STICK, count: 3 });
const withOre = () => ({ id: ID.COBBLE, count: 4 });

test('forno sem receita ou sem combustível não muda nada', () => {
    const idle = furnace();
    assert.deepEqual(stepFurnace(idle, 1), { changed: false, litChanged: false });
    assert.equal(idle.burn, 0);

    const onlyOre = furnace([withOre()]);
    assert.deepEqual(stepFurnace(onlyOre, 1), { changed: false, litChanged: false });
    assert.equal(onlyOre.burn, 0);
    assert.equal(onlyOre.cook, 0);

    const onlyFuel = furnace([null, withFuel()]);
    assert.deepEqual(stepFurnace(onlyFuel, 1), { changed: false, litChanged: false });
    assert.deepEqual(onlyFuel.inv.slots[1], { id: ID.STICK, count: 3 }, 'combustível não é gasto à toa');
});

test('acende consumindo um combustível e reporta a mudança de luz', () => {
    const f = furnace([withOre(), withFuel()]);
    const result = stepFurnace(f, 1);

    assert.equal(f.burn, FUEL[ID.STICK] - 1, 'queima um segundo');
    assert.equal(f.burnMax, FUEL[ID.STICK]);
    assert.deepEqual(f.inv.slots[1], { id: ID.STICK, count: 2 });
    assert.equal(f.cook, 1);
    assert.deepEqual(result, { changed: true, litChanged: true });
});

test('não acende de novo enquanto ainda está queimando', () => {
    const f = furnace([withOre(), withFuel()]);
    stepFurnace(f, 1);
    const fuelAfterFirst = f.inv.slots[1].count;
    stepFurnace(f, 1);
    assert.equal(f.inv.slots[1].count, fuelAfterFirst, 'não consome um segundo combustível');
});

test('funde no tempo da receita e entrega o resultado', () => {
    const f = furnace([withOre(), { id: ID.PLANKS, count: 2 }]);
    const time = SMELT[ID.COBBLE].time;

    stepFurnace(f, time - 0.1);
    assert.equal(f.inv.slots[2], null, 'ainda não terminou');

    const result = stepFurnace(f, 0.2);
    assert.deepEqual(f.inv.slots[2], { id: ID.STONE, count: 1 });
    assert.deepEqual(f.inv.slots[0], { id: ID.COBBLE, count: 3 });
    assert.equal(f.cook, 0, 'preparo zera ao entregar');
    assert.equal(result.changed, true);
});

test('resultado empilha até o limite e então o forno para de fundir', () => {
    const stone = { id: ID.STONE, count: ITEMS[ID.STONE].maxStack - 1 };
    const f = furnace([{ id: ID.COBBLE, count: 8 }, { id: ID.PLANKS, count: 4 }, stone]);
    const time = SMELT[ID.COBBLE].time;
    f.burn = f.burnMax = 60;

    stepFurnace(f, time);
    assert.equal(f.inv.slots[2].count, ITEMS[ID.STONE].maxStack);

    // pilha cheia: não consome entrada nem avança o preparo
    const before = f.inv.slots[0].count;
    stepFurnace(f, time);
    assert.equal(f.inv.slots[0].count, before);
    assert.equal(f.inv.slots[2].count, ITEMS[ID.STONE].maxStack);
});

test('resultado de outro item impede acender e fundir', () => {
    const f = furnace([withOre(), withFuel(), { id: ID.GRASS, count: 1 }]);
    const result = stepFurnace(f, 5);

    assert.equal(f.inv.slots[0].count, 4);
    assert.deepEqual(f.inv.slots[2], { id: ID.GRASS, count: 1 });
    assert.equal(f.cook, 0);
    assert.equal(f.burn, 0, 'nem acende, para não queimar combustível à toa');
    assert.deepEqual(f.inv.slots[1], { id: ID.STICK, count: 3 });
    assert.deepEqual(result, { changed: false, litChanged: false });
});

test('preparo esfria em dobro quando não há o que fundir', () => {
    const f = furnace([null, { id: ID.COAL, count: 1 }]);
    f.burn = 60;

    stepFurnace(f, 2);
    assert.equal(f.cook, 0, 'nunca fica negativo');

    f.cook = 8;
    stepFurnace(f, 1);
    assert.equal(f.cook, 6);
});

test('queima termina sem ficar negativa e apaga', () => {
    const f = furnace([withOre(), withFuel()]);
    f.burn = 0.5;
    f.burnMax = 5;

    const result = stepFurnace(f, 1);
    assert.equal(f.burn, 0);
    assert.equal(result.litChanged, true, 'o jogo precisa apagar a luz do forno');
});

test('dt inválido ou zero não faz nada', () => {
    const f = furnace([withOre(), withFuel()]);
    for (const dt of [0, -1, NaN, undefined]) {
        assert.deepEqual(stepFurnace(f, dt), { changed: false, litChanged: false });
        assert.equal(f.burn, 0);
    }
});

test('fumo: receita e combustível da receita real do catálogo', () => {
    assert.deepEqual(SMELT[ID.LOG], { result: ID.CHARCOAL, time: 10 });
    const f = furnace([{ id: ID.LOG, count: 1 }, { id: ID.COAL, count: 1 }]);
    stepFurnace(f, 10);
    assert.equal(f.burnMax, FUEL[ID.COAL]);
    assert.equal(f.inv.slots[0], null, 'entrada consumida');
    assert.deepEqual(f.inv.slots[2], { id: ID.CHARCOAL, count: 1 });
});

test('chunk do forno sai da chave e fica em cache', () => {
    const f = {};
    assert.deepEqual(furnaceChunk(f, '5,10,7', CHUNK_SIZE), { cx: 0, cz: 0 });
    assert.equal(f.cx, 0);

    const negative = {};
    // floorDiv (e não truncamento): -1 e -17 caem em chunks negativos distintos
    assert.deepEqual(furnaceChunk(negative, '-1,10,-17', CHUNK_SIZE), { cx: -1, cz: -2 });

    const far = {};
    assert.deepEqual(furnaceChunk(far, '40,70,40', CHUNK_SIZE), { cx: 2, cz: 2 });

    // cache: muda a chave, mas o resultado continua o do registro
    assert.deepEqual(furnaceChunk(f, '999,10,999', CHUNK_SIZE), { cx: 0, cz: 0 });
});

test('chave inválida devolve null em vez de chunk errado', () => {
    assert.equal(furnaceChunk({}, 'lixo', CHUNK_SIZE), null);
    assert.equal(furnaceChunk({}, '', CHUNK_SIZE), null);
    assert.equal(furnaceChunk({}, '1,2,3', 0), null);
});

const gameSource = readFileSync(new URL('../game.js', import.meta.url), 'utf8');

test('o jogo só simula fornos em chunks carregados', () => {
    assert.match(gameSource, /furnaceChunk\(f, key, CHUNK_SIZE\)/);
    assert.match(gameSource, /const chunk = coords \? world\?\.getChunk\(coords\.cx, coords\.cz\) : null;\s*\n\s*if \(!chunk\) continue;/);
    assert.match(gameSource, /stepFurnace\(f, dt\)/);
    // o laço antigo não sobrou no arquivo
    assert.doesNotMatch(gameSource, /const wasBurning = f\.burn > 0;/);
});

test('fumaça de forno longe não consulta o mundo', () => {
    const smoke = readFileSync(new URL('../world-furnace-effects.js', import.meta.url), 'utf8');
    const radiusAt = smoke.indexOf('nearRadiusSq');
    const worldAt = smoke.indexOf('world.getBlock(x, y, z)');
    assert.ok(radiusAt > 0 && worldAt > radiusAt, 'checagem de distância vem antes do getBlock');
});
