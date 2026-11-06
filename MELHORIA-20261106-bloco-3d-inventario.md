# MELHORIA: os blocos viram 3D na barra e no inventário (opção E)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-block-icons.js` (novo), `world-textures.js`,
  `world-catalog.js`, `tests/block-icon.test.mjs`

## O problema

O ícone de um bloco era **uma face só**: o item guardava `iconTile` apontando para
o tile de cima do bloco e o `inventory-assets` recortava aquele quadrado do atlas.
Resultado: na barra, dez blocos diferentes viravam dez adesivos iguais, sem
volume nenhum — a terra, a pedra e o pedregulho pareciam o mesmo retângulo.

## A escolha (feita antes de codar)

Cinco jeitos de desenhar o cubo isométrico, no comparador
(`preview/blocos-3d.html`), cada um com dez blocos e uma linha no **tamanho real**
da barra:

| Opção | Ideia |
| --- | --- |
| A · Clássico | topo claro, esquerda no meio, direita escura (1 : 0,82 : 0,60) |
| B · Suave | menos diferença de luz entre as faces |
| C · Com contorno | cubo 1 px menor, com contorno escuro para não sumir em fundo claro |
| D · De cima | face de cima maior, laterais mais curtas |
| **E · Contraste** ✅ | topo em luz cheia, laterais bem escuras (1 : 0,68 : 0,42) |

**Escolhida: E**, com um pedido junto: *menos pixelado, um pouco mais de
resolução*. Por isso o ícone de bloco é pintado em **32×32** — o tamanho da célula
do atlas — em vez dos 16×16 dos outros itens: assim cada pixel do ícone amostra a
arte do tile quase 1:1 e o cubo sai com detalhe de verdade.

## Como ficou

O desenho mora em `world-block-icons.js`, uma função pura que só conhece os tiles
do bloco e uma fonte de pixels:

| Peça | O que faz |
| --- | --- |
| `BLOCK_ICON_PX = 32` | lado do ícone; cabe inteiro numa célula do atlas |
| `createBlockIconPixels(tiles, pixel)` | para cada pixel da tela, descobre **em qual face** ele cai (topo / esquerda / direita) e em que ponto da textura |
| projeção | isométrica: losango de cima com metade da altura do ícone, laterais descendo até a base |
| luz | `topo ×1`, `esquerda ×0,68`, `direita ×0,42` |
| amostragem | média de uma caixa de texels (o pixel cobre mais de um texel do tile) — sem isso o pedregulho vira chuviscado |
| frente | forno e baú usam `tiles.front` na lateral direita; os outros caem na lateral |

Quem puxa o quê:

- `world-catalog.js`: todo bloco coletável ganhou `sprite: { kind: 'block', mat }`
  e uma **célula própria** no atlas (`iconTile: nextTile++`) — antes ele
  reaproveitava a célula do tile do mundo;
- `world-textures.js`: `spritePixels('block', mat)` monta o cubo com
  `createBlockIconPixels`, usando a mesma fonte de pixels do atlas;
- o atlas passou a desenhar cada ícone **no tamanho da arte** (`32 / arte.length`):
  16 px dobra (2×2), 32 px entra 1:1. A tocha continua com a arte de item dela
  (não é cubo), e o diamante mantém o ID do minério que ele reaproveita.
- o `icon` do forno e do baú saiu do catálogo: ninguém mais usava (a frente vem de
  `tiles.front`).

## Provas

- **1001** testes na suíte (8 novos em `tests/block-icon.test.mjs`):
  - ícone 32×32, `BLOCK_ICON_PX` igual ao lado do tile, pixels só da máscara do cubo
    e canais em 0–255;
  - as três faces existem e a luz é **1 : 0,68 : 0,42** (tolerância de 1 nível);
  - cada face amostra o tile certo (topo, lateral e **frente** quando existe);
  - silhueta de cubo: topo e quinas pintados, **quinas de baixo vazias** e base
    central pintada (é o que faz parecer cubo e não quadrado);
  - determinístico;
  - todo bloco coletável tem sprite `block`, `iconTile` fora da faixa dos tiles e
    **sem dividir célula** com outro bloco (só a tocha fica fora, por não ser cubo);
  - no atlas de verdade, o cubo é desenhado **1:1** (fillRect de 1 px) e ocupa a
    célula inteira;
  - a arte do bloco de verdade tem detalhe: a grama tem mais de 20 cores, topo
    verde e lateral terrosa.
- **Prova de força** (6 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| luz igual nas três faces | 2 |
| a frente do forno/baú é ignorada | 1 |
| ícone volta a ser 16 px | 5 |
| bloco volta a usar a célula do tile | 1 |
| atlas ignora o tamanho da arte e dobra tudo | 1 |
| luz invertida (topo escuro) | 3 |

## Correção que veio depois

O ícone deu `sprite` a todo bloco, e três pontos do `game.js` passaram a tratar
bloco como arte plana — o bloco na mão e no chão apareceram cortados e esticados.
Ver [`BUG-20261106-bloco-na-mao.md`](BUG-20261106-bloco-na-mao.md): a decisão agora
é `itemRenderMode(item)` (`'cube'` × `'sprite'`) e o `buildSpriteGeo` aceita arte
de qualquer tamanho.

## Próximo passo

Nada pendente aqui. Os demais temas (minérios um por vez) seguem esperando a
ordem do usuário.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 42.
