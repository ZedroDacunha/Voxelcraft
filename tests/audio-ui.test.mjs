import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    DEFAULT_SOUND_VOLUME,
    SOUND_NAMES,
    SOUND_RECIPES,
    bindUiSounds,
    createAudioSystem,
    soundAssetCandidates,
} from '../world-audio.js';

// --- dublês de WebAudio -------------------------------------------------

function makeParam(value = 0) {
    return {
        value,
        events: [],
        setValueAtTime(v, t) { this.events.push(['set', v, t]); this.value = v; return this; },
        linearRampToValueAtTime(v, t) { this.events.push(['linear', v, t]); return this; },
        exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); return this; },
    };
}

function withConnect(node) {
    node.connections = [];
    node.connect = target => { node.connections.push(target); return target; };
    node.disconnect = () => {};
    return node;
}

function makeContext({ state = 'running' } = {}) {
    const context = withConnect({
        state,
        currentTime: 0,
        destination: { name: 'destination' },
        resumed: 0,
        closed: false,
        oscillators: [],
        bufferSources: [],
        gains: [],
    });
    context.resume = async () => { context.resumed++; context.state = 'running'; };
    context.close = async () => { context.closed = true; context.state = 'closed'; };
    context.createGain = () => {
        const node = withConnect({ gain: makeParam(1) });
        context.gains.push(node);
        return node;
    };
    context.createOscillator = () => {
        const node = withConnect({
            type: 'sine',
            frequency: makeParam(440),
            started: [],
            stopped: [],
            start(t) { this.started.push(t); },
            stop(t) { this.stopped.push(t); },
        });
        context.oscillators.push(node);
        return node;
    };
    context.createBufferSource = () => {
        const node = withConnect({
            buffer: null,
            started: [],
            start(t) { this.started.push(t); },
        });
        context.bufferSources.push(node);
        return node;
    };
    context.decodeAudioData = (data, resolve) => {
        const buffer = { data, decoded: true };
        resolve?.(buffer);
        return Promise.resolve(buffer);
    };
    return context;
}

function makeFactory(options = {}) {
    const created = [];
    const Factory = function () {
        const context = makeContext(options);
        created.push(context);
        return context;
    };
    return { Factory, created, get context() { return created.at(-1); } };
}

function makeFetch(available = () => true) {
    const calls = [];
    const fetchImpl = async url => {
        calls.push(url);
        if (!available(url)) return { ok: false, status: 404 };
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    };
    fetchImpl.calls = calls;
    return fetchImpl;
}

const silent = () => {};

function makeAudio({ volume, ...overrides } = {}) {
    const factory = makeFactory();
    const warnings = [];
    const audio = createAudioSystem({
        AudioContextClass: factory.Factory,
        fetchImpl: makeFetch(),
        volume: volume ?? DEFAULT_SOUND_VOLUME,
        warn: (...args) => warnings.push(args.join(' ')),
        ...overrides,
    });
    return { audio, factory, warnings };
}

// --- receitas e nomes ---------------------------------------------------

test('todas as receitas são válidas e os nomes de arquivo são previsíveis', () => {
    assert.deepEqual(SOUND_NAMES, ['ui-click', 'ui-hover']);
    for (const name of SOUND_NAMES) {
        const recipe = SOUND_RECIPES[name];
        assert.ok(['sine', 'triangle', 'square', 'sawtooth'].includes(recipe.wave), `${name}: onda`);
        assert.ok(recipe.from >= 80 && recipe.from <= 8000, `${name}: frequência audível`);
        assert.ok(recipe.to >= 80 && recipe.to <= 8000, `${name}: frequência final`);
        assert.ok(recipe.duration > 0 && recipe.duration <= 0.5, `${name}: duração curta`);
        assert.ok(recipe.gain > 0 && recipe.gain <= 1, `${name}: ganho`);
        assert.ok(recipe.attack >= 0 && recipe.attack < recipe.duration, `${name}: ataque antes do fim`);
        assert.ok(Object.isFrozen(recipe), `${name}: receita imutável`);
    }
    assert.deepEqual(soundAssetCandidates('ui-click'), [
        'assets/sounds/ui-click.ogg',
        'assets/sounds/ui-click.wav',
    ]);
});

