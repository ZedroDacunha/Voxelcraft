import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { BLOCKS, ID, ITEMS } from '../world-catalog.js';
import { CHAT_COMMANDS, TIME_PRESETS, resolveItem } from '../world-chat-commands.js';
import {
    CHAT_SUGGESTION_LIMIT,
    completionsFor,
    createChatCompleter,
    itemSuggestionNames,
    visibleSuggestions,
} from '../world-chat-completion.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const CATALOG = { ITEMS, BLOCKS, ID };
const values = (text, catalog = CATALOG) => completionsFor(text, { catalog }).matches.map(match => match.value);

// ------------------------------------------------ o que o Tab oferece

test('no nome do comando, o Tab oferece os comandos da tabela', () => {
    assert.deepEqual(values('/'), CHAT_COMMANDS.map(command => `/${command.name}`));
    assert.deepEqual(values('/g'), ['/give']);
    assert.deepEqual(values('/TI'), ['/time'], 'não liga para maiúscula');
    assert.deepEqual(values('/t'), ['/time', '/tp']);
    assert.deepEqual(values('/zzz'), [], 'sem candidato, nada de lista');
});

test('depois do comando, cada um oferece o seu argumento', () => {
    assert.deepEqual(values('/time '), ['set', 'add']);
    assert.deepEqual(values('/time s'), ['set']);
    assert.deepEqual(values('/time set '), ['day', 'noon', 'night', 'midnight', 'sunrise', 'sunset', 'dusk', 'dawn']);
    assert.deepEqual(values('/time set n'), ['noon', 'night']);
    assert.deepEqual(values('/time set xyz'), []);
    // Sem argumento para completar: nada de lista inventada.
    assert.deepEqual(values('/clear '), []);
    assert.deepEqual(values('/kill '), []);
    assert.deepEqual(values('/seed '), []);
    assert.deepEqual(values('/tp 1'), []);
});

test('/help completa com os mesmos nomes de comando', () => {
    assert.deepEqual(values('/help '), CHAT_COMMANDS.map(command => command.name));
    assert.deepEqual(values('/help gi'), ['give']);
});

test('/give lista os itens do catálogo, pelo nome que aparece no jogo', () => {
    const todos = values('/give ');
    assert.ok(todos.length > 30, `esperava o catálogo inteiro, veio ${todos.length}`);
    assert.deepEqual(todos, itemSuggestionNames(CATALOG), 'a lista é o catálogo, na ordem dele');
    assert.ok(todos.includes('Terra'));

    assert.deepEqual(values('/give ter'), ['Terra']);
    assert.deepEqual(values('/give diamente'), [], 'prefixo errado não casa');
    assert.deepEqual(values('/give PÓ'), ['Pó luminoso', 'Porta de carvalho'], 'acento e maiúscula não atrapalham');
    // A lista mostra o nome que aparece no jogo; o nome do código (`wood_door`)
    // continua valendo no comando, mas não é o que o Tab sugere.
    assert.deepEqual(values('/give wood_door'), []);
});

test('tab em item de nome composto traz as opções todas', () => {
    const picaretas = values('/give picareta');
    assert.deepEqual(picaretas, [
        'Picareta de Cobre', 'Picareta de Diamante', 'Picareta de Ferro',
        'Picareta de Madeira', 'Picareta de Ouro', 'Picareta de Pedra',
    ]);
    // e cada uma dessas é mesmo um item que o /give aceita
    for (const name of picaretas) assert.ok(resolveItem(name, CATALOG), `${name} não resolve no /give`);
});

test('texto que não é comando não tem pré-seleção', () => {
    assert.deepEqual(values('oi'), []);
    assert.deepEqual(values(''), []);
    const context = completionsFor('oi', { catalog: CATALOG });
    assert.equal(context.matches.length, 0);
});

// ------------------------------------------------ o Tab que completa

