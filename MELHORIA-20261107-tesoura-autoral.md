# MELHORIA: a tesoura ganha silhueta própria

- **Data:** 07/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js`, `tests/shears-art.test.mjs`, `GUIA-DE-ARTE.md`

## O problema

A rodada anterior trouxe a tesoura para a régua da família: o sprite clássico
traduzido para o alfabeto da casa com **2 px** de forma nossa. O usuário olhou e
corrigiu o rumo:

> "o exemplo é o do jogo original, mude suavemente para não termos problemas com
> arte autoral"

Ele está certo. Dois pixels não são diferença — são a **mesma figura**. A paleta
era nossa (o ferro da família, o cabo da tábua), mas a silhueta continuava sendo
a do jogo, e a silhueta é justamente o que o olho reconhece de longe.

## A mudança

Não é um redesenho do zero (a tentativa de desenhar a tesoura por código —
linhas de Bresenham, argolas procedural, contorno automático — saiu feia e foi
descartada). É uma passada **autoral sobre a estrutura**, com quatro decisões que
mexem no desenho de cima para baixo:

1. **Ponta alta e afiada.** A lâmina sobe uma fileira e afina em
   `(9,1)`…`(12,1)`. É a mudança que mais aparece: o topo da peça deixa de ser
   aquele bloco arredondado e passa a ser um bico.
2. **Cabo afinado.** Nas linhas dos punhos o cabo cai de 3 para 2 px a partir de
   `(6,7)` — ele afina na direção das lâminas, como um cabo segurado.
3. **Costura aberta.** Um pixel a mais no vão entre as duas lâminas, em `(8,6)`:
   as duas peças se separam e a leitura "tesoura aberta" fica mais clara.
4. **Ponta da mandíbula em contorno.** `(13,7)` deixa de ser madeira e vira `O`:
   o punho não escorre para dentro da lâmina.

Nada de novo material: lâminas na rampa do ferro, punho na tábua do cabo, sem
acento e sem couro.

## A grade (79 px, 16×16)

```
................
.........b343...
........b3443...
.......b2443.3..
......bc343.34..
.....bd343.344..
....bda2..3443..
....bd...3432O..
...bd....23ba...
...bc...bbba....
...33bbbcca.....
..3..2ccaa......
..2a.Oaa........
...OOa..........
................
................
```

Perfil por linha: `[0,4,5,6,7,8,8,7,6,6,8,6,5,3,0,0]` — **79 pixels** cheios,
**uma peça só** em 4-vizinhos.

## O que muda na conta

| | base fiel (2 px) | agora |
| --- | --- | --- |
| pixels cheios | 79 | **79** |
| peças conectadas | 1 | **1** |
| topo da peça | bloco de 5 px | **bico de 4 px, 1 fileira mais alto** |
| cabo | 3 px de largura | **3 → 2 px (afina)** |
| vão entre as lâminas | 1 px | **2 px em `(8,6)`** |
| ponta da mandíbula | madeira | **contorno** |

O tamanho não subiu: a tesoura continua dentro do orçamento da família, e o que
mudou foi **onde os pixels estão**.

## O que fica travado nos testes

`tests/shears-art.test.mjs` (6 testes) passou a guardar a **nova** silhueta:

- perfil `[0,4,5,6,7,8,8,7,6,6,8,6,5,3,0,0]`, **79 px**, **uma peça só**;
- alfabeto da casa, sem `5`, `g` nem `s`;
- cada símbolo pinta o tom certo — metal = ferro, punho = tábua;
- lâminas claras × punho escuro (luminância média com diferença > 60);
- arte determinística e não compartilhada;
- o atlas desenha a tesoura com esta arte.

Se alguém voltar a colar a silhueta clássica, o perfil e a contagem de pixels
brigam na hora — é a trava contra transcrição.

## A regra que fica

**O clássico é referência de leitura, não molde.** A peça tem que ser reconhecida
como picareta, machado, pá ou tesoura de longe; e não como a arte do jogo. Mexer
em 2 px não afasta nada: o que afasta é proporção, silhueta e paleta próprias.

## Pendência

A picareta, o machado e a pá **continuam** na base fiel com 2 linhas de
diferença. A mesma passada autoral vale para elas — mas isso é decisão do
usuário, uma ferramenta por vez, como vem sendo feito desde o #119.
