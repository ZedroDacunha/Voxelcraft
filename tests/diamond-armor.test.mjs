import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { ID, ITEMS, RECIPES, matchRecipe } from '../world-catalog.js';
import { diamondArmorSprite } from '../world-diamond-armor-icons.js';
import { copperArmorSprite } from '../world-copper-armor-icons.js';
import { createTextureTools } from '../world-textures.js';
import { Inventory } from '../inventory-model.js';
import { craftConsume, invFillRecipe } from '../inventory-logic.js';
import { armorPoints, armorToughness, damageAfterArmor } from '../world-armor-protection.js';
import { damageEquippedArmor } from '../world-armor-durability.js';
import { canEquipArmor } from '../inventory-armor.js';
import { createWorldSaveCodec } from '../world-save-codec.js';
import { PLAYER_INVENTORY_SIZE } from '../world-save-settings.js';
import { createPlayerModel, PLAYER_MODEL_HEIGHT } from '../player-model.js';
import { createPlayerArmor } from '../player-armor.js';

// O item de diamante usa o ID histórico compartilhado com o minério.
const D = ID.DIAMOND_ORE, X = null;
const pieces = [
    [ID.DIAMOND_HELMET, 'helmet', 363, 3, [[D,D,D],[D,X,D]], 5],
    [ID.DIAMOND_CHESTPLATE, 'chest', 528, 8, [[D,X,D],[D,D,D],[D,D,D]], 8],
    [ID.DIAMOND_LEGGINGS, 'legs', 495, 6, [[D,D,D],[D,X,D],[D,X,D]], 7],
    [ID.DIAMOND_BOOTS, 'feet', 429, 3, [[D,X,D],[D,X,D]], 4],
];
const stack = id => ({ id, count: 1 });
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-10, `${a} != ${b}`);

test('ícones usam a mesma silhueta aprovada e a paleta de diamante', () => {
    const textures = createTextureTools(THREE);
    for (const [id, slot] of pieces) {
        const item = ITEMS[id], kind = item.sprite.kind;
        assert.equal(item.armorSlot, slot); assert.equal(item.maxStack, 1);
        const diamond = diamondArmorSprite(kind), copper = copperArmorSprite(kind.replace('diamond-', 'copper-'));
        assert.deepEqual(diamond.map(r => r.map(Boolean)), copper.map(r => r.map(Boolean)));
        assert.deepEqual(textures.spritePixels(kind, 'diamond'), diamond);
        assert.notDeepEqual(diamond, copper);
        assert(diamond.flat().filter(Boolean).every(color => Array.isArray(color) && color.length === 3));
    }
    assert.equal(diamondArmorSprite('diamond-gem'), null);
});

test('receitas usam diamante, formato correto, quantidades e bancada', () => {
    assert.equal(ITEMS[D].name, 'Diamante');
    for (const [id, , durability, points, shape, count] of pieces) {
        assert.equal(ITEMS[id].maxDurability, durability); assert.equal(ITEMS[id].armorPoints, points); assert.equal(ITEMS[id].armorToughness, 2);
        const recipe = RECIPES.find(r => r.result === id); assert.deepEqual(recipe.shape, shape);
        assert.equal(shape.flat().filter(Boolean).length, count);
        const inventory = new Inventory(36), craft = new Inventory(9); inventory.add(D, count);
        assert.deepEqual(invFillRecipe(inventory, craft, recipe, 2), {ok:false,reason:'requires-table'});
        assert.deepEqual(invFillRecipe(inventory, craft, recipe, 3), {ok:true});
        assert.deepEqual(matchRecipe(craft, 3), {id,count:1}); craftConsume(craft,3);
        assert(craft.slots.every(v => !v)); assert(inventory.slots.every(v => !v));
        const missing = new Inventory(36), empty = new Inventory(9); missing.add(D, count-1);
        assert.deepEqual(invFillRecipe(missing, empty, recipe, 3), {ok:false,reason:'missing-items'});
        assert.equal(missing.slots[0].count, count-1);
        const wrong = new Inventory(9);
        shape.forEach((row, y) => row.forEach((v,x) => {if(v) wrong.slots[y*3+x] = stack(ID.GOLD_INGOT)}));
        assert.notEqual(matchRecipe(wrong, 3)?.id,id);
    }
});

