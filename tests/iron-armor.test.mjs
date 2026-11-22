import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { ID, ITEMS, RECIPES, matchRecipe } from '../world-catalog.js';
import { ironArmorSprite } from '../world-iron-armor-icons.js';
import { copperArmorSprite } from '../world-copper-armor-icons.js';
import { createTextureTools } from '../world-textures.js';
import { Inventory } from '../inventory-model.js';
import { craftConsume, invFillRecipe } from '../inventory-logic.js';
import { armorPoints, damageAfterArmor } from '../world-armor-protection.js';
import { damageEquippedArmor } from '../world-armor-durability.js';
import { canEquipArmor } from '../inventory-armor.js';
import { createWorldSaveCodec } from '../world-save-codec.js';
import { PLAYER_INVENTORY_SIZE } from '../world-save-settings.js';
import { createPlayerModel, PLAYER_MODEL_HEIGHT } from '../player-model.js';
import { createPlayerArmor } from '../player-armor.js';

const I = ID.IRON_INGOT, X = null;
const pieces = [
    [ID.IRON_HELMET, 'helmet', 165, 2, [[I,I,I],[I,X,I]], 5],
    [ID.IRON_CHESTPLATE, 'chest', 240, 6, [[I,X,I],[I,I,I],[I,I,I]], 8],
    [ID.IRON_LEGGINGS, 'legs', 225, 5, [[I,I,I],[I,X,I],[I,X,I]], 7],
    [ID.IRON_BOOTS, 'feet', 195, 2, [[I,X,I],[I,X,I]], 4],
];
const stack = id => ({ id, count: 1 });

test('ícones preservam a silhueta aprovada e usam a paleta de ferro', () => {
    const textures = createTextureTools(THREE);
    for (const [id, slot] of pieces) {
        const item = ITEMS[id], kind = item.sprite.kind;
        assert.equal(item.armorSlot, slot); assert.equal(item.maxStack, 1);
        const iron = ironArmorSprite(kind), copper = copperArmorSprite(kind.replace('iron-', 'copper-'));
        assert.deepEqual(iron.map(r => r.map(Boolean)), copper.map(r => r.map(Boolean)));
        assert.deepEqual(textures.spritePixels(kind, 'iron'), iron);
        assert.notDeepEqual(iron, copper);
        assert(iron.flat().filter(Boolean).every(color => Array.isArray(color) && color.length === 3));
    }
    assert.equal(ironArmorSprite('iron-ingot'), null);
});

test('receitas usam barras de ferro com o formato do cobre e exigem bancada', () => {
    for (const [id, , durability, points, shape, count] of pieces) {
        assert.equal(ITEMS[id].maxDurability, durability); assert.equal(ITEMS[id].armorPoints, points);
        const recipe = RECIPES.find(r => r.result === id); assert.deepEqual(recipe.shape, shape);
        const inventory = new Inventory(36), craft = new Inventory(9); inventory.add(I, count);
        assert.deepEqual(invFillRecipe(inventory, craft, recipe, 2), {ok:false,reason:'requires-table'});
        assert.deepEqual(invFillRecipe(inventory, craft, recipe, 3), {ok:true});
        assert.deepEqual(matchRecipe(craft, 3), {id,count:1}); craftConsume(craft,3);
        assert(craft.slots.every(v => !v));
        const missing = new Inventory(36), empty = new Inventory(9); missing.add(I, count-1);
        assert.deepEqual(invFillRecipe(missing, empty, recipe, 3), {ok:false,reason:'missing-items'});
    }
});

test('defesa e desgaste aceitam conjuntos mistos e respeitam fontes sem proteção', () => {
    const armor = pieces.map(([id]) => stack(id));
    assert.equal(armorPoints(armor), 15); assert(armor.every((item, i) => canEquipArmor(i, item)));
    assert.equal(armorPoints([stack(ID.IRON_HELMET),stack(ID.COPPER_CHESTPLATE),stack(ID.IRON_LEGGINGS),stack(ID.COPPER_BOOTS)]), 12);
    assert(damageAfterArmor(8, 15) < damageAfterArmor(8, 10));
    for (const source of ['fall', 'drown', 'starve', 'kill']) {
        assert.equal(damageAfterArmor(8, 15, source), 8);
        damageEquippedArmor(armor, 8, source);
    }
    assert(armor.every(item => !item.damage));
    damageEquippedArmor(armor, 8); assert(armor.every(item => item.damage === 2));
    armor[0].damage = 164; assert.deepEqual(damageEquippedArmor(armor, 1), ['Capacete de ferro']); assert.equal(armor[0], null);
});

