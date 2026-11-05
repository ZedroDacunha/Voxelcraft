import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { BLOCKS, ID, ITEMS } from '../world-catalog.js';
import {
    CHAT_INPUT_LIMIT,
    CHAT_LINE_LIFETIME,
    CHAT_MESSAGE_LIMIT,
    CHAT_VISIBLE_LIMIT,
    createChatState,
} from '../world-chat.js';
import {
    CHAT_COMMANDS,
    COMMAND_PREFIX,
    TIME_PRESETS,
    findCommand,
    formatTimeOfDay,
    itemIndex,
    normalizeName,
    parseChatInput,
    parseCoordinate,
    parseTimeValue,
    resolveItem,
    runChatCommand,
} from '../world-chat-commands.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const CATALOG = { ITEMS, BLOCKS, ID };

// ------------------------------------------------ estado do chat

test('abrir o chat aceita um rascunho; fechar limpa tudo', () => {
    const chat = createChatState();
    assert.equal(chat.open, false);

    assert.equal(chat.openChat(), '', 'a tecla T abre vazio');
    assert.equal(chat.open, true);
    chat.setDraft('oi');
    chat.close();
    assert.equal(chat.open, false);
    assert.equal(chat.draft, '', 'fechar não deixa rascunho para trás');

    // A barra abre já com o `/` (atalho de comando do Minecraft).
    assert.equal(chat.openChat({ text: COMMAND_PREFIX }), '/');
});

test('digitar e apagar respeitam o limite da linha', () => {
    const chat = createChatState();
    chat.openChat();
    chat.type('a');
    chat.type('b');
    assert.equal(chat.draft, 'ab');
    chat.backspace();
    assert.equal(chat.draft, 'a');

    for (let i = 0; i < 250; i++) chat.type('x');
    assert.equal(chat.draft.length, CHAT_INPUT_LIMIT, 'a linha não cresce sem fim');

    // Rascunho vindo do DOM (colar, teclado virtual) também é aparado.
    chat.setDraft('y'.repeat(500));
    assert.equal(chat.draft.length, CHAT_INPUT_LIMIT);
});

test('Enter envia e limpa; linha só de espaços é como se fosse vazia', () => {
    const chat = createChatState();
    chat.openChat({ text: '  /give terra 3  ' });
    assert.equal(chat.send(), '/give terra 3', 'o texto vai aparado');
    assert.equal(chat.draft, '');

    chat.openChat({ text: '   ' });
    assert.equal(chat.send(), null, 'nada para enviar');
    assert.equal(chat.sent.length, 1, 'linha vazia não entra no histórico');
});

test('↑ volta o que foi enviado, ↓ desce e devolve o rascunho', () => {
    const chat = createChatState();
    for (const line of ['/time set day', '/give terra 5']) {
        chat.openChat({ text: line });
        chat.send();
    }
    chat.openChat();
    chat.setDraft('estava escrevendo');
    assert.equal(chat.recall(-1), '/give terra 5', 'a mais recente primeiro');
    assert.equal(chat.recall(-1), '/time set day');
    assert.equal(chat.recall(-1), '/time set day', 'no começo, para');
    assert.equal(chat.recall(1), '/give terra 5');
    assert.equal(chat.recall(1), 'estava escrevendo', 'passar do fim volta o rascunho');
});

test('sem nada enviado, ↑ não inventa mensagem', () => {
    const chat = createChatState();
    chat.openChat();
    chat.setDraft('abc');
    assert.equal(chat.recall(-1), 'abc');
});

test('o log guarda o texto quebrado em linhas e descarta o mais antigo', () => {
    const chat = createChatState();
    assert.equal(chat.add('linha 1\nlinha 2\n\nlinha 3'), 3, 'quebra em linhas e ignora as vazias');
    assert.equal(chat.messages.length, 3);

    for (let i = 0; i < CHAT_MESSAGE_LIMIT + 20; i++) chat.add(`m${i}`, { at: i });
    assert.equal(chat.messages.length, CHAT_MESSAGE_LIMIT, 'o log não cresce sem fim');
    assert.equal(chat.messages.at(-1).text, `m${CHAT_MESSAGE_LIMIT + 19}`);
});

