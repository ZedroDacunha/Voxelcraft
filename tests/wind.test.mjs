import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    WIND_ATTACK,
    WIND_DUST_IDLE,
    WIND_DUST_SPEED,
    WIND_GUST_BASE,
    WIND_GUST_SPEED,
    WIND_GUST_SWING,
    WIND_RELEASE,
    WIND_SWAY_FULL,
    WIND_SWAY_IDLE,
    configureWindSway,
    updateWindSway,
    windDirectionFor,
    windDustSpeed,
    windGust,
    windStep,
    windSwayAmount,
    windTargetFor,
} from '../world-wind.js';

// ------------------------------------------------ direção

test('a direção do vento é unitária, fixa por semente e diferente entre mundos', () => {
    const a = windDirectionFor(4242);
    assert.ok(Math.abs(Math.hypot(a.x, a.z) - 1) < 1e-9, 'vetor unitário');

    const outra = windDirectionFor(4242);
    assert.deepEqual(outra, a, 'mesma semente, mesmo vento (não muda no meio do jogo)');

    const outroMundo = windDirectionFor(99);
    assert.ok(Math.abs(outroMundo.x - a.x) > 1e-6 || Math.abs(outroMundo.z - a.z) > 1e-6,
        'outro mundo, outro vento');

    const zero = windDirectionFor(0);
    assert.ok(Math.abs(Math.hypot(zero.x, zero.z) - 1) < 1e-9, 'semente 0 também vale');
});

// ------------------------------------------------ intensidade

test('a intensidade vem do que se ouve: fase de vento sopra, silêncio e grilos não', () => {
    assert.equal(windTargetFor({ wind: 0.7, crickets: 0 }), 0.7, 'fase de vento');
    assert.equal(windTargetFor({ wind: 0.62, crickets: 0.5 }), 0.62, '"os dois" também sopra');
    assert.equal(windTargetFor({ wind: 0, crickets: 0.9 }), 0, 'só grilos: ar parado');
    assert.equal(windTargetFor({ wind: 0, crickets: 0 }), 0, 'silêncio');
    assert.equal(windTargetFor({}), 0, 'sem dados');
    assert.equal(windTargetFor({ wind: 2 }), 1, 'recorta em 1');
    assert.equal(windTargetFor({ wind: -3 }), 0, 'e em 0');
});

test('o vento chega depressa e assenta devagar, sem saltos', () => {
    // Subida: 1,6 s para ir de 0 a 1.
    assert.equal(windStep(0, 1, WIND_ATTACK / 2), 0.5, 'na metade do tempo, metade da força');
    assert.equal(windStep(0, 1, WIND_ATTACK), 1, 'chegou');
    assert.equal(windStep(0, 1, 10), 1, 'nunca passa do alvo');

    // Descida: mais lenta que a subida.
    assert.ok(WIND_RELEASE > WIND_ATTACK, 'sair de cena é mais lento que entrar');
    const caiu = windStep(1, 0, WIND_ATTACK);
    assert.ok(caiu > 0 && caiu < 1,
        `no tempo que o vento leva para chegar, ele mal começou a assentar (${caiu.toFixed(2)})`);
    assert.ok(caiu > 0.25, 'e ainda está longe de parar');
    assert.equal(windStep(1, 0, WIND_RELEASE), 0, 'e uma hora assenta de vez');

    // Nada de degrau: um quadro pequeno move pouco.
    const passo = windStep(0.2, 0.8, 0.016);
    assert.ok(passo > 0.2 && passo <= 0.2 + 0.016 / WIND_ATTACK + 1e-9,
        `um quadro a 60 fps move um fio (${passo.toFixed(4)})`);
    assert.ok(passo < 0.25, 'e não um degrau visível');
});

test('passo de tempo inválido não muda a intensidade', () => {
    assert.equal(windStep(0.4, 1, 0), 0.4);
    assert.equal(windStep(0.4, 1, -1), 0.4);
    assert.equal(windStep(0.4, 1, NaN), 0.4);
    assert.equal(windStep(0.4, 0.4, 0.016), 0.4, 'já está no alvo');
});

