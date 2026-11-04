// Áudio da interface.
//
// O jogo não versiona arquivos de som: cada efeito é **sintetizado** com
// WebAudio a partir de uma receita (onda, frequência, envelope). Se existir um
// arquivo em `assets/sounds/<nome>.ogg` (ou `.wav`), ele tem prioridade — dá
// para trocar um som por vez, sem mexer em código: basta copiar o arquivo com o
// nome certo.
//
// Tudo é injetável (AudioContext, fetch, document, relógio) para o módulo
// funcionar nos testes sem navegador.

export const SOUND_RECIPES = Object.freeze({
    // clique seco, curto, um pouco mais grave no fim
    'ui-click': Object.freeze({
        wave: 'triangle', from: 640, to: 420, attack: 0.004, duration: 0.08, gain: 0.22,
    }),
    // passada de mouse: bem discreta, só para dar textura
    'ui-hover': Object.freeze({
        wave: 'sine', from: 940, to: 900, attack: 0.004, duration: 0.035, gain: 0.06,
    }),
    // Passos: ruído curto com filtro passa-baixa. O material muda o corte e a
    // duração — grama é abafada e curta, pedra é brilhante e seca, areia é
    // ruído puro, madeira tem ressonância (Q alto).
    'step-grass': Object.freeze({
        kind: 'noise', cut: 1900, cutTo: 800, q: 0.7, attack: 0.005, duration: 0.09, gain: 0.09,
    }),
    'step-dirt': Object.freeze({
        kind: 'noise', cut: 1150, cutTo: 520, q: 0.8, attack: 0.005, duration: 0.10, gain: 0.10,
    }),
    'step-stone': Object.freeze({
        kind: 'noise', cut: 3200, cutTo: 1500, q: 1.2, attack: 0.003, duration: 0.07, gain: 0.085,
    }),
    'step-wood': Object.freeze({
        kind: 'noise', cut: 950, cutTo: 480, q: 2.4, attack: 0.004, duration: 0.09, gain: 0.10,
    }),
    'step-sand': Object.freeze({
        kind: 'noise', cut: 2600, cutTo: 2300, q: 0.4, attack: 0.009, duration: 0.12, gain: 0.075,
    }),
});

export const SOUND_NAMES = Object.freeze(Object.keys(SOUND_RECIPES));
export const SOUND_ASSET_EXTENSIONS = Object.freeze(['ogg', 'wav']);
export const SOUND_ASSET_DIR = 'assets/sounds';
export const DEFAULT_SOUND_VOLUME = 0.7;

export function soundAssetCandidates(name) {
    return SOUND_ASSET_EXTENSIONS.map(ext => `${SOUND_ASSET_DIR}/${name}.${ext}`);
}

function clampVolume(value, fallback = DEFAULT_SOUND_VOLUME) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(1, Math.max(0, number));
}

