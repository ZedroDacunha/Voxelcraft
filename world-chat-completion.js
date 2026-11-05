/**
 * Pré-seleção do chat: o que o **Tab** completa e o que a lista mostra.
 *
 * Regras, copiadas do Minecraft:
 *
 * - `Tab` completa pelo prefixo **do pedaço que está sendo digitado**: `/gi` →
 *   `/give `, `/time set n` → `night`.
 * - `Tab` de novo **não reescolhe**: anda para o próximo candidato da mesma
 *   lista (`/give pic` → Madeira → Diamante → Ouro…). `Shift+Tab` volta.
 * - Qualquer outra tecla reinicia a volta, para o Tab seguinte começar do
 *   primeiro candidato de novo.
 * - A lista de candidatos aparece na tela, com o que o Tab vai escolher
 *   destacado — é a "pré-seleção", e no celular dá para tocar no nome.
 *
 * Quem sabe o que é um comando e o que é um item é `world-chat-commands.js`:
 * aqui só se recorta a linha, se filtra por prefixo e se monta o texto novo.
 * Módulo puro — sem DOM, sem teclado, sem relógio.
 */

import {
    CHAT_COMMANDS, COMMAND_PREFIX, TIME_PRESETS, normalizeName,
} from './world-chat-commands.js';

/** Quantos candidatos cabem na lista da tela. O resto o Tab ainda alcança. */
export const CHAT_SUGGESTION_LIMIT = 8;

/** Os atalhos de hora, na ordem em que o jogador espera vê-los. */
const TIME_WORDS = ['day', 'noon', 'night', 'midnight', 'sunrise', 'sunset', 'dusk', 'dawn'];
const TIME_ACTIONS = ['set', 'add'];

/**
 * Todos os itens que dá para pedir no `/give`, pelo nome que aparece no jogo.
 *
 * A lista sai do catálogo de verdade (nada digitado à mão) e é ordenada pela
 * chave sem acento: assim dois itens com nome parecido ficam vizinhos e a ordem
 * não depende do idioma do navegador.
 */
export function itemSuggestionNames({ ITEMS = {} } = {}) {
    const names = new Map();
    for (const item of Object.values(ITEMS)) {
        const name = item?.name;
        if (!name) continue;
        const key = normalizeName(name);
        if (key && !names.has(key)) names.set(key, name);
    }
    return [...names.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, name]) => name);
}

const commandMatches = prefix => CHAT_COMMANDS
    .filter(command => command.name.startsWith(prefix))
    .map(command => ({
        value: `/${command.name}`,
        hint: command.summary,
        // Um comando completo é sempre seguido de um argumento: o espaço vem junto.
        insert: `/${command.name} `,
    }));

const plainMatches = (prefix, words) => words
    .filter(word => word.startsWith(prefix))
    .map(word => ({ value: word, hint: '', insert: `${word} ` }));

function itemMatches(prefix, catalog) {
    const key = normalizeName(prefix);
    return itemSuggestionNames(catalog)
        .filter(name => normalizeName(name).startsWith(key))
        .map(name => ({ value: name, hint: '', insert: `${name} ` }));
}

/**
 * Recorta a linha em `{ base, token, matches }`.
 *
 * `base` é tudo o que fica **antes** do pedaço sendo digitado (é o que não se
 * mexe ao completar) e `token` é o pedaço. Quando a linha ainda está no nome do
 * comando, a base é vazia e o token inclui a barra — completar `/gi` substitui o
 * `/gi` inteiro, não costura em cima.
 */
