import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { ID, ITEMS, RECIPES, matchRecipe } from '../world-catalog.js';
import { goldArmorSprite } from '../world-gold-armor-icons.js';
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

const G = ID.GOLD_INGOT, X = null;
const pieces = [
    [ID.GOLD_HELMET, 'helmet', 77, 2, [[G,G,G],[G,X,G]], 5],
    [ID.GOLD_CHESTPLATE, 'chest', 112, 5, [[G,X,G],[G,G,G],[G,G,G]], 8],
    [ID.GOLD_LEGGINGS, 'legs', 105, 3, [[G,G,G],[G,X,G],[G,X,G]], 7],
    [ID.GOLD_BOOTS, 'feet', 91, 1, [[G,X,G],[G,X,G]], 4],
];
const stack = id => ({ id, count: 1 });

test('ícones de ouro usam a silhueta e a paleta da prévia sem alterar os demais', () => {
    const textures = createTextureTools(THREE);
    for (const [id, slot] of pieces) {
        const item = ITEMS[id], kind = item.sprite.kind;
        assert.equal(item.armorSlot, slot); assert.equal(item.maxStack, 1);
        const gold = goldArmorSprite(kind), copper = copperArmorSprite(kind.replace('gold-', 'copper-'));
        assert.deepEqual(gold.map(r => r.map(Boolean)), copper.map(r => r.map(Boolean)));
        assert.deepEqual(textures.spritePixels(kind, 'gold'), gold);
        assert.notDeepEqual(gold, copper);
        assert(gold.flat().filter(Boolean).every(color => Array.isArray(color) && color.length === 3));
    }
    assert.equal(goldArmorSprite('gold-ingot'), null);
});

test('receitas da bancada usam os lingotes e formatos corretos', () => {
    for (const [id, , durability, points, shape, count] of pieces) {
        assert.equal(ITEMS[id].maxDurability, durability); assert.equal(ITEMS[id].armorPoints, points);
        const recipe = RECIPES.find(r => r.result === id); assert.deepEqual(recipe.shape, shape);
        assert.equal(shape.flat().filter(Boolean).length, count);
        const inventory = new Inventory(36), craft = new Inventory(9); inventory.add(G, count);
        assert.deepEqual(invFillRecipe(inventory, craft, recipe, 2), {ok:false,reason:'requires-table'});
        assert.deepEqual(invFillRecipe(inventory, craft, recipe, 3), {ok:true});
        assert.deepEqual(matchRecipe(craft, 3), {id,count:1}); craftConsume(craft,3);
        assert(craft.slots.every(v => !v));
        const missing = new Inventory(36), empty = new Inventory(9); missing.add(G, count-1);
        assert.deepEqual(invFillRecipe(missing, empty, recipe, 3), {ok:false,reason:'missing-items'});
        assert.equal(missing.slots[0].count, count-1);
        const wrong = new Inventory(9);
        shape.forEach((row, y) => row.forEach((v,x) => {if(v) wrong.slots[y*3+x] = stack(ID.RAW_GOLD)}));
        assert.notEqual(matchRecipe(wrong, 3)?.id,id);
    }
});

test('defesa 11, proteção e desgaste aplicam-se a peças mistas', () => {
    const armor = pieces.map(([id]) => stack(id));
    assert.equal(armorPoints(armor), 11); assert(armor.every((item,i) => canEquipArmor(i,item)));
    assert.equal(armorPoints([stack(ID.GOLD_HELMET),stack(ID.IRON_CHESTPLATE),stack(ID.GOLD_LEGGINGS),stack(ID.COPPER_BOOTS)]), 12);
    assert.equal(damageAfterArmor(8,11), 8*(1-7/25));
    for (const source of ['fall', 'drown', 'starve', 'kill']) {
        assert.equal(damageAfterArmor(8, 11, source), 8);
        damageEquippedArmor(armor, 8, source);
    }
    assert(armor.every(item => !item.damage));
    damageEquippedArmor(armor, 8); assert(armor.every(item => item.damage === 2));
    armor[0].damage = 76; assert.deepEqual(damageEquippedArmor(armor, 1), ['Capacete de ouro']);
    assert.equal(armor[0], null); assert.equal(armorPoints(armor), 9);
});

