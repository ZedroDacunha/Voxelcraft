# MELHORIA: a tesoura entra na régua da família

- **Data:** 07/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js`, `world-textures.js`, `tests/shears-art.test.mjs`, `GUIA-DE-ARTE.md`

## O problema

A tesoura era a última ferramenta desenhada por código: um "X" de ferro com
argolas, montado em `world-textures.js`. Depois das rodadas da
[picareta](MELHORIA-20261107-picareta-ajustes.md), do
[machado](MELHORIA-20261107-machado-ajustes.md) e da
[pá](MELHORIA-20261107-pa-ajustes.md), ela era a única fora da régua — e a única
que ainda se afastava bastante do sprite clássico.

## A mudança

Base fiel traduzida do sprite clássico (16×16) para o alfabeto da casa, com **2
pixels** de forma nossa. A tesoura tem uma divisão de material própria:

- **lâminas** — o metal do material (`O` no fio, `2`…`4` na face);
- **punho** — madeira (`a`…`d`), a mesma tábua do cabo das ferramentas.

## A grade (79 px, 16×16)

```
................
................
........b3443...
.......b2443.3..
......bc343.34..
.....bd343.344..
....bda23.3443..
....bda..3432a..
...bda...23ba...
...bca..bbba....
...33bbbcca.....
..3..2ccaa......
..2a.Oaa........
...OOa..........
................
................
```

Perfil por linha: `[0,0,5,6,7,8,9,8,7,7,8,6,5,3,0,0]` — **79 pixels** cheios.

## Os 2 px que fazem diferença

Não são enfeite: no sprite clássico as pontas das argolas do punho ficam
**soltas** — dois pares de pixels separados do corpo (4 px no total). Os nossos
dois pixels, em `(3,12)` e `(5,13)`, fecham os anéis e emendam tudo:

| | antes | agora |
| --- | --- | --- |
| peças conectadas (4-vizinhos) | 3 grupos (73 + 2 + 2) | **1 grupo, 79 px** |

É a mesma conta das outras ferramentas — 2 linhas fora da silhueta clássica —,
mas aqui ela também resolve a leitura: tesoura inteiriça.

## Por que o punho é de madeira

O sprite clássico tem o punho num marrom escuro, separado das lâminas claras.
Nossa família só tem uma rampa por material, então havia duas saídas: afundar o
punho no ferro (virava uma mancha azul-escura) ou usar a rampa da tábua. A tábua
ganhou — é a regra da família ("toda ferramenta tem o cabo de madeira do jogo") e
devolve o contraste de duas partes que a tesoura precisa para ser lida como
tesoura.

## O que fica travado nos testes

`tests/shears-art.test.mjs` (novo, 6 testes):

- grade 16×16 no alfabeto da casa, **sem** `5`, `g` ou `s`;
- silhueta `[0,0,5,6,7,8,9,8,7,7,8,6,5,3,0,0]`, **79 px**, **uma peça só**;
- cada símbolo pinta o tom certo — metal = ferro, punho = tábua;
- as lâminas são claras e o punho escuro (diferença de luminância > 60);
- a arte é determinística e não é compartilhada;
- **o atlas desenha a tesoura com esta arte** (não com o desenho antigo).

O desenho antigo continua no `world-textures.js` como **queda**, para o caso de a
arte sumir — o mesmo padrão da picareta, do machado e da pá.

## Comparador

`preview/comparador-tesoura.html` (e `.png`): clássico × nossa, no tamanho real e
ampliado, com as variantes de forma e a tabela da família.