test('com o chat fechado a linha apaga sozinha; aberto, o histórico fica', () => {
    const chat = createChatState();
    chat.add('oi', { at: 0 });
    assert.equal(chat.visible(0).length, 1);
    // Dez segundos escritos à mão (e não lidos da constante): é o tempo que o
    // jogador tem para ler a resposta de um comando antes dela desaparecer.
    assert.equal(chat.visible(10).length, 1, 'aos 10 s ainda está na tela');
    assert.equal(chat.visible(10.1).length, 0, 'passou dos 10 s, apagou');
    assert.ok(CHAT_LINE_LIFETIME >= 5 && CHAT_LINE_LIFETIME <= 30, 'tempo de vida legível');

    chat.add('oi de novo', { at: 100 });
    chat.openChat();
    assert.equal(chat.visible(1000).length, 2, 'aberto, nada apaga na frente do jogador');
    assert.equal(chat.visible(1000)[0].text, 'oi', 'a linha velha volta a aparecer no histórico');
});

test('a tela mostra as últimas linhas, não o log inteiro', () => {
    const chat = createChatState();
    for (let i = 0; i < 30; i++) chat.add(`m${i}`, { at: 50 });
    const lines = chat.visible(50);
    assert.equal(lines.length, CHAT_VISIBLE_LIMIT);
    assert.equal(lines.at(-1).text, 'm29');
});

// ------------------------------------------------ leitura da linha

test('a linha do chat é fala ou comando, e o comando separa nome e argumentos', () => {
    assert.deepEqual(parseChatInput(''), { kind: 'empty', text: '' });
    assert.deepEqual(parseChatInput('   '), { kind: 'empty', text: '' });
    assert.equal(parseChatInput('oi galera').kind, 'message');
    assert.equal(parseChatInput('oi galera').text, 'oi galera');

    const command = parseChatInput('/GIVE  Terra   10 ');
    assert.equal(command.kind, 'command');
    assert.equal(command.name, 'give', 'o nome do comando não liga para maiúscula');
    assert.deepEqual(command.args, ['Terra', '10']);
    assert.equal(parseChatInput('/').name, '');
});

test('nome de item ignora acento, maiúscula, espaço e o prefixo minecraft:', () => {
    assert.equal(normalizeName('Picareta de Diamante'), 'picaretadediamante');
    assert.equal(normalizeName('minecraft:dirt'), 'dirt');
    assert.equal(normalizeName('Pó Luminoso'), 'poluminoso');
    assert.equal(normalizeName('  wood_door '), 'wooddoor');
});

test('/give aceita o nome do código, o nome do jogo e os apelidos em inglês', () => {
    assert.equal(resolveItem('dirt', CATALOG).id, ID.DIRT);
    assert.equal(resolveItem('minecraft:dirt', CATALOG).id, ID.DIRT);
    assert.equal(resolveItem('Terra', CATALOG).id, ID.DIRT);
    assert.equal(resolveItem('terra', CATALOG).id, ID.DIRT);
    assert.equal(resolveItem('cobblestone', CATALOG).id, ID.COBBLE);
    assert.equal(resolveItem('wood', CATALOG).id, ID.LOG);
    assert.equal(resolveItem('picareta de diamante', CATALOG).name, 'Picareta de Diamante');
    assert.equal(resolveItem('pedra', CATALOG).id, ID.STONE);
    assert.equal(resolveItem('naoexiste', CATALOG), null);
    assert.equal(resolveItem('', CATALOG), null);
});

test('todo item do catálogo pode ser pedido pelo nome que aparece no jogo', () => {
    const index = itemIndex(CATALOG);
    for (const [id, item] of Object.entries(ITEMS)) {
        const found = index.get(normalizeName(item.name));
        assert.ok(found === Number(id) || resolveItem(item.name, CATALOG)?.id === Number(id),
            `${item.name} (${id}) não resolve`);
    }
});

test('hora aceita atalho, hh:mm e fração do dia; o resto é inválido', () => {
    assert.equal(parseTimeValue('noon'), TIME_PRESETS.noon);
    assert.equal(parseTimeValue('MIDNIGHT'), TIME_PRESETS.midnight);
    assert.equal(parseTimeValue('12:30'), ((12.5 + 18) % 24) / 24);
    assert.equal(parseTimeValue('06:00'), 0, 'o dia do jogo começa às 06:00');
    assert.equal(parseTimeValue('0.5'), 0.5);
    assert.equal(parseTimeValue('0'), 0);
    assert.equal(parseTimeValue('1'), 1);

    for (const bad of ['', 'amanha', '25:00', '12:75', '1.5', '-0.2']) {
        assert.equal(parseTimeValue(bad), null, `"${bad}" não é hora`);
    }
});