test('save preserva peças de ouro, dano e compatibilidade com saves anteriores', () => {
    const codec = createWorldSaveCodec(), inventory = new Inventory(PLAYER_INVENTORY_SIZE);
    const armor = pieces.map(([id],i) => ({id,count:1,damage:i+1})); inventory.slots[0] = {...armor[2]};
    const state={seed:7,worldTime:.5,world:{edits:new Map(),editCache:new Map(),blockFacings:{serialize:()=>[]}},player:{x:0,y:5,z:0,health:20,hunger:20},selectedSlot:0,inventory:inventory.slots,armor,drops:[],chests:new Map(),furnaces:new Map()};
    const data = codec.build(state), loaded = codec.validate(data, 7);
    assert.deepEqual(loaded.armor, armor); assert.deepEqual(loaded.inventory[0], armor[2]);
    delete data.armor; assert.deepEqual(codec.validate(data,7).armor, [null,null,null,null]);
});

test('troca entre ouro, ferro e cobre mantém equipamento, cabelo e roupa corretos', () => {
    const model = createPlayerModel(THREE), armor = createPlayerArmor(THREE, model, PLAYER_MODEL_HEIGHT / 32);
    const hair = model.head.getObjectByName('player-hair'), sleeve = model.leftArm.getObjectByName('shoulder');
    const trousers = model.leftLeg.getObjectByName('trousers-preview'), boot = model.leftLeg.getObjectByName('boot-preview');
    const goldHelmet = model.head.getObjectByName('gold-helmet-preview'), ironHelmet = model.head.getObjectByName('iron-helmet-preview');
    const goldLeg = model.leftLeg.getObjectByName('gold-leggings-preview'), goldBoot = model.leftLeg.getObjectByName('gold-boot-preview');
    const gold = pieces.map(([id]) => stack(id));
    const iron = [ID.IRON_HELMET,ID.IRON_CHESTPLATE,ID.IRON_LEGGINGS,ID.IRON_BOOTS].map(stack);
    const copper = [ID.COPPER_HELMET,ID.COPPER_CHESTPLATE,ID.COPPER_LEGGINGS,ID.COPPER_BOOTS].map(stack);
    armor.setEquipment(gold);
    assert(goldHelmet.visible && goldLeg.visible && goldBoot.visible);
    assert(!hair.visible && !sleeve.visible && !trousers.visible && !boot.visible);
    armor.setEquipment(iron); assert(!goldHelmet.visible && ironHelmet.visible && !hair.visible && !sleeve.visible && !trousers.visible && !boot.visible);
    armor.setEquipment([gold[0],copper[1],gold[2],iron[3]]); assert(goldHelmet.visible && !ironHelmet.visible && goldLeg.visible && !goldBoot.visible);
    assert(!hair.visible && !sleeve.visible && !trousers.visible && !boot.visible);
    armor.setEquipment([]); assert(hair.visible && sleeve.visible && trousers.visible && boot.visible);
    armor.dispose(); model.dispose();
});

test('detalhes da calça de ouro ficam conectados ao metal, sem flutuar', () => {
    const unit = PLAYER_MODEL_HEIGHT / 32, model = createPlayerModel(THREE), armor = createPlayerArmor(THREE, model, unit);
    for (const leg of [model.leftLeg, model.rightLeg]) {
        const group = leg.getObjectByName('gold-leggings-preview');
        for (const name of ['a-upper-band','refined-outer-line','refined-upper-step','refined-lower-light','refined-hem-light']) {
            const details = group.children.filter(mesh => mesh.name === name); assert.equal(details.length, 2);
            for (const detail of details) {
                detail.geometry.computeBoundingBox(); const box = detail.geometry.boundingBox;
                const near = Math.abs(detail.position.z) - (box.max.z-box.min.z)/2;
                const far = Math.abs(detail.position.z) + (box.max.z-box.min.z)/2;
                assert(near < 2.25*unit && far > 2.25*unit, `${name} deve tocar a face da calça`);
            }
        }
        for (const name of ['a-side-band','refined-side-vertical','refined-side-upper','refined-side-hem']) {
            const detail = group.getObjectByName(name); detail.geometry.computeBoundingBox(); const box = detail.geometry.boundingBox;
            const half = (box.max.x-box.min.x)/2;
            assert(Math.abs(detail.position.x)-half < 2.02*unit && Math.abs(detail.position.x)+half > 2.02*unit, `${name} deve tocar a lateral`);
        }
    }
    armor.dispose(); model.dispose();
});

test('itens estão no criativo, em comandos e no modelo do inventário', async () => {
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
        assert(model.getObjectByName('gold-helmet-preview').visible);
        assert(model.getObjectByName('gold-leggings-preview').visible);
        assert(model.getObjectByName('gold-boot-preview').visible);
        assert.equal(model.children.filter(child => child.name === 'block-chest-preview' && child.visible).length, 1);
        checked = true;
    },readRenderTargetPixels(){}};
    const canvas = {getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}}};
    renderInventoryPlayer({THREE, renderer, canvas, armor:pieces.map(([id])=>stack(id))});
    assert(checked); assert.equal(target,null);
});
