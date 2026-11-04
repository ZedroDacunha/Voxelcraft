# MELHORIA: menu de pausa no ESC e opções dentro do jogo

- **Data:** 04/11/2026 (interface; depois do [revert do degrau automático](https://github.com/ZedroDacunha/SiteCraft/pull/58))
- **Status:** implementado
- **Arquivos:** `index.html`, `styles.css`, `game.js`, `game-pause-menu.js`,
  `world-options-view.js`, `world-game-settings.js`, `world-graphics-quality.js`,
  `tests/pause-options.test.mjs` (novo), `tests/game-settings.test.mjs`,
  `tests/graphics-quality.test.mjs`, `tests/game-menu-state.test.mjs`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

Apertar `ESC` no meio do jogo soltava o mouse e mostrava um painel que era resto
do começo do projeto: **"Voxel Sandbox"**, "Parte 11 — Água, Natação…", "Clique
para Jogar" e um "Voltar à seleção de mundos". Nada ali era de pausa de verdade,
e a **tela de opções só existia no menu de fora** — para mudar sensibilidade ou
volume no meio de uma partida era preciso sair do mundo e voltar.

O pedido era o do Minecraft: `ESC` abre o menu de pausa, e de lá se chega às
opções.

## 1. O menu de pausa

`#menu` deixou de ser texto solto e virou um **cartão** (`.pause-card`) no padrão
de botões do jogo — `.classic-btn` cinza, borda 2px, sem raio:

```
Jogo pausado
[ Voltar ao jogo ]
[ Opções… ]
[ Salvar e sair para os mundos ]
▸ Controles        (recolhido: teclas, F3/F4, água)
```

- o texto "Parte 11…" e o "Clique para Jogar" saíram; o `id="btn-play"`
  continuou o mesmo, então a trava de 1,3 s do *pointer lock* (o navegador não
  devolve o mouse na hora) segue funcionando sem mudar uma linha dela;
- as dicas de teclado viraram `<details>`: quem já sabe jogar não precisa ler;
- `pauseMenuDisplay()` passou a devolver **`grid`** em vez de `flex` — o cartão é
  centralizado pelo `place-items` do `#menu`, e o menu continua oculto quando o
  inventário, a tela de morte ou o jogo em si já ocupam a tela;
- no toque, o botão **Pausar** abre o mesmo cartão (o aviso `#menu-touch-hint`
  ficou dentro dele).

## 2. A tela de opções vira grade (estilo Minecraft)

O mesmo `<dialog id="options-dialog">` do menu inicial, agora em **grade de duas
colunas** (uma no celular). Cada opção é uma barra com o nome à esquerda e o
valor à direita:

| Opção | Valores |
| --- | --- |
| Sensibilidade do mouse | 50% a 200%, passo 5% |
| Campo de visão | 60° a 100° |
| Distância de render | 2 a 6 chunks |
| Volume | mudo a 100% |
| Gráficos | Automática · Máxima · Alta · Média |

Gesto: **clique e arraste** definem o valor pela posição na barra (é o que
funciona no dedo também); setas andam um passo e `Home`/`End` vão aos extremos.
O botão tem `role="slider"` com `aria-valuemin/max/now/valuetext`, então leitor
de tela anuncia "Campo de visão: 75°" como slider de verdade.

O preenchimento da barra é uma variável CSS (`--option-fill`) escrita pelo
`world-options-view.js` — sem `input[type=range]`, que no toque e no visual do
jogo nunca ficou bom.

## 3. O que vale na hora e o que espera

A gravação fica em `world-game-settings.js` (localStorage) como antes. A novidade
é que **quem grava avisa**: `notifyGameSettingsChange()` / `onGameSettingsChange()`
— o mesmo padrão de assinatura que já se usa no áudio. O `game.js` assina e
aplica o que dá sem recarregar o mundo:

| Opção | Como entra |
| --- | --- |
| Sensibilidade | na hora (`LOOK_SENSITIVITY` virou `let`) |
| Campo de visão | na hora (o alvo do FOV já era lido por quadro) |
| Volume | na hora (`audio.setVolume`) |
| Gráficos | na hora, pelo **mesmo caminho do F4** (`gfx.setMode`) |
| Distância de render | só no próximo mundo — e o painel diz isso |

A qualidade gráfica ganhou `setMode(modo)` em `world-graphics-quality.js`, que
divide o `applyMode()` com o `cycle()` do `F4`: as duas formas de trocar
qualidade não podem divergir. O valor salvo é aplicado ao entrar no mundo com
`{ quiet: true }`, para não aparecer um aviso de algo que o jogador não mudou
agora.

A distância de render fica de fora de propósito: mudar chunks com o mundo
rodando é outro assunto (recarregar região, reconstruir malha, mexer no que já
foi gerado). Prometer ao vivo e não cumprir seria pior do que dizer quando vale.

## 4. Testes (22 novos, 564 no total)

- `tests/pause-options.test.mjs` (11): o menu de pausa tem os três botões no
  `.classic-btn`, o texto velho saiu, o cartão segue o padrão (borda 2px), o
  `ESC` abre o diálogo, as duas telas usam **os mesmos** controles, todo botão
  do formulário tem `type` (um `submit` acidental fecharia a tela), a grade vira
  uma coluna no celular, e o `game.js` aplica ao vivo **menos** a distância de
  render;
- `tests/game-settings.test.mjs` (+5): campo de lista (`graphics`) com
  sanitização, posição/valor na barra (ida e volta), passo que para no limite e
  dá a volta na lista, formatação, e o aviso de mudança (ouvinte com erro não
  derruba os outros);
- `tests/graphics-quality.test.mjs` (+4): `setMode` faz o mesmo que o `F4`,
  modo desconhecido é ignorado sem aviso, `quiet` cala o aviso do boot, e o
  `cycle` continua a lista de onde a escolha direta parou;
- `tests/game-menu-state.test.mjs`: `pauseMenuDisplay()` agora é `grid`.

## 5. O que sobra (de propósito)

- **`ESC` de novo não volta ao jogo**: quem volta é o botão. O navegador segura
  o *pointer lock* por ~1 s depois do ESC, e um atalho que falha às vezes é pior
  que um botão que sempre funciona;
- **distância de render ao vivo** (recarregar chunks) — assunto próprio;
- **tela de controles separada** com remapeamento de teclas: o `Controles` é
  informativo, como era antes;
- **validar no navegador**: teclas/barras, arraste no celular e o menu de pausa
  em tela pequena — o item 6 do [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md)
  cobre exatamente isso.
