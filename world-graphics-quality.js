export const QUALITY_MODES = Object.freeze(['auto', 'max', 1, 0.75, 0.5]);

export function createWorldGraphicsQuality({ max, min = 0.5, notify = () => {} }) {
    const state = {
        auto: true,
        max: Math.max(min, max),
        min,
        scale: Math.max(min, max),
        slow: 0,
        fast: 0,
        lastFps: null,
        noGain: 0,
        pending: null,
    };
    let qualityIndex = 0;

    function setScale(value) {
        state.scale = Math.max(state.min, Math.min(state.max, value));
        state.pending = state.scale;
    }

    function adapt(fpsNow, cpuMs, isHidden = false) {
        if (!state.auto || isHidden || !Number.isFinite(fpsNow) || !Number.isFinite(cpuMs)) return;
        if (state.lastFps !== null) {
            state.noGain = fpsNow < state.lastFps * 1.1 ? state.noGain + 1 : 0;
            state.lastFps = null;
            if (state.noGain >= 3) {
                state.auto = false;
                setScale(state.max);
                notify('FPS não melhora com menos resolução: veja economia de energia / aceleração de hardware');
                return;
            }
        }

        const gpuBound = cpuMs < 0.6 * 1000 / Math.max(fpsNow, 1);
        if (fpsNow < 55 && state.scale > state.min && gpuBound) {
            state.fast = 0;
            if (++state.slow >= 3) {
                state.slow = 0;
                state.lastFps = fpsNow;
                setScale(state.scale - 0.15);
            }
        } else if (fpsNow >= 58 && state.scale < state.max) {
            state.slow = 0;
            if (++state.fast >= 8) {
                state.fast = 0;
                setScale(state.scale + 0.1);
            }
        } else {
            state.slow = 0;
            state.fast = 0;
        }
    }

    function cycle() {
        qualityIndex = (qualityIndex + 1) % QUALITY_MODES.length;
        const mode = QUALITY_MODES[qualityIndex];
        state.noGain = 0;
        state.lastFps = null;
        state.slow = 0;
        state.fast = 0;

        if (mode === 'auto') {
            state.auto = true;
            setScale(state.max);
            notify('Qualidade: automática');
            return;
        }

        state.auto = false;
        setScale(mode === 'max' ? state.max : mode);
        notify('Qualidade: ' + (mode === 'max' ? 'máxima' : Math.round(mode * 100) + '%'));
    }

    function consumePending() {
        const pending = state.pending;
        state.pending = null;
        return pending;
    }

    return {
        get auto() { return state.auto; },
        get scale() { return state.scale; },
        adapt,
        consumePending,
        cycle,
    };
}
