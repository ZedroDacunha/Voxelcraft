import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    AMBIENT_FADE_SECONDS,
    AMBIENT_LAYERS,
    AMBIENT_RECIPES,
} from '../world-audio.js';
import { createFakeAudio, lastTarget } from './helpers/fake-audio.mjs';
import {
    AMBIENT_AVAILABILITY_FLOOR,
    AMBIENT_MODES,
    AMBIENT_PHASE_SECONDS,
    ambientAvailability,
    ambientLevelsFor,
    ambientModesFor,
    ambientPhaseSeconds,
    createAmbientState,
    nextAmbientMode,
    stepAmbient,
} from '../world-ambient-sounds.js';

// --- disponibilidade ----------------------------------------------------

test('de dia não há grilo; de noite há, mas só perto do nível do mar', () => {
    const day = ambientAvailability({ height: 26, night: false });
    assert.equal(day.crickets, 0);
    assert.ok(day.wind > 0.4, 'vento existe de dia');

    const night = ambientAvailability({ height: 26, night: true });
    assert.ok(night.crickets > 0.5);

    const mountain = ambientAvailability({ height: 80, night: true });
    assert.equal(mountain.crickets, 0, 'cume não tem grilo');
    assert.ok(mountain.wind > night.wind, 'mas venta mais que no vale');

    const cave = ambientAvailability({ height: 5, night: true });
    assert.equal(cave.crickets, 0, 'caverna funda também não');
});

test('altura inválida não vira NaN', () => {
    const weird = ambientAvailability({ height: NaN, night: true });
    assert.ok(Number.isFinite(weird.wind) && Number.isFinite(weird.crickets));
    assert.ok(weird.wind >= 0 && weird.wind <= 1);
});

test('níveis por fase respeitam a disponibilidade', () => {
    const night = { wind: 0.6, crickets: 0.9 };
    assert.deepEqual(ambientLevelsFor('silence', night), { wind: 0, crickets: 0 });
    assert.deepEqual(ambientLevelsFor('wind', night), { wind: 0.6, crickets: 0 });
    assert.deepEqual(ambientLevelsFor('crickets', night), { wind: 0, crickets: 0.9 });
    assert.deepEqual(ambientLevelsFor('both', night), { wind: 0.6, crickets: 0.9 });
    // de dia, "os dois" soa só o vento — o grilo nem é pedido
    assert.deepEqual(ambientLevelsFor('both', { wind: 0.6, crickets: 0 }), { wind: 0.6, crickets: 0 });
});

test('fases impossíveis saem do sorteio', () => {
    assert.deepEqual(ambientModesFor({ wind: 0.6, crickets: 0 }), ['silence', 'wind']);
    assert.deepEqual(ambientModesFor({ wind: 0.6, crickets: 0.8 }), [...AMBIENT_MODES]);
    // nem vento (absurdo, mas não pode quebrar): só silêncio
    assert.deepEqual(ambientModesFor({ wind: 0, crickets: 0 }), ['silence']);
    assert.ok(AMBIENT_AVAILABILITY_FLOOR > 0);
});

test('nunca repete a fase anterior', () => {
    const night = { wind: 0.6, crickets: 0.9 };
    let previous = 'silence';
    for (let i = 0; i < 300; i++) {
        const mode = nextAmbientMode({ availability: night, avoid: previous, random: Math.random });
        assert.notEqual(mode, previous, `repetiu ${mode}`);
        previous = mode;
    }
    // com só uma fase possível, repetir é inevitável — e não pode quebrar
    assert.equal(nextAmbientMode({ availability: { wind: 0, crickets: 0 }, avoid: 'silence' }), 'silence');
});

test('o sorteio nunca escolhe uma fase sem camada', () => {
    const day = { wind: 0.6, crickets: 0 };
    for (let i = 0; i < 200; i++) {
        const mode = nextAmbientMode({ availability: day, random: Math.random });
        assert.notEqual(mode, 'crickets', 'de dia não sorteia grilos');
        assert.notEqual(mode, 'both', 'nem os dois');
    }
});

