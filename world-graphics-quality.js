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
                notify('Escala mantida: FPS não melhorou com menos resolução; verifique aceleração gráfica');
                return;
            }
        }

        const gpuBound = cpuMs < 0.6 * 1000 / Math.max(fpsNow, 1);
        if (fpsNow < 55 && state.scale > state.min && gpuBound) {
            state.fast = 0;
            if (++state.slow >= 2) {
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

    // Aplica um modo já escolhido. `cycle()` e a tela de opções chegam aqui
    // pelo mesmo caminho, senão as duas formas de trocar qualidade podiam
    // divergir (uma zerando o histórico de FPS e a outra não).
    function applyMode(mode, quiet = false) {
        state.noGain = 0;
        state.lastFps = null;
        state.slow = 0;
        state.fast = 0;

        if (mode === 'auto') {
            state.auto = true;
            setScale(state.max);
            if (!quiet) notify('Qualidade: automática');
            return;
        }

        state.auto = false;
        setScale(mode === 'max' ? state.max : mode);
        if (!quiet) notify('Qualidade: ' + (mode === 'max' ? 'máxima' : Math.round(mode * 100) + '%'));
    }

    function cycle() {
        qualityIndex = (qualityIndex + 1) % QUALITY_MODES.length;
        applyMode(QUALITY_MODES[qualityIndex]);
        return QUALITY_MODES[qualityIndex];
    }

    // Escolha direta (tela de opções). Modo desconhecido é ignorado: quem
    // chama decide o que fazer no lugar. `quiet` é para o valor já salvo ser
    // aplicado ao entrar no mundo sem avisar o que o jogador não mudou agora.
    function setMode(mode, { quiet = false } = {}) {
        const index = QUALITY_MODES.indexOf(mode);
        if (index < 0) return false;
        qualityIndex = index;
        applyMode(mode, quiet);
        return true;
    }

    function consumePending() {
        const pending = state.pending;
        state.pending = null;
        return pending;
    }

    return {
        get auto() { return state.auto; },
        get scale() { return state.scale; },
        get mode() { return QUALITY_MODES[qualityIndex]; },
        adapt,
        consumePending,
        cycle,
        setMode,
    };
}
