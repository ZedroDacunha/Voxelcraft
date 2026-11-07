# MELHORIA: a pá volta à base fiel — a família fecha

- **Data:** 07/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js`, `tests/tool-art.test.mjs`, `tests/art-style.test.mjs`, `GUIA-DE-ARTE.md`

## O problema

A pá era a última ferramenta com o desenho autoral do
[#122](MELHORIA-20261106-arte-autoral-ferramentas.md): concha redonda, pescoço
comprido e **faixa de couro** no cabo. Depois das rodadas da
[picareta](MELHORIA-20261107-picareta-ajustes.md) e do
[machado](MELHORIA-20261107-machado-ajustes.md), ela era a única fora da régua —
e a que mais se afastava do sprite clássico.

## A mudança

Base fiel traduzida do sprite 16×16 da pá para o alfabeto da casa, com **2 px**
de forma nossa:

- **topo da lâmina** 1 px mais largo à esquerda;
- **canto de baixo da lâmina** 1 px de contorno.

E o que já valia nas outras: **sem couro**, **sem acento**, cabo das tábuas,
paleta da família (`PA_PALETAS === PICARETA_PALETAS`).

## A grade (55 px, 16×16)

```
................
................
..........111O..
..........1442O.
.........14324O.
........143234O.
.........b234O..
........bda4OO..
.......bda.O....
......bca.......
.....bda........
....bca.........
..bbda..........
..bda...........
...aa...........
................
```

Perfil por linha: `[0,0,4,5,6,7,5,6,4,3,3,3,4,3,2,0]` — **55 pixels** cheios,
**2 linhas** diferentes da clássica (`[0,0,3,5,6,7,5,5,4,3,3,3,4,3,2,0]`).

## O que foi descartado

Cinco recortes em cima da base: **A** só a base, **B** topo +1, **C** topo e
canto (escolhida), **D** topo e gume de baixo, **E** topo, canto e a outra ponta
do topo. B mudava pouco e E deixava o topo "quadrado" demais. Comparador fora do
repo: `preview/comparador-pa.html` (e `.png`).

## A família fecha

Com a pá, as três ferramentas agora seguem a mesma receita:

| | picareta | machado | pá |
| --- | --- | --- | --- |
| forma | base fiel + 2 px | base fiel + 2 px | base fiel + 2 px |
| pixels | 70 | 62 | 55 |
| linhas fora do clássico | 2 | 2 | 2 |
| couro | não | não | não |
| acento | não | não | não |

`PUNHO_PALETA` (couro e costura) foi **removido** do módulo — não há mais `g`/`s`
em lugar nenhum, então o alfabeto das ferramentas é só `.`, `O`, `1`…`4` e
`a`…`d`.

## O que fica travado nos testes

- `tests/tool-art.test.mjs`: silhueta da pá `[0,0,4,5,6,7,5,6,4,3,3,3,4,3,2,0]`,
  **55 px**; `SIMBOLOS` sem `g`/`s`; as três grades usam exatamente o mesmo
  alfabeto.
- `tests/art-style.test.mjs`: **"nenhuma ferramenta tem faixa de couro"**;
  afastamento da clássica agora é **2 linhas** nas três (70/62/55 px); saiu o
  teste da paleta do couro.

## O que sobra

A **tesoura** — a única ferramenta que ainda usa o desenho antigo, e agora a única
fora da régua.