test('as fases somam as durações esperadas e não ficam coladas', () => {
    for (const mode of AMBIENT_MODES) {
        const [min, max] = AMBIENT_PHASE_SECONDS[mode];
        assert.ok(min > 0 && max > min);
        assert.equal(ambientPhaseSeconds(mode, () => 0), min);
        assert.equal(ambientPhaseSeconds(mode, () => 1), max);
        assert.ok(min >= 6, `${mode}: fase longa o bastante para respirar`);
    }
    const [, silenceMax] = AMBIENT_PHASE_SECONDS.silence;
    assert.ok(silenceMax >= 15, 'há silêncio de verdade entre as fases');
    const [, bothMax] = AMBIENT_PHASE_SECONDS.both;
    assert.ok(bothMax <= 12, '"os dois" é sempre curto');
});

test('começa em silêncio e troca de fase quando o tempo acaba', () => {
    const state = createAmbientState();
    assert.equal(state.mode, 'silence');

    const night = { wind: 0.6, crickets: 0.9 };
    const first = stepAmbient(state, 1, { availability: night, random: () => 0.1 });
    assert.equal(first.changed, false, 'ainda dentro do silêncio inicial');
    assert.deepEqual([first.wind, first.crickets], [0, 0]);

    const after = stepAmbient(state, 20, { availability: night, random: () => 0.1 });
    assert.equal(after.changed, true);
    assert.notEqual(after.mode, 'silence', 'depois do silêncio vem alguma camada');
    assert.ok(after.wind > 0 || after.crickets > 0);
});

test('amanhecer corta a fase de grilos na hora', () => {
    const state = createAmbientState();
    // força uma fase longa de grilos
    stepAmbient(state, 20, { availability: { wind: 0.6, crickets: 0.9 }, random: () => 1 });
    assert.notEqual(state.mode, 'silence', 'random 1 cai na última fase permitida');
    assert.ok(state.mode === 'both' || state.mode === 'crickets' || state.mode === 'wind');

    const state2 = { mode: 'crickets', remaining: 30 };
    const step = stepAmbient(state2, 0.1, { availability: { wind: 0.6, crickets: 0 }, random: () => 0 });
    assert.equal(step.changed, true, 'fase impossível troca imediatamente');
    assert.notEqual(step.mode, 'crickets');
});

test('dt inválido devolve o estado atual sem trocar de fase', () => {
    const state = { mode: 'wind', remaining: 5 };
    for (const dt of [0, -1, NaN, undefined]) {
        const step = stepAmbient(state, dt, { availability: { wind: 0.6, crickets: 0 } });
        assert.equal(step.mode, 'wind');
        assert.equal(step.changed, false);
        assert.equal(step.remaining, 5, 'o relógio não anda com dt inválido');
    }
});

// Gerador determinístico: o teste de distribuição não pode depender do acaso do
// dia. (Math.random aqui já deu fase sem grilo nenhum em 60 s — o teste virou
// moeda, e teste que às vezes passa é pior que teste nenhum.)
function seeded(seed = 1234567) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
    };
}

test('em dez minutos há silêncio, vento e grilos — e os dois juntos são a exceção', () => {
    const night = { wind: 0.6, crickets: 0.9 };
    const state = createAmbientState();
    const random = seeded();
    const seen = new Map();
    const seconds = new Map();
    for (let i = 0; i < 60 * 600; i++) { // 10 minutos a 60 quadros/s
        const step = stepAmbient(state, 1 / 60, { availability: night, random });
        seen.set(step.mode, (seen.get(step.mode) ?? 0) + 1);
        seconds.set(step.mode, (seconds.get(step.mode) ?? 0) + 1 / 60);
    }
    for (const mode of AMBIENT_MODES) assert.ok(seen.get(mode) > 0, `fase ${mode} apareceu`);

    const total = 600;
    const silent = seconds.get('silence');
    const both = seconds.get('both');
    assert.ok(silent / total > 0.15 && silent / total < 0.55, `silêncio ocupa ${(silent / total * 100).toFixed(0)}%`);
    assert.ok(both / total < 0.2, `os dois juntos ocupam ${(both / total * 100).toFixed(0)}%`);

    // nenhuma fase dura um piscar: nada de som piscando a cada segundo
    let shortest = Infinity;
    let run = 0;
    let previous = null;
    const random2 = seeded(99);
    const state2 = createAmbientState();
    for (let i = 0; i < 60 * 600; i++) {
        const step = stepAmbient(state2, 1 / 60, { availability: night, random: random2 });
        if (step.mode === previous) run += 1 / 60;
        else {
            if (previous !== null) shortest = Math.min(shortest, run);
            previous = step.mode;
            run = 1 / 60;
        }
    }
    assert.ok(shortest >= 6, `a fase mais curta durou ${shortest.toFixed(1)} s`);
});

