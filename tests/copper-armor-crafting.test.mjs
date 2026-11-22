import test from 'node:test';
import assert from 'node:assert/strict';
import { ID, ITEMS, RECIPES, matchRecipe } from '../world-catalog.js';
import { Inventory } from '../inventory-model.js';
import { craftConsume, invFillRecipe } from '../inventory-logic.js';
import { damageEquippedArmor } from '../world-armor-durability.js';
import { stackHtml } from '../inventory-view.js';
import { createWorldSaveCodec } from '../world-save-codec.js';
import { PLAYER_INVENTORY_SIZE } from '../world-save-settings.js';

const C=ID.COPPER_INGOT, X=null;
const cases=[
    [ID.COPPER_HELMET,121,[[C,C,C],[C,X,C]],5],
    [ID.COPPER_CHESTPLATE,176,[[C,X,C],[C,C,C],[C,C,C]],8],
    [ID.COPPER_LEGGINGS,165,[[C,C,C],[C,X,C],[C,X,C]],7],
    [ID.COPPER_BOOTS,143,[[C,X,C],[C,X,C]],4],
];
function grid(shape) { const inv=new Inventory(9);for(let y=0;y<shape.length;y++)for(let x=0;x<shape[y].length;x++)if(shape[y][x])inv.slots[y*3+x]={id:shape[y][x],count:1};return inv; }

test('quatro receitas de cobre têm formatos, quantidades e bancada corretos', () => {
    for(const [id,durability,shape,count] of cases){
        assert.equal(ITEMS[id].maxDurability,durability);
        const r=RECIPES.find(recipe=>recipe.result===id);assert(r);assert.deepEqual(r.shape,shape);
        assert.equal(shape.flat().filter(Boolean).length,count);
        const craft=grid(shape);assert.deepEqual(matchRecipe(craft,3),{id,count:1});
        craftConsume(craft,3);assert(craft.slots.every(x=>!x));
        const inv=new Inventory(36);inv.add(C,count);const next=new Inventory(9);
        assert.deepEqual(invFillRecipe(inv,next,r,2),{ok:false,reason:'requires-table'});
        assert.deepEqual(invFillRecipe(inv,next,r,3),{ok:true});assert.deepEqual(matchRecipe(next,3),{id,count:1});
        assert.equal(inv.slots.reduce((n,slot)=>n+(slot?.count||0),0),0);
        const insuficiente=new Inventory(36);insuficiente.add(C,count-1);const blank=new Inventory(9);
        assert.deepEqual(invFillRecipe(insuficiente,blank,r,3),{ok:false,reason:'missing-items'});
        assert.equal(insuficiente.slots[0].count,count-1);assert(blank.slots.every(x=>!x));
        const wrong=grid(shape);wrong.slots[wrong.slots.findIndex(Boolean)]={id:ID.RAW_COPPER,count:1};
        assert.notEqual(matchRecipe(wrong,3)?.id,id);
    }
});

test('impactos gastam cada peça equipada, sem gastar por quedas, fome, afogamento ou kill', () => {
    const slots=cases.map(([id])=>({id,count:1}));
    for(const source of ['fall','starve','drown','kill'])assert.deepEqual(damageEquippedArmor(slots,100,source),[]);
    assert(slots.every(s=>!s.damage));
    assert.deepEqual(damageEquippedArmor(slots,3,'generic'),[]);assert(slots.every(s=>s.damage===1));
    damageEquippedArmor(slots,12,'generic');assert(slots.every(s=>s.damage===4));
    for(const v of [0,-1,NaN,Infinity])damageEquippedArmor(slots,v);assert(slots.every(s=>s.damage===4));
    slots[0].damage=120;slots[1].damage=175;
    assert.deepEqual(damageEquippedArmor(slots,1),['Capacete de cobre','Peitoral de cobre']);
    assert.equal(slots[0],null);assert.equal(slots[1],null);assert.equal(slots[2].damage,5);
});

test('desgaste aparece no inventário e sobrevive ao save no slot e fora dele', () => {
    const stack={id:ID.COPPER_LEGGINGS,count:1,damage:32};assert.match(stackHtml(stack),/class="dur"/);
    const codec=createWorldSaveCodec(),inventory=new Inventory(PLAYER_INVENTORY_SIZE);inventory.slots[0]={...stack};
    const state={seed:7,worldTime:.5,world:{edits:new Map(),editCache:new Map(),blockFacings:{serialize:()=>[]}},player:{x:0,y:5,z:0,health:20,hunger:20},selectedSlot:0,inventory:inventory.slots,armor:[null,null,stack,null],drops:[],chests:new Map(),furnaces:new Map()};
    const save=codec.validate(codec.build(state),7);assert.deepEqual(save.inventory[0],stack);assert.deepEqual(save.armor[2],stack);
});
