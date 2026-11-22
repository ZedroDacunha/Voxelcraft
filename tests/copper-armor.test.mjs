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
    for(const [id,slot,kind] of [[ID.COPPER_HELMET,'helmet','copper-helmet'],[ID.COPPER_CHESTPLATE,'chest','copper-chestplate'],[ID.COPPER_LEGGINGS,'legs','copper-leggings'],[ID.COPPER_BOOTS,'feet','copper-boots']]) {
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

test('equipamento visual segue tronco, não braços, e restaura cabelo e manga', () => {
    const m=createPlayerModel(THREE), a=createPlayerArmor(THREE,m,PLAYER_MODEL_HEIGHT/32), hair=m.head.getObjectByName('player-hair'), sleeve=m.leftArm.getObjectByName('shoulder');
    assert(hair.visible&&sleeve.visible);
    a.setEquipment([{id:ID.COPPER_HELMET,count:1},{id:ID.COPPER_CHESTPLATE,count:1}]);
    assert(!hair.visible&&!sleeve.visible);assert(m.head.getObjectByName('copper-helmet-revised').visible);
    m.leftArm.rotation.x=.4; m.torso.rotation.y=.2; a.sync();
    const shoulder=m.root.getObjectByName('chest-left-pivot');
    assert.ok(Math.abs(shoulder.rotation.x)<1e-9);
    assert.ok(Math.abs(shoulder.quaternion.dot(m.torso.quaternion))>0.999999);
    assert.notEqual(shoulder.position.z,0);
    a.setEquipment([]);assert(hair.visible&&sleeve.visible);a.dispose();m.dispose();
});

test('saves antigos abrem sem armadura e novas peças persistem em seus slots', () => {
    const codec=createWorldSaveCodec(), state={seed:7,worldTime:.5,world:{edits:new Map(),editCache:new Map(),blockFacings:{serialize:()=>[]}},player:{x:0,y:5,z:0,health:20,hunger:20},selectedSlot:0,inventory:new Inventory(PLAYER_INVENTORY_SIZE).slots,drops:[],chests:new Map(),furnaces:new Map()};
    const old=codec.build(state);delete old.armor;assert.deepEqual(codec.validate(old,7).armor,[null,null,null,null]);
    const helmet={id:ID.COPPER_HELMET,count:1},chest={id:ID.COPPER_CHESTPLATE,count:1};
    const save=codec.build({...state,armor:[helmet,chest]});assert.deepEqual(codec.validate(save,7).armor,[helmet,chest,null,null]);
    save.armor=[chest,helmet];assert.deepEqual(codec.validate(save,7).armor,[null,null,null,null]);
});

test('o atlas usa os ícones aprovados e os comandos encontram os itens', async () => {
    const { createTextureTools } = await import('../world-textures.js');
    const { resolveItem } = await import('../world-chat-commands.js');
    const textures=createTextureTools(THREE);
    assert.deepEqual(textures.spritePixels('copper-helmet','copper'),copperArmorSprite('copper-helmet'));
    assert.deepEqual(textures.spritePixels('copper-chestplate','copper'),copperArmorSprite('copper-chestplate'));
    assert.equal(resolveItem('copper_helmet',{ID,ITEMS}).id,ID.COPPER_HELMET);
    assert.equal(resolveItem('copper_chestplate',{ID,ITEMS}).id,ID.COPPER_CHESTPLATE);
    assert.equal(resolveItem('copper_leggings',{ID,ITEMS}).id,ID.COPPER_LEGGINGS);
    assert.equal(resolveItem('copper_boots',{ID,ITEMS}).id,ID.COPPER_BOOTS);
    for (const kind of ['copper-leggings','copper-boots']) assert.deepEqual(textures.spritePixels(kind,'copper'),copperArmorSprite(kind));
});

test('armadura do inventário desenha as peças reais e restaura o destino WebGL', async () => {
    const { renderInventoryPlayer }=await import('../inventory-player-preview.js');
    let target=null,checked=false;
    const renderer={getRenderTarget(){return target},setRenderTarget(v){target=v},clear(){},render(scene){
        const model=scene.getObjectByName('player');
        assert(model.getObjectByName('copper-helmet-revised').visible);
        assert(model.getObjectByName('block-chest-preview').visible);
        assert(model.getObjectByName('copper-leggings-leg').visible);
        assert(model.getObjectByName('copper-boot-preview').visible);
        checked=true;
    },readRenderTargetPixels(){}};
    const canvas={getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}}};
    renderInventoryPlayer({THREE,renderer,canvas,armor:[{id:ID.COPPER_HELMET,count:1},{id:ID.COPPER_CHESTPLATE,count:1},{id:ID.COPPER_LEGGINGS,count:1},{id:ID.COPPER_BOOTS,count:1}]});
    assert(checked);assert.equal(target,null);
});