// --- contexto e volume --------------------------------------------------

test('sem AudioContext o sistema fica em silêncio sem lançar', () => {
    const warnings = [];
    const audio = createAudioSystem({
        AudioContextClass: null,
        warn: (...args) => warnings.push(args.join(' ')),
    });
    assert.equal(audio.available, false);
    assert.equal(audio.play('ui-click'), false);
    assert.equal(audio.ready, false);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /AudioContext/);
});

test('volume zero é mudo: não cria contexto nem toca', () => {
    const { audio, factory } = makeAudio({ volume: 0 });
    assert.equal(audio.play('ui-click'), false);
    assert.equal(factory.created.length, 0);
    assert.equal(audio.ready, false);
});

test('o contexto é criado uma vez e reaproveitado', () => {
    const { audio, factory } = makeAudio();
    assert.equal(audio.play('ui-click'), true);
    assert.equal(audio.play('ui-hover'), true);
    assert.equal(factory.created.length, 1);
    assert.equal(factory.context.gains.length, 3, 'master + um gain por som');
});

test('contexto suspenso é liberado no primeiro gesto', async () => {
    const { audio, factory } = makeAudio();
    const factorySuspended = makeFactory({ state: 'suspended' });
    const audio2 = createAudioSystem({
        AudioContextClass: factorySuspended.Factory,
        fetchImpl: makeFetch(),
        volume: 0.5,
        warn: silent,
    });
    audio2.play('ui-click');
    assert.equal(factorySuspended.context.state, 'suspended');
    assert.equal(await audio2.unlock(), true);
    assert.equal(factorySuspended.context.resumed, 1);
    assert.equal(audio2.ready, true);
    assert.equal(factory.created.length, 0, 'o outro sistema não criou contexto');
    assert.equal(audio.ready, false);
});

test('setVolume e setMuted controlam o ganho principal na hora', () => {
    const { audio, factory } = makeAudio({ volume: 0.4 });
    audio.play('ui-click');
    assert.equal(factory.context.gains[0].gain.value, 0.4);

    audio.setVolume(0.9);
    assert.equal(audio.volume, 0.9);
    assert.equal(factory.context.gains[0].gain.value, 0.9);

    audio.setVolume(5);
    assert.equal(audio.volume, 1, 'acima de 1 é preso em 1');

    audio.setMuted(true);
    assert.equal(factory.context.gains[0].gain.value, 0);
    assert.equal(audio.play('ui-click'), false, 'mudo não agenda som');

    audio.setMuted(false);
    assert.equal(factory.context.gains[0].gain.value, 1);
    audio.setVolume(Number.NaN);
    assert.equal(audio.volume, 1, 'valor inválido mantém o anterior');
});

// --- síntese e arquivos -------------------------------------------------

test('a síntese usa a receita: onda, frequência e envelope', () => {
    const { audio, factory } = makeAudio();
    const recipe = SOUND_RECIPES['ui-click'];
    audio.play('ui-click');
    const [oscillator] = factory.context.oscillators;
    assert.equal(oscillator.type, recipe.wave);
    assert.equal(oscillator.started.length, 1);
    assert.equal(oscillator.stopped.length, 1);
    assert.ok(oscillator.stopped[0] > oscillator.started[0], 'para depois de começar');

    const [frequency] = oscillator.frequency.events;
    assert.equal(frequency[0], 'set');
    assert.equal(frequency[1], recipe.from);
    const ramp = oscillator.frequency.events.at(-1);
    assert.equal(ramp[0], 'exp');
    assert.equal(ramp[1], recipe.to);

    const gainParam = oscillator.connections[0].gain;
    assert.equal(gainParam.events[0][1], 0.0001, 'começa no silêncio (sem clique)');
    assert.equal(gainParam.events.at(-1)[0], 'exp', 'decai exponencialmente');
});