test('a hora formatada é a mesma do relógio da HUD', () => {
    assert.equal(formatTimeOfDay(0), '06:00');
    assert.equal(formatTimeOfDay(0.25), '12:00');
    assert.equal(formatTimeOfDay(0.5), '18:00');
    assert.equal(formatTimeOfDay(0.75), '00:00');
    assert.equal(formatTimeOfDay(TIME_PRESETS.noon), '12:00');
});

test('/tp entende número, ~ e ~deslocamento', () => {
    assert.equal(parseCoordinate('10'), 10);
    assert.equal(parseCoordinate('-2.5'), -2.5);
    assert.equal(parseCoordinate('~', 7), 7);
    assert.equal(parseCoordinate('~2', 7), 9);
    assert.equal(parseCoordinate('~-1.5', 7), 5.5);
    for (const bad of ['', 'abc', '~abc', '~~']) assert.equal(parseCoordinate(bad, 0), null, `"${bad}"`);
});

// ------------------------------------------------ os comandos

/** Um `ctx` de mentira que anota tudo o que o comando pediu ao jogo. */
function makeContext({ position = { x: 5, y: 12, z: -3 }, seed = 4242, time = 0.25, free = true } = {}) {
    const calls = { teleported: [], given: [], killed: 0, cleared: 0, times: [] };
    const ctx = {
        getPosition: () => ({ ...position }),
        teleport: (x, y, z) => {
            if (!free) return false;
            calls.teleported.push([x, y, z]);
            return true;
        },
        setTime: (value) => { calls.times.push(['set', value]); return value; },
        addTime: (minutes) => { calls.times.push(['add', minutes]); return 0.5; },
        giveItem: (id, count) => {
            calls.given.push([id, count]);
            return count;
        },
        clearInventory: () => { calls.cleared += 1; return 4; },
        killPlayer: () => { calls.killed += 1; },
        getSeed: () => seed,
    };
    return { ctx, calls };
}

test('comando desconhecido aponta para o /help em vez de não fazer nada', () => {
    const { ctx } = makeContext();
    const result = runChatCommand('/voar', ctx, CATALOG);
    assert.equal(result.ok, false);
    assert.match(result.messages[0], /\/help/);
});

