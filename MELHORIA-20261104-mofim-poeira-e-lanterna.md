# MELHORIA: o pó luminoso do Mofim e a lanterna (T2)

- **Data:** 04/11/2026 (tema 2 de criaturas, depois do [T1](MELHORIA-20261104-mofim.md))
- **Status:** implementado
- **Arquivos:** `world-creature.js`, `world-catalog.js`, `world-textures.js`,
  `world-block-materials.js`, `game.js`, `tests/creature.test.mjs`, `tests/catalog.test.mjs`

## Por que

O T1 deu comportamento ao Mofim — medo, chilreio, pulo de degrau, planeio — mas o
golpe continuava **sem consequência**: acertar o bicho só o assustava, e ele
voltava a passear segundos depois. E o corpo dele (um vaga-lume com um cubinho
de luz) nunca virava nada no mundo.

Este recorte fecha o ciclo com duas peças: **o golpe derruba**, e o corpo
derrubado deixa **pó luminoso**; o pó é a receita da **lanterna de mofim**, o
primeiro bloco colocável do jogo que **ilumina de verdade**.

## 1. Vida do Mofim e a resposta ao golpe

| Constante | Valor | O que faz |
| --- | --- | --- |
| `MOFIM_HEALTH` | 3 | golpes de mão para derrubar |
| `HURT_FLASH` | 0,22 s | tempo que o corpo fica aceso depois do dano |
| `KNOCKBACK_DISTANCE` | 0,35 bloco | empurrão na direção do golpe |

`hitFrom()` continua sendo o único ponto de entrada do golpe (mesmo `HIT_REACH`,
mesmo `HIT_COOLDOWN` de 0,35 s — segurar o botão não vira saraivada). O que mudou:

1. Desconta um ponto de vida e **acende o corpo** por `HURT_FLASH`.
2. **Empurra** o bicho para longe de quem bateu (`stepToward`, então nunca o
   empurra para dentro de uma parede ou de um lago).
3. Com a vida no fim, **sai do mundo** e chama `onDeath(entity)`.

O clarão usa um **material próprio por criatura** (clone do corpo no
`createModel`), com `emissive` subindo no golpe e apagando sozinho no
`update`. Sem o clone, o emissive — que é do material compartilhado pelo
sistema — pintaria de laranja **todos** os Mofins do mundo de uma vez.

O retorno passou de "o bicho atingido" para `{ entity, killed }`, porque quem
chama (o jogo) precisa saber se o corpo sumiu.

### O pó

`onDeath` no `game.js` solta **1 ou 2** `Pó luminoso` (`ID.MOFIM_DUST`) no lugar
do corpo, com um pulinho para cima e 0,3 s de carência antes de poder ser
apanhado (o item entra no chão, não voa direto para a mochila). O item é
comum: `maxStack` 64, então dois Mofins já pagam uma lanterna e o excedente não
entope o inventário.

## 2. A lanterna de mofim

Bloco sólido novo (`ID.MOFIM_LANTERN`), feito com o pó:

```
[pó] [pó]
[pó] [tábua]   → 1 lanterna
```

| Propriedade | Valor |
| --- | --- |
| `light` | 13 (a tocha é 14) |
| `solid` | sim (é um cubo; dá para apoiar coisas em cima) |
| `render` | `opaque` (cubo normal, não tocha) |
| `hardness` | 0,8 — quebra na mão e devolve a própria lanterna |

O motor de luz não precisou de nenhuma linha nova: a propagação já pega
`BLOCKS[tipo].light` de **qualquer** bloco (`propagateLightChannel`), então a
lanterna acende o cômodo como uma tocha, só que acesa para sempre e sem apoiar
na parede. A família de material é `stone` (`world-block-materials.js`), o que
lhe dá som de passo, de quebrar e de colocar de graça — o teste de "todo bloco
não líquido tem som" garante que blocos novos não fiquem mudos.

## 3. Arte

- **Tile da lanterna** (`TILE.MOFIM_LANTERN`): moldura verde-musgo (a cor do
  bicho) com rebites nos cantos e um núcleo aceso em três tons de âmbar, com
  grãos de pó espalhados — legível de longe como "isto brilha".
- **Sprite do pó** (`spritePixels('mofim-dust')`): sete grãos acesos com halo
  fraco, do jeito que o Mofim solta.

Os dois caem no atlas normal (`ATLAS_COLUMNS` 16, agora 5 linhas = 80 células
para 67 tiles) e o teste `atlas-draw` (zero magenta, uma célula por tile e por
item) cobre automaticamente os dois.

## Testes

- `tests/creature.test.mjs` (34 → **34**, +3 novos): empurrão do golpe, clarão
  do dano que acende e apaga (e que o material é próprio), e os três golpes que
  derrubam — sai da lista e da cena, `onDeath` chama **uma vez só** e com as
  coordenadas do corpo.
- `tests/catalog.test.mjs` (+2): a lanterna é sólida, ilumina menos que a tocha,
  usa o tile nas seis faces e devolve a si mesma; o pó é item de pilha com
  sprite próprio e a grade 2×2 do pó + tábua casa só com a tábua no lugar.

## O que ficou de fora

- **Luz real** (`PointLight`) e aparição noturna: tema 3, ainda não pedido.
- O Mofim **não reage** a ser perseguido com a lanterna na mão — só existe um
  tipo de medo, e ele já está fechado pelo T1.
- Sem som próprio para o clarão/morte: o chilreio de susto já toca no mesmo
  instante do golpe, e um segundo som em cima dele só embolava.
