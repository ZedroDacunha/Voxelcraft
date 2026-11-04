import test from 'node:test';
import assert from 'node:assert/strict';

import { ID } from '../world-catalog.js';
import {
    WATERFALL_ATTACK_SECONDS,
    WATERFALL_AUDIBLE,
    WATERFALL_MAX_GAIN,
    WATERFALL_RELEASE_SECONDS,
    WATERFALL_START_GAIN,
    WATERFALL_STOP_GAIN,
    createWaterfallSoundState,
    isFallingWater,
    scanWaterfall,
    updateWaterfallSound,
    waterfallGain,
} from '../world-waterfall.js';
import { WATERFALL_RECIPE } from '../world-audio.js';
import { createFakeAudio, lastTarget } from './helpers/fake-audio.mjs';

// Mundo de mentira: só as células de água caindo importam.
function makeWorld(cells = []) {
    const falling = new Set(cells.map(cell => cell.join(',')));
    return { getBlock: (x, y, z) => (falling.has(`${x},${y},${z}`) ? ID.WATER_FALL : 0) };
}

const origin = (x = 0.5, y = 10, z = 0.5) => ({ x, y, z });

// ------------------------------------------------ o que conta como cachoeira

test('só água caindo faz barulho de queda', () => {
    assert.equal(isFallingWater(ID.WATER_FALL), true);
    assert.equal(isFallingWater(ID.WATER), false, 'lago parado não é cachoeira');
    assert.equal(isFallingWater(ID.WATER_FLOW_1), false, 'corrente horizontal também não');
    assert.equal(isFallingWater(ID.WATER_FLOW_7), false);
    assert.equal(isFallingWater(0), false);
    assert.equal(isFallingWater(undefined), false);
    assert.equal(isFallingWater(9999), false, 'bloco desconhecido não estoura');
});

test('a busca vê colunas, altura e a distância da água mais próxima', () => {
    const cells = [];
    for (let x = 5; x <= 6; x++) for (let y = 10; y <= 12; y++) cells.push([x, y, 0]);
    const found = scanWaterfall(makeWorld(cells), origin());

    assert.equal(found.columns, 2, 'duas colunas de água');
    assert.equal(found.height, 3, 'três blocos de queda');
    assert.ok(Math.abs(found.distance - Math.hypot(5, 0.5, 0)) < 0.01, `distância até a célula mais perto (${found.distance.toFixed(2)})`);
});

test('sem água caindo, nada é encontrado (e a distância é infinita)', () => {
    const found = scanWaterfall(makeWorld([[5, 10, 0]]), origin(30, 10, 30));
    assert.deepEqual(found, { columns: 0, height: 0, distance: Infinity });
    assert.deepEqual(scanWaterfall(null, origin()), { columns: 0, height: 0, distance: Infinity });
    assert.deepEqual(scanWaterfall(makeWorld([]), null), { columns: 0, height: 0, distance: Infinity });
});

test('a caixa da busca tem alcance: cachoeira longe não entra', () => {
    const longe = makeWorld([[40, 10, 40]]);
    assert.equal(scanWaterfall(longe, origin()).columns, 0, 'fora da caixa');

    // E a água muito acima da cabeça também fica de fora da caixa.
    const noCeu = makeWorld([[0, 90, 0]]);
    assert.equal(scanWaterfall(noCeu, origin()).columns, 0);
});

test('queda alta conta como sequência, não como blocos soltos', () => {
    const cells = [];
    for (let y = 60; y >= 40; y--) cells.push([3, y, 3]);
    const found = scanWaterfall(makeWorld(cells), origin(3.5, 45, 3.5));
    assert.equal(found.columns, 1);
    assert.equal(found.height, 18, 'só o que cabe na janela acima do jogador');
});

// ------------------------------------------------ ganho

test('longe demais é silêncio; perto e grande é o teto', () => {
    assert.equal(waterfallGain({ columns: 1, height: 3, distance: WATERFALL_AUDIBLE + 1 }), 0);
    assert.equal(waterfallGain({ columns: 1, height: 3, distance: WATERFALL_AUDIBLE }), 0, 'na borda do alcance já é zero');

    const pertoGrande = waterfallGain({ columns: 4, height: 4, distance: 1 });
    assert.ok(pertoGrande > 0.4, `cachoeira grande e colada é forte (${pertoGrande.toFixed(2)})`);
    assert.ok(pertoGrande <= WATERFALL_MAX_GAIN, 'mas nunca passa do teto');
    assert.equal(waterfallGain({ columns: 8, height: 12, distance: 0 }), WATERFALL_MAX_GAIN, 'satura no teto');
});