test('proteção e dureza seguem a fórmula Java, inclusive peças mistas e golpes fortes', () => {
    const armor = pieces.map(([id]) => stack(id));
    assert.equal(armorPoints(armor), 20); assert.equal(armorToughness(armor), 8);
    assert(armor.every((item,i) => canEquipArmor(i,item)));
    const mixed = [stack(ID.DIAMOND_HELMET), stack(ID.IRON_CHESTPLATE), stack(ID.DIAMOND_LEGGINGS), stack(ID.GOLD_BOOTS)];
    assert.equal(armorPoints(mixed), 16); assert.equal(armorToughness(mixed), 4);
    assert.equal(armorToughness([stack(ID.DIAMOND_BOOTS),null,null,null]),0);
    assert.equal(armorToughness(null),0);
    near(damageAfterArmor(20,20,'generic',8), 8);
    near(damageAfterArmor(20,16,'generic',4), 20*(1-(16-20/3)/25));
    near(damageAfterArmor(4,10,'generic',0), 2.72);
    near(damageAfterArmor(4,10), 2.72);
    assert(damageAfterArmor(20,20,'generic',8) < damageAfterArmor(20,20,'generic',0));
    for (const source of ['fall','drown','starve','kill']) {
        assert.equal(damageAfterArmor(20, 20, source, 8), 20);
        damageEquippedArmor(armor, 20, source);
    }
    assert(armor.every(item => !item.damage));
    damageEquippedArmor(armor, 8); assert(armor.every(item => item.damage === 2));
    armor[0].damage = 362; assert.deepEqual(damageEquippedArmor(armor, 1), ['Capacete de diamante']);
    assert.equal(armor[0], null); assert.equal(armorPoints(armor), 17); assert.equal(armorToughness(armor), 6);
});

test('save preserva peças de diamante e desgaste sem afetar saves anteriores', () => {
    const codec = createWorldSaveCodec(), inventory = new Inventory(PLAYER_INVENTORY_SIZE);
    const armor = pieces.map(([id],i) => ({id,count:1,damage:i+1})); inventory.slots[0] = {...armor[2]};
    const state={seed:7,worldTime:.5,world:{edits:new Map(),editCache:new Map(),blockFacings:{serialize:()=>[]}},player:{x:0,y:5,z:0,health:20,hunger:20},selectedSlot:0,inventory:inventory.slots,armor,drops:[],chests:new Map(),furnaces:new Map()};
    const data = codec.build(state), loaded = codec.validate(data, 7);
    assert.deepEqual(loaded.armor, armor); assert.deepEqual(loaded.inventory[0], armor[2]);
    delete data.armor; assert.deepEqual(codec.validate(data,7).armor, [null,null,null,null]);
});

test('equipar e trocar diamante com outros materiais preserva cabelo e roupa', () => {
    const model = createPlayerModel(THREE), armor = createPlayerArmor(THREE, model, PLAYER_MODEL_HEIGHT / 32);
    const hair = model.head.getObjectByName('player-hair'), sleeve = model.leftArm.getObjectByName('shoulder');
    const trousers = model.leftLeg.getObjectByName('trousers-preview'), boot = model.leftLeg.getObjectByName('boot-preview');
    const diamondHelmet = model.head.getObjectByName('diamond-helmet-preview'), goldHelmet = model.head.getObjectByName('gold-helmet-preview');
    const diamondLeg = model.leftLeg.getObjectByName('diamond-leggings-preview'), diamondBoot = model.leftLeg.getObjectByName('diamond-boot-preview');
    const diamond = pieces.map(([id]) => stack(id));
    const gold = [ID.GOLD_HELMET,ID.GOLD_CHESTPLATE,ID.GOLD_LEGGINGS,ID.GOLD_BOOTS].map(stack);
    const iron = [ID.IRON_HELMET,ID.IRON_CHESTPLATE,ID.IRON_LEGGINGS,ID.IRON_BOOTS].map(stack);
    armor.setEquipment(diamond);
    assert(diamondHelmet.visible && diamondLeg.visible && diamondBoot.visible);
    assert(!hair.visible && !sleeve.visible && !trousers.visible && !boot.visible);
    armor.setEquipment(gold); assert(!diamondHelmet.visible && goldHelmet.visible && !hair.visible && !sleeve.visible && !trousers.visible && !boot.visible);
    armor.setEquipment([diamond[0],iron[1],diamond[2],gold[3]]); assert(diamondHelmet.visible && !goldHelmet.visible && diamondLeg.visible && !diamondBoot.visible);
    assert(!hair.visible && !sleeve.visible && !trousers.visible && !boot.visible);
    armor.setEquipment([]); assert(hair.visible && sleeve.visible && trousers.visible && boot.visible);
    armor.dispose(); model.dispose();
});

test('catálogo criativo, comandos e personagem do inventário reconhecem diamante', async () => {
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
        assert(model.getObjectByName('diamond-helmet-preview').visible);
        assert(model.getObjectByName('diamond-leggings-preview').visible);
        assert(model.getObjectByName('diamond-boot-preview').visible);
        assert.equal(model.children.filter(child => child.name === 'block-chest-preview' && child.visible).length, 1);
        checked = true;
    },readRenderTargetPixels(){}};
    const canvas = {getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}}};
    renderInventoryPlayer({THREE, renderer, canvas, armor:pieces.map(([id])=>stack(id))});
    assert(checked); assert.equal(target,null);
});