test('calça e botas equipam separadamente, acompanham pernas e restauram a roupa', () => {
    const model=createPlayerModel(THREE), armor=createPlayerArmor(THREE,model,PLAYER_MODEL_HEIGHT/32);
    const leggings={id:ID.COPPER_LEGGINGS,count:1}, boots={id:ID.COPPER_BOOTS,count:1};
    const trousers=model.leftLeg.getObjectByName('trousers-preview'), boot=model.leftLeg.getObjectByName('boot-preview');
    const leg=model.leftLeg.getObjectByName('copper-leggings-leg'), foot=model.leftLeg.getObjectByName('copper-boot-preview');
    assert(trousers.visible&&boot.visible);assert(!leg.visible&&!foot.visible);
    armor.setEquipment([null,null,leggings,null]);
    assert(leg.visible&&!trousers.visible);assert(!foot.visible&&boot.visible);
    armor.setEquipment([null,null,leggings,boots]);assert(foot.visible&&!boot.visible);
    model.leftLeg.rotation.x=.6;model.root.updateMatrixWorld(true);
    assert.equal(leg.parent,model.leftLeg);assert.equal(foot.parent,model.leftLeg);
    armor.setEquipment([null,null,null,boots]);assert(trousers.visible&&!leg.visible&&foot.visible);
    armor.dispose();assert(trousers.visible&&boot.visible);assert.equal(leg.parent,null);model.dispose();
});

test('slots adicionais são exclusivos e saves antigos de dois slots preservam armaduras', () => {
    const legs={id:ID.COPPER_LEGGINGS,count:1}, boots={id:ID.COPPER_BOOTS,count:1};
    assert(canEquipArmor(2,legs)&&canEquipArmor(3,boots));
    assert(!canEquipArmor(2,boots)&&!canEquipArmor(3,legs));
    const slots=[null,null,null,null],cursor={stack:legs};assert(!armorClick(slots,3,cursor));assert(armorClick(slots,2,cursor));assert.equal(cursor.stack,null);assert(armorClick(slots,2,cursor));assert.deepEqual(cursor.stack,legs);
    const codec=createWorldSaveCodec(),state={seed:7,worldTime:.5,world:{edits:new Map(),editCache:new Map(),blockFacings:{serialize:()=>[]}},player:{x:0,y:5,z:0,health:20,hunger:20},selectedSlot:0,inventory:new Inventory(PLAYER_INVENTORY_SIZE).slots,drops:[],chests:new Map(),furnaces:new Map()};
    const helmet={id:ID.COPPER_HELMET,count:1},chest={id:ID.COPPER_CHESTPLATE,count:1};
    const save=codec.build({...state,armor:[helmet,chest,legs,boots]});assert.deepEqual(codec.validate(save,7).armor,[helmet,chest,legs,boots]);
    save.armor=[helmet,chest];assert.deepEqual(codec.validate(save,7).armor,[helmet,chest,null,null]);
    save.armor=[helmet,chest,boots,legs];assert.deepEqual(codec.validate(save,7).armor,[helmet,chest,null,null]);
});
