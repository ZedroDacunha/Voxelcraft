import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BLOCKS, ID } from '../world-catalog.js';
import { BLOCK_MATERIALS, blockMaterialFor, blocksWithMaterial, materialSoundName } from '../world-block-materials.js';
import { SOUND_RECIPES } from '../world-audio.js';

const TORCH_IDS = [ID.TORCH, ID.TORCH_WALL_XP, ID.TORCH_WALL_XN, ID.TORCH_WALL_ZP, ID.TORCH_WALL_ZN];

test('a família de material é única para passo, quebra e colocação', () => {
    assert.deepEqual(BLOCK_MATERIALS, ['grass', 'dirt', 'stone', 'wood', 'sand']);
    for (const material of BLOCK_MATERIALS) {
        assert.equal(materialSoundName(ID.GRASS, 'step') !== null, true);
        for (const prefix of ['step', 'break', 'place']) {
            assert.ok(SOUND_RECIPES[`${prefix}-${material}`], `falta a receita ${prefix}-${material}`);
        }
    }
    assert.equal(materialSoundName(ID.STONE, 'break'), 'break-stone');
    assert.equal(materialSoundName(ID.PLANKS, 'place'), 'place-wood');
    assert.equal(materialSoundName(0, 'break'), null, 'ar não quebra');
    assert.equal(materialSoundName(ID.WATER, 'place'), null, 'água não é colocada');
    assert.deepEqual(materialSoundName(ID.TORCH, 'place'), null);
});

test('todo bloco não líquido tem som de quebrar e de colocar', () => {
    const missing = [];
    for (const [id, block] of Object.entries(BLOCKS)) {
        const type = Number(id);
        if (block.render === 'liquid' || block.waterLevel || block.waterSource) continue;
        if (TORCH_IDS.includes(type)) continue;
        for (const prefix of ['break', 'place']) {
            if (!SOUND_RECIPES[materialSoundName(type, prefix)]) missing.push(`${block.name}: ${prefix}`);
        }
    }
    assert.deepEqual(missing, []);
    assert.ok(blocksWithMaterial().length >= 15, 'o mapa cobre o catálogo');
});

test('quebrar é mais longo e mais alto que colocar', () => {
    for (const material of BLOCK_MATERIALS) {
        const breaking = SOUND_RECIPES[`break-${material}`];
        const placing = SOUND_RECIPES[`place-${material}`];
        assert.ok(breaking.duration > placing.duration, `${material}: quebrar dura mais`);
        assert.ok(breaking.gain > placing.gain, `${material}: quebrar é mais alto`);
        assert.ok(breaking.thump, `${material}: quebrar tem baque`);
        assert.ok(placing.thump, `${material}: colocar assenta com um baque curto`);
        assert.ok(breaking.thump.from > breaking.thump.to, `${material}: o baque desce`);
        assert.ok(placing.thump.duration < 0.08, `${material}: o baque de colocar é curto`);
    }
});

test('material duro soa mais brilhante e seco que material macio', () => {
    const stone = SOUND_RECIPES['break-stone'];
    const dirt = SOUND_RECIPES['break-dirt'];
    assert.ok(stone.cut > dirt.cut, 'pedra tem corte mais alto que terra');
    assert.ok(stone.duration < dirt.duration, 'pedra é mais seca');
    assert.ok(stone.thump.from > dirt.thump.from, 'o baque da pedra é mais agudo');

    const sand = SOUND_RECIPES['break-sand'];
    assert.equal(sand.q, 0.4, 'areia não ressoa');
    assert.ok(SOUND_RECIPES['break-wood'].q > 2, 'madeira ressoa');
});

test('a batida de cada golpe é mais curta e discreta que a quebra', () => {
    for (const material of BLOCK_MATERIALS) {
        const hit = SOUND_RECIPES[`hit-${material}`];
        const breaking = SOUND_RECIPES[`break-${material}`];
        assert.ok(hit, `falta a receita hit-${material}`);
        assert.ok(hit.duration < breaking.duration, `${material}: batida dura menos`);
        assert.ok(hit.gain <= breaking.gain, `${material}: batida é mais discreta`);
        assert.ok(hit.duration <= 0.06, `${material}: batida é percussiva`);
        // o grave fica reservado para o impacto final da quebra
        assert.ok(!hit.thump || hit.thump.gain < breaking.thump.gain, `${material}: baque da batida é mínimo`);
    }
});

test('game.js toca a batida no ritmo do braço e ignora a grama alta', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /const phaseBefore = handAnim\.phase/);
    assert.match(source, /if \(miningNow\) playMiningHits\(countStrikes\(phaseBefore, handAnim\.phase\)\)/);

    const fn = source.slice(source.indexOf('function playMiningHits('));
    const body = fn.slice(0, fn.indexOf('\n}'));
    assert.match(body, /materialSoundName\(currentHit\.type, 'hit'\)/);
    assert.match(body, /currentHit\.type === ID\.TALL_GRASS\) return/,
        'quem cai no primeiro quadro não precisa de batida');
});

test('game.js toca quebrar e colocar no material certo, uma vez só', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');

    const breakBlock = source.slice(source.indexOf('function breakBlock('));
    const breakBody = breakBlock.slice(0, breakBlock.indexOf('\n}'));
    assert.match(breakBody, /materialSoundName\(type, 'break'\)/);
    assert.match(breakBody, /audio\.play\(breakSound, \{ rate: stepPitch\(\) \}\)/);

    assert.match(source, /const placeSound = materialSoundName\(placedType, 'place'\)/);
    assert.match(source, /if \(placed\) \{[\s\S]{0,300}?audio\.play\(placeSound/,
        'o som de colocar só sai depois que o bloco entrou de fato');
    assert.match(source, /import \{ materialSoundName \} from '\.\/world-block-materials\.js'/);
});