test('o primeiro Tab completa o pedaço e já deixa o espaço', () => {
    const completer = createChatCompleter({ catalog: CATALOG });

    assert.equal(completer.complete('/gi').text, '/give ');
    assert.equal(completer.complete('/ti').text, '/time ');
    assert.equal(completer.complete('/time se').text, '/time set ');
    assert.equal(completer.complete('/time set n').text, '/time set noon ');
});

test('o segundo Tab anda para o próximo candidato, sem recomeçar', () => {
    const completer = createChatCompleter({ catalog: CATALOG });
    const primeiro = completer.complete('/give picareta');
    assert.equal(primeiro.text, '/give Picareta de Cobre ');
    assert.equal(primeiro.activeIndex, 0);
    assert.equal(primeiro.matches.length, 6);

    const segundo = completer.complete(primeiro.text);
    assert.equal(segundo.text, '/give Picareta de Diamante ', 'andou na lista');
    assert.equal(segundo.activeIndex, 1);
    assert.equal(segundo.cycled, true);

    // e continua até dar a volta (são seis picaretas)
    let atual = segundo.text;
    const vistos = [primeiro.text, segundo.text];
    for (let i = 0; i < 5; i++) {
        atual = completer.complete(atual).text;
        vistos.push(atual);
    }
    assert.equal(vistos.at(-1), '/give Picareta de Cobre ', 'depois da última, volta para a primeira');
    assert.equal(new Set(vistos).size, 6, 'passou por todas');
});

test('Shift+Tab volta na lista; do primeiro, vai para o último', () => {
    const completer = createChatCompleter({ catalog: CATALOG });
    const primeiro = completer.complete('/give picareta');
    assert.equal(completer.complete(primeiro.text, { backwards: true }).text, '/give Picareta de Pedra ');

    const novo = createChatCompleter({ catalog: CATALOG });
    assert.equal(novo.complete('/give picareta', { backwards: true }).text, '/give Picareta de Pedra ',
        'Shift+Tab direto já começa pelo último');
});

test('digitar qualquer coisa reinicia a volta', () => {
    const completer = createChatCompleter({ catalog: CATALOG });
    const primeiro = completer.complete('/give picareta');
    const segundo = completer.complete(primeiro.text);
    assert.equal(segundo.activeIndex, 1);

    // O jogo chama reset() no evento de digitação.
    completer.reset();
    const depois = completer.complete('/give picareta');
    assert.equal(depois.activeIndex, 0, 'volta a começar do primeiro');
    assert.equal(depois.text, '/give Picareta de Cobre ');
});

test('Tab sem candidato não estraga a linha', () => {
    const completer = createChatCompleter({ catalog: CATALOG });
    for (const line of ['/zzz', '/tp 12 x', 'mensagem']) {
        const result = completer.complete(line);
        assert.equal(result.text, line, `${line} ficou intacta`);
        assert.equal(result.matches.length, 0);
    }
});

test('Tab e Shift+Tab andam em sentidos opostos na mesma lista', () => {
    const completer = createChatCompleter({ catalog: CATALOG });
    const primeiro = completer.complete('/help ');
    assert.equal(primeiro.text, '/help help ', 'o primeiro da lista é o próprio /help');
    assert.equal(primeiro.matches.length, CHAT_COMMANDS.length);

    const segundo = completer.complete(primeiro.text);
    assert.equal(segundo.text, '/help give ');
    const volta = completer.complete(segundo.text, { backwards: true });
    assert.equal(volta.text, '/help help ', 'Shift+Tab desfaz o Tab');
});

test('a lista de pré-seleção acompanha a volta do Tab', () => {
    const completer = createChatCompleter({ catalog: CATALOG });
    const inicial = completer.suggest('/give picareta');
    assert.equal(inicial.activeIndex, 0, 'antes do Tab, o primeiro da lista já está destacado');
    assert.equal(inicial.matches[0].value, 'Picareta de Cobre');
    assert.ok(inicial.matches[0].insert.endsWith(' '), 'o espaço vem junto');

    // Depois do Tab, a lista continua mostrando a mesma volta, com o novo destaque.
    const depois = completer.complete('/give picareta');
    assert.equal(completer.suggest(depois.text).activeIndex, 0);
    const segundo = completer.complete(depois.text);
    assert.equal(completer.suggest(segundo.text).activeIndex, 1);
    assert.equal(completer.suggest(segundo.text).matches[1].value, 'Picareta de Diamante');
});

