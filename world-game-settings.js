// Preferências do jogo (não do save): sensibilidade, campo de visão, distância
// de render, volume, qualidade gráfica e resolução de renderização. Ficam em
// localStorage e são lidas quando `game.js` é importado (ao entrar em um mundo).
// A tela de opções — do menu e a do ESC durante o jogo — grava aqui.
import { RESOLUTION_AUTO, RESOLUTION_IDS, resolutionLabel } from './world-render-resolution.js';

export const GAME_SETTINGS_KEY = 'voxel-sandbox/game-settings/v1';

export const GAME_SETTING_FIELDS = Object.freeze({
    sensitivity: Object.freeze({
        min: 0.5, max: 2, step: 0.05, default: 1,
        format: value => `${Math.round(value * 100)}%`,
    }),
    fov: Object.freeze({
        min: 60, max: 100, step: 1, default: 75,
        format: value => `${Math.round(value)}°`,
    }),
    renderDistance: Object.freeze({
        min: 2, max: 6, step: 1, default: 4,
        format: value => `${Math.round(value)} chunks`,
    }),
    volume: Object.freeze({
        min: 0, max: 1, step: 0.05, default: 0.7,
        format: value => (value <= 0 ? 'mudo' : `${Math.round(value * 100)}%`),
    }),
    // Qualidade gráfica não é um número numa faixa: é uma lista de modos, do
    // automático à metade da resolução. Fica gravada como texto para o save
    // antigo continuar válido.
    graphics: Object.freeze({
        choices: Object.freeze(['auto', 'max', '0.75', '0.5']),
        labels: Object.freeze({ auto: 'Automática', max: 'Máxima', 0.75: 'Alta', 0.5: 'Média' }),
        default: 'auto',
        format: value => GAME_SETTING_FIELDS.graphics.labels[value] ?? 'Automática',
    }),
    // Resolução de renderização: quantos pixels o jogo desenha antes de a
    // imagem ser esticada para a tela (ver world-render-resolution.js). É uma
    // lista, mas com `slider`: vinte resoluções em degraus pedem barra, não
    // vinte cliques. `Janela (nativa)` é o comportamento de antes.
    resolution: Object.freeze({
        choices: RESOLUTION_IDS,
        slider: true,
        default: RESOLUTION_AUTO,
        format: value => resolutionLabel(value),
    }),
    // Toque: de que lado ficam joystick e botões (canhoto troca tudo de lado) e
    // o tamanho dos controles. Valem só no modo toque; no desktop não há o que
    // mudar, mas a preferência fica guardada para o celular.
    touchLayout: Object.freeze({
        choices: Object.freeze(['right', 'left']),
        labels: Object.freeze({ right: 'Destro', left: 'Canhoto' }),
        default: 'right',
        format: value => GAME_SETTING_FIELDS.touchLayout.labels[value] ?? 'Destro',
    }),
    touchButtonSize: Object.freeze({
        min: 0.8, max: 1.4, step: 0.1, default: 1,
        format: value => `${Math.round(value * 100)}%`,
    }),
    // Vibração do toque: o celular confirma quebrar/cavar, colocar, passo, dano
    // e botão apertado. Lista de dois modos, porque é liga/desliga.
    touchVibration: Object.freeze({
        choices: Object.freeze(['on', 'off']),
        labels: Object.freeze({ on: 'Ligada', off: 'Desligada' }),
        default: 'on',
        format: value => GAME_SETTING_FIELDS.touchVibration.labels[value] ?? 'Ligada',
    }),
    // Quanto o dedo gira por pixel arrastado. É uma barra própria, separada da
    // do mouse: o gesto é outro (dedo na tela contra mouse com pointer lock) e
    // quem joga nos dois não pode ficar refém de uma barra só. 80% de fábrica
    // porque o giro antigo era um pouco nervoso no celular.
    touchSensitivity: Object.freeze({
        min: 0.5, max: 2, step: 0.05, default: 0.8,
        format: value => `${Math.round(value * 100)}%`,
    }),
});

export const DEFAULT_GAME_SETTINGS = Object.freeze(Object.fromEntries(
    Object.entries(GAME_SETTING_FIELDS).map(([key, field]) => [key, field.default]),
));

// Aceita qualquer coisa vinda do storage (JSON antigo, string, número fora da
// faixa) e devolve um objeto completo e válido.
export function sanitizeGameSettings(raw = {}) {
    const clean = { ...DEFAULT_GAME_SETTINGS };
    if (!raw || typeof raw !== 'object') return clean;
    for (const [key, field] of Object.entries(GAME_SETTING_FIELDS)) {
        if (field.choices) {
            clean[key] = field.choices.includes(raw[key]) ? raw[key] : field.default;
            continue;
        }
        const value = Number(raw[key]);
        if (!Number.isFinite(value)) continue;
        const stepped = Math.round((value - field.min) / field.step) * field.step + field.min;
        const clamped = Math.min(field.max, Math.max(field.min, stepped));
        // evita 0.30000000000000004 depois do arredondamento no passo
        clean[key] = Number(clamped.toFixed(4));
    }
    return clean;
}

