# MELHORIA: os itens de carvão ganham arte própria (opção E)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `world-textures.js`,
  `tests/coal-item-texture.test.mjs`

## O problema

O bloco de minério já era pixel art desenhada (PR #103), mas **os itens** que caem
dele continuavam na arte velha:

| Item | Antes | Como era feito |
| --- | --- | --- |
| Carvão (mineral) | amontoado chapado, sem relevo | três "elipses" de raio fixo, cor sorteada por `(x + y) % 5` |
| Carvão vegetal | quase o mesmo amontoado | elipse chapada `(x − 7,5)/5, (y − 9)/3,6` com `(x + y) % 3` |

Os dois eram **a mesma mancha cinza-escura** — na barra de itens o jogador não
sabia qual era qual sem passar o mouse.

## A escolha (feita antes de codar)

Cinco opções desenhadas no comparador dos itens (`preview/itens-carvao.html`),
cada uma com **duas formas**: uma para o mineral (pedra) e outra para o vegetal
(madeira queimada).

| Opção | Mineral | Vegetal |
| --- | --- | --- |
| A · Clássico | torrão redondo | toco em pé |
| B · Lasca | lasca com aresta | graveto fino na diagonal |
| C · Farelo | pedaço médio + farelo | lasca deitada + farelo |
| D · Quinhão | pedaço quadrado e chapado | toco grosso e baixo |
| **E · Punhado** ✅ | **três pedaços** | **três gravetos** |

**Escolhida: E.** É a única em que a **forma** também muda, não só a cor: o
mineral é um punhado de pedra gorda, o vegetal são três gravetos finos. Com cor
diferente **e** silhueta diferente, os dois se leem de relance.

## Como ficou

Uma arte só, servindo os dois itens, em `world-mineral-textures.js`:

| Peça | O que faz |
| --- | --- |
| `CARVAO_ITEM` | as duas camadas (`mineral`, `vegetal`), cada uma com paleta e máscara |
| máscara 16×16 | um caractere = **um pixel** do ícone (o item é 16×16, dobrado 2× para o atlas) |
| `pintarItem` | relevo automático: beirada de cima/esquerda clara, de baixo/direita escura |
| miolo | dois tons (`meio`/`corpo`) sorteados por pixel com `hash2(x, y, 4242)` |
| grão | só no vegetal: risco escuro curto (`hash2(x/4, y/2, 9091) > 0,74`) — madeira queimada |
| `createCoalItemSpritePixels(camada)` | devolve o sprite 16×16 da camada pedida |

Paletas (todas múltiplas de 8, que é como a arte foi mostrada no comparador):

| Camada | escuro | corpo | meio | claro |
| --- | --- | --- | --- | --- |
| mineral (pedra, frio) | `16,16,24` | `40,40,48` | `56,56,64` | `96,96,112` |
| vegetal (madeira, quente) | `24,24,16` | `56,48,40` | `72,56,48` | `104,88,72` |

Quem puxa cada item:

- **mineral** — continua entrando por `createMineralSpritePixels('coal', 'coal')`,
  que agora devolve `createCoalItemSpritePixels('mineral')` (o caminho dos
  minérios não mudou);
- **vegetal** — `world-textures.js` ganhou o caso `kind === 'charcoal'`, que
  devolve `createCoalItemSpritePixels('vegetal')`. Antes ele dividia o `if` com a
  maçã.

A arte foi **levantada um pixel** em relação ao comparador para não encostar na
borda do ícone (quem encosta cola no ícone vizinho na barra).

## Provas

- **993** testes na suíte (9 novos em `tests/coal-item-texture.test.mjs`):
  - as duas máscaras são 16×16, só com `#` e `.`, e **diferentes** entre si;
  - o sprite só usa as **quatro cores** da paleta da camada (relevo + dois tons);
  - nenhum pixel pintado **fora** da máscara, e nenhum colando na primeira/última
    linha ou coluna (respiro do ícone);
  - a cobertura fica entre 15% e 45% do ícone (nem sumido, nem tampando);
  - **cor fria contra cor quente**: o mineral tem azul > vermelho, o vegetal
    vermelho > azul, e o mineral tem ≥ 15 px pintados a mais (pedra gorda × graveto);
  - o vegetal tem **grão** (pixel escuro no meio do pedaço) e o mineral não;
  - determinístico, canais inteiros em 0–255, camada inválida devolve `null`;
  - o item de carvão mineral sai igual pelo caminho dos minérios;
  - **no atlas de verdade** (canvas falso que grava cada `fillRect`), a célula do
    carvão mineral só pinta as 4 cores do mineral e a do vegetal as 4 do vegetal —
    é a prova de que o jogo desenha a arte nova, não só que a função existe.
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| a paleta do vegetal vira a do mineral | 4 |
| o grão do vegetal é desligado | 1 |
| a máscara do vegetal vira a do mineral | 2 |
| o ramo do `charcoal` deixa de desenhar | 1 |
| a arte do vegetal encosta na borda | 1 |

## Próximo passo

Os demais minérios (cobre, ferro, ouro, diamante) continuam na arte genérica
(`ORE_CENTERS`): cada um ganha a sua rodada de opções A–E, como o carvão.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 41.