test('ganho cresce com o tamanho e cai com a distância', () => {
    const pequena = waterfallGain({ columns: 1, height: 1, distance: 4 });
    const media = waterfallGain({ columns: 2, height: 3, distance: 4 });
    const grande = waterfallGain({ columns: 4, height: 5, distance: 4 });
    assert.ok(pequena < media && media < grande, `${pequena.toFixed(2)} < ${media.toFixed(2)} < ${grande.toFixed(2)}`);

    const perto = waterfallGain({ columns: 2, height: 3, distance: 2 });
    const longe = waterfallGain({ columns: 2, height: 3, distance: 12 });
    assert.ok(perto - longe > 0.15, 'a distância pesa de verdade');
});

test('ganho inválido ou irrisório vira silêncio', () => {
    assert.equal(waterfallGain({}), 0);
    assert.equal(waterfallGain({ columns: 0, height: 5, distance: 1 }), 0);
    assert.equal(waterfallGain({ columns: 2, height: 0, distance: 1 }), 0);
    assert.equal(waterfallGain({ columns: 2, height: 2, distance: NaN }), 0);
    assert.equal(waterfallGain({ columns: NaN, height: 2, distance: 1 }), 0);
    // no limite do alcance o ganho é minúsculo e o piso corta
    assert.equal(waterfallGain({ columns: 1, height: 1, distance: WATERFALL_AUDIBLE - 0.1 }), 0);
});

// ------------------------------------------------ laço com histerese

test('o laço só abre quando o ganho alvo pede', () => {
    const state = createWaterfallSoundState();
    assert.deepEqual(updateWaterfallSound(state, 0, 0.016), { action: null, gain: 0 });
    assert.deepEqual(updateWaterfallSound(state, WATERFALL_START_GAIN - 0.001, 0.016), { action: null, gain: 0 });
    assert.equal(state.active, false);

    const started = updateWaterfallSound(state, 0.3, 0.016);
    assert.equal(started.action, 'start');
    assert.ok(started.gain > 0 && started.gain < 0.3, 'entra crescendo, não de uma vez');
    assert.equal(state.active, true);
});

test('o ganho sobe no ataque e desce na saída', () => {
    const state = createWaterfallSoundState();
    const inicio = updateWaterfallSound(state, 0.4, 0.016).gain;
    assert.ok(inicio > 0 && inicio < 0.4, 'entra crescendo, não de uma vez');

    // A rampa é linear: ~0,03 por quadro, então meio ataque depois ainda está
    // longe do alvo (nada de "liga no volume final").
    for (let i = 0; i < 5; i++) updateWaterfallSound(state, 0.4, 0.016);
    assert.ok(state.gain > inicio, 'subiu');
    assert.ok(state.gain < 0.3, `ainda longe do alvo (${state.gain.toFixed(3)})`);

    // tempo suficiente: chega ao alvo e fica nele (rampa linear, não assíntota)
    for (let i = 0; i < 40; i++) updateWaterfallSound(state, 0.4, 0.016);
    assert.equal(state.gain, 0.4, 'estabiliza exatamente no alvo');

    // a fonte some: cai devagar e só então fecha
    const caindo = [];
    for (let i = 0; i < 20; i++) caindo.push(updateWaterfallSound(state, 0, 0.016));
    assert.ok(caindo.at(-1).gain < 0.4, 'descendo');
    assert.ok(caindo.every(step => step.action !== 'stop'), `ainda não fechou em ${(20 * 0.016).toFixed(2)} s`);
    assert.ok(WATERFALL_RELEASE_SECONDS > WATERFALL_ATTACK_SECONDS, 'sair é mais lento que entrar');
});

test('sem cachoeira há muito tempo, o laço fecha e zera', () => {
    const state = createWaterfallSoundState();
    updateWaterfallSound(state, 0.4, 0.016);
    for (let i = 0; i < 120; i++) updateWaterfallSound(state, 0.4, 0.016);

    let stopped = null;
    for (let i = 0; i < 200 && !stopped; i++) {
        const step = updateWaterfallSound(state, 0, 0.016);
        if (step.action === 'stop') stopped = step;
    }
    assert.ok(stopped, 'fechou');
    assert.equal(stopped.gain, 0);
    assert.equal(state.active, false);
    assert.ok(state.gain <= WATERFALL_STOP_GAIN, 'só fecha depois de descer abaixo do piso');
});