export function createAudioSystem({
    AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null,
    fetchImpl = typeof fetch === 'function' ? (...args) => fetch(...args) : null,
    volume = DEFAULT_SOUND_VOLUME,
    warn = (...args) => console.warn(...args),
} = {}) {
    const state = {
        context: null,
        master: null,
        volume: clampVolume(volume),
        muted: false,
        failed: false,
    };
    // nome -> AudioBuffer (arquivo do jogador) ou null (não existe: síntese)
    const assets = new Map();
    // nome -> Promise em andamento, para dois pedidos não baixarem o mesmo som
    const pending = new Map();
    const noiseCache = new WeakMap();
    const warned = new Set();

    const effectiveVolume = () => (state.muted ? 0 : state.volume);

    function ensureContext() {
        if (state.context || state.failed) return state.context;
        if (!AudioContextClass) {
            state.failed = true;
            warn('Áudio indisponível: este navegador não expõe AudioContext.');
            return null;
        }
        try {
            state.context = new AudioContextClass();
            state.master = state.context.createGain();
            state.master.gain.value = effectiveVolume();
            state.master.connect(state.context.destination);
        } catch (error) {
            state.failed = true;
            warn('Falha ao criar o contexto de áudio:', error);
            return null;
        }
        return state.context;
    }

    async function unlock() {
        const context = ensureContext();
        if (!context) return false;
        if (context.state === 'suspended' && typeof context.resume === 'function') {
            try {
                await context.resume();
            } catch (error) {
                warn('Falha ao liberar o áudio:', error);
                return false;
            }
        }
        return true;
    }

    function playBuffer(buffer) {
        const context = state.context;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(state.master);
        source.start(0);
        return true;
    }

    // Ruído branco reaproveitado: um buffer por contexto, filtrado a cada passo.
    function noiseBufferFor(context) {
        let buffer = noiseCache.get(context);
        if (buffer && buffer.length) return buffer;
        const sampleRate = context.sampleRate ?? 44100;
        const length = Math.max(1, Math.floor(sampleRate * 0.5));
        buffer = context.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        noiseCache.set(context, buffer);
        return buffer;
    }

    function playNoise(recipe, gainScale = 1, rate = 1) {
        const context = state.context;
        const when = context.currentTime ?? 0;
        const source = context.createBufferSource();
        source.buffer = noiseBufferFor(context);
        const rateParam = source.playbackRate;
        if (rateParam) {
            if (typeof rateParam.setValueAtTime === 'function') rateParam.setValueAtTime(rate, when);
            else rateParam.value = rate;
        }
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(recipe.cut * rate, when);
        if (recipe.cutTo) {
            filter.frequency.exponentialRampToValueAtTime(
                Math.max(60, recipe.cutTo * rate), when + recipe.duration);
        }
        filter.Q?.setValueAtTime?.(recipe.q ?? 1, when);
        const gain = context.createGain();
        const peak = Math.max(0.0001, recipe.gain * gainScale);
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.linearRampToValueAtTime(peak, when + recipe.attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + recipe.duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(state.master);
        source.start(when);
        source.stop(when + recipe.duration + 0.02);
        return true;
    }

    function playTone(recipe, gainScale = 1, rate = 1) {
        const context = state.context;
        const when = context.currentTime ?? 0;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = recipe.wave;
        oscillator.frequency.setValueAtTime(recipe.from * rate, when);
        if (recipe.to !== recipe.from) {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(20, recipe.to * rate), when + recipe.duration);
        }
        const peak = Math.max(0.0001, recipe.gain * gainScale);
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.linearRampToValueAtTime(peak, when + recipe.attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + recipe.duration);
        oscillator.connect(gain);
        gain.connect(state.master);
        oscillator.start(when);
        oscillator.stop(when + recipe.duration + 0.02);
        return true;
    }

    function loadAsset(name) {
        if (assets.has(name)) return Promise.resolve(assets.get(name));
        if (pending.has(name)) return pending.get(name);
        // sem fetch ou sem contexto: a síntese resolve e nada é cacheado
        if (!fetchImpl || !state.context) return Promise.resolve(null);
        const task = (async () => {
            for (const url of soundAssetCandidates(name)) {
                try {
                    const response = await fetchImpl(url);
                    if (!response || !response.ok) continue;
                    const data = await response.arrayBuffer();
                    const buffer = await new Promise((resolve, reject) => {
                        const result = state.context.decodeAudioData(data, resolve, reject);
                        if (result && typeof result.then === 'function') result.then(resolve, reject);
                    });
                    if (buffer) {
                        assets.set(name, buffer);
                        return buffer;
                    }
                } catch {
                    // arquivo ausente ou inválido: tenta a próxima extensão
                }
            }
            assets.set(name, null); // não existe: não busca de novo
            return null;
        })().finally(() => pending.delete(name));
        pending.set(name, task);
        return task;
    }

    function play(name, { gainScale = 1, rate = 1 } = {}) {
        const recipe = SOUND_RECIPES[name];
        if (!recipe) {
            if (!warned.has(name)) {
                warned.add(name);
                warn(`Som desconhecido: ${name}`);
            }
            return false;
        }
        if (effectiveVolume() <= 0) return false;
        if (!ensureContext()) return false;
        const synth = recipe.kind === 'noise'
            ? () => playNoise(recipe, gainScale, rate)
            : () => playTone(recipe, gainScale, rate);
        if (assets.has(name)) {
            const buffer = assets.get(name);
            return buffer ? playBuffer(buffer) : synth();
        }
        // ainda não sabe se existe arquivo: toca a síntese agora e busca em
        // segundo plano, para o próximo som já usar o arquivo
        if (!pending.has(name)) loadAsset(name).catch(() => {});
        return synth();
    }

    function setVolume(value) {
        state.volume = clampVolume(value, state.volume);
        if (state.master) state.master.gain.value = effectiveVolume();
        return state.volume;
    }

    function setMuted(value) {
        state.muted = Boolean(value);
        if (state.master) state.master.gain.value = effectiveVolume();
        return state.muted;
    }

    async function preload(names = SOUND_NAMES) {
        if (!ensureContext()) return 0;
        let ready = 0;
        for (const name of names) {
            const buffer = await loadAsset(name);
            if (buffer) ready++;
        }
        return ready;
    }

    function dispose() {
        try {
            state.context?.close?.();
        } catch {
            // nada a fazer: contexto já fechado
        }
        state.context = null;
        state.master = null;
        assets.clear();
        pending.clear();
    }

    return {
        get volume() { return state.volume; },
        get muted() { return state.muted; },
        get ready() { return Boolean(state.context); },
        get available() { return Boolean(AudioContextClass); },
        play,
        preload,
        setMuted,
        setVolume,
        unlock,
        dispose,
    };
}

