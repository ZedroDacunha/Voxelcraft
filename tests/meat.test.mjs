// AS CARNES — crua e assada — e a regra que leva uma à outra no forno.
//
// A tabela fica em `world-meats.js` e é a **única** fonte: dela saem os ids, os
// itens, a receita de forno (e, por tabela, o livro de receitas e a dica do slot)
// e as cores do sprite. Estes testes cobram duas coisas:
//
// 1. a carne de ovelha assa de verdade — entra crua no forno, sai assada e
//    alimenta mais;
// 2. o **contrato para os próximos bichos**: toda carne da tabela tem par crua +
//    assada, ids na faixa reservada, arte com cores e receita de forno. Mob novo
//    que solta carne só precisa cumprir isso.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ID, ITEMS, SMELT, ATLAS_COLUMNS, ATLAS_ROWS, FUEL } from '../world-catalog.js';
import { stepFurnace } from '../world-furnace-rules.js';
import { MEATS, MEAT_IDS, MEAT_SMELTING, MEAT_ID_BASE, MEAT_ID_END, MEAT_SPRITE_CORES } from '../world-meats.js';
import { createTextureTools } from '../world-textures.js';
import { resolveItem } from '../world-chat-commands.js';

const ovelha = MEATS.find(meat => meat.key === 'mutton');

const forno = (slots = []) => ({
    inv: { slots: [slots[0] ?? null, slots[1] ?? null, slots[2] ?? null] },
    burn: 0,
    burnMax: 0,
    cook: 0,
});

/** Os pixels de um sprite pela rota do atlas (o mesmo caminho do jogo). */
function sprites() {
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {}, getImageData() { return { data: new Uint8ClampedArray(4) }; } }) }) };
    const THREE = { CanvasTexture: class { constructor(image) { this.image = image; } }, NearestFilter: 1006, ClampToEdgeWrapping: 1001, SRGBColorSpace: 'srgb' };
    const tools = createTextureTools(THREE);
    const crua = tools.spritePixels(ovelha.raw.sprite.kind, ovelha.raw.sprite.mat);
    const assada = tools.spritePixels(ovelha.cooked.sprite.kind, ovelha.cooked.sprite.mat);
    delete globalThis.document;
    return { crua, assada };
}

test('a carne de ovelha continua a mesma crua, com o id de sempre', () => {
    const crua = ITEMS[ID.MUTTON];
    assert.ok(crua, 'a carne crua existe');
    assert.equal(ID.MUTTON, ovelha.raw.id);
    assert.equal(crua.name, 'Carne de ovelha');
    assert.equal(crua.maxStack, 64);
    assert.deepEqual(crua.food, { hunger: 3, sat: 1.6 });
    assert.deepEqual(crua.sprite, { kind: 'mutton', mat: 'meat' });
    assert.equal(ovelha.raw.id, 100, 'o id da crua não muda (save antigo)');
});

test('a carne assada é item próprio, mais forte que a crua', () => {
    const assada = ITEMS[ID.COOKED_MUTTON];
    assert.ok(assada, 'a carne assada existe');
    assert.equal(ID.COOKED_MUTTON, 101);
    assert.equal(assada.name, 'Carne de ovelha assada');
    assert.equal(assada.maxStack, 64);
    assert.ok(assada.food.hunger > ITEMS[ID.MUTTON].food.hunger, 'assada mata mais fome');
    assert.ok(assada.food.sat > ITEMS[ID.MUTTON].food.sat, 'assada sustenta mais');
    assert.equal(assada.food.hunger, 6);
    assert.notEqual(assada.iconTile, ITEMS[ID.MUTTON].iconTile, 'cada uma tem seu tile no atlas');
    for (const item of [ITEMS[ID.MUTTON], assada]) {
        assert.ok(item.iconTile < ATLAS_COLUMNS * ATLAS_ROWS, `${item.name} cabe no atlas`);
    }
});

test('o forno assa a carne crua: entra 100, sai 101', () => {
    const receita = SMELT[ID.MUTTON];
    assert.deepEqual(receita, { result: ID.COOKED_MUTTON, time: ovelha.time });
    assert.equal(MEAT_SMELTING.length, 1);
    assert.deepEqual(MEAT_SMELTING[0], { raw: ID.MUTTON, cooked: ID.COOKED_MUTTON, time: 10 });

    // Fumaça de verdade: um naco + tábuas (15 s de chama para 10 s de forno).
    const f = forno([{ id: ID.MUTTON, count: 2 }, { id: ID.PLANKS, count: 1 }]);
    let assou = false;
    for (let i = 0; i < 12; i++) if (stepFurnace(f, 1).smelted) assou = true;
    assert.ok(assou, 'avisa que ficou pronto (é o som do forno)');
    assert.deepEqual(f.inv.slots[2], { id: ID.COOKED_MUTTON, count: 1 }, 'saiu uma assada');
    assert.deepEqual(f.inv.slots[0], { id: ID.MUTTON, count: 1 }, 'consumiu um naco cru');
});