// --- áudio: camadas em laço ---------------------------------------------



test('as camadas são laços de buffer, um nó por camada e por página', () => {
    const { audio, factory } = createFakeAudio();
    audio.setAmbientLevels({ wind: 1, crickets: 0 });
    audio.setAmbientLevels({ wind: 1, crickets: 1 });

    const context = factory.context;
    assert.equal(context.sources.length, 2, 'uma fonte por camada, não uma por quadro');
    for (const source of context.sources) {
        assert.equal(source.loop, true, 'o buffer precisa repetir');
        assert.ok(source.buffer && source.buffer.length > 0);
        assert.equal(source.started.length, 1, 'toca uma vez e fica');
    }
    for (const name of AMBIENT_LAYERS) assert.ok(AMBIENT_RECIPES[name].loopSeconds >= 3);
    assert.ok(context.filters.every(filter => filter.type === 'lowpass'));
});

test('o volume da camada entra por fade, nunca em degrau', () => {
    const { audio, factory } = createFakeAudio();
    audio.setAmbientLevels({ wind: 1 });
    const context = factory.context;
    const gain = context.gains.at(-1);
    const target = lastTarget(gain.gain);
    assert.ok(target, 'usa setTargetAtTime');
    assert.equal(target[1], AMBIENT_RECIPES.wind.gain);
    assert.ok(target[3] > 0 && target[3] <= AMBIENT_FADE_SECONDS, 'constante de tempo curta, mas suave');

    audio.setAmbientLevels({ wind: 0 });
    const off = lastTarget(gain.gain);
    assert.equal(off[1], 0, 'silêncio também é fade');
});

test('pedir silêncio antes de existir som não cria AudioContext', () => {
    const { audio, factory } = createFakeAudio();
    assert.equal(audio.setAmbientLevels({ wind: 0, crickets: 0 }), false);
    assert.equal(factory.created.length, 0, 'nada de contexto antes de um gesto');
    assert.equal(audio.setAmbientLevels({}), false);

    assert.equal(audio.setAmbientLevels({ wind: 0.5 }), true);
    assert.equal(factory.created.length, 1);
});

test('nível inválido não estoura o ganho', () => {
    const { audio, factory } = createFakeAudio();
    audio.setAmbientLevels({ wind: NaN, crickets: '0.5' });
    const context = factory.context;
    assert.equal(lastTarget(context.gains.at(-1).gain)[1], AMBIENT_RECIPES.crickets.gain * 0.5);
});

test('stopAmbient para as fontes e limpa o estado', () => {
    const { audio, factory } = createFakeAudio();
    audio.setAmbientLevels({ wind: 1, crickets: 1 });
    const context = factory.context;
    audio.stopAmbient();
    assert.ok(context.sources.every(source => source.stopped === 1));
    // e pode voltar: cria de novo, sem duplicar
    audio.setAmbientLevels({ wind: 1 });
    assert.equal(context.sources.length, 3);
});

// --- fiação no jogo ------------------------------------------------------

test('o jogo cala o ambiente fora do jogo e não reescreve o áudio à toa', () => {
    const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    const fn = source.slice(source.indexOf('function updateAmbient('));
    const body = fn.slice(0, fn.indexOf('\n}', fn.indexOf('applyAmbientLevels')));

    assert.match(body, /!playing\(\) \|\| dead \|\| document\.hidden/, 'silencio tambem fora do modo toque');
    assert.match(body, /applyAmbientLevels\(\{ wind: 0, crickets: 0 \}\)/);
    assert.match(body, /ambientAvailability\(\{/);
    assert.match(body, /night: worldSky\.day < 0\.35/);
    assert.match(body, /stepAmbient\(ambientState, dt, \{ availability \}\)/);

    const apply = source.slice(source.indexOf('function applyAmbientLevels('));
    assert.match(apply.slice(0, 400), /< 0\.01/, 'só aplica quando o nível muda de verdade');
    assert.match(source, /updateAmbient\(dt\);/, 'chamado no laço de quadros');
});