function defaultStorage() {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        // navegador com storage bloqueado (modo privado, iframe restrito)
        return null;
    }
}

export function loadGameSettings(storage = defaultStorage()) {
    try {
        const raw = storage?.getItem(GAME_SETTINGS_KEY);
        return sanitizeGameSettings(raw ? JSON.parse(raw) : {});
    } catch {
        return { ...DEFAULT_GAME_SETTINGS };
    }
}

export function saveGameSettings(settings, storage = defaultStorage()) {
    const clean = sanitizeGameSettings(settings);
    try {
        storage?.setItem(GAME_SETTINGS_KEY, JSON.stringify(clean));
    } catch {
        // quota cheia ou storage bloqueado: vale só para esta sessão
    }
    return clean;
}

// ------------------------------------------------------------------
// Valores da tela de opções
//
// Cada opção é uma barra que mostra "Rótulo: valor". Quem desenha pergunta
// estas funções puras: onde está o valor na barra (0 a 1), qual valor cai em
// cada ponto, qual é o próximo e como escrever. Assim a regra de cada campo
// (passo, faixa, lista) fica num lugar só e dá para testar sem DOM.
// ------------------------------------------------------------------

function clampField(field, value) {
    const stepped = Math.round((value - field.min) / field.step) * field.step + field.min;
    const clamped = Math.min(field.max, Math.max(field.min, stepped));
    return Number(clamped.toFixed(4));
}

/** Texto do valor, do jeito que aparece na tela ("75°", "Automática"). */
export function formatSetting(key, value = DEFAULT_GAME_SETTINGS[key]) {
    const field = GAME_SETTING_FIELDS[key];
    return field ? field.format(value) : String(value);
}

/**
 * Posição do valor na barra, de 0 (mínimo) a 1 (máximo). Campo de lista usa a
 * posição na lista — `graphics` com 4 modos tem 0, 1/3, 2/3 e 1.
 */
export function settingFraction(key, value) {
    const field = GAME_SETTING_FIELDS[key];
    if (!field) return 0;
    if (field.choices) {
        const index = field.choices.indexOf(value);
        if (index < 0) return 0;
        return field.choices.length > 1 ? index / (field.choices.length - 1) : 0;
    }
    const span = field.max - field.min;
    if (!(span > 0)) return 0;
    return Math.min(1, Math.max(0, (Number(value) - field.min) / span));
}

/**
 * Valor que cai num ponto da barra — é o que o clique e o arraste usam. O ponto
 * é arredondado no passo do campo, então a barra nunca gera valor "quebrado".
 */
export function settingFromFraction(key, fraction) {
    const field = GAME_SETTING_FIELDS[key];
    if (!field) return undefined;
    const t = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
    if (field.choices) return field.choices[Math.round(t * (field.choices.length - 1))];
    return clampField(field, field.min + t * (field.max - field.min));
}

/**
 * Passo a passo (seta do teclado, clique curto): anda `direction` casas. Nos
 * campos numéricos para no limite — quem quer o outro extremo arrasta ou usa
 * Home/End. Nas listas de clique dá a volta, porque são poucos modos e voltar ao
 * começo é o que se espera de um botão que cicla; nas listas com barra
 * (`slider`, como a resolução) para no limite, igual a um campo numérico.
 */
export function stepSetting(key, value, direction = 1) {
    const field = GAME_SETTING_FIELDS[key];
    if (!field) return value;
    const dir = direction < 0 ? -1 : 1;
    if (field.choices) {
        const total = field.choices.length;
        const index = field.choices.indexOf(value);
        const from = index < 0 ? 0 : index;
        if (field.slider) return field.choices[Math.max(0, Math.min(total - 1, from + dir))];
        return field.choices[((from + dir) % total + total) % total];
    }
    return clampField(field, Number(value) + field.step * dir);
}

// ------------------------------------------------------------------
// Aviso de mudança
//
// O menu grava as opções; o jogo (FOV, sensibilidade, volume, qualidade) e o
// áudio da interface precisam saber na hora. Em vez de cada tela conhecer a
// outra, quem grava avisa e quem quer saber assina.
// ------------------------------------------------------------------

const changeListeners = new Set();

/** Assina as mudanças de opções. Devolve a função que cancela a assinatura. */
export function onGameSettingsChange(listener) {
    if (typeof listener !== 'function') return () => {};
    changeListeners.add(listener);
    return () => { changeListeners.delete(listener); };
}

/** Avisa os assinantes. Um ouvinte com erro não derruba os outros. */
export function notifyGameSettingsChange(settings) {
    for (const listener of [...changeListeners]) {
        try {
            listener(settings);
        } catch {
            // uma tela quebrada não pode travar a mudança de volume
        }
    }
}