test('nunca fica vento zero: o ar respira mesmo no silêncio', () => {
    assert.equal(windSwayAmount(0), WIND_SWAY_IDLE);
    assert.equal(windSwayAmount(1), WIND_SWAY_FULL);
    assert.ok(WIND_SWAY_IDLE > 0, 'capim parado de todo parece decorativo');
    assert.ok(windSwayAmount(0.5) > WIND_SWAY_IDLE && windSwayAmount(0.5) < WIND_SWAY_FULL);
    assert.equal(windSwayAmount(9), WIND_SWAY_FULL, 'recorta em 1');
    assert.equal(windSwayAmount(-2), WIND_SWAY_IDLE, 'e em 0');
});

// ------------------------------------------------ shader

function fakeMaterial() {
    return { userData: {}, onBeforeCompile: null, customProgramCacheKey: null };
}

function fakeShader() {
    return {
        uniforms: {},
        vertexShader: 'void main() {\n#include <common>\n#include <begin_vertex>\n}',
    };
}

test('o material do capim ganha os uniforms e o balanço no vertex shader', () => {
    const material = fakeMaterial();
    configureWindSway(material, { direction: { x: 0.6, z: 0.8 } });
    assert.equal(typeof material.onBeforeCompile, 'function');
    assert.equal(material.customProgramCacheKey(), 'voxel-grass-wind-v1');

    const shader = fakeShader();
    material.onBeforeCompile(shader);

    assert.ok(shader.uniforms.uWindTime, 'tempo do vento');
    assert.ok(shader.uniforms.uWindSway, 'amplitude');
    assert.deepEqual(shader.uniforms.uWindDir.value, { x: 0.6, y: 0.8 },
        'direção no plano XZ (y do uniform é o z do mundo)');
    assert.equal(material.userData.windShader, shader, 'guardado para o quadro atualizar');

    assert.match(shader.vertexShader, /uniform float uWindSway;/, 'declarou os uniforms');
    assert.match(shader.vertexShader, /uv\.y \* uv\.y/, 'raiz presa, ponta solta');
    assert.match(shader.vertexShader, /instanceMatrix\[3\]\.xz/, 'fase por tufo, da posição da instância');
    assert.match(shader.vertexShader, /USE_INSTANCING/, 'capim do mundo balança; o da mão, não');
    assert.ok(shader.vertexShader.includes('#include <begin_vertex>'), 'não comeu o include original');
});

test('sem direção informada, o vento sopra reto em X', () => {
    const material = fakeMaterial();
    configureWindSway(material);
    const shader = fakeShader();
    material.onBeforeCompile(shader);
    assert.deepEqual(shader.uniforms.uWindDir.value, { x: 1, y: 0 });
});

test('capacidade nula não quebra (material ausente)', () => {
    assert.doesNotThrow(() => configureWindSway(null));
    assert.doesNotThrow(() => updateWindSway(null, 1, 1));
    assert.doesNotThrow(() => updateWindSway([null, {}], 1, 1));
});

test('um passo por quadro entrega tempo e amplitude para todos os capins', () => {
    const materiais = [fakeMaterial(), fakeMaterial()];
    for (const material of materiais) {
        configureWindSway(material);
        material.onBeforeCompile(fakeShader());
    }
    // Material sem shader (ainda não compilado) no meio: não pode quebrar.
    const semShader = fakeMaterial();

    updateWindSway([...materiais, semShader], 12.5, 1);
    for (const material of materiais) {
        assert.equal(material.userData.windShader.uniforms.uWindTime.value, 12.5);
        assert.equal(material.userData.windShader.uniforms.uWindSway.value, WIND_SWAY_FULL);
    }

    updateWindSway(materiais, 13, 0);
    assert.equal(materiais[0].userData.windShader.uniforms.uWindSway.value, WIND_SWAY_IDLE,
        'fase calada: só o respirinho');
});

// ------------------------------------------------ ligação com o jogo