test('som desconhecido não toca e avisa uma vez só', () => {
    const { audio, warnings } = makeAudio();
    assert.equal(audio.play('ui-explosao'), false);
    assert.equal(audio.play('ui-explosao'), false);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /ui-explosao/);
});

test('arquivo do jogador tem prioridade sobre a síntese', async () => {
    const fetchImpl = makeFetch();
    const factory = makeFactory();
    const audio = createAudioSystem({
        AudioContextClass: factory.Factory,
        fetchImpl,
        volume: 0.8,
        warn: silent,
    });
    audio.play('ui-click');
    assert.equal(factory.context.oscillators.length, 1, 'antes do arquivo: síntese');
    await audio.preload(['ui-click']);
    assert.equal(fetchImpl.calls[0], 'assets/sounds/ui-click.ogg', 'tenta ogg primeiro');

    audio.play('ui-click');
    assert.equal(factory.context.bufferSources.length, 1, 'depois do arquivo: buffer');
    assert.equal(factory.context.oscillators.length, 1, 'não somou outra síntese');
    assert.ok(factory.context.bufferSources[0].buffer?.decoded, 'buffer decodificado');
});

test('arquivo ausente cai na síntese e não é buscado de novo', async () => {
    const fetchImpl = makeFetch(() => false);
    const factory = makeFactory();
    const audio = createAudioSystem({
        AudioContextClass: factory.Factory,
        fetchImpl,
        volume: 0.8,
        warn: silent,
    });
    assert.equal(await audio.preload(['ui-click']), 0);
    assert.deepEqual(fetchImpl.calls, ['assets/sounds/ui-click.ogg', 'assets/sounds/ui-click.wav']);

    audio.play('ui-click');
    assert.equal(factory.context.oscillators.length, 1, 'usa a síntese');
    await audio.preload(['ui-click']);
    assert.equal(fetchImpl.calls.length, 2, 'não repete a busca depois de faltar');
});

test('fetch que lança não impede o som', async () => {
    const factory = makeFactory();
    const audio = createAudioSystem({
        AudioContextClass: factory.Factory,
        fetchImpl: async () => { throw new Error('rede fora'); },
        volume: 0.8,
        warn: silent,
    });
    assert.equal(await audio.preload(['ui-click']), 0);
    assert.equal(audio.play('ui-click'), true);
    assert.equal(factory.context.oscillators.length, 1);
});

test('sem fetch o som sai pela síntese direto', async () => {
    const factory = makeFactory();
    const audio = createAudioSystem({
        AudioContextClass: factory.Factory,
        fetchImpl: null,
        volume: 0.8,
        warn: silent,
    });
    assert.equal(await audio.preload(), 0);
    assert.equal(audio.play('ui-hover'), true);
});

test('dispose fecha o contexto e volta a ficar pronto para recriar', async () => {
    const { audio, factory } = makeAudio();
    audio.play('ui-click');
    audio.dispose();
    assert.equal(factory.context.closed, true);
    assert.equal(audio.ready, false);
    audio.play('ui-click');
    assert.equal(factory.created.length, 2, 'cria um contexto novo depois do dispose');
});

// --- delegação na interface --------------------------------------------

function makeDoc() {
    const listeners = new Map();
    return {
        addEventListener(type, handler, capture) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add({ handler, capture });
        },
        removeEventListener(type, handler) {
            for (const entry of listeners.get(type) ?? []) {
                if (entry.handler === handler) listeners.get(type).delete(entry);
            }
        },
        emit(type, event) {
            for (const { handler } of [...(listeners.get(type) ?? [])]) handler(event);
        },
        count(type) {
            return listeners.get(type)?.size ?? 0;
        },
    };
}

