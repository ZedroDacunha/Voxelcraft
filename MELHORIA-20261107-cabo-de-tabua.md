# MELHORIA: o cabo das ferramentas é feito das tábuas do jogo

- **Data:** 07/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js` (`CABO_PALETA`), `tests/art-style.test.mjs`, `GUIA-DE-ARTE.md`

## O problema

Na rodada da picareta o pedido foi *"madeira parecida com a cor da tábua do
jogo"*. O que mudou ali foi a **cabeça** das ferramentas de madeira
(`PICARETA_PALETAS.wood`). O **cabo** continuou com uma rampa própria — mais
escura e mais saturada que a tábua:

| tom | cabo de antes | tábua do jogo |
| --- | --- | --- |
| a | `#3a2a12` | — |
| b | `#6b4c1e` | `#7b5b33` |
| c | `#9a7130` | `#977443` |
| d | `#c39148` | `#caa66a` |

Resultado: a ferramenta na mão não combinava com o chão de madeira.

## A mudança

`CABO_PALETA` passa a ser o tile `PLANKS` (`world-textures.js`):

| tom | agora | papel |
| --- | --- | --- |
| `a` | `#563e22` | sombra do cabo (o lado de baixo) |
| `b` | `#7b5b33` | veio da tábua |
| `c` | `#977443` | sombra da tábua |
| `d` | `#caa66a` | claro da tábua (o topo do cabo) |

A luminância média do cabo sobe de **130** para **168** e o matiz deixa de ser
alaranjado: vem do tile, não de uma rampa inventada. Vale para as **três**
ferramentas de uma vez, porque o cabo é um só (`CABO_PALETA` é compartilhado).

Nas ferramentas de madeira a cabeça e o cabo agora são quase a mesma peça — como
no sprite clássico, em que a ferramenta inteira é um pedaço de tábua.

## O que fica travado no teste

`tests/art-style.test.mjs` ganhou **"o cabo é feito das tábuas do jogo"**:

- `b`, `c` e `d` **exatamente** o veio, a sombra e o claro da tábua;
- `a` mais escuro que o veio (é a sombra do cabo) e ainda acima do preto puro.

O teste antigo de hex exatos (`as cores da família são exatamente estas`) foi
atualizado para os valores novos. Cobertura por mutação conferida: voltar o `d`
ao valor antigo e clarear o `d` demais — os dois derrubam dois testes cada.

## Comparador

`preview/comparador-cabo.html` (e `.png`): antes × agora, nas três ferramentas ×
seis materiais, a 9× e no tamanho real, com a tabela dos quatro tons.
