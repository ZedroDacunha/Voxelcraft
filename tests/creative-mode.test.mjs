import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ID, ITEMS} from '../world-catalog.js';
import {CREATIVE,SURVIVAL,parseGameMode,creativeItems,creativeStack,flightTap} from '../world-creative.js';
import {runChatCommand} from '../world-chat-commands.js';
import {completionsFor} from '../world-chat-completion.js';
import {Inventory} from '../inventory-model.js';
import {createWorldSaveCodec} from '../world-save-codec.js';
import {PLAYER_INVENTORY_SIZE} from '../world-save-settings.js';

test('seleção de modo aceita nomes e comandos válidos, sem aceitar desconhecidos',()=>{
    for(const n of ['creative','criativo','1'])assert.equal(parseGameMode(n),CREATIVE);
    for(const n of ['survival','sobrevivência','sobrevivencia','0'])assert.equal(parseGameMode(n),SURVIVAL);
    assert.equal(parseGameMode('outro'),null);
    let mode;const ctx={setGameMode(v){mode=v;return true;}};
    assert(runChatCommand('/gamemode creative',ctx).ok);assert.equal(mode,CREATIVE);
    assert(runChatCommand('/gamemode survival',ctx).ok);assert.equal(mode,SURVIVAL);
    assert(!runChatCommand('/gamemode banana',ctx).ok);assert.equal(mode,SURVIVAL);
    assert(!runChatCommand('/gamemode creative',{setGameMode:()=>false}).ok);
    assert.deepEqual(completionsFor('/gamemode c').matches.map(v=>v.value),['creative']);
});

test('catálogo lista itens reais, busca sem acentos e entrega pilhas corretas',()=>{
    const all=creativeItems();assert(all.includes(ID.COPPER_HELMET));assert(all.includes(ID.STONE));
    assert(all.every(id=>ITEMS[id]));assert(creativeItems('macA').includes(ID.APPLE));
    assert(creativeItems('xyz-inexistente').length===0);
    assert.deepEqual(creativeStack(ID.STONE),{id:ID.STONE,count:ITEMS[ID.STONE].maxStack});
    assert.deepEqual(creativeStack(ID.COPPER_BOOTS),{id:ID.COPPER_BOOTS,count:1});
    assert.deepEqual(creativeStack(ID.STONE,true),{id:ID.STONE,count:1});assert.equal(creativeStack(9999),null);
});

test('duplo toque alterna voo apenas no criativo e não confunde toques longos',()=>{
    const state={flying:false,lastTap:-Infinity};assert(!flightTap(state,1,false));assert(!state.flying);
    assert(!flightTap(state,1,true));assert(flightTap(state,1.2,true));assert(state.flying);
    assert(!flightTap(state,2,true));assert(flightTap(state,2.2,true));assert(!state.flying);
    assert(!flightTap(state,3,true));assert(!flightTap(state,3.5,true));assert(!state.flying);
});

test('modo e inventário persistem; saves anteriores continuam em sobrevivência',()=>{
    const codec=createWorldSaveCodec(),inv=new Inventory(PLAYER_INVENTORY_SIZE);inv.add(ID.STONE,42);
    const state={seed:7,gameMode:CREATIVE,worldTime:.5,world:{edits:new Map(),editCache:new Map(),blockFacings:{serialize:()=>[]}},player:{x:0,y:5,z:0,health:20,hunger:20},selectedSlot:0,inventory:inv.slots,drops:[],chests:new Map(),furnaces:new Map()};
    const data=codec.build(state);let loaded=codec.validate(data,7);assert.equal(loaded.gameMode,CREATIVE);assert.equal(loaded.inventory[0].count,42);
    delete data.gameMode;loaded=codec.validate(data,7);assert.equal(loaded.gameMode,SURVIVAL);
    data.gameMode='invalid';assert.equal(codec.validate(data,7).gameMode,SURVIVAL);
});

test('integração limita criativo ao mundo individual e liga os controles do catálogo e voo',()=>{
    const html=readFileSync('index.html','utf8'),game=readFileSync('game.js','utf8'),menu=readFileSync('world-menu.js','utf8');
    assert.match(html,/id="world-mode"/);assert.match(menu,/gameMode: document.getElementById\('world-mode'\).value/);
    assert.match(html,/id="creative-search"/);assert.match(game,/if \(!isCreative\(\) \|\| station \|\| cursorHeld.stack\) return/);
    assert.match(game,/if \(online \|\| !parseGameMode\(mode\)\) return false/);
    assert.match(game,/if \(!isCreative\(\)\) inventory.removeOne\(selectedSlot\)/);
    assert.match(game,/flightTap\(creativeFlight, performance.now\(\) \/ 1000, isCreative\(\)\)/);
    assert.match(game,/isCreative\(\) && source !== 'kill'/);
});