test('save preserva as peças de ferro e desgaste dentro e fora dos slots', () => {
    const codec = createWorldSaveCodec(), inventory = new Inventory(PLAYER_INVENTORY_SIZE);
    const armor = pieces.map(([id], i) => ({id, count:1, damage:i+1})); inventory.slots[0] = {...armor[2]};
    const state={seed:7,worldTime:.5,world:{edits:new Map(),editCache:new Map(),blockFacings:{serialize:()=>[]}},player:{x:0,y:5,z:0,health:20,hunger:20},selectedSlot:0,inventory:inventory.slots,armor,drops:[],chests:new Map(),furnaces:new Map()};
    const loaded = codec.validate(codec.build(state), 7);
    assert.deepEqual(loaded.armor, armor); assert.deepEqual(loaded.inventory[0], armor[2]);
});

test('troca entre cobre e ferro preserva peças, cabelo e roupa no modelo', () => {
    const model = createPlayerModel(THREE), armor = createPlayerArmor(THREE, model, PLAYER_MODEL_HEIGHT / 32);
    const hair = model.head.getObjectByName('player-hair');
    const sleeve = model.leftArm.getObjectByName('shoulder');
    const trousers = model.leftLeg.getObjectByName('trousers-preview');
    const boot = model.leftLeg.getObjectByName('boot-preview');
    const ironHelmet = model.head.getObjectByName('iron-helmet-preview');
    const copperHelmet = model.head.getObjectByName('copper-helmet-revised');
    const ironLeg = model.leftLeg.getObjectByName('iron-leggings-preview');
    const ironBoot = model.leftLeg.getObjectByName('iron-boot-preview');
    const copper = [ID.COPPER_HELMET,ID.COPPER_CHESTPLATE,ID.COPPER_LEGGINGS,ID.COPPER_BOOTS].map(stack);
    const iron = pieces.map(([id]) => stack(id));
    armor.sync(); armor.setEquipment(copper); assert(copperHelmet.visible && !hair.visible && !sleeve.visible && !trousers.visible && !boot.visible);
    armor.setEquipment(iron); assert(ironHelmet.visible && !copperHelmet.visible && ironLeg.visible && ironBoot.visible);
    assert(!hair.visible && !sleeve.visible && !trousers.visible && !boot.visible);
    armor.setEquipment([copper[0],iron[1],copper[2],iron[3]]);
    assert(copperHelmet.visible && !ironHelmet.visible && ironBoot.visible && !ironLeg.visible);
    assert(!hair.visible && !sleeve.visible && !trousers.visible && !boot.visible);
    armor.setEquipment([]); assert(hair.visible && sleeve.visible && trousers.visible && boot.visible);
    armor.dispose(); model.dispose();
});

test('comandos, criativo e modelo do inventário expõem as peças de ferro', async () => {
    const { resolveItem } = await import('../world-chat-commands.js');
    const { creativeItems } = await import('../world-creative.js');
    const { renderInventoryPlayer } = await import('../inventory-player-preview.js');
    for (const [id] of pieces) {
        assert(creativeItems().includes(id));
        assert.equal(resolveItem(Object.keys(ID).find(key => ID[key] === id).toLowerCase(), { ID, ITEMS }).id, id);
    }
    let target = null, checked = false;
    const renderer = {getRenderTarget(){return target},setRenderTarget(v){target=v},clear(){},render(scene){
        const model = scene.getObjectByName('player');
        assert(model.getObjectByName('iron-helmet-preview').visible);
        assert(model.getObjectByName('iron-leggings-preview').visible);
        assert(model.getObjectByName('iron-boot-preview').visible);
        const chests = model.children.filter(child => child.name === 'block-chest-preview');
        assert.equal(chests.filter(chest => chest.visible).length, 1);
        checked = true;
    },readRenderTargetPixels(){}};
    const canvas = {getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}}};
    renderInventoryPlayer({THREE, renderer, canvas, armor:pieces.map(([id])=>stack(id))});
    assert(checked); assert.equal(target,null);
});
