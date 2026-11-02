# MELHORIA: lista de mundos lê metadados, não saves inteiros

- **Data:** 02/11/2026 (item 8 da [análise de 31/10](ANALISE-20261031-melhorias.md))
- **Status:** implementado
- **Arquivos principais:** `world-list-store.js`, `world-save-manager.js`,
  `world-save-recovery.js`, `world-save-options.js`, `world-menu.js`, `game.js`,
  `tests/world-list-metadata.test.mjs`

## Antes

`getWorlds()` — chamado toda vez que o menu de mundos abre ou é atualizado — fazia
`store.get(world.saveKey)` para **cada** mundo e usava só dois campos do
resultado: `time` (data do último save) e se ele existia. Ou seja, abrir o menu
deserializava o save inteiro de todos os mundos, com blocos editados, baús,
fornos, inventário e drops, só para mostrar "Último save: 31/10/2026" e ordenar a
lista.

Com 20 mundos de 20 MB isso é ~400 MB de leitura por abertura do menu.

## Depois

| Dado | Como era obtido | Como é obtido agora |
| --- | --- | --- |
| data do último save | `store.get(saveKey).time` (blob inteiro) | campo `lastSavedAt` nos metadados do mundo |
| save existe | `store.get(saveKey)` | `store.getKey(saveKey)` |
| backup / rejeitado / importado existem | `store.getKey(...)` | igual (já era barato) |

- **`markWorldSaved(worldId, savedAt)`** grava a data no meta. É chamado no
  mesmo fluxo do salvamento:
  - `world-save-manager.js` ganhou o callback `onSaved(data)`, disparado depois
    de cada gravação bem-sucedida — inclusive quando o carregamento recupera um
    backup ou uma cópia importada (`lock.write(raw)`);
  - `game.js` liga esse callback a `markWorldSaved(ACTIVE_WORLD.id, data.time)`;
  - restaurar uma cópia pelo menu (`world-save-options.js`) também atualiza a
    data: `restoreSaveCopy()` passou a devolver o save restaurado e o menu escreve
    o `time` dele no meta.

- **Metadados antigos** (criados antes desta versão) não têm `lastSavedAt`. Nesse
  caso o save é lido **uma única vez**, a data é gravada no meta e as próximas
  aberturas do menu já custam só metadados. A migração de mundos legados
  (`world-*`) também grava a data de saída.
- A ordenação e o texto do cartão (`Último save: …` / `Ainda não iniciado …`)
  continuam iguais: `lastSavedAt` ainda é `null` quando não dá para saber, e o
  `sortTimestamp` cai na data de criação.
- `getWorlds` e `markWorldSaved` aceitam um `storeRequest` injetável (com o valor
  real como padrão), o que permite testar a lista sem IndexedDB e sem navegador.

## Custo por abertura do menu

Para N mundos:

| | Antes | Agora |
| --- | --- | --- |
| leituras de save (blob inteiro) | N | 0 (1 por mundo só na primeira vez após atualizar) |
| checagens de chave | 3N | 4N (inclui "save existe") |
| leituras de meta | N | N |

O teste de aceitação da análise — "abrir a lista com N mundos grandes deve ter
custo proporcional aos metadados, não ao tamanho total dos saves" — é verificado
em `tests/world-list-metadata.test.mjs` com 20 mundos de 64 KB+ de conteúdo
fictício: **nenhuma chave de save é lida**, e as leituras são exatamente 20 metas
+ 80 checagens de chave.

## Validação

```bash
npm test        # 156 testes (14 novos em tests/world-list-metadata.test.mjs)
npm run check   # sintaxe 75/75 + importmap em dia
```

Os testes cobrem: lista sem abrir saves, leitura única + backfill no meta, save
sem data válida, mundo ainda sem save, metadados inválidos, migração de mundos
legados, `markWorldSaved` (grava, não regrava igual, ignora mundo inexistente e
dados inválidos), restauração de cópia devolvendo o save restaurado e a ligação
`onSaved` entre save manager, jogo e menu.

## Limitações conhecidas

- **Não medi tempo real em navegador** (o sandbox não tem browser: falta
  `libnss3`). A economia vem de não pedir o valor ao IndexedDB; `getKey` devolve
  só a chave, sem desserializar o registro — comportamento garantido pelo
  IndexedDB, não medido aqui.
- A data no meta pode ficar velha **se outro app ou outra aba escrever no save
  sem passar por este fluxo**. No jogo, todos os caminhos de escrita de save
  (salvamento normal, recuperação no carregamento, restauração de cópia) foram
  cobertos.
- `?reset` apaga o save mas mantém o `lastSavedAt` no meta; como `hasSave` passa
  a ser falso, o cartão mostra "Ainda não iniciado · criado em …" — sem data
  errada na tela.
- Um save aceito é sempre gravado com `time` novo; cópias restauradas mantêm a
  data original de quando foram feitas, que é o que aparece na lista.
