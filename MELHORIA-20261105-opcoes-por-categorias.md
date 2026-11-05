# MELHORIA: opções separadas por categorias

- **Data:** 05/11/2026 (depois da [sensibilidade do olhar](MELHORIA-20261105-sensibilidade-do-olhar.md))
- **Status:** implementado
- **Arquivos:** `index.html`, `world-options-view.js`, `tests/options-categories.test.mjs`
  (novo), `tests/game-settings.test.mjs`, `tests/pause-options.test.mjs`,
  `tests/touch-layout.test.mjs`, `tests/touch-positions.test.mjs`,
  `service-worker.js`, `README.md`, `TESTE-EM-NAVEGADOR.md`

## Por que

A tela de opções tinha virado uma parede: seis linhas numa grade de duas colunas,
com volume ao lado de distância de render e "Configurações de toque" no fim,
disputando espaço com sliders. Encontrar uma coisa exigia lembrar onde ela estava
— e o problema só cresceria a cada opção nova (sensibilidade do olhar, vibração
e posição livre já tinham chegado todas na mesma semana).

O Minecraft resolve isso com categorias, e o jogo já tinha o mecanismo: a
sub-tela de toque trocava a grade **no lugar**, sem empilhar janelas. Faltava
generalizar.

## 1. A janela passou a ser uma lista de categorias

```
Opções
├── Áudio      → Volume
├── Gráficos   → Gráficos · Campo de visão · Distância de render
└── Controles  → Sensibilidade do mouse
                 └── Controles de toque  → Sensibilidade do olhar · Mão ·
                                           Tamanho dos botões · Vibração ·
                                           Editar posições
```

Três decisões, escolhidas pelo jogador antes do código:

- **três categorias**, com o mouse e o dedo juntos em **Controles** e o toque
  como sub-opção dentro dela — é onde se procura "como eu controlo o jogo", e
  deixa a lista de entrada curta;
- os botões de categoria mostram **só o nome**: uma lista limpa, com os valores
  guardados onde eles se ajustam. A exceção é a linha **Controles de toque**, que
  continua resumindo (`Destro · 100%`) porque é a única porta que esconde duas
  escolhas de aparência, e quem arrastou os botões precisa se lembrar disso;
- **Restaurar padrões** fica em **todas** as telas, junto do Concluído: a
  correção mais comum é "deixar como era", e não faz sentido obrigar a voltar
  para a lista para isso.

## 2. Uma tabela manda na navegação

`OPTION_SCREENS` descreve cada tela — a grade que ela mostra, o título, o botão
que a abre e o pai para onde o "Voltar" retorna:

```js
{ key: 'touch', grid: 'options-touch-grid', title: 'Controles de toque',
  open: 'opt-touch-open', parent: 'controls', controls: TOUCH_OPTION_CONTROLS },
```

Com isso o `world-options-view.js` não tem mais um caso especial por tela: ele
esconde todas as grades menos uma, acerta o título, o `Voltar` e o
`aria-expanded`, e o `goBack()` sobe um nível lendo `parent`. A sub-tela de toque
deixou de ser um `showTouchScreen(open)` e virou a mesma engrenagem das outras —
o que também significa que uma categoria nova é uma linha na tabela e uma grade
no HTML.

As linhas de valor saíram de uma lista única para listas por categoria
(`AUDIO_OPTION_CONTROLS`, `GRAPHICS_OPTION_CONTROLS`, `CONTROL_OPTION_CONTROLS`,
`TOUCH_OPTION_CONTROLS`), e `OPTION_CONTROLS` continua sendo a soma de todas —
quem já consumia a lista não mudou.

## 3. Detalhes que não podiam quebrar

- **uma janela só**: nada de `showModal` novo nem de segunda caixa; a grade nova
  entra no lugar da anterior, como manda a regra do menu;
- **foco**: ao abrir uma categoria, o foco vai para a primeira linha dela (o
  botão que estava em foco acabou de sair da tela); ao voltar, volta no botão que
  abriu. Fechar o diálogo **não** rouba o foco de quem estava atrás;
- **lista de teclas**: o `<details>` de teclas e mouse agora é da categoria
  **Controles**, que é o lugar dele, e chega recolhido como antes;
- **`Editar posições`**: continua aparecendo só na tela de toque e só dentro do
  mundo (`body.touch-mode`);
- **fechar e reabrir** sempre cai na lista de categorias — quem abriu no ESC para
  mexer no volume não quer cair na tela de toque.

## O que ficou coberto por teste (`npm test`, 725)

`tests/options-categories.test.mjs` (13 testes):

- lista de entrada: as três categorias, na ordem, cada uma um `.classic-btn` de
  navegação sem valor, sem resumo e sem trilho, com `aria-label`,
  `aria-expanded` e `aria-controls` apontando para a grade certa;
- grades: a lista abre visível e todas as categorias começam `hidden`; cada linha
  está dentro da grade da sua categoria e existe no `index.html`;
- hierarquia: `touch.parent === 'controls'`, `controls.parent === 'main'`, e a
  linha de toque é a única com resumo (`.option-summary` uma vez só);
- troca de tela: uma grade por vez, título pela tabela, `Voltar` escondido na
  lista, foco na primeira linha ao abrir e no botão de origem ao voltar, fechar e
  reabrir caindo na lista, e **nenhum** `showModal`/segunda janela no módulo;
- `Restaurar padrões` sem troca de tela; `Editar posições` só no toque; e a regra
  de CSS que faz `.options-grid[hidden]` sumir de verdade.

Os testes antigos acompanharam: a conferência "uma linha por campo" passou a
comparar conjuntos (a ordem virou a das categorias), a contagem de barras e
valores usa a lista única, e o teste da sub-tela de toque agora olha para
`showScreen`/`goBack`.

O que só a tela mostra está no [roteiro](TESTE-EM-NAVEGADOR.md) §18 — em especial
se o caminho `Opções → Controles → Controles de toque` parece curto o bastante
com o dedo.
