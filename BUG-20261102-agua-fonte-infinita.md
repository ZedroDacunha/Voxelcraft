# BUG: quebrar bloco ao lado de água criava uma fonte permanente

- **Data:** 02/11/2026 (encontrado na análise de 31/10)
- **Status:** corrigido
- **Arquivos principais:** `world-water.js`, `game.js`

## Sintoma

Minerar um bloco encostado na água transformava o vão em **água de nascente**.
Colocar uma pedra ao lado de um lago e quebrá-la deixava `type=16` com
`waterSource=true` naquele ponto: a nascente ficava lá para sempre, mesmo longe
de qualquer fonte original.

Efeito prático: dava para duplicar água. Bastava cavar em volta de um lago —
cada bloco removido perto da borda criava mais uma fonte permanente, e o lago
crescia em vez de se comportar como fluxo que evapora.

## Causa

`breakBlock()` gravava a água por conta própria:

```js
const touchesWater = world.water.isAdjacent(world, x, y, z);
world.setBlock(x, y, z, touchesWater ? ID.WATER : 0);
if (touchesWater) world.water.activate(world, x, y, z);
```

`ID.WATER` é a **fonte** (`waterSource = true`), não água de fluxo. A chamada a
`activate()` logo depois era correta — ela reenfileira os vizinhos líquidos para
a simulação —, mas o bloco já tinha sido gravado como fonte, então o sistema de
fluxo não tinha nada a corrigir.

## Correção

A decisão passou para o sistema de água (`world-water.js` › `onBlockBroken()`):

- a célula quebrada vira **ar** (`0`);
- se havia líquido em volta, os vizinhos são reenfileirados (`activate`), e o
  fluxo preenche o vão como água corrente — com o nível certo, caindo se for o
  caso (`WATER_FALL`), e evaporando se ficar longe de uma fonte;
- o número de fontes permanentes nunca muda.

`breakBlock()` agora só chama `world.water.onBlockBroken(world, x, y, z)`. A
regra deixou de ser um efeito colateral de uma escrita de bloco no meio da
função de mineração e passou a ser testável sem DOM e sem mundo carregado.

## Validação

```bash
node --test tests/*.test.mjs            # 115 testes, 115 aprovados
node tools/stamp-importmap.mjs --check   # importmap e hashes em dia
git diff --check                         # sem problemas de whitespace
```

`tests/water-source.test.mjs` (5 casos, com um mundo falso de blocos):

| Cenário | Antes | Agora |
| --- | --- | --- |
| quebrar pedra ao lado de uma fonte | virava fonte (2 fontes) | vira água corrente, 1 fonte |
| quebrar o bloco **abaixo** de uma fonte | virava fonte | recebe `WATER_FALL` e cai |
| quebrar longe de água | ar, nada na fila | ar, nada na fila (inalterado) |
| fluxo isolado, sem fonte por perto | evapora | evapora (inalterado) |
| minerar 4 blocos em volta de um lago de 3 fontes | até 7 fontes | continua com 3 |

A água que preenche o vão continua lá porque há uma fonte adjacente; o teste de
contraste garante que a evaporação longe da fonte segue funcionando.
