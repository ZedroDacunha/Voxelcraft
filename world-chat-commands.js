/**
 * Os comandos do chat — os do Minecraft, no que cabe neste jogo.
 *
 * O navegador não tem console, e o jogo não tem aba de depuração: até agora,
 * para mudar a hora do mundo ou ganhar um item, só editando o save. O chat com
 * `/comando` resolve isso do jeito que o jogador já conhece.
 *
 * O módulo é **puro**: ele não conhece THREE, mundo, DOM nem teclado. Quem tem
 * o poder de mexer no jogo é o `ctx` que o `game.js` passa (teleportar, dar
 * item, matar…). Assim cada comando é testável com um `ctx` de mentira e o
 * catálogo de verdade.
 *
 * A lista de comandos é uma **tabela**: nome, uso e resumo num lugar só. É dela
 * que saem o `/help` e, na próxima parte, a pré-seleção com Tab — completar por
 * prefixo é procurar nesta mesma tabela.
 */

/** Prefixo que transforma a linha em comando. */
export const COMMAND_PREFIX = '/';

/**
 * Atalhos de hora. O relógio do jogo anda em fração do dia com o zero às 06:00
 * (ver `world-clock.js`): 0 = amanhecer, 0,25 = meio-dia, 0,5 = pôr do sol,
 * 0,75 = meia-noite.
 */
export const TIME_PRESETS = Object.freeze({
    sunrise: 0,
    dawn: 0,
    day: 0.04,
    morning: 0.04,
    noon: 0.25,
    midday: 0.25,
    sunset: 0.5,
    dusk: 0.5,
    night: 0.58,
    midnight: 0.75,
});

const MAX_GIVE = 64;

/** "pedregulho", "Picareta de Diamante", "minecraft:dirt" → chave comparável. */
export function normalizeName(text) {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/^minecraft:/, '')
        .replace(/[\s_-]+/g, '');
}

/** Nomes em inglês que o jogador vai tentar e que no jogo têm outro nome. */
const ITEM_ALIASES = Object.freeze({
    cobblestone: 'COBBLE',
    planks: 'PLANKS',
    wood: 'LOG',
    log: 'LOG',
    door: 'WOOD_DOOR',
    grassblock: 'GRASS',
    lantern: 'MOFIM_LANTERN',
    dust: 'MOFIM_DUST',
    glowdust: 'MOFIM_DUST',
    seeds: 'WHEAT_SEEDS',
    wool: 'WOOL_WHITE',
    la: 'WOOL_WHITE',
    shears: 'SHEARS',
    scissors: 'SHEARS',
    carne: 'MUTTON',
    mutton: 'MUTTON',
});

/**
 * Um índice de nomes → id de item, montado a partir do catálogo de verdade.
 *
 * Vale o nome do código (`dirt`, `wood_door`), o nome que aparece no jogo
 * ("Terra", "Picareta de Diamante"), os apelidos em inglês da tabela acima e o
 * par material+ferramenta das ferramentas (`wood_pickaxe`), que é como o
 * Minecraft as chama.
 */
export function itemIndex({ ITEMS = {}, ID = {} } = {}) {
    const index = new Map();
    const put = (name, id) => {
        const key = normalizeName(name);
        if (key && ITEMS[id] && !index.has(key)) index.set(key, id);
    };
    for (const [alias, idKey] of Object.entries(ITEM_ALIASES)) put(alias, ID[idKey]);
    for (const [idKey, id] of Object.entries(ID)) put(idKey, id);
    for (const [id, item] of Object.entries(ITEMS)) {
        put(item?.name, Number(id));
        if (item?.sprite?.kind && item?.sprite?.mat) put(`${item.sprite.mat}_${item.sprite.kind}`, Number(id));
    }
    return index;
}

/** Um nome digitado → `{ id, name, maxStack }`, ou `null` se não existe. */
export function resolveItem(token, catalog = {}) {
    const index = itemIndex(catalog);
    const id = index.get(normalizeName(token));
    if (id === undefined) return null;
    const item = catalog.ITEMS[id];
    return { id, name: item.name, maxStack: item.maxStack ?? MAX_GIVE };
}