export function completionsFor(text, { catalog = {} } = {}) {
    const raw = String(text ?? '');
    if (!raw.startsWith(COMMAND_PREFIX)) return { base: raw, token: '', matches: [], argIndex: -1 };

    const firstSpace = raw.search(/\s/);
    if (firstSpace < 0) {
        return {
            base: '',
            token: raw,
            argIndex: -1,
            matches: commandMatches(raw.slice(COMMAND_PREFIX.length).toLowerCase()),
        };
    }

    const afterCommand = raw.slice(firstSpace + 1);
    const token = afterCommand.slice(afterCommand.lastIndexOf(' ') + 1);
    const base = raw.slice(0, raw.length - token.length);
    const typedBefore = raw.slice(firstSpace + 1, raw.length - token.length).trim();
    const argIndex = typedBefore ? typedBefore.split(/\s+/).length : 0;
    const command = raw.slice(COMMAND_PREFIX.length, firstSpace).toLowerCase();
    const tokenKey = token.toLowerCase();

    if (command === 'give' && argIndex === 0) {
        return { base, token, argIndex, matches: itemMatches(token, catalog) };
    }
    if (command === 'help' && argIndex === 0) {
        // Aqui o candidato é o *argumento* do /help, então o nome vai sem a barra.
        const matches = CHAT_COMMANDS
            .filter(other => other.name.startsWith(tokenKey))
            .map(other => ({ value: other.name, hint: other.summary, insert: `${other.name} ` }));
        return { base, token, argIndex, matches };
    }
    if (command === 'time' && argIndex === 0) {
        return { base, token, argIndex, matches: plainMatches(tokenKey, TIME_ACTIONS) };
    }
    if (command === 'time' && argIndex === 1 && typedBefore.toLowerCase() === 'set') {
        const preset = tokenKey;
        return { base, token, argIndex, matches: plainMatches(preset, TIME_WORDS.filter(word => word in TIME_PRESETS)) };
    }
    return { base, token, argIndex, matches: [] };
}

/**
 * O completador com memória: é ele que faz o segundo Tab andar para o próximo
 * candidato em vez de recomeçar do primeiro.
 */
export function createChatCompleter({ catalog = {} } = {}) {
    let cycle = null;

    function reset() {
        cycle = null;
    }

    /**
     * Tab na linha. Devolve o texto novo (igual ao antigo quando não há
     * candidato) e o estado da lista para quem desenha a pré-seleção.
     */
    function complete(text, { backwards = false } = {}) {
        const current = String(text ?? '');

        // Segundo Tab no mesmo resultado: anda na volta já sorteada.
        if (cycle && (current === cycle.text || current === cycle.text.trimEnd())) {
            const step = backwards ? -1 : 1;
            cycle.index = (cycle.index + step + cycle.matches.length) % cycle.matches.length;
            cycle.text = cycle.base + cycle.matches[cycle.index].insert;
            return { ...describe(cycle), text: cycle.text, cycled: true };
        }

        const context = completionsFor(current, { catalog });
        if (!context.matches.length) {
            cycle = null;
            return { base: context.base, token: context.token, matches: [], activeIndex: -1, text: current, cycled: false };
        }

        const index = backwards ? context.matches.length - 1 : 0;
        cycle = {
            base: context.base,
            token: context.token,
            matches: context.matches,
            index,
            text: context.base + context.matches[index].insert,
        };
        return { ...describe(cycle), text: cycle.text, cycled: false };
    }

    /**
     * O que mostrar na lista, sem completar nada. `activeIndex` é o que o Tab
     * escolheria agora.
     */
    function suggest(text) {
        const current = String(text ?? '');
        if (cycle && (current === cycle.text || current === cycle.text.trimEnd())) {
            return describe(cycle);
        }
        const context = completionsFor(current, { catalog });
        return {
            base: context.base,
            token: context.token,
            matches: context.matches,
            activeIndex: context.matches.length ? 0 : -1,
        };
    }

    return { complete, suggest, reset };
}

function describe(cycle) {
    return {
        base: cycle.base,
        token: cycle.token,
        matches: cycle.matches,
        activeIndex: cycle.index,
    };
}

/**
 * A fatia da lista que cabe na tela, com o candidato ativo sempre dentro.
 *
 * Devolve também quantos ficaram de fora, para a lista poder avisar (`+12`).
 */
export function visibleSuggestions(matches, activeIndex, limit = CHAT_SUGGESTION_LIMIT) {
    const total = Array.isArray(matches) ? matches.length : 0;
    const size = Math.max(1, Math.floor(Number(limit) || CHAT_SUGGESTION_LIMIT));
    if (!total) return { items: [], offset: 0, total: 0, hidden: 0 };
    const active = Number.isFinite(activeIndex) ? Math.min(total - 1, Math.max(0, activeIndex)) : 0;
    // A janela desliza para o ativo ficar no fim dela: é onde o olho está.
    const offset = Math.max(0, Math.min(active - size + 1, total - size));
    return {
        items: matches.slice(offset, offset + size),
        offset,
        total,
        hidden: total - Math.min(size, total),
    };
}
