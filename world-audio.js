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
    // Quebrar: ruído com baque grave embaixo. Material duro tem corte mais
    // brilhante e baque mais curto/seco; material macio é abafado e some devagar.
    'break-grass': Object.freeze({
        kind: 'noise', cut: 1500, cutTo: 600, q: 0.7, attack: 0.002, duration: 0.16, gain: 0.16,
        thump: Object.freeze({ from: 180, to: 90, duration: 0.11, gain: 0.10 }),
    }),
    'break-dirt': Object.freeze({
        kind: 'noise', cut: 1000, cutTo: 420, q: 0.8, attack: 0.002, duration: 0.15, gain: 0.17,
        thump: Object.freeze({ from: 160, to: 80, duration: 0.10, gain: 0.11 }),
    }),
    'break-stone': Object.freeze({
        kind: 'noise', cut: 3600, cutTo: 1200, q: 1.6, attack: 0.001, duration: 0.11, gain: 0.18,
        thump: Object.freeze({ from: 210, to: 110, duration: 0.08, gain: 0.13 }),
    }),
    'break-wood': Object.freeze({
        kind: 'noise', cut: 1700, cutTo: 700, q: 2.6, attack: 0.002, duration: 0.13, gain: 0.17,
        thump: Object.freeze({ from: 240, to: 120, duration: 0.10, gain: 0.10 }),
    }),
    'break-sand': Object.freeze({
        kind: 'noise', cut: 2400, cutTo: 1800, q: 0.4, attack: 0.004, duration: 0.18, gain: 0.14,
        thump: Object.freeze({ from: 140, to: 80, duration: 0.12, gain: 0.07 }),
    }),
    // Batida: cada golpe durante a mineração, antes do bloco cair. Mais curta e
    // mais discreta que o quebrar — é a percussão que segura o ritmo, não o
    // evento. Sem baque: o grave fica reservado para o impacto final.
    'hit-grass': Object.freeze({
        kind: 'noise', cut: 1600, cutTo: 900, q: 0.7, attack: 0.001, duration: 0.05, gain: 0.075,
    }),
    'hit-dirt': Object.freeze({
        kind: 'noise', cut: 1050, cutTo: 600, q: 0.8, attack: 0.001, duration: 0.05, gain: 0.08,
    }),
    'hit-stone': Object.freeze({
        kind: 'noise', cut: 3800, cutTo: 2200, q: 1.5, attack: 0.001, duration: 0.04, gain: 0.085,
        thump: Object.freeze({ from: 300, to: 220, duration: 0.03, gain: 0.03 }),
    }),
    'hit-wood': Object.freeze({
        kind: 'noise', cut: 1900, cutTo: 1100, q: 2.2, attack: 0.001, duration: 0.045, gain: 0.08,
        thump: Object.freeze({ from: 330, to: 240, duration: 0.03, gain: 0.025 }),
    }),
    'hit-sand': Object.freeze({
        kind: 'noise', cut: 2500, cutTo: 2000, q: 0.4, attack: 0.002, duration: 0.06, gain: 0.07,
    }),
    // Forno: acender (crepitar que abre), apagar (sopro de cinza) e o item que
    // ficou pronto (golpe curto, quase metálico). Sem laço enquanto queima.
    'furnace-light': Object.freeze({
        kind: 'noise', cut: 2400, cutTo: 700, q: 0.6, attack: 0.03, duration: 0.50, gain: 0.13,
        thump: Object.freeze({ from: 130, to: 85, duration: 0.28, gain: 0.05 }),
    }),
    'furnace-out': Object.freeze({
        kind: 'noise', cut: 900, cutTo: 260, q: 0.5, attack: 0.06, duration: 0.40, gain: 0.09,
    }),
    'furnace-done': Object.freeze({
        wave: 'triangle', from: 1180, to: 880, attack: 0.002, duration: 0.12, gain: 0.10,
    }),
    // Dano: impacto curto com gemido grave descendo. A morte é a mesma ideia
    // esticada — o corpo cai, o tom vai até o fundo do poço.
    'hurt': Object.freeze({
        kind: 'noise', cut: 900, cutTo: 300, q: 1.4, attack: 0.003, duration: 0.18, gain: 0.15,
        thump: Object.freeze({ from: 220, to: 110, duration: 0.16, gain: 0.14 }),
    }),
    'death': Object.freeze({
        kind: 'noise', cut: 700, cutTo: 180, q: 1.2, attack: 0.01, duration: 0.6, gain: 0.18,
        thump: Object.freeze({ from: 180, to: 55, duration: 0.55, gain: 0.16 }),
    }),
    // Mofim: chilreio. Dois trinados curtos e agudos (como inseto), com `repeat`
    // — um oscilador só não faz "tsi-tsi". Fica discreto porque o volume cai com
    // a distância (`gainScale` quem cuida disso no jogo).
    'mofim-chirp': Object.freeze({
        wave: 'sine', from: 1850, to: 2450, attack: 0.004, duration: 0.055, gain: 0.06,
        repeat: 2, gap: 0.085,
    }),
    // Água: entrar (splash com corpo grave), sair (curto, escorrendo),
    // submergir (abafado, grave) e a braçada (leve e curta).
    'water-splash': Object.freeze({
        kind: 'noise', cut: 2600, cutTo: 500, q: 0.5, attack: 0.002, duration: 0.22, gain: 0.16,
        thump: Object.freeze({ from: 150, to: 70, duration: 0.12, gain: 0.07 }),
    }),
    'water-exit': Object.freeze({
        kind: 'noise', cut: 1500, cutTo: 800, q: 0.6, attack: 0.006, duration: 0.16, gain: 0.10,
    }),
    'water-dive': Object.freeze({
        kind: 'noise', cut: 700, cutTo: 260, q: 1.2, attack: 0.03, duration: 0.30, gain: 0.10,
    }),
    'swim-stroke': Object.freeze({
        kind: 'noise', cut: 1200, cutTo: 620, q: 0.7, attack: 0.012, duration: 0.16, gain: 0.08,
    }),
    // Porta: rangido de dobradiça (ruído longo com ressonância) + batente de
    // madeira (baque). Abrir é mais lento e mais grave; fechar é um golpe seco.
    'door-open': Object.freeze({
        kind: 'noise', cut: 1100, cutTo: 420, q: 3.2, attack: 0.02, duration: 0.26, gain: 0.13,
        thump: Object.freeze({ from: 170, to: 105, duration: 0.09, gain: 0.07 }),
    }),
    'door-close': Object.freeze({
        kind: 'noise', cut: 900, cutTo: 380, q: 2.4, attack: 0.004, duration: 0.14, gain: 0.15,
        thump: Object.freeze({ from: 210, to: 115, duration: 0.08, gain: 0.12 }),
    }),
    // Colocar: seco, curto e mais agudo que quebrar — é o "assentar" do bloco.
    'place-grass': Object.freeze({
        kind: 'noise', cut: 1300, cutTo: 700, q: 0.8, attack: 0.002, duration: 0.07, gain: 0.11,
        thump: Object.freeze({ from: 210, to: 150, duration: 0.05, gain: 0.06 }),
    }),
    'place-dirt': Object.freeze({
        kind: 'noise', cut: 900, cutTo: 500, q: 0.9, attack: 0.002, duration: 0.07, gain: 0.12,
        thump: Object.freeze({ from: 200, to: 140, duration: 0.05, gain: 0.07 }),
    }),
    'place-stone': Object.freeze({
        kind: 'noise', cut: 3400, cutTo: 1600, q: 1.8, attack: 0.001, duration: 0.05, gain: 0.13,
        thump: Object.freeze({ from: 260, to: 190, duration: 0.04, gain: 0.08 }),
    }),
    'place-wood': Object.freeze({
        kind: 'noise', cut: 1500, cutTo: 650, q: 2.4, attack: 0.002, duration: 0.06, gain: 0.12,
        thump: Object.freeze({ from: 280, to: 180, duration: 0.05, gain: 0.07 }),
    }),
    'place-sand': Object.freeze({
        kind: 'noise', cut: 2500, cutTo: 2000, q: 0.4, attack: 0.004, duration: 0.08, gain: 0.10,
        thump: Object.freeze({ from: 180, to: 120, duration: 0.05, gain: 0.05 }),
    }),
});

