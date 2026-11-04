// Ambiente: vento e grilos, em fases.
//
// Todos os outros sons do jogo são **eventos** — algo acontece, dispara um som
// curto. Ambiente é o contrário: som contínuo. Disparar um som por quadro viraria
// metralhadora, e um laço ligado o tempo todo vira ruído de fundo que o jogador
// aprende a ignorar.
//
// Então o ambiente é **escasso de propósito**: ele alterna fases (silêncio,
// vento, grilos, os dois), cada uma com duração sorteada. O silêncio entre as
// fases é o que faz o vento voltar a ser audível, e os dois raramente coincidem —
// quando coincidem, é curtinho.
//
// Este módulo só decide *quanto* de cada camada; o áudio aplica com fade.

export const AMBIENT_LAYERS = Object.freeze(['wind', 'crickets']);

export const AMBIENT_MODES = Object.freeze(['silence', 'wind', 'crickets', 'both']);

// Faixas de duração (segundos) de cada fase.
export const AMBIENT_PHASE_SECONDS = Object.freeze({
    silence: Object.freeze([10, 22]),
    wind: Object.freeze([15, 32]),
    crickets: Object.freeze([12, 26]),
    both: Object.freeze([6, 12]),
});

// Peso de cada fase no sorteio. O silêncio e o vento dominam; "os dois" é a
// exceção que dá variedade sem transformar a trilha em parede de som.
export const AMBIENT_MODE_WEIGHTS = Object.freeze({
    silence: 0.34,
    wind: 0.34,
    crickets: 0.20,
    both: 0.12,
});

// Abaixo disso a camada não existe naquele lugar/hora (grilo de dia = 0).
export const AMBIENT_AVAILABILITY_FLOOR = 0.06;

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * Quanto de cada camada **pode** existir aqui e agora (0 a 1).
 *
 * - vento: existe em todo lugar, mais forte no alto (cume venta, vale não).
 * - grilos: só de noite e perto do nível do mar; em cima de uma montanha ou
 *   dentro de uma caverna funda não há grilo.
 */
export function ambientAvailability({ height = 64, night = false, seaLevel = 26 } = {}) {
    const y = Number(height);
    const altitude = Number.isFinite(y) ? y - seaLevel : 0;
    // 0,5 no nível do mar → 0,85 bem alto; nunca zero (o vento não desliga)
    const wind = clamp01(0.5 + clamp01(altitude / 60) * 0.35 + (night ? 0.05 : 0));
    // grilos: 1 no nível do mar, caindo até 0 a 18 blocos de distância dele
    const near = clamp01(1 - Math.abs(altitude) / 18);
    const crickets = night ? near * 0.9 : 0;
    return { wind, crickets };
}

/** Ganho de cada camada numa fase, já multiplicado pela disponibilidade. */
export function ambientLevelsFor(mode, availability = {}) {
    const wind = clamp01(Number(availability.wind) || 0);
    const crickets = clamp01(Number(availability.crickets) || 0);
    const wantsWind = mode === 'wind' || mode === 'both';
    const wantsCrickets = mode === 'crickets' || mode === 'both';
    return {
        wind: wantsWind ? wind : 0,
        crickets: wantsCrickets ? crickets : 0,
    };
}

/** Fases possíveis agora: sem grilo disponível, nem "grilos" nem "os dois". */
export function ambientModesFor(availability = {}) {
    const { wind, crickets } = ambientAvailabilityOf(availability);
    return AMBIENT_MODES.filter(mode => {
        if (mode === 'silence') return true;
        const wantsWind = mode === 'wind' || mode === 'both';
        const wantsCrickets = mode === 'crickets' || mode === 'both';
        if (wantsWind && wind < AMBIENT_AVAILABILITY_FLOOR) return false;
        if (wantsCrickets && crickets < AMBIENT_AVAILABILITY_FLOOR) return false;
        return true;
    });
}

function ambientAvailabilityOf(availability) {
    return {
        wind: clamp01(Number(availability?.wind) || 0),
        crickets: clamp01(Number(availability?.crickets) || 0),
    };
}

function randomBetween([min, max], random) {
    const r = Number(random());
    const t = Number.isFinite(r) ? clamp01(r) : 0.5;
    return min + (max - min) * t;
}

/** Duração sorteada de uma fase, em segundos. */
export function ambientPhaseSeconds(mode, random = Math.random) {
    const range = AMBIENT_PHASE_SECONDS[mode] ?? AMBIENT_PHASE_SECONDS.silence;
    return randomBetween(range, random);
}

/**
 * Sorteia a próxima fase, respeitando o que existe no lugar e na hora.
 *
 * `avoid` (a fase que acabou) sai do sorteio: silêncio seguido de silêncio soa
 * como se o áudio tivesse morrido, e vento atrás de vento parece um laço. Com a
 * repetição proibida, toda pausa é seguida de alguma camada — e é justamente o
 * contraste que faz o vento voltar a existir para quem está jogando.
 */
export function nextAmbientMode({ availability = {}, random = Math.random, avoid = null } = {}) {
    const all = ambientModesFor(availability);
    const modes = all.length > 1 ? all.filter(mode => mode !== avoid) : all;
    const weights = modes.map(mode => AMBIENT_MODE_WEIGHTS[mode] ?? 0);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (!(total > 0)) return 'silence';
    let ticket = clamp01(Number(random()) || 0) * total;
    for (let i = 0; i < modes.length; i++) {
        ticket -= weights[i];
        if (ticket < 0) return modes[i];
    }
    return modes[modes.length - 1];
}

/** Estado inicial: começa em silêncio, curto, para não entrar no mundo com som. */
export function createAmbientState() {
    return { mode: 'silence', remaining: 8 };
}

/**
 * Relógio do ambiente. Um passo por quadro, custo desprezível.
 *
 * Devolve os ganhos atuais e `changed` quando uma fase nova começou — o áudio
 * usa isso para fazer o fade só na troca.
 */
export function stepAmbient(state, dt, { availability = {}, random = Math.random } = {}) {
    const current = {
        mode: state.mode,
        remaining: state.remaining,
        ...ambientLevelsFor(state.mode, availability),
        changed: false,
    };
    if (!Number.isFinite(dt) || dt <= 0) return current;

    state.remaining -= dt;
    if (state.remaining > 0) {
        // o que existe mudou (amanheceu, o jogador cavou)? então a fase atual
        // pode ter ficado impossível — encurta para trocar logo
        const levels = ambientLevelsFor(state.mode, availability);
        if (state.mode !== 'silence' && levels.wind + levels.crickets <= 0) {
            state.remaining = 0;
        } else {
            return { mode: state.mode, remaining: state.remaining, ...levels, changed: false };
        }
    }

    const mode = nextAmbientMode({ availability, random, avoid: state.mode });
    state.mode = mode;
    state.remaining = ambientPhaseSeconds(mode, random);
    return {
        mode,
        remaining: state.remaining,
        ...ambientLevelsFor(mode, availability),
        changed: true,
    };
}
