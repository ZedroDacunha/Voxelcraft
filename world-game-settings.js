// Preferências do jogo (não do save): sensibilidade, campo de visão e
// distância de render. Ficam em localStorage e são lidas quando `game.js` é
// importado (ao entrar em um mundo). A tela de opções do menu grava aqui.
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