// Um único sistema de áudio para o jogo inteiro: o menu cria (com o volume
// salvo) e o jogo reaproveita. Sem isso cada módulo abriria um AudioContext.
let sharedAudio = null;
export function getSharedAudio(options = {}) {
    if (!sharedAudio) sharedAudio = createAudioSystem(options);
    return sharedAudio;
}

// Elementos que "clicam": botões de menu, inventário, diálogos.
export const UI_SOUND_SELECTOR = 'button, [role="button"], [role="menuitem"]';
export const UI_SOUND_HOVER_THROTTLE_MS = 60;

// Delegação no documento: um único listener cobre menu, diálogos e inventário
// sem cada módulo precisar conhecer o áudio.
export function bindUiSounds(audio, doc, {
    selector = UI_SOUND_SELECTOR,
    hoverThrottleMs = UI_SOUND_HOVER_THROTTLE_MS,
    now = () => Date.now(),
    clickSound = 'ui-click',
    hoverSound = 'ui-hover',
} = {}) {
    if (!audio || !doc?.addEventListener) return () => {};

    let lastHover = null;
    let lastHoverAt = -Infinity;

    const targetOf = event => {
        const target = event?.target;
        const closest = target?.closest;
        return typeof closest === 'function' ? closest.call(target, selector) : null;
    };

    const isDisabled = el => Boolean(el?.disabled) || el?.getAttribute?.('aria-disabled') === 'true';

    const onClick = event => {
        if (typeof event?.button === 'number' && event.button > 0) return;
        const el = targetOf(event);
        if (!el || isDisabled(el)) return;
        audio.unlock();
        audio.play(clickSound);
    };

    const onHover = event => {
        const el = targetOf(event);
        if (!el || isDisabled(el) || el === lastHover) return;
        const at = now();
        if (at - lastHoverAt < hoverThrottleMs) return;
        lastHover = el;
        lastHoverAt = at;
        audio.play(hoverSound);
    };

    const onKeyDown = () => { audio.unlock(); };

    doc.addEventListener('pointerdown', onClick, true);
    doc.addEventListener('pointerover', onHover, true);
    doc.addEventListener('keydown', onKeyDown, true);

    return () => {
        doc.removeEventListener('pointerdown', onClick, true);
        doc.removeEventListener('pointerover', onHover, true);
        doc.removeEventListener('keydown', onKeyDown, true);
    };
}