export const SOUND_NAMES = Object.freeze(Object.keys(SOUND_RECIPES));
export const SOUND_ASSET_EXTENSIONS = Object.freeze(['ogg', 'wav']);
export const SOUND_ASSET_DIR = 'assets/sounds';
export const DEFAULT_SOUND_VOLUME = 0.7;

// Ambiente: as duas camadas contínuas do jogo. São laços de ruído gerados na
// hora (um por camada, para a página inteira) — nunca um som por quadro.
export const AMBIENT_LAYERS = Object.freeze(['wind', 'crickets']);
export const AMBIENT_RECIPES = Object.freeze({
    // vento: ruído grave filtrado, com corpo
    wind: Object.freeze({ gain: 0.055, cut: 480, q: 0.7, loopSeconds: 3 }),
    // grilos: chiado fino e estreito, quase no limite do audível
    crickets: Object.freeze({ gain: 0.042, cut: 4200, q: 8, loopSeconds: 4 }),
});
// Fade das camadas: entrar e sair de fase nunca é um degrau (o degrau estala).
export const AMBIENT_FADE_SECONDS = 0.9;

// Cachoeira: laço próprio, ligado só quando há água caindo perto (quem decide é
// world-waterfall.js). Mais grave e mais presente que o vento: é água batendo.
export const WATERFALL_RECIPE = Object.freeze({
    gain: 0.5, cut: 2600, q: 0.6, loopSeconds: 2.5,
});
// A cachoeira entra e sai mais devagar que o ambiente: o jogador pode estar
// andando na beirada do alcance, e um fade curto faria o som piscar.
export const WATERFALL_FADE_SECONDS = 1.1;

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
        // Baque grave: dá corpo ao impacto, que o ruído sozinho não tem.
        if (recipe.thump) {
            playTone({
                wave: 'sine',
                from: recipe.thump.from * rate,
                to: recipe.thump.to * rate,
                attack: 0.002,
                duration: recipe.thump.duration,
                gain: recipe.thump.gain,
            }, gainScale, 1);
        }
        return true;
    }

    // Receitas de som podem pedir repetição (`repeat: 2, gap: 0.085`): o mesmo
    // tom toca de novo depois do intervalo. É o que transforma um bip em trinado
    // sem precisar de amostra.
    function playTone(recipe, gainScale = 1, rate = 1) {
        const count = Math.max(1, Math.round(recipe.repeat ?? 1));
        const gap = recipe.gap ?? 0;
        for (let i = 0; i < count; i++) playToneOnce(recipe, gainScale, rate, i * gap);
        return true;
    }

    function playToneOnce(recipe, gainScale, rate, offset = 0) {
        const context = state.context;
        const when = (context.currentTime ?? 0) + offset;
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

    // --- ambiente -------------------------------------------------------
    // Um buffer por camada, gerado em JS: vento é ruído com grave acumulado,
    // grilos são pulsos curtos e agudos em ritmo irregular (ruído filtrado
    // soaria como chiado, não como inseto).
    const ambientBuffers = new WeakMap();

    // Receita de um laço contínuo: ambiente (vento/grilos) ou cachoeira.
    function loopRecipeFor(name) {
        return AMBIENT_RECIPES[name] ?? (name === 'waterfall' ? WATERFALL_RECIPE : null);
    }

    function ambientBufferFor(context, name) {
        let cache = ambientBuffers.get(context);
        if (!cache) { cache = new Map(); ambientBuffers.set(context, cache); }
        if (cache.has(name)) return cache.get(name);
        const recipe = loopRecipeFor(name) ?? AMBIENT_RECIPES.wind;
        const sampleRate = context.sampleRate ?? 44100;
        const length = Math.max(1, Math.floor(sampleRate * recipe.loopSeconds));
        const buffer = context.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        const twoPi = Math.PI * 2;
        if (name === 'waterfall') {
            // Água caindo: ruído com três pesos (grave = o volume de água,
            // médio = o corpo, agudo = o respingo), com uma ondulação lenta que
            // faz parecer caudal e não chuva. O fim do buffer é dobrado sobre o
            // começo para o laço não estalar na emenda.
            const twoPiLocal = Math.PI * 2;
            const fade = Math.max(1, Math.floor(sampleRate * 0.08));
            const scratch = new Float32Array(length + fade);
            let low = 0, mid = 0, high = 0;
            let peak = 0;
            for (let i = 0; i < scratch.length; i++) {
                const t = (i % length) / length;
                const noise = Math.random() * 2 - 1;
                low += 0.06 * (noise - low);
                mid += 0.22 * (noise - mid);
                high += 0.55 * (noise - high);
                const surge = 0.82 + 0.18 * Math.sin(twoPiLocal * t * 3) * Math.sin(twoPiLocal * t * 5);
                const value = (low * 1.8 + mid * 0.9 + high * 0.25) * surge;
                scratch[i] = value;
                if (Math.abs(value) > peak) peak = Math.abs(value);
            }
            const normalize = peak > 0 ? 0.9 / peak : 1;
            for (let i = 0; i < length; i++) data[i] = scratch[i] * normalize;
            for (let i = 0; i < fade; i++) {
                const k = i / fade;
                data[i] = (data[i] * k + scratch[length + i] * normalize * (1 - k));
            }
        } else if (name === 'crickets') {
            // sequência fixa de pulsos: curto, agudo, com silêncio entre eles.
            // O laço de 4 s cabe ~3 "chamados", o que soa orgânico sem repetir
            // rápido demais.
            const bursts = [0.05, 0.62, 0.9, 1.55, 2.3, 2.35, 2.4, 3.1];
            for (const start of bursts) {
                const begin = Math.floor(start * sampleRate);
                const chirp = Math.floor(sampleRate * 0.055);
                const freq = 4100 + (start % 0.3) * 900;
                for (let i = 0; i < chirp && begin + i < length; i++) {
                    const t = i / sampleRate;
                    const envelope = Math.sin(Math.PI * (i / chirp)) ** 2;
                    data[begin + i] += Math.sin(twoPi * freq * t) * envelope * 0.5;
                }
            }
        } else {
            // vento: ruído branco passado por um passa-baixa de um polo, com o
            // corte variando devagar (rajada) — o que dá a sensação de ar.
            let low = 0;
            for (let i = 0; i < length; i++) {
                const t = i / length;
                const gust = 0.55 + 0.45 * Math.sin(twoPi * t * 2) * Math.sin(twoPi * t);
                const cutoff = 0.02 + 0.02 * gust;
                low += cutoff * ((Math.random() * 2 - 1) - low);
                data[i] = low * (1.4 + gust * 1.2);
            }
        }
        cache.set(name, buffer);
        return buffer;
    }

    const ambientNodes = new Map();

    function ensureAmbientLayer(name) {
        const existing = ambientNodes.get(name);
        if (existing) return existing;
        const context = state.context;
        const recipe = loopRecipeFor(name);
        if (!context || !recipe) return null;
        const when = context.currentTime ?? 0;
        const source = context.createBufferSource();
        source.buffer = ambientBufferFor(context, name);
        source.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(recipe.cut, when);
        filter.Q?.setValueAtTime?.(recipe.q, when);
        const gain = context.createGain();
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(state.master);
        source.start(when);
        const layer = { source, filter, gain };
        ambientNodes.set(name, layer);
        return layer;
    }

    // Ganhos por camada (0 a 1). O volume final é o da receita vezes esse valor,
    // então quem decide a mixagem é o jogo, e o timbre é daqui.
    function setAmbientLevels(levels = {}) {
        const wanted = {};
        let total = 0;
        for (const name of AMBIENT_LAYERS) {
            const value = Number(levels?.[name]);
            wanted[name] = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
            total += wanted[name];
        }
        // nada para tocar e nada tocando: não cria AudioContext à toa (o
        // navegador só libera áudio depois de um gesto do jogador)
        if (total <= 0 && ambientNodes.size === 0) return false;
        if (!ensureContext()) return false;
        const context = state.context;
        const when = context.currentTime ?? 0;
        const ramp = Math.max(0.01, AMBIENT_FADE_SECONDS / 3);
        for (const name of AMBIENT_LAYERS) {
            const target = wanted[name] * (AMBIENT_RECIPES[name]?.gain ?? 0);
            const layer = target > 0 ? ensureAmbientLayer(name) : ambientNodes.get(name);
            if (!layer) continue;
            const param = layer.gain.gain;
            if (typeof param.setTargetAtTime === 'function') param.setTargetAtTime(target, when, ramp);
            else param.value = target;
        }
        return true;
    }

    /**
     * Ganho do laço da cachoeira (0 a 1, já pronto: quem calcula é
     * world-waterfall.js). Mesma máquina das camadas de ambiente — um nó só por
     * laço, fade em vez de degrau —, mas fora da mixagem do ambiente.
     */
    function setWaterfallLevel(level) {
        const value = Number(level);
        const wanted = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
        if (wanted <= 0 && !ambientNodes.has('waterfall')) return false;
        if (!ensureContext()) return false;
        const when = state.context.currentTime ?? 0;
        const ramp = Math.max(0.01, WATERFALL_FADE_SECONDS / 3);
        const layer = wanted > 0 ? ensureAmbientLayer('waterfall') : ambientNodes.get('waterfall');
        if (!layer) return false;
        const target = wanted * WATERFALL_RECIPE.gain;
        const param = layer.gain.gain;
        if (typeof param.setTargetAtTime === 'function') param.setTargetAtTime(target, when, ramp);
        else param.value = target;
        return true;
    }

    /** Para todos os laços contínuos (ambiente e cachoeira) e limpa o estado. */
    function stopAmbient() {
        for (const layer of ambientNodes.values()) {
            try {
                layer.gain.gain.value = 0;
                layer.source.stop?.(0);
            } catch {
                // já parado
            }
        }
        ambientNodes.clear();
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
        ambientNodes.clear();
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
        setAmbientLevels,
        setWaterfallLevel,
        stopAmbient,
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