test('vaivém na borda não pisca o som (histerese)', () => {
    const state = createWaterfallSoundState();
    // alvo conversando entre 0,03 e 0,06: acima do piso de parada, abaixo do de
    // partida — o laço, uma vez aberto, não fecha.
    updateWaterfallSound(state, 0.06, 0.016);
    assert.equal(state.active, true);
    let stops = 0;
    for (let i = 0; i < 300; i++) {
        const step = updateWaterfallSound(state, i % 2 ? 0.03 : 0.06, 0.016);
        if (step.action === 'stop') stops++;
    }
    assert.equal(stops, 0, 'nunca fechou');
    assert.equal(state.active, true);
});

test('alvo e dt inválidos não estragam o estado', () => {
    const state = createWaterfallSoundState();
    updateWaterfallSound(state, 0.3, 0.016);
    const antes = state.gain;

    updateWaterfallSound(state, 0.3, NaN);
    updateWaterfallSound(state, 0.3, -1);
    updateWaterfallSound(state, 0.3, 0);
    assert.equal(state.gain, antes, 'dt inválido não move o ganho');
    assert.equal(state.active, true);

    updateWaterfallSound(state, NaN, 0.016);
    assert.ok(Number.isFinite(state.gain) && state.gain >= 0, 'alvo inválido não vira NaN');
});

// ------------------------------------------------ áudio: o laço existe de fato

test('setWaterfallLevel cria um laço só, com fade e sem contexto à toa', () => {
    const { audio, factory } = createFakeAudio();
    assert.equal(audio.setWaterfallLevel(0), false, 'silêncio sem laço não abre AudioContext');
    assert.equal(factory.created.length, 0);

    assert.equal(audio.setWaterfallLevel(0.5), true);
    const context = factory.context;
    assert.equal(context.sources.length, 1, 'uma fonte para a vida do laço, não uma por quadro');

    const source = context.sources[0];
    assert.equal(source.loop, true);
    assert.ok(source.buffer.length >= context.sampleRate * 2, 'buffer de alguns segundos');

    const target = lastTarget(context.gains.at(-1).gain);
    assert.ok(target, 'usa setTargetAtTime (nunca um degrau)');
    assert.ok(Math.abs(target[1] - WATERFALL_RECIPE.gain * 0.5) < 1e-9, 'ganho da receita vezes o nível pedido');
    assert.ok(target[3] > 0, 'com constante suave');

    audio.setWaterfallLevel(1);
    assert.equal(context.sources.length, 1, 'subir o volume não cria outro laço');
    assert.equal(lastTarget(context.gains.at(-1).gain)[1], WATERFALL_RECIPE.gain);
});

test('o buffer da cachoeira não é silêncio nem estala na emenda', () => {
    const { audio, factory } = createFakeAudio();
    audio.setWaterfallLevel(1);
    const data = factory.context.sources[0].buffer.data;

    let peak = 0, soma = 0;
    for (const value of data) { peak = Math.max(peak, Math.abs(value)); soma += Math.abs(value); }
    assert.ok(peak > 0.5, `tem corpo (pico ${peak.toFixed(2)})`);
    assert.ok(peak <= 1, 'nunca satura');
    assert.ok(soma / data.length > 0.05, 'não é silêncio');

    const emenda = Math.abs(data[data.length - 1] - data[0]);
    assert.ok(emenda < 0.35, `a emenda do laço é suave (${emenda.toFixed(2)})`);
});

test('o ambiente não mexe na cachoeira, e vice-versa', () => {
    const { audio, factory } = createFakeAudio();
    audio.setWaterfallLevel(0.8);
    const context = factory.context;
    const waterfall = context.gains.at(-1);
    const antes = lastTarget(waterfall.gain)[1];

    audio.setAmbientLevels({ wind: 1, crickets: 0 });
    assert.equal(lastTarget(waterfall.gain)[1], antes, 'o ambiente não reescreve o laço da cachoeira');
    assert.equal(context.sources.length, 2, 'vento + cach oeira, um nó cada');

    audio.setAmbientLevels({ wind: 0, crickets: 0 });
    assert.equal(audio.setWaterfallLevel(0), true, 'e a cachoeira pode sair sozinha');
    assert.equal(lastTarget(waterfall.gain)[1], 0);
});
