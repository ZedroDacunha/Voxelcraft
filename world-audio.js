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

    function playTone(recipe, gainScale = 1) {
        const context = state.context;
        const when = context.currentTime ?? 0;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = recipe.wave;
        oscillator.frequency.setValueAtTime(recipe.from, when);
        if (recipe.to !== recipe.from) {
            oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, recipe.to), when + recipe.duration);
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

    function play(name, { gainScale = 1 } = {}) {
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
        if (assets.has(name)) {
            const buffer = assets.get(name);
            return buffer ? playBuffer(buffer) : playTone(recipe, gainScale);
        }
        // ainda não sabe se existe arquivo: toca a síntese agora e busca em
        // segundo plano, para o próximo clique já usar o arquivo
        if (!pending.has(name)) loadAsset(name).catch(() => {});
        return playTone(recipe, gainScale);
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
