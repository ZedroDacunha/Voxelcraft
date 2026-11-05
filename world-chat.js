/**
 * O estado do chat: o que está aparecendo na tela, o que está sendo digitado e o
 * que já foi enviado.
 *
 * Nada de DOM aqui — o `game.js` desenha a partir daqui. É o mesmo motivo dos
 * outros módulos de regra do projeto (clima, criaturas, ferramentas): dá para
 * testar "o Enter envia e limpa", "↑ volta a última mensagem" e "linha velha
 * apaga" sem navegador, sem teclado e sem relógio de verdade.
 *
 * O desenho é o do Minecraft: as mensagens ficam no canto de baixo, a última
 * linha some dez segundos depois de chegar, e o que foi enviado volta com ↑/↓.
 */

/** Quantas mensagens ficam guardadas (a tela mostra só as últimas). */
export const CHAT_MESSAGE_LIMIT = 100;
/** Quantas linhas cabem na tela ao mesmo tempo. */
export const CHAT_VISIBLE_LIMIT = 10;
/** Segundos até a linha apagar sozinha (só com o chat fechado). */
export const CHAT_LINE_LIFETIME = 10;
/** Tamanho máximo do que se digita numa linha. */
export const CHAT_INPUT_LIMIT = 200;
/** Quantos envios ficam no histórico do ↑. */
export const CHAT_SENT_LIMIT = 50;

function finiteTime(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

export function createChatState() {
    const messages = [];
    const sent = [];
    let open = false;
    let draft = '';
    // Posição no histórico do ↑: `null` quando se está digitando algo novo.
    let cursor = null;
    let draftBeforeRecall = '';

    /**
     * Guarda uma mensagem (quebra em linhas: um comando pode responder em
     * várias). Mensagem antiga demais sai pela frente.
     */
    function add(text, { kind = 'system', at = 0 } = {}) {
        const lines = String(text ?? '')
            .split('\n')
            .map(line => line.trimEnd())
            .filter(line => line.length > 0);
        for (const line of lines) messages.push({ text: line, kind, at: finiteTime(at) });
        while (messages.length > CHAT_MESSAGE_LIMIT) messages.shift();
        return lines.length;
    }

    /**
     * O que está na tela agora.
     *
     * Com o chat aberto, o histórico fica todo visível (é quando se lê o que
     * passou); fechado, só as linhas dos últimos dez segundos — como no
     * Minecraft, onde o chat some sozinho depois de um tempo.
     */
    function visible(now = 0) {
        const time = finiteTime(now);
        const fresh = open
            ? messages
            : messages.filter(message => time - message.at <= CHAT_LINE_LIFETIME);
        return fresh.slice(-CHAT_VISIBLE_LIMIT);
    }

    function openChat({ text = '' } = {}) {
        open = true;
        draft = String(text ?? '').slice(0, CHAT_INPUT_LIMIT);
        cursor = null;
        draftBeforeRecall = '';
        return draft;
    }

    function close() {
        open = false;
        draft = '';
        cursor = null;
        draftBeforeRecall = '';
    }

    function setDraft(text) {
        draft = String(text ?? '').slice(0, CHAT_INPUT_LIMIT);
        return draft;
    }

    /** Digitar um caractere. No limite, o resto é ignorado (não estoura). */
    function type(char) {
        if (!open || !char) return draft;
        if (draft.length >= CHAT_INPUT_LIMIT) return draft;
        draft += char;
        return draft;
    }

    function backspace() {
        draft = draft.slice(0, -1);
        return draft;
    }

    /**
     * ↑/↓ no histórico. `-1` é para trás (mais antigo), `1` para frente (mais
     * novo); ao passar do fim, volta o rascunho que estava sendo escrito.
     */
    function recall(direction) {
        if (!open || !sent.length) return draft;
        if (cursor === null) {
            draftBeforeRecall = draft;
            cursor = sent.length;
        }
        cursor = Math.max(0, Math.min(sent.length, cursor + (direction < 0 ? -1 : 1)));
        draft = cursor >= sent.length ? draftBeforeRecall : sent[cursor];
        return draft;
    }

    /**
     * Enter: devolve o texto digitado (aparado) para quem chamou enviar, guarda
     * no histórico do ↑ e limpa a linha. Devolve `null` quando não havia nada.
     */
    function send() {
        const text = draft.trim();
        draft = '';
        cursor = null;
        draftBeforeRecall = '';
        if (!text) return null;
        sent.push(text);
        while (sent.length > CHAT_SENT_LIMIT) sent.shift();
        return text;
    }

    return {
        add,
        backspace,
        close,
        openChat,
        recall,
        send,
        setDraft,
        type,
        visible,
        get open() { return open; },
        get draft() { return draft; },
        get messages() { return messages; },
        get sent() { return sent; },
    };
}
