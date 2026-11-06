# MELHORIA: o item de picareta, transcrito do desenho clássico

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js` (novo), `world-textures.js`, `tests/pickaxe-item-texture.test.mjs`

## O problema

A picareta era montada por código: um cabo diagonal desenhado num mapa e uma
cabeça em outro, com a cabeça saindo de degradês calculados (`metalHeadColors`).
O resultado não batia com o desenho clássico que você mandou: o cabo tinha outra
inclinação, a cabeça era um "L" achatado e não havia contorno fechando a silhueta.

## A transcrição

A arte foi **copiada pixel a pixel** do desenho clássico da picareta (sprite
16×16), não redesenhada "de olho". A partir do sprite original saiu:

- **uma grade de papéis** (`PICARETA_GRADE`) — 16×16, cada célula com um símbolo:
  - `O` contorno,
  - `1`…`4` a cabeça, do escuro ao reflexo,
  - `a`…`d` o cabo, do escuro ao claro;
- **uma paleta por material**, com esses nove tons.

```
................
................
......11111.....
.....1432231bc..
......1OOO22da..
..........b32O..
.........bca23O.
........bda.O2O.
.......bca..O2O.
......bda...O3O.
.....bca....O4O.
....bda......O..
...bca..........
..bda...........
..aa............
................
```

A picareta é **uma peça só de 68 px**: cabeça = a barra de cima + a haste que
desce pela direita; cabo = a diagonal que sai de trás da cabeça e termina na
quina de baixo à esquerda. Dois pixels de reflexo (`4`), na cabeça.

## Fidelidade conferida com bytes

Comparação da nossa arte com os sprites originais, pixel a pixel:

| material | pixels idênticos |
| --- | --- |
| madeira | **256/256** |
| pedra | **256/256** |
| ferro | **256/256** |
| ouro | **256/256** |
| diamante | **256/256** |

Nenhum símbolo da grade tem mais de uma cor em nenhum dos materiais — é isso que
garante que a transcrição é fiel e não uma aproximação. Detalhe que só apareceu
na conferência: **a picareta de madeira usa tons de cabo um pouco mais quentes**
que as outras (o desenho original também faz isso), então o cabo dela tem paleta
própria.

O **cobre** é do nosso jogo (o desenho clássico não tem picareta de cobre): a
paleta dele foi derivada do cobre fundido dos lingotes, mantendo a mesma
estrutura de quatro tons + contorno.

## Como ficou no código

- módulo puro novo `world-tool-textures.js` (sem DOM, sem THREE), com
  `PICARETA_GRADE`, `CABO_PALETA`, `PICARETA_PALETAS`, `createPickaxeSpritePixels(mat)`,
  `pickaxeGradeFor`, `pickaxePaletteFor` e `pickaxeMateriais()`;
- `world-textures.js`: o galho `pickaxe` passou a usar essa arte;
- **material fora da arte cai no desenho antigo** (`createPickaxeSpritePixels`
  devolve `null`) — nada quebra se aparecer um material novo antes da arte dele.

## Provas

- **1104** testes na suíte (9 novos em `tests/pickaxe-item-texture.test.mjs`):
  - grade 16×16 só com os símbolos do desenho;
  - **silhueta linha a linha** (`0,0,5,9,8,4,6,6,6,6,6,4,3,3,2,0`), 68 px, uma peça só;
  - 1 px por célula, transparente fora, em **todos os seis materiais**;
  - **cada símbolo tem um tom** e todo símbolo da grade existe nas paletas;
  - a cabeça é a barra de cima + a haste da direita, o cabo é a diagonal, e o
    reflexo aparece **exatamente** em `(6,3)` e `(13,10)`;
  - os tons da cabeça crescem do escuro ao claro e o contorno é o mais escuro;
  - **os seis materiais se distinguem pela cor** (madeira marrom, pedra cinza,
    cobre quente, ferro claro e neutro, ouro amarelo, diamante ciano) e nenhum par
    desenha os mesmos pixels;
  - material desconhecido devolve `null`;
  - determinístico, cores em 0–255 e **sem sprite compartilhado** entre chamadas.
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| ferro com a paleta da pedra | 2 |
| a grade vira um retângulo | 3 |
| cabo pintado com a cor da cabeça | 1 |
| tons da cabeça invertidos | 1 |
| diamante com a paleta do ouro | 2 |

## Próximo passo

O **machado** e a **pá** continuam no desenho antigo (e com o cabo de outra
inclinação) — são as próximas duas, uma por PR, do mesmo jeito: transcrever o
desenho clássico e dar paleta por material.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 55.
