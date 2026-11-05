import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { QUALITY_MODES, createWorldGraphicsQuality } from '../world-graphics-quality.js';

const makeQuality = (overrides = {}) => {
    const notices = [];
    const quality = createWorldGraphicsQuality({
        max: 1,
        min: 0.5,
        notify: message => notices.push(message),
        ...overrides,
    });
    return { quality, notices };
};

// fps baixo com CPU ociosa = limitado pela GPU (é quando baixar a resolução ajuda)
const GPU_BOUND = { fps: 30, cpu: 5 };
// fps baixo com CPU ocupada = baixar a resolução não adianta
const CPU_BOUND = { fps: 30, cpu: 60 };

const adapt = (quality, fps, cpu, hidden = false) => quality.adapt(fps, cpu, hidden);

test('começa em automático na escala máxima', () => {
    const { quality } = makeQuality();
    assert.equal(quality.auto, true);
    assert.equal(quality.scale, 1);
    assert.equal(quality.consumePending(), null, 'nada pendente antes de mudar');
});

test('max abaixo do min é elevado ao min; min é respeitado', () => {
    const { quality } = makeQuality({ max: 0.3, min: 0.5 });
    assert.equal(quality.scale, 0.5);

    for (let i = 0; i < 40; i++) adapt(quality, GPU_BOUND.fps, GPU_BOUND.cpu);
    assert.equal(quality.scale, 0.5, 'nunca desce abaixo do mínimo');
});

test('fps baixo com GPU no limite reduz a escala a cada duas leituras', () => {
    const { quality } = makeQuality();

    adapt(quality, GPU_BOUND.fps, GPU_BOUND.cpu);
    assert.equal(quality.scale, 1, 'a primeira leitura só conta');
    assert.equal(quality.consumePending(), null);

    adapt(quality, GPU_BOUND.fps, GPU_BOUND.cpu);
    assert.equal(quality.scale, 0.85);
    assert.equal(quality.consumePending(), 0.85, 'a nova escala fica pendente para o renderer');
    assert.equal(quality.consumePending(), null, 'pendente é consumido uma vez só');
});

test('fps baixo com CPU ocupada não mexe na resolução', () => {
    const { quality } = makeQuality();
    for (let i = 0; i < 10; i++) adapt(quality, CPU_BOUND.fps, CPU_BOUND.cpu);
    assert.equal(quality.scale, 1);
    assert.equal(quality.consumePending(), null);
});

// desce uma escala com duas leituras de FPS estável (mantém o automático ligado)
const descendStep = (quality, fps) => {
    adapt(quality, fps, 5);
    adapt(quality, fps, 5);
};

test('fps alto sobe a escala devagar (oito leituras)', () => {
    const { quality } = makeQuality({ max: 1 });
    descendStep(quality, 30); // 1 -> 0.85
    descendStep(quality, 34); // 0.85 -> 0.70
    descendStep(quality, 38); // 0.70 -> 0.55
    const low = quality.scale;
    assert.ok(Math.abs(low - 0.55) < 1e-9, `escala baixou até ${low}`);
    assert.equal(quality.auto, true, 'FPS melhorando mantém o automático');

    for (let i = 0; i < 7; i++) adapt(quality, 60, 1);
    assert.equal(quality.scale, low, 'sete leituras boas ainda não bastam');

    adapt(quality, 60, 1);
    assert.ok(Math.abs(quality.scale - Math.min(1, low + 0.1)) < 1e-9);
});

test('fps na faixa intermediária zera as contagens', () => {
    const { quality } = makeQuality();
    adapt(quality, 30, 5);      // slow = 1
    adapt(quality, 56, 1);      // faixa neutra: zera
    adapt(quality, 30, 5);      // slow = 1 de novo
    assert.equal(quality.scale, 1, 'a contagem foi reiniciada no meio');
});

test('leitura escondida, manual ou inválida é ignorada', () => {
    const { quality } = makeQuality();
    for (let i = 0; i < 5; i++) {
        adapt(quality, 30, 5, true); // aba escondida
        adapt(quality, 30, 5, false);
    }
    assert.ok(quality.scale < 1, 'sem escondida ainda desce');

    const manual = makeQuality();
    manual.quality.cycle(); // sai do automático
    const scale = manual.quality.scale;
    for (let i = 0; i < 10; i++) adapt(manual.quality, 10, 1);
    assert.equal(manual.quality.scale, scale, 'modo manual não adapta');

    const invalid = makeQuality();
    for (let i = 0; i < 10; i++) {
        adapt(invalid.quality, NaN, 1);
        adapt(invalid.quality, 30, NaN);
    }
    assert.equal(invalid.quality.scale, 1);
});

