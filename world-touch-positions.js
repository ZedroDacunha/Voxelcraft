// Posição livre dos controles de toque: cada peça guarda um deslocamento em
// relação ao lugar natural dela no layout (joystick, Pular, Cavar, Usar,
// Agachar, Mochila, Pausar).
//
// Deslocamento e não coordenada absoluta, de propósito: assim o layout de
// fábrica continua sendo o do CSS (grade, canto, destro/canhoto, tamanho), e a
// posição livre só empurra a peça dali. Quem nunca arrastou nada tem tudo em
// zero e nada muda; quem arrastou vê o resultado somado ao layout escolhido.
//
// A unidade gravada é **porcentagem da tela**, não pixel: o mesmo "Pular um
// pouco acima do canto" vale no celular pequeno e no tablet, e girar o aparelho
// não joga os botões para fora.
//
// Este módulo é só a matemática e o storage — nada de DOM, para poder testar
// sem navegador.

export const TOUCH_POSITIONS_KEY = 'voxel-sandbox/touch-positions/v1';

// A tela de opções (que vive no menu) e o jogo (que vive no mundo) são módulos
// separados: eles se falam por evento no documento, e não por import cruzado.
export const TOUCH_EDIT_EVENT = 'touch-edit-positions';
export const TOUCH_RESET_EVENT = 'touch-positions-reset';

// Ordem estável: é ela que o jogo percorre ao aplicar e o teste confere.
export const TOUCH_PIECES = Object.freeze(['stick', 'crouch', 'use', 'break', 'jump', 'inventory', 'pause']);

// Trava dura do que pode ser gravado, em % da tela. O limite de verdade é o
// clamp com o tamanho da peça (a peça não sai da tela); este só impede que um
// storage adulterado guarde um deslocamento absurdo. 120% porque a peça pode
// atravessar a tela: do canto direito para o esquerdo dá quase -90% da largura.
export const TOUCH_OFFSET_LIMIT = 120;

export const TOUCH_EDIT_MARGIN = 6;

export function emptyTouchPositions() {
    return Object.fromEntries(TOUCH_PIECES.map(piece => [piece, { x: 0, y: 0 }]));
}

function clampPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(-TOUCH_OFFSET_LIMIT, Math.min(TOUCH_OFFSET_LIMIT, number));
}

/**
 * Aceita qualquer coisa vinda do storage e devolve sempre as sete peças, com
 * números válidos. Peça desconhecida é descartada (não vira lixo acumulado) e
 * valor quebrado volta para zero.
 */
export function sanitizeTouchPositions(raw = {}) {
    const clean = emptyTouchPositions();
    if (!raw || typeof raw !== 'object') return clean;
    for (const piece of TOUCH_PIECES) {
        const value = raw[piece];
        if (!value || typeof value !== 'object') continue;
        clean[piece] = { x: clampPercent(value.x), y: clampPercent(value.y) };
    }
    return clean;
}

/** Alguma peça saiu do lugar natural? (usado para não anunciar "livre" à toa) */
export function hasCustomPositions(positions, { tolerance = 0.5 } = {}) {
    const clean = sanitizeTouchPositions(positions);
    return TOUCH_PIECES.some(piece => Math.abs(clean[piece].x) > tolerance || Math.abs(clean[piece].y) > tolerance);
}

function defaultStorage() {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}

export function loadTouchPositions(storage = defaultStorage()) {
    try {
        const raw = storage?.getItem(TOUCH_POSITIONS_KEY);
        return sanitizeTouchPositions(raw ? JSON.parse(raw) : {});
    } catch {
        return emptyTouchPositions();
    }
}

export function saveTouchPositions(positions, storage = defaultStorage()) {
    const clean = sanitizeTouchPositions(positions);
    try {
        storage?.setItem(TOUCH_POSITIONS_KEY, JSON.stringify(clean));
    } catch {
        // storage bloqueado (modo privado/iframe): a posição vale só nesta sessão
    }
    return clean;
}

/** Apaga o que foi arrastado: tudo volta ao lugar de fábrica. */
export function resetTouchPositions(storage = defaultStorage()) {
    try {
        storage?.removeItem(TOUCH_POSITIONS_KEY);
    } catch {
        // idem
    }
    return emptyTouchPositions();
}

/** % da tela → pixel (é o que o CSS recebe em `--touch-dx/--touch-dy`). */
export function offsetPixels(position, { width = 0, height = 0 } = {}) {
    const w = Number(width) > 0 ? Number(width) : 0;
    const h = Number(height) > 0 ? Number(height) : 0;
    return { x: (clampPercent(position?.x) / 100) * w, y: (clampPercent(position?.y) / 100) * h };
}

/** Pixel → % da tela (é o que vai para o storage). */
export function offsetPercent(pixels, { width = 0, height = 0 } = {}) {
    const x = Number(pixels?.x);
    const y = Number(pixels?.y);
    const w = Number(width) > 0 ? Number(width) : 0;
    const h = Number(height) > 0 ? Number(height) : 0;
    return {
        x: w > 0 && Number.isFinite(x) ? clampPercent((x / w) * 100) : 0,
        y: h > 0 && Number.isFinite(y) ? clampPercent((y / h) * 100) : 0,
    };
}

/**
 * Prende o deslocamento para a peça não sair da tela.
 *
 * `naturalLeft/naturalTop` é onde a peça ficaria **sem** deslocamento (o retângulo
 * medido menos o deslocamento atual). A margem existe para a peça não encostar na
 * borda, onde o dedo não pega.
 */
export function clampOffsetPx({
    naturalLeft = 0, naturalTop = 0, width = 0, height = 0,
    offsetX = 0, offsetY = 0, viewportWidth = 0, viewportHeight = 0,
    margin = TOUCH_EDIT_MARGIN,
} = {}) {
    const w = Math.max(0, Number(width) || 0);
    const h = Math.max(0, Number(height) || 0);
    const vw = Math.max(0, Number(viewportWidth) || 0);
    const vh = Math.max(0, Number(viewportHeight) || 0);
    const gap = Math.max(0, Number(margin) || 0);
    const minX = gap - (Number(naturalLeft) || 0);
    const maxX = vw - gap - (Number(naturalLeft) || 0) - w;
    const minY = gap - (Number(naturalTop) || 0);
    const maxY = vh - gap - (Number(naturalTop) || 0) - h;
    const clamp = (value, min, max) => {
        const number = Number(value) || 0;
        if (max < min) return min; // peça maior que a tela: cola no mínimo
        return Math.max(min, Math.min(max, number));
    };
    return {
        x: clamp(offsetX, minX, maxX),
        y: clamp(offsetY, minY, maxY),
    };
}
