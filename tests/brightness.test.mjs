// Brilho: barra em Gráficos e gama no próprio shader do three, pelo ponto de
// extensão CustomToneMapping. Aqui ficam o expoente, a instalação no chunk e
// a ligação no game.js (céu, nuvens, chama e folhas entram junto).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import * as THREE from '../vendor/three/three.module.js';
import { gammaForBrightness, installBrightnessToneMapping } from '../world-brightness.js';
import { DEFAULT_GAME_SETTINGS, GAME_SETTING_FIELDS, sanitizeGameSettings, stepSetting } from '../world-game-settings.js';
import { GRAPHICS_OPTION_CONTROLS } from '../world-options-view.js';

const root = file => path.join(import.meta.dirname, '..', file);
const html = readFileSync(root('index.html'), 'utf8');
const game = readFileSync(root('game.js'), 'utf8');
const sky = readFileSync(root('world-sky.js'), 'utf8');
const clouds = readFileSync(root('world-clouds.js'), 'utf8');
const leaves = readFileSync(root('world-falling-leaves.js'), 'utf8');

test('brilho é barra de 50% a 200%, 100% por padrão', () => {
    const field = GAME_SETTING_FIELDS.brightness;
    assert.equal(field.min, 0.5);
    assert.equal(field.max, 2);
    assert.equal(field.step, 0.1);
    assert.equal(field.default, 1);
    assert.equal(DEFAULT_GAME_SETTINGS.brightness, 1);
    assert.equal(field.format(1), '100%');
    assert.equal(field.format(1.5), '150%');
    assert.equal(field.format(0.5), '50%');
    assert.equal(sanitizeGameSettings({ brightness: 9 }).brightness, 2, 'acima do teto satura no teto');
    assert.equal(sanitizeGameSettings({ brightness: 0 }).brightness, 0.5, 'abaixo do piso satura no piso');
    assert.equal(stepSetting('brightness', 1, 1), 1.1);
});

test('o expoente da gama é o inverso do brilho — 100% é identidade', () => {
    assert.equal(gammaForBrightness(1), 1, 'padrão não muda pixel nenhum');
    assert.equal(gammaForBrightness(1.5), 1 / 1.5);
    assert.equal(gammaForBrightness(2), 0.5, '200% é raiz quadrada: escuros sobem, altas ficam');
    assert.equal(gammaForBrightness(0.5), 2, '50% escurece');
});

test('instala a gama no ponto CustomToneMapping do three', () => {
    // O vendor é o mesmo módulo que o jogo carrega (o importmap aponta para
    // cá) — se o three atualizar o texto do stub, este teste cai antes do
    // brilho virar um ajuste silencioso que não faz nada.
    const stub = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
    assert.ok(THREE.ShaderChunk.tonemapping_pars_fragment.includes(stub), 'o stub do three mudou — revise world-brightness.js');
    assert.equal(installBrightnessToneMapping(THREE.ShaderChunk), true);
    const installed = THREE.ShaderChunk.tonemapping_pars_fragment;
    assert.ok(installed.includes('pow( max( color, vec3( 0.0 ) ), vec3( 1.0 / max( toneMappingExposure, 0.1 ) ) )'));
    assert.equal(installBrightnessToneMapping(THREE.ShaderChunk), false, 'segunda chamada não acha o stub — já instalado');
    assert.equal(installBrightnessToneMapping({}), false, 'chunk estranho devolve false, não lança');
});

test('a linha Brilho mora em Gráficos, é barra e existe no index.html', () => {
    const row = GRAPHICS_OPTION_CONTROLS.find(control => control.key === 'brightness');
    assert.ok(row, 'campo brightness fora da categoria Gráficos');
    assert.equal(row.label, 'Brilho');
    assert.equal(row.button, 'opt-brightness');
    assert.equal(row.output, 'opt-brightness-value');
    const start = html.lastIndexOf('<button', html.indexOf('id="opt-brightness"'));
    const block = html.slice(start, html.indexOf('</button>', start));
    assert.match(block, /class="classic-btn option-btn option-slider"/, 'é barra, não botão de clique');
    assert.match(block, /<span class="option-track" aria-hidden="true"><span class="option-knob"><\/span><\/span>/);
    assert.match(block, /aria-label="Brilho"/);
    assert.ok(block.includes('<span class="option-name">Brilho</span>'));
    assert.match(block, /<span class="option-value" id="opt-brightness-value">100%<\/span>/);
});

test('o jogo instala a gama no renderer e aplica ao vivo', () => {
    assert.match(game, /import \{ gammaForBrightness, installBrightnessToneMapping \} from '\.\/world-brightness\.js';/);
    // instalado antes do renderer nascer, e o renderer nasce com a gama ligada
    assert.match(game, /installBrightnessToneMapping\(THREE\.ShaderChunk\);\n    renderer = new THREE\.WebGLRenderer/);
    assert.match(game, /renderer\.toneMapping = THREE\.CustomToneMapping;/);
    assert.match(game, /renderer\.toneMappingExposure = gammaForBrightness\(GAME_SETTINGS\.brightness\);/);
    // trocar a barra no ESC vale na hora, sem reiniciar nada
    assert.match(game, /GAME_SETTINGS\.brightness = settings\.brightness;/);
    assert.match(game, /if \(renderer\) renderer\.toneMappingExposure = gammaForBrightness\(settings\.brightness\);/);
});

test('céu e nuvens entram na gama antes da conversão de cor', () => {
    for (const [name, source] of [['o céu', sky], ['as nuvens', clouds]]) {
        const gamma = source.indexOf('#include <tonemapping_fragment>');
        assert.ok(gamma > 0, `${name} sem tonemapping_fragment`);
        const encode = source.indexOf('#include <colorspace_fragment>');
        assert.ok(encode > 0, `${name} sem colorspace_fragment`);
        assert.ok(gamma < encode, `${name}: a gama tem que rodar antes da conversão de cor`);
    }
});

test('chama da tocha e folhas não se escondem do brilho', () => {
    // O opt-out `toneMapped: false` faria a chama e a folha ficarem em 100%
    // enquanto o mundo inteiro muda — saiu de propósito.
    assert.doesNotMatch(game, /toneMapped: false/, 'game.js');
    assert.doesNotMatch(leaves, /toneMapped: false/, 'world-falling-leaves.js');
});