function makeButton({ disabled = false, ariaDisabled = null } = {}) {
    const button = {
        disabled,
        getAttribute: name => (name === 'aria-disabled' ? ariaDisabled : null),
        closest: selector => (selector.includes('button') ? button : null),
    };
    return button;
}

function recordingAudio() {
    const played = [];
    let unlocked = 0;
    return {
        played,
        get unlocked() { return unlocked; },
        play: name => { played.push(name); return true; },
        unlock: () => { unlocked++; return Promise.resolve(true); },
        setVolume: () => 0,
        setMuted: () => false,
    };
}

test('clique em botão toca o som e libera o áudio', () => {
    const doc = makeDoc();
    const audio = recordingAudio();
    const dispose = bindUiSounds(audio, doc, { now: () => 0 });

    doc.emit('pointerdown', { target: makeButton() });
    assert.deepEqual(audio.played, ['ui-click']);
    assert.equal(audio.unlocked, 1);

    doc.emit('pointerdown', { target: { closest: () => null } });
    assert.deepEqual(audio.played, ['ui-click'], 'clique fora de botão não toca');

    doc.emit('pointerdown', { target: makeButton({ disabled: true }) });
    doc.emit('pointerdown', { target: makeButton({ ariaDisabled: 'true' }) });
    assert.deepEqual(audio.played, ['ui-click'], 'botão desabilitado é ignorado');

    doc.emit('pointerdown', { button: 2, target: makeButton() });
    assert.deepEqual(audio.played, ['ui-click'], 'botão direito não é clique de UI');

    dispose();
    assert.equal(doc.count('pointerdown'), 0);
    doc.emit('pointerdown', { target: makeButton() });
    assert.deepEqual(audio.played, ['ui-click'], 'nada toca depois do dispose');
});

test('hover toca no máximo uma vez por elemento dentro do intervalo', () => {
    const doc = makeDoc();
    const audio = recordingAudio();
    let clock = 0;
    bindUiSounds(audio, doc, { now: () => clock, hoverThrottleMs: 60 });

    const first = makeButton();
    doc.emit('pointerover', { target: first });
    assert.deepEqual(audio.played, ['ui-hover']);

    clock = 10;
    doc.emit('pointerover', { target: first });
    assert.deepEqual(audio.played, ['ui-hover'], 'mesmo elemento não repete');

    const second = makeButton();
    doc.emit('pointerover', { target: second });
    assert.deepEqual(audio.played, ['ui-hover'], 'throttle por tempo segura a troca');

    clock = 100;
    doc.emit('pointerover', { target: second });
    assert.deepEqual(audio.played, ['ui-hover', 'ui-hover']);
});

test('teclado libera o áudio sem tocar nada', () => {
    const doc = makeDoc();
    const audio = recordingAudio();
    bindUiSounds(audio, doc);
    doc.emit('keydown', { key: 'Enter' });
    assert.equal(audio.unlocked, 1);
    assert.deepEqual(audio.played, []);
});

test('bindUiSounds sem documento devolve um dispose seguro', () => {
    const dispose = bindUiSounds(recordingAudio(), null);
    assert.equal(typeof dispose, 'function');
    assert.doesNotThrow(() => dispose());
});

// --- integração com o menu ---------------------------------------------

test('o menu cria o áudio com o volume salvo e a tela de opções aplica na hora', () => {
    const menu = readFileSync(new URL('../world-menu.js', import.meta.url), 'utf8');
    assert.match(menu, /createAudioSystem\(\{ volume: loadGameSettings\(\)\.volume \}\)/);
    assert.match(menu, /bindUiSounds\(uiAudio, document\)/);
    assert.match(menu, /onChange: settings => uiAudio\.setVolume\(settings\.volume\)/);

    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /id="opt-volume"/);
    assert.match(html, /id="opt-volume-value"/);
});