test('a sugestão de comando vem com o resumo, para a lista poder explicar', () => {
    const give = completionsFor('/gi', { catalog: CATALOG }).matches[0];
    assert.equal(give.value, '/give');
    assert.match(give.hint, /itens/);
    assert.equal(give.insert, '/give ');
});

test('a hora sugerida é sempre um atalho que o /time aceita', () => {
    // Lista escrita à mão: o Tab só pode oferecer o que o comando entende.
    const esperado = ['day', 'noon', 'night', 'midnight', 'sunrise', 'sunset', 'dusk', 'dawn'];
    assert.deepEqual(values('/time set '), esperado);
    for (const word of esperado) assert.ok(word in TIME_PRESETS, `${word} não é atalho de hora`);
});

// ------------------------------------------------ a janela da lista

test('a lista mostra só o que cabe na tela, com o ativo dentro', () => {
    const matches = Array.from({ length: 30 }, (_, i) => ({ value: `item${i}` }));
    const primeira = visibleSuggestions(matches, 0);
    assert.equal(primeira.items.length, CHAT_SUGGESTION_LIMIT);
    assert.equal(primeira.offset, 0);
    assert.equal(primeira.total, 30);
    assert.equal(primeira.hidden, 30 - CHAT_SUGGESTION_LIMIT);

    const meio = visibleSuggestions(matches, 20);
    assert.ok(meio.items.some(item => item.value === 'item20'), 'o ativo aparece');
    assert.equal(meio.items.at(-1).value, 'item20', 'e fica no fim da janela');

    const fim = visibleSuggestions(matches, 29);
    assert.equal(fim.items.at(-1).value, 'item29');
    assert.equal(fim.offset, 30 - CHAT_SUGGESTION_LIMIT);
});

test('lista vazia não desenha nada e lista curta aparece inteira', () => {
    assert.deepEqual(visibleSuggestions([], 0), { items: [], offset: 0, total: 0, hidden: 0 });
    const curta = visibleSuggestions([{ value: 'a' }, { value: 'b' }], 1);
    assert.equal(curta.items.length, 2);
    assert.equal(curta.hidden, 0);
});

// ------------------------------------------------ fiação no jogo

test('o Tab do input do chat completa; Shift+Tab volta', () => {
    const game = read('game.js');
    assert.match(game, /if \(event\.key === 'Tab'\) \{\s*event\.preventDefault\(\);\s*completeChat\(event\.shiftKey\);/);
    assert.match(game, /const chatCompleter = createChatCompleter\(\{ catalog: \{ ITEMS, BLOCKS, ID \} \}\);/);
    // digitar reinicia a volta
    assert.match(game, /chat\.setDraft\(chatInput\.value\);\s*\/\/ Digitou: a volta do Tab recomeça do primeiro candidato\.\s*chatCompleter\.reset\(\);/);
    // a lista aparece e some junto com o chat
    assert.match(game, /function renderChatSuggest\(\)/);
    assert.match(game, /if \(!chat\.open\) \{\s*list\.hidden = true;/);
});

test('a lista de sugestões tem caixa no HTML e destaque no CSS', () => {
    const html = read('index.html');
    const css = read('styles.css');
    assert.match(html, /<ul id="chat-suggest" aria-label="Sugestões do Tab" hidden><\/ul>/);
    assert.match(css, /#chat-suggest \{ list-style: none;/);
    assert.match(css, /\.chat-suggestion\.active \{ background: rgba\(90, 90, 90, \.78\); color: #fff; \}/);
    // e dá para tocar num nome no celular
    assert.match(read('game.js'), /pickChatSuggestion\(Number\(item\.dataset\.index\)\)/);
});
