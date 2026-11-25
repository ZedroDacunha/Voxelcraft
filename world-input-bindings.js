/**
 * Controles rebindáveis do teclado.
 *
 * A primeira parte do rebind é só o modelo: quais ações existem, qual tecla
 * padrão cada uma usa, como salvar/carregar do storage e como mostrar o nome da
 * tecla na UI. A ligação com o game.js vem em etapas seguintes.
 */
export const INPUT_BINDINGS_KEY = 'voxel-sandbox/input-bindings/v1';

export const BINDING_ACTIONS = Object.freeze([
    Object.freeze({ id: 'forward', label: 'Andar para frente', category: 'Movimento', defaultCode: 'KeyW' }),
    Object.freeze({ id: 'back', label: 'Andar para trás', category: 'Movimento', defaultCode: 'KeyS' }),
    Object.freeze({ id: 'left', label: 'Andar para esquerda', category: 'Movimento', defaultCode: 'KeyA' }),
    Object.freeze({ id: 'right', label: 'Andar para direita', category: 'Movimento', defaultCode: 'KeyD' }),
    Object.freeze({ id: 'jump', label: 'Pular / Nadar', category: 'Movimento', defaultCode: 'Space' }),
    Object.freeze({ id: 'sprint', label: 'Correr', category: 'Movimento', defaultCode: 'ShiftLeft' }),
    Object.freeze({ id: 'crouch', label: 'Agachar / Mergulhar', category: 'Movimento', defaultCode: 'KeyC' }),
    Object.freeze({ id: 'inventory', label: 'Inventário', category: 'Jogo', defaultCode: 'KeyE' }),
    Object.freeze({ id: 'drop', label: 'Largar item', category: 'Jogo', defaultCode: 'KeyQ' }),
    Object.freeze({ id: 'chat', label: 'Chat', category: 'Jogo', defaultCode: 'KeyT' }),
    Object.freeze({ id: 'command', label: 'Comando', category: 'Jogo', defaultCode: 'Slash' }),
    Object.freeze({ id: 'toggleThirdPerson', label: 'Terceira pessoa', category: 'Jogo', defaultCode: 'KeyV' }),
]);

export const DEFAULT_INPUT_BINDINGS = Object.freeze(Object.fromEntries(
    BINDING_ACTIONS.map(action => [action.id, action.defaultCode]),
));

const CODE_LABELS = Object.freeze({
    Space: 'Espaço',
    ShiftLeft: 'Shift Esq',
    ShiftRight: 'Shift Dir',
    ControlLeft: 'Ctrl Esq',
    ControlRight: 'Ctrl Dir',
    AltLeft: 'Alt Esq',
    AltRight: 'Alt Dir',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'Esc',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Slash: '/',
    Backslash: '\\',
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Minus: '-',
    Equal: '=',
});

export function formatBindingCode(code) {
    if (typeof code !== 'string' || !code) return '—';
    if (CODE_LABELS[code]) return CODE_LABELS[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
    return code;
}

export function isValidBindingCode(code) {
    return typeof code === 'string' && code.length >= 1 && code.length <= 32;
}

export function sanitizeInputBindings(raw = {}) {
    const clean = { ...DEFAULT_INPUT_BINDINGS };
    if (!raw || typeof raw !== 'object') return clean;
    for (const action of BINDING_ACTIONS) {
        const value = raw[action.id];
        if (isValidBindingCode(value)) clean[action.id] = value;
    }
    return clean;
}

function defaultStorage() {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}

export function loadInputBindings(storage = defaultStorage()) {
    try {
        const raw = storage?.getItem(INPUT_BINDINGS_KEY);
        return sanitizeInputBindings(raw ? JSON.parse(raw) : {});
    } catch {
        return { ...DEFAULT_INPUT_BINDINGS };
    }
}

export function saveInputBindings(bindings, storage = defaultStorage()) {
    const clean = sanitizeInputBindings(bindings);
    try {
        storage?.setItem(INPUT_BINDINGS_KEY, JSON.stringify(clean));
    } catch {
        // quota cheia ou storage bloqueado: vale só para esta sessão
    }
    return clean;
}

export function findBindingConflicts(bindings, actionId, code) {
    return BINDING_ACTIONS
        .filter(action => action.id !== actionId && bindings[action.id] === code)
        .map(action => action.id);
}
