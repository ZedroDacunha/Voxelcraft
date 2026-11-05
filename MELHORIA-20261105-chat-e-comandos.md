# MELHORIA: o chat e os comandos

- **Data:** 05/11/2026
- **Status:** implementado (parte 1 — a pré-seleção com Tab fica para a próxima)
- **Arquivos principais:** `world-chat.js` (novo), `world-chat-commands.js` (novo),
  `game.js`, `index.html`, `styles.css`, `game-pause-menu.js`,
  `world-touch-controls.js`, `world-touch-positions.js`, `tests/chat.test.mjs` (novo)

## Antes

Não havia como falar com o jogo. Para mudar a hora do mundo, ganhar um item ou
se teleportar existia só o `window.dbg` — e só com `?debug` na URL, abrindo o
console do navegador. No celular, nenhum dos dois.

## Depois

### O chat

- **`T` abre** a linha de digitação (vazio). **`/` abre já com a barra**, que é o
  atalho do Minecraft para comando.
- **`Enter` envia**, **`Esc` fecha sem enviar**. Linha vazia só fecha.
- **`↑`/`↓`** percorrem o que já foi enviado (50 linhas de histórico), e `↓` além
  do fim devolve o rascunho que estava sendo escrito.
- O log fica no canto de baixo, em cima da hotbar: cada linha **apaga sozinha em
  10 s** com o chat fechado, e o histórico todo fica visível com ele aberto.
- Texto sem barra aparece como fala (`Jogador: oi`); com barra, vira comando, e a
  linha digitada fica no log junto da resposta — erro sai em vermelho.
- **No celular** há um botão de chat na faixa do topo (ao lado de Mochila e
  Pausar), que abre a linha e chama o teclado virtual. O botão entra também na
  edição de posições, como todos os outros.

**O mundo continua rodando enquanto se digita** (decisão do pedido, como no
Minecraft): o sol anda, a água corre, os bichos vivem, a fome segue. O jogador é
que fica parado — as teclas vão para a linha de digitação e o mouse está solto.
Soltar o mouse para digitar **não é pausa**: o menu de pausa não aparece (o
estado `chatOpen` entrou em `game-pause-menu.js`, no mesmo lugar do inventário) e,
ao fechar, o jogo volta a capturar o mouse.

### Os comandos

| Comando | O que faz |
| --- | --- |
| `/help [comando]` | lista todos (ou detalha um) |
| `/give <item> [quantidade]` | dá itens; aceita `dirt`, `minecraft:dirt`, `terra`, `cobblestone`, `picareta de diamante`… |
| `/clear` | esvazia o inventário e conta o que saiu |
| `/time set <day\|noon\|night\|midnight\|12:30\|0-1>` | põe o relógio na hora pedida |
| `/time add <minutos>` | adianta o relógio em minutos do jogo |
| `/tp <x> <y> <z>` | teleporta; aceita `~`, `~2`, `~-1.5` |
| `/kill` | morre na hora |
| `/seed` | mostra a semente do mundo |

Detalhes que o jogador sente:

- **`/give` com nome composto**: `picareta de diamante` funciona — o último pedaço
  numérico é a quantidade, o resto é o nome. O nome é comparado sem acento, sem
  maiúscula, sem espaço/underscore e sem `minecraft:`; valem o nome do código, o
  nome que aparece no jogo e alguns apelidos em inglês (`cobblestone`, `planks`,
  `wood`).
- **Empilhamento respeitado**: pedir 64 picaretas dá 1, e a resposta diz quando só
  coube parte (`Você recebeu 3× Terra (só cabiam 3).`).
- **Mochila cheia** é aviso, não silêncio.
- **Hora**: o relógio do jogo tem o zero às 06:00 (`world-clock.js`), então
  `12:30` vira a fração certa e a resposta devolve a hora já formatada
  (`Hora do mundo: 12:30.`), na mesma conta da HUD.
- **Teleporte** recusa destino fora do mundo em vez de cair no vazio.

### Como está montado

- **`world-chat.js`** — só o estado (log, rascunho, histórico do ↑), sem DOM:
  dá para testar "Enter limpa a linha" e "linha velha apaga" sem navegador.
- **`world-chat-commands.js`** — a **tabela** de comandos e um `ctx` que o jogo
  preenche (teleportar, dar item, matar…). O módulo é puro: nenhum comando conhece
  THREE, mundo ou DOM, e cada um é testável com um `ctx` de mentira e o catálogo
  de verdade.
- **`game.js`** — DOM, teclado, o que cada comando faz no jogo e o desenho do log
  (que só mexe no DOM quando o texto visível muda).

A tabela é o que prepara a próxima parte: **Tab** completa por prefixo procurando
nesta mesma lista (`/t` → `time`, `tp`), com o `usage` de cada comando como
sugestão.

## Validação

```bash
npm test        # 843 testes (35 novos em tests/chat.test.mjs)
npm run check   # sintaxe (154 arquivos) + importmap em dia
npm run stamp   # index.html recarimbado
```

**Prova de força** — cada quebra proposital derruba o teste que a defende:

| Quebra proposital | Teste que reprova |
| --- | --- |
| linha nunca apaga | "com o chat fechado a linha apaga sozinha" |
| relógio com outra origem (06:00 ≠ 0) | "hora aceita atalho, hh:mm e fração" e "/time set…" |
| `/give` sem limite de pilha | "/give respeita o empilhamento máximo" |
| `chatOpen` fora do menu de pausa | "menu de pausa fica oculto durante jogo, inventário, chat ou morte" |
| mundo parado ao digitar | "o mundo continua rodando enquanto se digita" |
| `/help` sem listar | "/help lista todos os comandos" |

## O que ainda **não** existe (de propósito)

- **pré-seleção com Tab** (próxima parte);
- nomes de comando em português (`/dar`, `/hora`) — os comandos seguem o inglês do
  Minecraft, só as respostas são em português;
- histórico do chat salvo no save (ao recarregar, o log começa vazio);
- autocomplete de item no `/give` (vem junto com o Tab).