test('texto sem barra não é comando', () => {
    const { ctx } = makeContext();
    const result = runChatCommand('oi', ctx, CATALOG);
    assert.equal(result.ok, false);
    assert.match(result.messages[0], /começam com \//);
});

test('/help lista todos os comandos e detalha um deles', () => {
    const { ctx } = makeContext();
    const geral = runChatCommand('/help', ctx, CATALOG);
    assert.equal(geral.ok, true);
    for (const command of CHAT_COMMANDS) {
        assert.ok(geral.messages.some(line => line.includes(command.usage)), `falta ${command.name} no /help`);
    }
    const detalhe = runChatCommand('/help give', ctx, CATALOG);
    assert.equal(detalhe.ok, true);
    assert.ok(detalhe.messages.includes('/give <item> [quantidade]'));

    assert.equal(runChatCommand('/help naoexiste', ctx, CATALOG).ok, false);
});

test('/give entrega o item pedido, com quantidade', () => {
    const { ctx, calls } = makeContext();
    const result = runChatCommand('/give terra 10', ctx, CATALOG);
    assert.equal(result.ok, true);
    assert.deepEqual(calls.given, [[ID.DIRT, 10]]);
    assert.match(result.messages[0], /10× Terra/);
});

test('/give sem quantidade dá um; sem item, mostra o uso', () => {
    const { ctx, calls } = makeContext();
    assert.equal(runChatCommand('/give pedra', ctx, CATALOG).ok, true);
    assert.deepEqual(calls.given, [[ID.STONE, 1]]);

    const semItem = runChatCommand('/give', ctx, CATALOG);
    assert.equal(semItem.ok, false);
    assert.match(semItem.messages[0], /Uso: \/give/);
});

test('/give respeita o empilhamento máximo (ferramenta não vira pilha de 64)', () => {
    const { ctx, calls } = makeContext();
    const result = runChatCommand('/give picareta de diamante 64', ctx, CATALOG);
    assert.equal(result.ok, true);
    assert.equal(calls.given.length, 1);
    assert.match(result.messages[0], /Picareta de Diamante/);
    assert.equal(calls.given[0][1], 1, 'a picareta empilha 1');
});

test('/give recusa item inexistente, quantidade inválida e mochila cheia', () => {
    const { ctx } = makeContext();
    const item = runChatCommand('/give chuveiro', ctx, CATALOG);
    assert.equal(item.ok, false);
    assert.match(item.messages[0], /Não conheço o item/);

    assert.equal(runChatCommand('/give terra 0', ctx, CATALOG).ok, false);
    assert.equal(runChatCommand('/give terra -3', ctx, CATALOG).ok, false);
    assert.equal(runChatCommand('/give terra 2.5', ctx, CATALOG).ok, false);

    const cheio = makeContext().ctx;
    cheio.giveItem = () => 0;
    const semEspaco = runChatCommand('/give terra 5', cheio, CATALOG);
    assert.equal(semEspaco.ok, false);
    assert.match(semEspaco.messages[0], /cheia/);
});

test('/give avisa quando só coube parte da pilha', () => {
    const { ctx } = makeContext();
    ctx.giveItem = () => 3;
    const result = runChatCommand('/give terra 10', ctx, CATALOG);
    assert.equal(result.ok, true);
    assert.match(result.messages[0], /só cabiam 3/);
});

test('/clear esvazia e conta o que saiu', () => {
    const { ctx, calls } = makeContext();
    const result = runChatCommand('/clear', ctx, CATALOG);
    assert.equal(result.ok, true);
    assert.equal(calls.cleared, 1);
    assert.match(result.messages[0], /4 itens/);

    const vazio = makeContext().ctx;
    vazio.clearInventory = () => 0;
    assert.match(runChatCommand('/clear', vazio, CATALOG).messages[0], /já estava vazio/);
});

test('/time set aceita atalho, relógio e fração, e sempre diz a hora final', () => {
    const { ctx, calls } = makeContext();
    const meioDia = runChatCommand('/time set noon', ctx, CATALOG);
    assert.equal(meioDia.ok, true);
    assert.deepEqual(calls.times.at(-1), ['set', TIME_PRESETS.noon]);
    assert.match(meioDia.messages[0], /12:00/);

    runChatCommand('/time set 18:00', ctx, CATALOG);
    assert.deepEqual(calls.times.at(-1), ['set', 0.5]);

    assert.equal(runChatCommand('/time set', ctx, CATALOG).ok, false);
    assert.equal(runChatCommand('/time set qualquercoisa', ctx, CATALOG).ok, false);
    assert.equal(runChatCommand('/time', ctx, CATALOG).ok, false);
});

test('/time add adianta o relógio em minutos do jogo', () => {
    const { ctx, calls } = makeContext();
    const result = runChatCommand('/time add 90', ctx, CATALOG);
    assert.equal(result.ok, true);
    assert.deepEqual(calls.times.at(-1), ['add', 90]);
    assert.match(result.messages[0], /\+90 min/);
    assert.equal(runChatCommand('/time add', ctx, CATALOG).ok, false);
    assert.equal(runChatCommand('/time add logo', ctx, CATALOG).ok, false);
});

test('/tp leva para a posição e aceita coordenada relativa', () => {
    const { ctx, calls } = makeContext({ position: { x: 5, y: 12, z: -3 } });
    const absoluto = runChatCommand('/tp 10 20 -5', ctx, CATALOG);
    assert.equal(absoluto.ok, true);
    assert.deepEqual(calls.teleported.at(-1), [10, 20, -5]);
    assert.match(absoluto.messages[0], /10\.0 20\.0 -5\.0/);

    runChatCommand('/tp ~ ~2 ~-1', ctx, CATALOG);
    assert.deepEqual(calls.teleported.at(-1), [5, 14, -4], 'relativo a onde o jogador está');
});

test('/tp recusa coordenada ilegível, argumento faltando e destino impossível', () => {
    const { ctx } = makeContext();
    for (const line of ['/tp 1 2', '/tp', '/tp a b c']) {
        const result = runChatCommand(line, ctx, CATALOG);
        assert.equal(result.ok, false, `${line} deveria falhar`);
    }
    const impossivel = makeContext({ free: false }).ctx;
    const result = runChatCommand('/tp 0 99 0', impossivel, CATALOG);
    assert.equal(result.ok, false);
    assert.match(result.messages[0], /Não dá para ir/);
});

test('/kill mata e /seed conta a semente', () => {
    const { ctx, calls } = makeContext({ seed: 987654 });
    assert.equal(runChatCommand('/kill', ctx, CATALOG).ok, true);
    assert.equal(calls.killed, 1);

    const semente = runChatCommand('/seed', ctx, CATALOG);
    assert.equal(semente.ok, true);
    assert.match(semente.messages[0], /987654/);
});

test('comando que quebra não derruba o chat', () => {
    const quebrado = { getPosition: () => { throw new Error('sem mundo'); } };
    const result = runChatCommand('/tp ~ ~ ~', quebrado, CATALOG);
    assert.equal(result.ok, false);
    assert.match(result.messages[0], /falhou/);
});

test('a tabela de comandos serve para o /help e para a pré-seleção com Tab', () => {
    const names = CHAT_COMMANDS.map(command => command.name);
    assert.equal(new Set(names).size, names.length, 'sem nome repetido');
    for (const command of CHAT_COMMANDS) {
        assert.match(command.usage, /^\/[a-z]+/, `${command.name}: uso começa com /nome`);
        assert.ok(command.summary.length > 3, `${command.name}: tem resumo`);
        assert.equal(findCommand(command.name), command);
        assert.equal(findCommand(`/${command.name.toUpperCase()}`), command, `${command.name}: acha com barra e maiúscula`);
    }
    assert.equal(findCommand('nada'), null);
    const prefixo = names.filter(name => name.startsWith('t'));
    assert.deepEqual(prefixo, ['time', 'tp'], 'prefixo "t" → time e tp (a base do Tab)');
});

// ------------------------------------------------ fiação no jogo

test('a tecla T e a barra abrem o chat; Esc fecha; Enter envia', () => {
    const game = read('game.js');
    assert.match(game, /case 'KeyT': if \(!event\.repeat\) \{ event\.preventDefault\(\); openChat\(\); \} break;/);
    assert.match(game, /case 'Slash': if \(!event\.repeat\) \{ event\.preventDefault\(\); openChat\(COMMAND_PREFIX\); \} break;/);
    assert.match(game, /if \(event\.key === 'Escape'\) \{\s*event\.preventDefault\(\);\s*closeChat\(\);/);
    assert.match(game, /if \(event\.key === 'Enter'\) \{\s*event\.preventDefault\(\);\s*submitChat\(\);/);
    assert.match(game, /chatInput\.value = chat\.recall\(event\.key === 'ArrowUp' \? -1 : 1\);/);
    // com o chat aberto o teclado é dele: nada de andar/saltar enquanto digita
    assert.match(game, /\/\/ Com o chat aberto, o teclado é dele \(inclusive o T que abriu\)\.\n {8}if \(chat\.open\) return;/);
});

test('o mundo continua rodando enquanto se digita, e o menu de pausa não aparece', () => {
    const game = read('game.js');
    assert.match(game, /const worldRunning = playing\(\) \|\| chat\.open;/);
    assert.match(game, /chatOpen: chat\.open/);
    assert.match(game, /if \(chat\.open \|\| chatUnlockPending\) return;/);
    // e o mouse solto para digitar não é pausa: o chat se fecha e o jogo volta
    assert.match(game, /function closeChat\(\{ relock = true \} = \{\}\)/);
    assert.match(game, /startPlay\(\{ preferMouse: lastPointerKind === 'mouse' \}\);/);
});

test('morrer fecha o chat em vez de deixar a linha de digitação na tela de morte', () => {
    const game = read('game.js');
    assert.match(game, /if \(chat\.open\) closeChat\(\{ relock: false \}\);/);
});

test('o chat tem caixa no HTML e estilo próprio, e o botão de toque existe', () => {
    const html = read('index.html');
    const css = read('styles.css');
    const game = read('game.js');
    for (const id of ['chat', 'chat-log', 'chat-form', 'chat-input']) {
        assert.ok(html.includes(`id="${id}"`), `falta #${id} no index.html`);
    }
    assert.match(html, /data-touch="chat"[^>]*aria-label="Chat"/);
    assert.match(game, /else if \(id === 'chat'\) openChat\(\);/);
    assert.match(css, /#chat \{ position: absolute; left: 10px; bottom: 118px;/);
    assert.match(css, /#chat-input:focus/);
    assert.match(css, /\.chat-line\.error \{ color: #ff9a9a; \}/);
    assert.match(css, /body\.is-paused #chat, body\.touch-editing #chat \{ opacity: 0;/);
    // a dica do toque agora divide a faixa do topo com três botões
    assert.match(css, /right: calc\(24px \+ 3 \* var\(--touch-top-size, 46px\) \+ 16px\);/);
});
