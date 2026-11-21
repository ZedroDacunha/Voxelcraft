import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { ID, ITEMS } from '../world-catalog.js';
import { copperArmorSprite } from '../world-copper-armor-icons.js';
import { armorClick, canEquipArmor } from '../inventory-armor.js';
import { createPlayerModel, PLAYER_MODEL_HEIGHT } from '../player-model.js';
import { createPlayerArmor } from '../player-armor.js';
import { createWorldSaveCodec } from '../world-save-codec.js';
import { Inventory } from '../inventory-model.js';
import { PLAYER_INVENTORY_SIZE } from '../world-save-settings.js';

test('itens têm ícones aprovados e espaços exclusivos', () => {
    for(const [id,slot,kind] of [[ID.COPPER_HELMET,'helmet','copper-helmet'],[ID.COPPER_CHESTPLATE,'chest','copper-chestplate']]) {
        assert.equal(ITEMS[id].armorSlot,slot);assert.equal(ITEMS[id].maxStack,1);
        const sprite=copperArmorSprite(kind);assert.equal(sprite.length,16);assert(sprite.every(row=>row.length===16));assert(sprite.flat().some(Boolean));
    }
    assert(canEquipArmor(0,{id:ID.COPPER_HELMET,count:1}));
    assert(!canEquipArmor(1,{id:ID.COPPER_HELMET,count:1}));
    assert(!canEquipArmor(0,{id:ID.DIRT,count:1}));
});

test('equipar e retirar não perde itens nem aceita peças incompatíveis', () => {
    const slots=[null,null], cursor={stack:{id:ID.COPPER_HELMET,count:1}};
    assert(!armorClick(slots,1,cursor));assert.equal(cursor.stack.id,ID.COPPER_HELMET);
    assert(armorClick(slots,0,cursor));assert.equal(cursor.stack,null);assert.equal(slots[0].id,ID.COPPER_HELMET);
    assert(armorClick(slots,0,cursor));assert.equal(slots[0],null);assert.equal(cursor.stack.id,ID.COPPER_HELMET);
    assert(!armorClick(slots,2,cursor));
});

test('equipamento visual separado segue braços e restaura cabelo e manga', () => {
    const m=createPlayerModel(THREE), a=createPlayerArmor(THREE,m,PLAYER_MODEL_HEIGHT/32), hair=m.head.getObjectByName('player-hair'), sleeve=m.leftArm.getObjectByName('shoulder');
    assert(hair.visible&&sleeve.visible);
    a.setEquipment([{id:ID.COPPER_HELMET,count:1},{id:ID.COPPER_CHESTPLATE,count:1}]);
    assert(!hair.visible&&!sleeve.visible);assert(m.head.getObjectByName('copper-helmet-revised').visible);
    m.leftArm.rotation.x=.4;a.sync();assert.ok(Math.abs(m.root.getObjectByName('chest-left-pivot').rotation.x-.4)<1e-9);
    a.setEquipment([]);assert(hair.visible&&sleeve.visible);a.dispose();m.dispose();
});

test('saves antigos abrem sem armadura e novas peças persistem em seus slots', () => {
    const codec=createWorldSaveCodec(), state={seed:7,worldTime:.5,world:{edits:new Map(),editCache:new Map(),blockFacings:{serialize:()=>[]}},player:{x:0,y:5,z:0,health:20,hunger:20},selectedSlot:0,inventory:new Inventory(PLAYER_INVENTORY_SIZE).slots,drops:[],chests:new Map(),furnaces:new Map()};
    const old=codec.build(state);delete old.armor;assert.deepEqual(codec.validate(old,7).armor,[null,null]);
    const helmet={id:ID.COPPER_HELMET,count:1},chest={id:ID.COPPER_CHESTPLATE,count:1};
    const save=codec.build({...state,armor:[helmet,chest]});assert.deepEqual(codec.validate(save,7).armor,[helmet,chest]);
    save.armor=[chest,helmet];assert.deepEqual(codec.validate(save,7).armor,[null,null]);
});

test('o atlas usa os ícones aprovados e os comandos encontram os itens', async () => {
    const { createTextureTools } = await import('../world-textures.js');
    const { resolveItem } = await import('../world-chat-commands.js');
    const textures=createTextureTools(THREE);
    assert.deepEqual(textures.spritePixels('copper-helmet','copper'),copperArmorSprite('copper-helmet'));
    assert.deepEqual(textures.spritePixels('copper-chestplate','copper'),copperArmorSprite('copper-chestplate'));
    assert.equal(resolveItem('copper_helmet',{ID,ITEMS}).id,ID.COPPER_HELMET);
    assert.equal(resolveItem('copper_chestplate',{ID,ITEMS}).id,ID.COPPER_CHESTPLATE);
});

test('armadura do inventário desenha as peças reais e restaura o destino WebGL', async () => {
    const { renderInventoryPlayer }=await import('../inventory-player-preview.js');
    let target=null,checked=false;
    const renderer={getRenderTarget(){return target},setRenderTarget(v){target=v},clear(){},render(scene){
        const model=scene.getObjectByName('player');
        assert(model.getObjectByName('copper-helmet-revised').visible);
        assert(model.getObjectByName('block-chest-preview').visible);
        checked=true;
    },readRenderTargetPixels(){}};
    const canvas={getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}}};
    renderInventoryPlayer({THREE,renderer,canvas,armor:[{id:ID.COPPER_HELMET,count:1},{id:ID.COPPER_CHESTPLATE,count:1}]});
    assert(checked);assert.equal(target,null);
});
