# MELHORIA: o machado volta à base fiel, com ajustes pequenos e nossos

- **Data:** 07/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js`, `tests/tool-art.test.mjs`, `tests/art-style.test.mjs`, `GUIA-DE-ARTE.md`

## O problema

O machado do [#122](MELHORIA-20261106-arte-autoral-ferramentas.md) era desenho
livre. Em 07/11/2026 a picareta voltou à **base fiel** do sprite clássico
([`MELHORIA-20261107-picareta-ajustes.md`](MELHORIA-20261107-picareta-ajustes.md))
e o machado ficou sendo o único com forma inventada na família — lado a lado, os
dois não pareciam saídos da mesma oficina.

A rodada do machado aplica a **mesma receita**: base clássica, 2 px de forma,
cor nossa, sem couro.

## O que mudou

1. **A forma volta à clássica.** A grade foi tirada do sprite 16×16 do machado
   (só os contornos, sem copiar cor) e traduzida para o alfabeto da casa:
   `O` contorno · `1`…`4` a cabeça · `a`…`d` o cabo.
2. **Dois pixels nossos.** O topo da cabeça ganha 1 px à direita e a barba ganha
   1 px à direita. É a mesma conta da picareta — e a mesma régua no teste.
3. **Sem couro.** A faixa sai do machado junto com a da picareta; o cabo fica
   liso. A **pá** ainda tem a dela até chegar a rodada.
4. **Cor:** a paleta é a mesma da família (`MACHADO_PALETAS === PICARETA_PALETAS`)
   e o acento é o amarelo-palha `#ead69e`, num pixel em `(8,2)`.

## A grade (62 px, 16×16)

```
................
.........111....
........5441....
.......14341....
......14333bc...
......O44323a...
.......OOb323O..
........bca33O..
.......bda.OOO..
......bca.......
.....bca........
....bda.........
...bca..........
..bda...........
..aa............
................
```

Perfil por linha: `[0,3,4,5,7,7,7,6,6,3,3,3,3,3,2,0]` — **62 pixels** cheios,
**2 linhas** diferentes da clássica (`[0,2,4,5,7,7,7,6,5,3,3,3,3,3,2,0]`).
Contra o sprite clássico: **2** pixels de forma, **60** de cor, **0** iguais —
nenhum pixel ficou com a cor do original.

## As opções que foram descartadas

Antes de fechar, cinco recortes em cima da base:

| | mudança | por que ficou de fora |
| --- | --- | --- |
| A | só o acento | não muda forma nenhuma: não é "cor + forma" |
| B | topo +1 | bom, mas não distinguia o suficiente |
| **C** | topo +1 e barba +1 | **escolhida** — a receita da picareta |
| D | C + barba descendo 1 px | a barba virava um pingo solto embaixo |
| E | B + gume 1 px à esquerda | o pixel do gume aparecia como um ponto descolado |

O comparador com as cinco está fora do repo, em
`preview/comparador-machado.html` (e `.png`).

## O que fica travado nos testes

- `tests/tool-art.test.mjs`: silhueta `[0,3,4,5,7,7,7,6,6,3,3,3,3,3,2,0]`,
  **62 px**, machado **sem** `g`/`s`, acento único em `[[8,2]]`.
- `tests/art-style.test.mjs`: o couro agora é só da **pá**; "cada silhueta se
  afasta da clássica na medida combinada" passou a exigir **2 linhas e 62 px**
  do machado.

## Pendências da família

- **Pá** — ainda é o desenho livre do #122, com couro. É a próxima rodada.
- **Tesoura** — segue com o desenho antigo.
- **Cabo**: hoje as três usam `CABO_PALETA` (`#3a2a12 … #c39148`), que é mais
  escuro que as tábuas do jogo. Ficou em aberto se o cabo deve adotar de vez os
  tons da tábua — mudaria as três de uma vez.
