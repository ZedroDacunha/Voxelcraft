# MELHORIA: fornos só simulam em chunks carregados

- **Data:** 02/11/2026 (item 9 da [análise de 31/10](ANALISE-20261031-melhorias.md), primeiro recorte)
- **Status:** implementado
- **Arquivos principais:** `world-furnace-rules.js` (novo), `game.js`,
  `world-furnace-effects.js`, `tests/furnace-rules.test.mjs`

## Antes

`updateFurnaces(dt)` percorria **todos os fornos do save** a cada quadro, mesmo os
que estavam em chunks já descarregados (`unloadFar()` libera chunk além do
render distance). Para cada um, refazia a conta de receita/combustível e, quando
a chama acendia ou apagava, fazia `key.split(',')` + `getChunk` + refresh de luz.

Dois problemas:

1. **Custo cresce com o mundo.** O laço é O(fornos totais) por quadro, e o save
   guarda fornos do mundo inteiro.
2. **Fornos fundiam sozinhos longe do jogador.** Dava para acender um forno,
   sair minerar e voltar com o minério todo fundido (e o combustível gasto) —
   comportamento diferente do Minecraft e que também segurava o chunk em
   `lightDirty` à toa.

## Depois

- O passo do forno saiu do `game.js` para **`world-furnace-rules.js`**
  (`stepFurnace`), sem DOM e sem three.js, com o catálogo injetável — testável
  com `node --test`.
- `updateFurnaces()` calcula o chunk do forno (`furnaceChunk`, com `cx`/`cz` em
  cache no registro para não quebrar a string de novo a cada quadro) e **pula o
  forno se o chunk não estiver carregado**. Sem chunk, o forno congela: não
  consome combustível, não avança a queima nem o preparo — igual ao Minecraft.
- O refresh de luz só acontece quando a chama realmente acende ou apaga
  (`litChanged`), e a UI do forno aberto só re-renderiza quando itens mudaram
  (`changed`).
- `world-furnace-effects.js` (fumaça) agora checa a distância **antes** de
  consultar o mundo: forno a mais de 32 blocos não custa leitura de bloco.
- O cache `cx`/`cz` não vai para o save: `buildSave()` grava só
  `slots`/`burn`/`burnMax`/`cook`, então o formato do save não muda.

### Comportamento visível

| Situação | Antes | Agora |
| --- | --- | --- |
| forno longe do jogador | fundia e gastava combustível | pausado; retoma ao carregar o chunk |
| forno perto | igual | igual |
| custo por quadro | O(total de fornos do save) | O(fornos carregados) |
| fumaça de forno distante | 2 leituras de bloco por forno aceso | nenhuma |

## Validação

```bash
npm test        # 170 testes (14 novos em tests/furnace-rules.test.mjs)
npm run check   # sintaxe 77/77 + importmap em dia
```

Os testes cobrem: forno ocioso (sem receita / sem combustível / só combustível),
acendimento consumindo exatamente um combustível, não reacender enquanto queima,
fundir no tempo da receita, empilhar até o limite da pilha e parar, resultado de
outro item bloqueando a fundição (sem queimar combustível), esfriamento em dobro,
fim da queima sem valor negativo, `dt` inválido, receita real do catálogo
(tronco → carvão vegetal, carvão como combustível), `furnaceChunk` com coordenadas
negativas (floor, não truncamento), cache da chave e a ligação no `game.js`.

## Limitações conhecidas

- **Sem medição de FPS em navegador real** (o sandbox não tem browser: falta
  `libnss3`). O ganho é estrutural: o laço deixou de ser O(mundo) e fornos
  distantes deixaram de ser simulados.
- O save continua sem formato por chunk: `buildSave()` ainda serializa todas as
  edições (outro ponto do item 9).
- Malha na thread principal e reconstrução de nuvens seguem abertos no item 9;
  este PR resolve só o recorte dos fornos.
