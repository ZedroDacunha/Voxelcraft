# MELHORIA: a picareta volta à base fiel, com ajustes pequenos e nossos

- **Data:** 07/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js`, `tests/tool-art.test.mjs`, `tests/art-style.test.mjs`, `GUIA-DE-ARTE.md`

## O problema

O [#119](MELHORIA-20261106-item-picareta.md) tinha a picareta **transcrita** do
sprite clássico — igual, mas cópia. O [#122](MELHORIA-20261106-arte-autoral-ferramentas.md)
respondeu redesenhando as três ferramentas do zero. A picareta autoral ficou
legível e nossa, mas **deixou de parecer a picareta do jogo**: cabo em outro
ângulo, cabeça com outro peso, faixa de couro que nunca existiu ali.

A direção pedida nesta rodada é a do meio: **voltar à versão fiel do #119 e
mexer pouco**. Forma reconhecível, cor nossa.

## O que mudou

Foram três decisões, todas pequenas:

1. **Cor + forma, sem couro.** A silhueta volta à base fiel e ganha **2 pixels**
   de forma própria (a cabeça cresce dois pixels à direita, emendando a barra).
   A faixa de couro sai — era a assinatura que mais pesava na leitura.
2. **Cor mais suave.** A paleta perdeu o contraste duro do #122: sombras mais
   altas, claros mais baixos, o metal lê como metal sem virar desenho animado.
3. **Madeira = a tábua do jogo.** O cabo usa os **mesmos quatro tons do tile
   `PLANKS`** (`world-textures.js`): veio `#7b5b33`, sombra `#977443`, claro
   `#caa66a`, contorno `#563e22`. A ferramenta na mão é feita do chão.

E o pedido específico do metal: **nos metais, o desvio de cor é o mais aparente**.
A madeira fica discreta (é tábua, tem que parecer tábua); ferro, ouro e diamante
é que se afastam do clássico.

## A grade (70 px, 16×16)

```
................
................
......111111....
....11532231bc..
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

Perfil por linha: `[0,0,6,10,8,4,6,6,6,6,6,4,3,3,2,0]` — **70 pixels** cheios,
**2 linhas** diferentes da referência clássica (a 3ª, que ganhou o sexto pixel de
cabeça, e a 4ª, que ganhou o `5`). O acento amarelo-cítrico fica em **um** pixel
no alto da cabeça, `(6,3)`, e é o mesmo `#fdf0a8` das outras ferramentas.

## As paletas

`O` é contorno tingido (nunca preto puro), `1`…`4` vão do escuro ao claro.

| material | `O` | `1` | `2` | `3` | `4` |
| --- | --- | --- | --- | --- | --- |
| wood | `86,62,34` | `123,91,51` | `151,116,67` | `175,140,88` | `202,166,106` |
| stone | `58,56,52` | `82,81,78` | `126,124,119` | `140,138,132` | `163,160,153` |
| copper | `70,38,24` | `122,62,38` | `190,112,66` | `208,146,96` | `232,178,130` |
| iron | `40,45,53` | `66,72,82` | `186,194,203` | `206,214,222` | `238,243,248` |
| gold | `78,50,12` | `152,98,16` | `232,166,28` | `242,198,72` | `255,238,128` |
| diamond | `12,56,56` | `16,98,96` | `34,188,174` | `48,212,196` | `92,240,220` |

A madeira é a tábua, tom a tom. O cobre é nosso (não existe no sprite clássico).
O resto: **ferro puxa azul, ouro puxa laranja, diamante puxa azul-esverdeado**.

## Como isso fica travado nos testes

`tests/art-style.test.mjs` ganhou três provas novas:

- **"a picareta de madeira usa as cores da tábua do jogo"** — os quatro tons da
  madeira têm que ser exatamente os quatro da tábua.
- **"cada silhueta se afasta da clássica na medida combinada"** — picareta com
  **2** linhas diferentes e 70 px; machado e pá com **≥ 8**. A régua antiga (8
  para todos) não valia mais para uma base fiel.
- **"nos metais o desvio de cor é o mais visível"** — mede contra a paleta
  clássica, e o eixo muda por material:

  | material | eixo | régua | nossa média | clássica |
  | --- | --- | --- | --- | --- |
  | ferro | `b − r` | todos os tons ≥ 8 | 16, 17, 16, 10 | 0 |
  | ouro | `r − b` | média acima da clássica | 159,3 | 150,5 |
  | diamante | `b − r` | média acima da clássica | 124,0 | 109,0 |

  A primeira versão deste teste usava `r − b` para os três e **falhava no ouro** —
  e o motivo importa: o ouro clássico já é muito quente (`r − b` = 150,5), então
  "mais ouro" não é "mais vermelho", é mais saturação no mesmo matiz. Ficou
  registrado como armadilha no `GUIA-DE-ARTE.md` §4.

`tests/tool-art.test.mjs` acompanhou: silhueta `[0,0,6,10,8,4,6,6,6,6,6,4,3,3,2,0]`,
70 px, picareta **sem** `g`/`s`, acento único em `[[6,3]]`.

Cobertura por mutação (cada quebra tem que derrubar um teste): madeira fora da
tábua → pega; forma de volta à base (0 px) → pega (3 testes); acento removido →
pega; contorno preto puro → pega; ferro cinza em um tom → pega.

## O que fica para depois

- **Machado** e **pá** ainda são os desenhos autorais do #122, intactos. São as
  próximas rodadas, uma por vez.
- **Tesoura** segue com o desenho antigo.
- O comparador ampliado (fiel · nossa · lado a lado, a 16× e 12×) fica fora do
  repo, em `preview/comparador-picareta.html`.
