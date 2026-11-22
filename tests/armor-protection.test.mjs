import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ID, ITEMS } from '../world-catalog.js';
import { armorPoints, damageAfterArmor, armorProtectsFrom } from '../world-armor-protection.js';
import { damageEquippedArmor } from '../world-armor-durability.js';
import { createWorldSaveCodec } from '../world-save-codec.js';
import { Inventory } from '../inventory-model.js';
import { PLAYER_INVENTORY_SIZE } from '../world-save-settings.js';
import { statusLabels } from '../inventory-a11y.js';
const piece=id=>({id,count:1});
const full=[ID.COPPER_HELMET,ID.COPPER_CHESTPLATE,ID.COPPER_LEGGINGS,ID.COPPER_BOOTS].map(piece);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('cada peça oferece seus pontos e só no espaço próprio', () => {
    assert.deepEqual(full.map(s=>ITEMS[s.id].armorPoints),[2,4,3,1]);
    assert.equal(armorPoints(full),10);assert.equal(armorPoints([null,null,piece(ID.COPPER_LEGGINGS),null]),3);
    assert.equal(armorPoints([piece(ID.COPPER_CHESTPLATE),null,null,null]),0);
    assert.equal(armorPoints([piece(ID.DIRT),null,null,null]),0);
    assert.equal(armorPoints([]),0);assert.equal(armorPoints(null),0);
});

test('proteção de cobre segue fórmula Java sem dureza e ignora fontes especificadas', () => {
    near(damageAfterArmor(4,10),2.72);near(damageAfterArmor(20,10),18.4);
    near(damageAfterArmor(4,0),4);near(damageAfterArmor(4,20),1.12);
    for(const source of ['fall','drown','starve','kill']) {assert(!armorProtectsFrom(source));assert.equal(damageAfterArmor(10,10,source),10);}
    assert.equal(damageAfterArmor(-2,10),0);
});

test('último ponto de durabilidade protege o golpe atual, depois a proteção cai', () => {
    const slots=full.map(s=>({...s}));slots[1].damage=ITEMS[slots[1].id].maxDurability-1;
    const prior=damageAfterArmor(4,armorPoints(slots));assert.deepEqual(damageEquippedArmor(slots,4),['Peitoral de cobre']);
    assert.equal(armorPoints(slots),6);assert(damageAfterArmor(4,armorPoints(slots))>prior);
    for(const source of ['fall','drown','starve','kill']) {const copy=full.map(s=>({...s}));damageEquippedArmor(copy,999,source);assert(copy.every(s=>!s.damage));}
});

test('vida fracionária sobrevive ao salvamento e não é anunciada como zero', () => {
    const codec=createWorldSaveCodec(),state={seed:7,worldTime:.5,world:{edits:new Map(),editCache:new Map(),blockFacings:{serialize:()=>[]}},player:{x:0,y:5,z:0,health:.25,hunger:20},selectedSlot:0,inventory:new Inventory(PLAYER_INVENTORY_SIZE).slots,armor:full,drops:[],chests:new Map(),furnaces:new Map()};
    const save=codec.validate(codec.build(state),7);assert.equal(save.player.health,.25);assert.equal(armorPoints(save.armor),10);
    assert.equal(statusLabels({health:.25}).health,'Vida: 1 de 20');
});

test('barra usa a opção B, suporta estados e é atualizada nas transições', () => {
    const html=readFileSync('index.html','utf8'),css=readFileSync('styles.css','utf8'),game=readFileSync('game.js','utf8');
    assert.match(html,/id="armor-bar" role="img" aria-label="Armadura: 0 de 20" hidden/);
    assert.match(css,/#armor-bar\[hidden\] \{ display: none; \}/);
    for(const cls of ['.armor-stat {','.armor-stat.half {','.armor-stat.empty-stat {'])assert(css.includes(cls));
    assert.match(game,/updateSurvivalIcons\(survivalIcons\.armor, 'armor-stat', points\)/);
    assert.match(game,/damageAfterArmor\(amount, armorPoints\(armorSlots\), source\)/);
    assert.ok(game.indexOf('const reducedDamage = damageAfterArmor')<game.indexOf('const brokenArmor = damageEquippedArmor'));
    assert.match(game,/updateSurvivalIcons\(survivalIcons\.hearts, 'heart', Math\.ceil\(health\)\)/);
});