/** "12:30" → fração do dia; `null` se não for hora. */
function parseClock(text) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(text);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    // O relógio do jogo começa às 06:00, então 06:00 equivale a 0.
    return (((hours + minutes / 60) + 18) % 24) / 24;
}

/**
 * `day`, `noon`, `night`, `midnight`, `12:30` ou um número de 0 a 1 (fração do
 * dia). Qualquer outra coisa é `null`.
 */
export function parseTimeValue(token) {
    const text = String(token ?? '').trim().toLowerCase();
    if (!text) return null;
    if (Object.prototype.hasOwnProperty.call(TIME_PRESETS, text)) return TIME_PRESETS[text];
    const clock = parseClock(text);
    if (clock !== null) return clock;
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0 || value > 1) return null;
    return value;
}

/** Fração do dia → "HH:MM", na mesma conta do relógio da HUD. */
export function formatTimeOfDay(fraction) {
    const value = Number.isFinite(Number(fraction)) ? Number(fraction) : 0;
    const hourValue = ((value % 1) + 1) % 1 * 24 + 6;
    const hours = Math.floor(hourValue % 24);
    const minutes = Math.floor((hourValue - Math.floor(hourValue)) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Uma coordenada digitada: número absoluto, `~` (onde está) ou `~2` / `~-1,5`
 * (relativo). `null` quando não dá para ler.
 */
export function parseCoordinate(token, current = 0) {
    const text = String(token ?? '').trim();
    if (!text) return null;
    const base = Number.isFinite(Number(current)) ? Number(current) : 0;
    if (text === '~') return base;
    if (text.startsWith('~')) {
        const offset = Number(text.slice(1));
        return Number.isFinite(offset) ? base + offset : null;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
}

/** Lê a linha do chat sem executar nada. */
export function parseChatInput(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return { kind: 'empty', text: '' };
    if (!text.startsWith(COMMAND_PREFIX)) return { kind: 'message', text };
    const [head, ...args] = text.slice(COMMAND_PREFIX.length).trim().split(/\s+/).filter(Boolean);
    return {
        kind: 'command',
        text,
        name: (head ?? '').toLowerCase(),
        args: args.map(arg => arg.trim()).filter(Boolean),
    };
}

const succeed = (...messages) => ({ ok: true, messages });
const fail = (...messages) => ({ ok: false, messages });

function usageOf(command) {
    return fail(`Uso: ${command.usage}`);
}

/**
 * A tabela de comandos.
 *
 * `run(ctx, args, catalog)` devolve `{ ok, messages }`; mensagem de erro é
 * `ok: false` (o chat pinta de vermelho, como no Minecraft). `usage` é o texto
 * que o `/help` mostra e o que a pré-seleção vai sugerir.
 */
export const CHAT_COMMANDS = Object.freeze([
    {
        name: 'help',
        usage: '/help [comando]',
        summary: 'lista os comandos',
        run(ctx, args) {
            if (!args.length) {
                return succeed(
                    'Comandos (use /help <comando> para ver o uso):',
                    ...CHAT_COMMANDS.map(command => `${command.usage} — ${command.summary}`),
                );
            }
            const command = findCommand(args[0]);
            if (!command) return fail(`Não existe o comando /${args[0]}.`);
            return succeed(command.usage, command.summary);
        },
    },
    {
        name: 'give',
        usage: '/give <item> [quantidade]',
        summary: 'dá itens para você',
        run(ctx, args, catalog) {
            if (!args.length) return usageOf(this);
            // O nome do item pode ter espaços ("picareta de diamante"): a
            // quantidade, se vier, é o último pedaço e é numérica.
            const words = [...args];
            let count = 1;
            if (words.length > 1 && /^[-+]?\d/.test(words[words.length - 1])) {
                const wanted = Number(words[words.length - 1]);
                if (!Number.isInteger(wanted) || wanted < 1) {
                    return fail(`Quantidade inválida: ${words[words.length - 1]}.`);
                }
                count = wanted;
                words.pop();
            }
            const name = words.join(' ');
            const item = resolveItem(name, catalog);
            if (!item) return fail(`Não conheço o item "${name}". Tente /give terra ou /give picareta de diamante.`);
            count = Math.min(count, item.maxStack, MAX_GIVE);
            const given = ctx.giveItem(item.id, count);
            if (!given) return fail('A mochila está cheia.');
            const nota = given < count ? ` (só cabiam ${given})` : '';
            return succeed(`Você recebeu ${given}× ${item.name}${nota}.`);
        },
    },
    {
        name: 'clear',
        usage: '/clear',
        summary: 'esvazia o inventário',
        run(ctx) {
            const removed = ctx.clearInventory();
            return succeed(removed > 0
                ? `Inventário esvaziado (${removed} ${removed === 1 ? 'item' : 'itens'}).`
                : 'O inventário já estava vazio.');
        },
    },
    {
        name: 'time',
        usage: '/time set <day|noon|night|midnight|hh:mm|0-1> · /time add <minutos>',
        summary: 'hora do mundo',
        run(ctx, args) {
            const action = String(args[0] ?? '').toLowerCase();
            if (action === 'set') {
                if (!args[1]) return fail('Uso: /time set <day|noon|night|midnight|12:30|0.5>');
                const value = parseTimeValue(args[1]);
                if (value === null) return fail(`Hora inválida: ${args[1]}.`);
                const applied = ctx.setTime(value);
                return succeed(`Hora do mundo: ${formatTimeOfDay(applied)}.`);
            }
            if (action === 'add') {
                const minutes = Number(args[1]);
                if (!Number.isFinite(minutes)) return fail('Uso: /time add <minutos>');
                const applied = ctx.addTime(minutes);
                return succeed(`Hora do mundo: ${formatTimeOfDay(applied)} (+${minutes} min).`);
            }
            return fail('Uso: /time set <hora> ou /time add <minutos>');
        },
    },
    {
        name: 'tp',
        usage: '/tp <x> <y> <z>',
        summary: 'vai até uma posição (aceita ~)',
        run(ctx, args) {
            if (args.length < 3) return usageOf(this);
            const from = ctx.getPosition();
            const axes = ['x', 'y', 'z'];
            const target = args.slice(0, 3).map((token, index) => parseCoordinate(token, from[axes[index]]));
            if (target.some(value => value === null)) {
                return fail('Coordenadas inválidas. Use números ou ~ para relativo.');
            }
            const [x, y, z] = target;
            if (!ctx.teleport(x, y, z)) return fail('Não dá para ir até aí.');
            const mostra = value => Number(value).toFixed(1);
            return succeed(`Teleportado para ${mostra(x)} ${mostra(y)} ${mostra(z)}.`);
        },
    },
    {
        name: 'kill',
        usage: '/kill',
        summary: 'morre na hora',
        run(ctx) {
            ctx.killPlayer();
            return succeed('Você morreu.');
        },
    },
    {
        name: 'seed',
        usage: '/seed',
        summary: 'semente do mundo',
        run(ctx) {
            return succeed(`Semente do mundo: ${ctx.getSeed()}`);
        },
    },
]);

/** O comando com esse nome (sem a barra), ou `null`. */
export function findCommand(name) {
    const key = String(name ?? '').trim().replace(/^\//, '').toLowerCase();
    return CHAT_COMMANDS.find(command => command.name === key) ?? null;
}

/**
 * Executa uma linha de comando. Linha que não é comando (sem a barra) volta
 * como erro — quem chama só deve passar linhas que começam com `/`.
 */
export function runChatCommand(raw, ctx, catalog = {}) {
    const parsed = parseChatInput(raw);
    if (parsed.kind === 'empty') return succeed();
    if (parsed.kind !== 'command') return fail('Comandos começam com /.');
    const command = findCommand(parsed.name);
    if (!command) return fail(`Comando desconhecido: /${parsed.name}. Digite /help.`);
    try {
        return command.run.call(command, ctx, parsed.args, catalog);
    } catch (error) {
        return fail(`O comando /${command.name} falhou: ${error?.message ?? error}`);
    }
}
