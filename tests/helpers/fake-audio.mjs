// AudioContext de mentira para testar as camadas contínuas (vento, grilos,
// cachoeira) sem navegador.
//
// Cobre só o que `world-audio.js` usa ao montar um laço: criar ganho/filtro/
// fonte de buffer, `setTargetAtTime` (o fade) e o buffer gerado em JS. Os
// eventos de cada parâmetro ficam guardados para o teste conferir o alvo do
// fade, e não só o valor final.
import { createAudioSystem } from '../../world-audio.js';

export function makeParam(value = 0) {
    return {
        value,
        events: [],
        setValueAtTime(v, t) { this.events.push(['set', v, t]); this.value = v; return this; },
        linearRampToValueAtTime(v, t) { this.events.push(['linear', v, t]); return this; },
        exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); return this; },
        setTargetAtTime(v, t, constant) { this.events.push(['target', v, t, constant]); this.value = v; return this; },
    };
}

export function withConnect(node) {
    node.connections = [];
    node.connect = target => { node.connections.push(target); return target; };
    node.disconnect = () => {};
    return node;
}

export function makeFactory() {
    const created = [];
    const Factory = function () {
        const context = withConnect({
            state: 'running',
            currentTime: 0,
            sampleRate: 48000,
            destination: { name: 'destination' },
            sources: [],
            gains: [],
            filters: [],
        });
        context.resume = async () => { context.state = 'running'; };
        context.close = async () => { context.state = 'closed'; };
        context.createGain = () => { const node = withConnect({ gain: makeParam(1) }); context.gains.push(node); return node; };
        context.createBiquadFilter = () => {
            const node = withConnect({ type: 'lowpass', frequency: makeParam(350), Q: makeParam(1) });
            context.filters.push(node);
            return node;
        };
        context.createBufferSource = () => {
            const node = withConnect({
                buffer: null,
                loop: false,
                playbackRate: makeParam(1),
                started: [],
                start(t) { this.started.push(t); },
                stop(t) { this.stopped = (this.stopped ?? 0) + 1; this.stoppedAt = t; },
            });
            context.sources.push(node);
            return node;
        };
        context.createBuffer = (channels, length, rate) => {
            const data = new Float32Array(length);
            return { channels, length, sampleRate: rate, getChannelData: () => data, data };
        };
        context.decodeAudioData = (data, resolve) => { resolve?.({ data }); return Promise.resolve({ data }); };
        created.push(context);
        return context;
    };
    return { Factory, created, get context() { return created.at(-1); } };
}

/** Sistema de áudio ligado no contexto falso: `{ audio, factory, warnings }`. */
export function createFakeAudio() {
    const factory = makeFactory();
    const warnings = [];
    const audio = createAudioSystem({
        AudioContextClass: factory.Factory,
        fetchImpl: null,
        warn: (...args) => warnings.push(args.join(' ')),
    });
    return { audio, factory, warnings };
}

/** Último fade pedido a um parâmetro (`setTargetAtTime`). */
export const lastTarget = param => param.events.filter(event => event[0] === 'target').at(-1);