test('a carne assada não vira carne assada de novo (nem assa outra coisa)', () => {
    assert.equal(SMELT[ID.COOKED_MUTTON], undefined, 'a assada não tem receita');
    const f = forno([{ id: ID.COOKED_MUTTON, count: 1 }, { id: ID.PLANKS, count: 1 }]);
    assert.deepEqual(stepFurnace(f, 1), { changed: false, litChanged: false, smelted: false });
    assert.equal(f.burn, 0, 'nem acende');
});

test('a assada é o mesmo naco, só tostado — silhueta igual, cores outras', () => {
    const { crua, assada } = sprites();
    const mascara = px => px.map(linha => linha.map(c => (c ? '#' : '.')).join('')).join('\n');
    assert.equal(mascara(assada), mascara(crua), 'mesma silhueta: o olho reconhece o pedaço');

    const conjunto = px => new Set(px.flat().filter(Boolean).map(c => c.join(',')));
    const coresCrua = conjunto(crua);
    const coresAssada = conjunto(assada);
    assert.ok(coresCrua.size >= 3 && coresAssada.size >= 3, 'as duas têm paleta');
    for (const cor of coresAssada) assert.ok(!coresCrua.has(cor), `a assada não usa a cor crua ${cor}`);

    const cru = MEAT_SPRITE_CORES.mutton.raw;
    const cozido = MEAT_SPRITE_CORES.mutton.cooked;
    assert.ok(coresCrua.has(cru.carne.join(',')), 'o naco cru é rosado');
    assert.ok(coresAssada.has(cozido.carne.join(',')), 'o naco assado é tostado');
    assert.ok(coresAssada.has(cozido.marca.join(',')), 'e tem marca de grelha');
    assert.ok(!coresCrua.has(cozido.marca.join(',')), 'a crua não tem marca de grelha');
});

test('/give carne assada acha o item', () => {
    for (const nome of ['carne assada', 'assada', 'cooked_mutton', 'Carne de ovelha assada']) {
        assert.equal(resolveItem(nome, { ITEMS, ID })?.id, ID.COOKED_MUTTON, `/${nome} devia dar a assada`);
    }
    assert.equal(resolveItem('carne', { ITEMS, ID })?.id, ID.MUTTON, 'a crua continua em "carne"');
});

test('o contrato para o próximo bicho que solta carne', () => {
    // É esta a conta que um mob novo precisa fechar: uma entrada na tabela com
    // crua + assada, ids na faixa reservada, arte com cores e receita de forno.
    const idsUsados = new Set();
    for (const meat of MEATS) {
        for (const [lado, parte] of [['crua', meat.raw], ['assada', meat.cooked]]) {
            assert.ok(Number.isInteger(parte.id), `${meat.key}/${lado}: id inteiro`);
            assert.ok(parte.id >= MEAT_ID_BASE && parte.id <= MEAT_ID_END,
                `${meat.key}/${lado}: id ${parte.id} fora da faixa ${MEAT_ID_BASE}–${MEAT_ID_END}`);
            assert.ok(!idsUsados.has(parte.id), `${meat.key}/${lado}: id ${parte.id} repetido`);
            idsUsados.add(parte.id);
            assert.equal(ID[parte.idKey], parte.id, `${parte.idKey} entrou no ID`);
            assert.ok(ITEMS[parte.id], `${meat.key}/${lado}: item no catálogo`);
            assert.ok(parte.food.hunger > 0, `${meat.key}/${lado}: alimenta`);
            assert.ok(MEAT_SPRITE_CORES[parte.sprite.kind], `${meat.key}/${lado}: arte com cores`);
        }
        assert.ok(ITEMS[meat.cooked.id].food.hunger > ITEMS[meat.raw.id].food.hunger,
            `${meat.key}: assada alimenta mais que crua`);
        assert.deepEqual(SMELT[meat.raw.id], { result: meat.cooked.id, time: meat.time },
            `${meat.key}: o forno assa`);
        assert.equal(SMELT[meat.cooked.id], undefined, `${meat.key}: a assada não assa`);
    }
    // Toda carne da tabela tem receita de forno, e nenhuma receita ficou órfã.
    assert.equal(MEAT_SMELTING.length, MEATS.length);
    for (const [raw, receita] of MEAT_SMELTING.map(m => [m.raw, m])) {
        assert.ok(SMELT[raw] && SMELT[raw].result === receita.cooked);
    }
    assert.ok(MEAT_IDS.COOKED_MUTTON === ID.COOKED_MUTTON);
    // O combustível da família continua servindo para assar (nada especial).
    assert.ok(FUEL[ID.PLANKS] > ovelha.time, 'as tábuas queimam o bastante para um naco');
});