test('se baixar a resolução não melhora o FPS, o automático se desliga', () => {
    const { quality, notices } = makeQuality();

    for (let i = 0; i < 20 && quality.auto; i++) adapt(quality, GPU_BOUND.fps, GPU_BOUND.cpu);

    assert.equal(quality.auto, false, 'para de brigar com uma limitação que não é de resolução');
    assert.ok(notices.some(message => /FPS não melhorou/i.test(message)));
});

test('cycle percorre os modos e volta ao automático', () => {
    const { quality, notices } = makeQuality();

    quality.cycle();
    assert.equal(quality.auto, false);
    assert.equal(quality.scale, 1);
    assert.equal(quality.consumePending(), 1);
    assert.match(notices.at(-1), /máxima/);

    quality.cycle();
    assert.equal(quality.scale, 1);
    assert.match(notices.at(-1), /100%/);

    quality.cycle();
    assert.equal(quality.scale, 0.75);
    assert.equal(quality.consumePending(), 0.75);

    quality.cycle();
    assert.equal(quality.scale, 0.5);

    quality.cycle();
    assert.equal(quality.auto, true, 'depois do último modo volta ao automático');
    assert.equal(quality.scale, 1);
    assert.equal(quality.consumePending(), 1);
    assert.match(notices.at(-1), /automática/);
});

test('cycle respeita o mínimo configurado', () => {
    const { quality } = makeQuality({ min: 0.9, max: 1 });
    quality.cycle(); // max
    quality.cycle(); // 1
    quality.cycle(); // 0.75 -> limitado a 0.9
    assert.equal(quality.scale, 0.9);
});

test('modos disponíveis são exatamente os anunciados', () => {
    assert.deepEqual(QUALITY_MODES, ['auto', 'max', 1, 0.75, 0.5]);
    assert.equal(Object.isFrozen(QUALITY_MODES), true);
});

test('o jogo aplica a escala pendente e mede FPS para adaptar', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    assert.match(source, /gfx\.consumePending\(\)/);
    assert.match(source, /gfx\.adapt\(perf\.fps, perf\.avg, document\.hidden\)/);
    // a escala vai para o renderer em applyRenderResolution (renderTarget),
    // e não muda o buffer quando há uma resolução fixa escolhida
    assert.match(source, /renderer\.setPixelRatio\(target\.pixelRatio\)/);
    assert.match(source, /if \(pendingScale !== null && !resolutionSize\(resolutionMode\)\) renderer\.setPixelRatio\(pendingScale\);/);
    assert.match(source, /const cycleQuality = \(\) => gfx\.cycle\(\)/);
});

test('escolha direta pela tela de opções usa o mesmo caminho do F4', () => {
    const { quality, notices } = makeQuality();

    assert.equal(quality.mode, 'auto', 'começa em automático');
    assert.equal(quality.setMode(0.75), true);
    assert.equal(quality.mode, 0.75);
    assert.equal(quality.auto, false);
    assert.equal(quality.scale, 0.75);
    assert.equal(quality.consumePending(), 0.75);
    assert.match(notices.at(-1), /75%/);

    assert.equal(quality.setMode('max'), true);
    assert.equal(quality.scale, 1);
    assert.match(notices.at(-1), /máxima/);

    assert.equal(quality.setMode('auto'), true);
    assert.equal(quality.auto, true);
    assert.match(notices.at(-1), /automática/);
});

test('modo desconhecido é ignorado sem mudar nada', () => {
    const { quality, notices } = makeQuality();
    quality.setMode(0.5);
    const before = { mode: quality.mode, scale: quality.scale, notices: notices.length };

    assert.equal(quality.setMode(0.3), false, 'escala fora da lista não entra');
    assert.equal(quality.setMode('ultra'), false);
    assert.equal(quality.mode, before.mode);
    assert.equal(quality.scale, before.scale);
    assert.equal(notices.length, before.notices);
});

test('aplicar o valor já salvo ao entrar no mundo não avisa', () => {
    const { quality, notices } = makeQuality();
    assert.equal(quality.setMode(0.5, { quiet: true }), true);
    assert.equal(quality.scale, 0.5);
    assert.equal(notices.length, 0, 'ninguém mudou nada agora, então nada de aviso');
});

test('cycle continua andando de onde a escolha direta parou', () => {
    const { quality } = makeQuality();
    quality.setMode(0.75);
    quality.cycle();
    assert.equal(quality.mode, 0.5, 'o F4 segue a lista a partir do modo atual');
});
