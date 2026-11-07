# MELHORIA: a picareta ganha cabeça própria

- **Data:** 07/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js`, `tests/tool-art.test.mjs`, `tests/art-style.test.mjs`, `GUIA-DE-ARTE.md`

## O problema

A picareta era a primeira da régua: **base fiel** do sprite clássico com **2 px**
de forma nossa — um no topo da peça e outro na ponta. É exatamente o que a
tesoura era antes de a arte autoral entrar na conversa, e o usuário já disse o
que pensa disso:

> "o exemplo é o do jogo original, mude suavemente para não termos problemas com
> arte autoral"

2 px não é diferença: é a mesma figura. A picareta precisava do mesmo remédio da
tesoura — mexer na **estrutura**.

## A mudança

O alvo é a **cabeça**, que é o que dá identidade à picareta. Três decisões:

1. **fundo da cabeça mais fino.** As quatro fileiras de baixo (`(6,4)`…`(9,4)`)
   saíram. A cabeça clássica tem 3 fileiras de espessura; a nossa fica com **2**
   no miolo — o fio aparece e a peça fica mais leve.
2. **ponta esquerda em bico.** O `1` em `(3,3)` estica o braço esquerdo: ele
   deixa de terminar reto e passa a apontar.
3. **colar no encaixe.** `(10,4)` sai e `(10,5)` vira `1`: a cabeça e o cabo se
   encontram num degrau, como peça montada — em vez de derreter um no outro.

O cabo continua o mesmo das tábuas, sem acento e sem couro.

## A grade (66 px, 16×16)

```
................
................
......111111....
...111432231bc..
...........2da..
..........132O..
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

Perfil por linha: `[0,0,6,11,3,4,6,6,6,6,6,4,3,3,2,0]` — **66 pixels** cheios,
**uma peça só**.

## O que muda na conta

| | base fiel (2 px) | agora |
| --- | --- | --- |
| pixels cheios | 70 | **66** |
| espessura da cabeça | 3 fileiras | **2 no miolo** |
| ponta esquerda | reta | **bico de 1 px** |
| encaixe cabo/cabeça | direto | **colar em `(10,5)`** |
| linhas fora do clássico | 2 | **3** |

## O que fica travado nos testes

- `tests/tool-art.test.mjs` — perfil
  `[0,0,6,11,3,4,6,6,6,6,6,4,3,3,2,0]`, **66 px**, peça única;
- `tests/art-style.test.mjs` — a régua da família passa a cobrar **3 linhas**
  fora da silhueta clássica e **66 px** para a picareta (machado e pá seguem com
  2 linhas).

## Pendência

O **machado** e a **pá** continuam na base fiel. A mesma passada autoral vale
para eles — uma ferramenta por vez, com comparador antes de implementar, como
vem sendo desde o #119.
