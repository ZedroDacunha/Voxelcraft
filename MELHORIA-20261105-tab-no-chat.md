# MELHORIA: a pré-seleção com Tab no chat

- **Data:** 05/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-chat-completion.js` (novo), `game.js`,
  `index.html`, `styles.css`, `tests/chat-completion.test.mjs` (novo)

## Antes

O chat (PR #86 / `MELHORIA-20261105-chat-e-comandos.md`) só aceitava a linha
inteira digitada à mão: para oito comandos era tolerável, mas `/give` tem **49
itens** e nenhum jogador vai decorar se o nome é `picareta de diamante`,
`Picareta de Diamante` ou `diamond_pickaxe`. E o `/time set` tem oito atalhos de
hora que ninguém lembra na ordem.

## Depois

### Tab completa, Shift+Tab volta

- `/gi` + **Tab** → `/give ` (com o espaço já posto, porque comando é sempre
  seguido de argumento).
- `/time set n` + **Tab** → `/time set noon `; **Tab** de novo → `night`.
- `/give picareta` + **Tab** → `Picareta de Cobre `; **Tab** → `Diamante` →
  `Ferro` → `Madeira` → `Ouro` → `Pedra` → volta para `Cobre`. **Shift+Tab**
  anda para trás (do primeiro, cai no último).
- **Qualquer outra tecla reinicia a volta**: depois de digitar, o Tab volta a
  começar do primeiro candidato, em vez de continuar de onde parou.
- Tab sem candidato não mexe na linha (nada de apagar o que foi escrito).

### A lista na tela (a "pré-seleção")

Embaixo do log e colado na linha de digitação aparece a lista de candidatos, com
o que o **Tab vai escolher** destacado — em comando, com o resumo ao lado
(`/give · dá itens para você`). Cabem oito; o resto vira `+N — Tab percorre
todas`, e a janela desliza para o candidato ativo não sair de vista.

No celular, **tocar num nome insere** aquele candidato (útil quando o teclado
virtual está cobrindo metade da tela).

### O que cada posição da linha oferece

| Digitando | O Tab oferece |
| --- | --- |
| `/…` (nome do comando) | os oito comandos da tabela |
| `/help …` | os nomes dos comandos |
| `/give …` (primeiro argumento) | os 49 itens do catálogo, pelo nome do jogo |
| `/time …` | `set`, `add` |
| `/time set …` | `day`, `noon`, `night`, `midnight`, `sunrise`, `sunset`, `dusk`, `dawn` |
| `/tp …`, `/clear`, `/kill`, `/seed` | nada (são números ou não têm argumento) |

A comparação **ignora acento, maiúscula e espaço**: `/give PÓ` acha "Pó
luminoso", `/give ter` acha "Terra", `/TI` acha `/time`.

## Como está montado

`world-chat-completion.js` é puro — sem DOM, sem teclado, sem relógio:

- `completionsFor(text, { catalog })` recorta a linha em `{ base, token, matches }`
  e diz o que cabe naquele pedaço (`base` é o que não se mexe, `token` é o que o
  Tab substitui — e, no nome do comando, a base é vazia para o `/gi` inteiro ser
  trocado em vez de costurado);
- `createChatCompleter({ catalog })` guarda a **volta** (o segundo Tab anda em vez
  de recomeçar) e devolve também o `activeIndex` que a lista destaca;
- `visibleSuggestions(matches, activeIndex, limit)` é a janela de oito com o ativo
  dentro e a contagem do que ficou de fora;
- `itemSuggestionNames(catalog)` monta a lista de itens **do catálogo de
  verdade**, ordenada pela chave sem acento (a ordem não depende do idioma do
  navegador).

Quem sabe o que é comando e o que é item continua sendo
`world-chat-commands.js` — a mesma tabela do `/help`. Nada de lista digitada à
mão: item novo no catálogo aparece no Tab sozinho.

No `game.js` ficaram só as três pontas: `completeChat()` no `keydown` do Tab,
`renderChatSuggest()` desenhando a lista e `pickChatSuggestion()` para o toque.

## Validação

```bash
npm test        # 862 testes (19 novos em tests/chat-completion.test.mjs)
npm run check   # sintaxe (155 arquivos) + importmap em dia
npm run stamp   # index.html recarimbado
```

**Prova de força** — cada quebra proposital derruba o teste que a defende:

| Quebra proposital | Teste que reprova |
| --- | --- |
| Tab sem o espaço depois do comando | "o primeiro Tab completa o pedaço e já deixa o espaço" |
| Tab sempre no primeiro candidato (sem volta) | "o segundo Tab anda para o próximo candidato" e mais quatro |
| nome de comando comparado com maiúscula | "no nome do comando, o Tab oferece os comandos da tabela" |
| item comparado sem tirar acento | "/give lista os itens do catálogo" |
| janela da lista travada na primeira página | "a lista mostra só o que cabe na tela" |
| atalho de hora inventado (`lunch`) | "depois do comando, cada um oferece o seu argumento" |

## O que ainda **não** existe (de propósito)

- completar **nome de item item a item com aspas** quando o nome tem espaço (aqui
  o `/give` aceita o nome composto sem aspas, então não precisa);
- completar coordenada de `/tp` (não há o que sugerir além de `~`);
- lista de comandos com histórico de uso ("os últimos que você digitou primeiro").
