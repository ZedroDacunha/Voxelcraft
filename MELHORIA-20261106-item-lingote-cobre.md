# MELHORIA: o item de lingote de cobre na forma clássica de barra

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/copper-ingot-item-texture.test.mjs`

## O problema

O lingote era o último item da família dos minérios no sprite automático: um
retângulo chapado de 10 × 8 px, com contorno escuro e uma faixa clara em cima —
o mesmo desenho para cobre, ferro e ouro. Não parecia uma barra: parecia um
tijolo.

## A escolha

O pedido foi para redesenhar a barra **na forma clássica do lingote** (o desenho
dos jogos de bloco), "o mais fiel possível".

A primeira tentativa foi um trapézio simétrico, largo na base — e o resultado
lia como um monte de terra. O que faz a barra ler como barra em 16 px é outra
coisa:

- a barra é **tombada na diagonal**;
- existe uma **face de cima** clara, grande, com um reflexo de 1 px;
- o corpo fica **em sombra** embaixo e à direita;
- um **contorno escuro** fecha a silhueta;
- as duas pontas afinam, uma em cima à direita e outra embaixo à esquerda.

Então a forma e o sombreado foram **transcritos pixel a pixel** do lingote
clássico (sprite 16×16, 1.21.4): cada pixel do original foi reduzido a um dos
cinco tons de luminância e virou um dígito no desenho.

```
................
................
..........00....
.......000221...
....0002333321..
.00023333333321.
0433333333334431
0243333334443120
0224334443111120
0222443111112220
012231111122100.
.012311111000...
..01210000......
...0000.........
................
................
```

`0` = contorno/sombra · `4` = reflexo. **135 px**, 53% do ícone, uma peça só.

## As cores são nossas

O original é cinza; aqui o metal é **cobre fundido** — mais vermelho e mais claro
que o minério bruto (que é um punhado de grumos):

| tom | cor | onde |
| --- | --- | --- |
| 0 | `62,30,22` | contorno e sombra funda |
| 1 | `128,62,40` | corpo em sombra |
| 2 | `146,72,46` | grão do sombreado (de propósito perto do 1) |
| 3 | `246,182,132` | face de cima na luz |
| 4 | `255,236,206` | reflexo |

O tom `2` fica perto do `1` de propósito: no original o "grão" é cinza sobre
cinza e lê como sombreado; no cobre, se abrisse muito, viraria textura de
ferrugem.

## Como ficou no código

- `LINGOTE_GRADE` — a forma, **uma só para todos os metais**;
- `LINGOTE_PALETAS` — a paleta por metal (hoje só `copper`);
- `ARTES_ITEM_LINGOTE` — junta forma + paleta, no mesmo padrão do
  `ARTES_ITEM_BRUTO` e do `ARTES_ITEM_GEMA`;
- `createMineralSpritePixels('ingot', material)` usa a arte desenhada quando ela
  existe e **cai no retângulo genérico** quando não — ferro e ouro continuam
  iguais até a rodada deles;
- `ingotItemGradeFor(material)` dá acesso à forma para o teste.

Como a forma é compartilhada, os lingotes de **ferro** e de **ouro** vão precisar
só de paleta na rodada deles.

## Provas

- **1078** testes na suíte (9 novos em `tests/copper-ingot-item-texture.test.mjs`):
  - o desenho é 16×16 e cada célula tem um tom de 0 a 4;
  - a **silhueta** bate linha a linha (`0,0,2,6,10,14,16,16,16,16,15,12,8,4,0,0`),
    135 px, e é **uma peça só** (sem farelo solto);
  - 1 px por célula, transparente fora da barra, e **cada pixel usa o tom escrito
    no desenho**;
  - o **contorno é escuro** (média de tom ≤ 0,5) e o interior é claro (≥ 2);
  - **a luz vem de cima**: metade de cima mais clara que a de baixo, e o reflexo
    (tom 4) sempre na metade de cima;
  - é cobre: R > G > B e R−B > 70; e a arte **não se confunde com o minério
    bruto** (grumos), que continua igual;
  - ferro e ouro **continuam genéricos** (retângulo de 80 px), provando que a arte
    não vazou para os outros metais;
  - determinística, cores em 0–255.
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| cobre volta ao retângulo genérico | 6 |
| a forma vira um retângulo | 7 |
| paleta invertida (contorno claro, face escura) | 1 |
| o reflexo (tom 4) vira tom 0 | 1 |
| ferro e ouro herdam a arte do cobre | 1 |

## Próximo passo

Os lingotes de **ferro** e de **ouro**: mesma forma, paleta nova.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 52.
