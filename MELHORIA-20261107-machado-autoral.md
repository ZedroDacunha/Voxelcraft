# MELHORIA: o machado ganha barba e fio reto

- **Data:** 07/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js`, `tests/tool-art.test.mjs`, `tests/art-style.test.mjs`, `GUIA-DE-ARTE.md`

## O problema

Terceira ferramenta da passada autoral. A tesoura ganhou bico e cabo fino, a
picareta perdeu a fileira de fundo da cabeça — e o machado continuava **base fiel
com 2 px**, a mesma figura do jogo.

O machado é o caso mais difícil dos quatro: a cabeça é uma **mancha só**, e cortes
grandes viram outra ferramenta (o "D" gigante e descolado do cabo foi reprovado no
#120). O que sobra para mexer é a **borda de corte** e o **contra-fio**.

## A mudança

Quatro decisões, na ordem em que foram somadas no comparador:

1. **contra-fio curto** — a pontinha de trás da cabeça (`(13,6)` e `(13,7)`) sai e
   `(12,7)` vira contorno: sobra a lâmina e um toco de encaixe, sem o rabo do
   clássico;
2. **fio reto** — `(6,3)` entra e `(7,3)` vira `4`: a borda de corte fica
   **vertical em três fileiras**, com o tom claro correndo pelo fio, em vez do
   degrau;
3. **topo sem degrau** — `(11,1)` sai;
4. **barba** — `(6,6)` vira `4` e `(5,6)`, `(6,7)` e `(5,7)` viram `O`: a lâmina
   **desce na direção do cabo**, como machado de barba.

A opção escolhida foi a **D** do comparador (as quatro juntas). A C (sem a barba)
ficava mais discreta.

## A grade (64 px, 16×16)

```
................
.........11.....
........1441....
......144341....
......14333bc...
......444323a...
.....O4OOb323...
.....OO.bca3O...
.......bda.OOO..
......bca.......
.....bca........
....bda.........
...bca..........
..bda...........
..aa............
................
```

Perfil por linha: `[0,2,4,6,7,7,8,7,6,3,3,3,3,3,2,0]` — **64 pixels** cheios,
**uma peça só**. Cabo das tábuas, sem acento e sem couro.

## O que muda na conta

| | base fiel (2 px) | agora |
| --- | --- | --- |
| pixels cheios | 62 | **64** |
| contra-fio | ponta comprida | **curto, com toco** |
| borda de corte | degrau | **vertical em 3 fileiras** |
| topo | degrau | **reto** |
| lâmina | reta | **barba descendo para o cabo** |
| linhas fora do clássico | 2 | **4** |

## O que fica travado nos testes

- `tests/tool-art.test.mjs` — perfil
  `[0,2,4,6,7,7,8,7,6,3,3,3,3,3,2,0]`, **64 px**, peça única;
- `tests/art-style.test.mjs` — a régua da família cobra **4 linhas** fora da
  silhueta clássica e **64 px** para o machado.

## Pendência

Só a **pá** continua na base fiel com 2 px. É a última da fila — mesma receita,
com comparador antes de implementar.