test('o jogo liga o vento ao capim e o atualiza com o ambiente', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /configureWindSway\(material, \{ direction: windDirection \}\)/,
        'o capim precisa receber o shader do vento');
    assert.match(source, /windStep\(windState\.level, windTargetFor\(ambientApplied\), dt\)/,
        'a intensidade segue a fase do áudio ambiente');
    assert.match(source, /updateWindSway\(tallGrassMaterials, windState\.time, windState\.level\)/,
        'e é entregue aos materiais todo quadro');
    assert.match(source, /updateGrassWind\(dt\)/, 'chamado no laço do jogo');
});

// ------------------------------------------------ a rajada (capim e pó juntos)

test('a rajada nunca sopra ao contrário: fica entre 0,5 e 1', () => {
    assert.ok(Math.abs(windGust(0, 0) - WIND_GUST_BASE) < 1e-12, 'sem tempo, o valor de repouso');
    for (let t = 0; t < 20; t += 0.37) {
        for (const phase of [0, 1.1, 3.14, 6]) {
            const gust = windGust(t, phase);
            assert.ok(gust >= WIND_GUST_BASE - WIND_GUST_SWING - 1e-12, `nunca abaixo do piso (${gust.toFixed(3)})`);
            assert.ok(gust <= WIND_GUST_BASE + WIND_GUST_SWING + 1e-12, `nem acima do teto (${gust.toFixed(3)})`);
        }
    }
});

test('fases diferentes desencontram as rajadas', () => {
    const a = windGust(1, 0);
    const b = windGust(1, Math.PI);
    assert.ok(Math.abs(a - b) > 0.1, 'dois tufos vizinhos não batem asa juntos');
    assert.equal(windGust(1, 0), windGust(1, 0), 'mas cada um é previsível');
    assert.ok(Number.isFinite(windGust(NaN, NaN)), 'entrada inválida não vira NaN');
});

test('o pó acelera na mesma proporção em que o capim verga', () => {
    assert.ok(Math.abs(windDustSpeed(0) - WIND_DUST_SPEED * WIND_DUST_IDLE) < 1e-12, 'calado: 25%');
    assert.ok(Math.abs(windDustSpeed(1) - WIND_DUST_SPEED) < 1e-12, 'cheio: 100%');
    assert.equal(windDustSpeed(-2), windDustSpeed(0), 'recorta embaixo');
    assert.equal(windDustSpeed(9), windDustSpeed(1), 'e em cima');
    // A mesma fração do capim: é o que faz os dois parecerem o MESMO vento.
    const fracaoCapim = windSwayAmount(0) / windSwayAmount(1);
    assert.ok(Math.abs(fracaoCapim - WIND_DUST_IDLE) < 1e-9,
        `capim parado mantém ${(fracaoCapim * 100).toFixed(0)}% e o pó também`);
});

test('o shader do capim usa as mesmas constantes da rajada', () => {
    const material = fakeMaterial();
    configureWindSway(material);
    const shader = fakeShader();
    material.onBeforeCompile(shader);
    const esperado = `${WIND_GUST_BASE} + ${WIND_GUST_SWING} * sin(uWindTime * ${WIND_GUST_SPEED} + windPhase)`;
    assert.ok(shader.vertexShader.includes(esperado),
        'os números do capim e do pó vêm da mesma fonte — não há como saírem do compasso');
});

test('o mesmo vento chega ao pó do Mofim', () => {
    const creature = readFileSync(new URL('../world-creature.js', import.meta.url), 'utf8');
    assert.match(creature, /this\.dust\.update\(dt, this\.wind\(\)\)/,
        'o sistema de pó precisa receber o vento');

    const dust = readFileSync(new URL('../world-creature-dust.js', import.meta.url), 'utf8');
    assert.match(dust, /windDustSpeed\(wind\.level\)/, 'e usa a velocidade do módulo do vento');
    assert.match(dust, /windGust\(windTime, slot\.phase\)/, 'com a rajada, por partícula');

    const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(game, /wind: \(\) => \(\{[\s\S]{0,160}?windState\.level,[\s\S]{0,80}?windState\.time,/,
        'o jogo entrega direção, intensidade e tempo do vento');
});
