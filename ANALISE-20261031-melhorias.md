# Análise do SiteCraft — o que falta melhorar

**Data:** 31/10/2026  
**Branch auditada:** `arena/0c52672d-sitecraft`  
**Commit base:** `fc20f4a`  
**Escopo:** revisão de código, testes automatizados, execução em navegador e sondas de comportamento. Nenhuma correção de jogo foi aplicada nesta análise.

## Resumo executivo

O projeto já é um sandbox voxel funcional, com geração procedural, água, sobrevivência, inventário, crafting, fornos, baús, portas, saves em IndexedDB, backup/recuperação e módulos puros testáveis. A base está acima de um protótipo comum.

O que mais falta não é “mais bloco” ou “mais bioma”: é **robustez de fluxo, UX e previsibilidade**. Encontrei problemas concretos em busca de receitas, iluminação entre chunks, retorno do pointer lock, responsividade e um modo de reset que pode apagar progresso repetidamente.

### Prioridades sugeridas

| Prioridade | Problema | Impacto | Onde |
|---|---|---|---|
| Alta | `?reset` continua ativo depois de voltar ao menu | Pode apagar o save de novo ao reentrar no mundo | `game.js:2957`, `world-save-manager.js:101-110` |
| Alta | Busca do livro de receitas não esconde itens filtrados | A busca parece quebrada | `inventory-recipe-book.js:145-160`, `inventory.css:22` |
| Alta | Luz de tocha some na borda de um chunk após editar chunk vizinho | Escurecimento incorreto e intermitente | `game.js:372-402` |
| Alta | Fechar inventário esconde o menu mesmo se o pointer lock falhar | Tela fica sem pausa nem orientação | `game.js:2354-2357`, `2981-2996` |
| Média | HUD/inventário não são responsivos | Hotbar cortada e menu escalado em celular | `styles.css:88-112`, `inventory.css:3` |
| Média | Quebrar bloco ao lado de água cria nova fonte permanente | Água infinita / duplicação de nascente | `game.js:1778-1780` — **corrigido em 02/11** ([BUG-20261102](BUG-20261102-agua-fonte-infinita.md)) |
| Média | Porta aberta não tem colisão | Jogador atravessa o painel aberto | `world-door.js`, `game.js` — **corrigido em 03/11** ([MELHORIA-20261103](MELHORIA-20261103-porta-aberta.md)) |
| Média | Lista de mundos lê o save completo de todos os mundos | Custo de memória/tempo cresce com o total de saves | `world-list-store.js` — **corrigido em 02/11** ([MELHORIA-20261102](MELHORIA-20261102-lista-de-mundos.md)) |
| Média | Malha, nuvens, água e fornos ainda têm trabalho síncrono evitável | Picos de CPU em mundo maior | `game.js:790`, `world-clouds.js:90-102`, `world-water.js:63-126` — **fornos, buffers de malha e fila da água corrigidos em 02/11** ([fornos](MELHORIA-20261102-fornos-por-chunk.md), [buffers](MELHORIA-20261102-buffers-malha.md), [água](MELHORIA-20261102-fila-de-agua.md)); malha em worker, nuvens e BFS de água abertos |
| Baixa | Acessibilidade do inventário/HUD, áudio, toque, PWA e conteúdo | Polimento e alcance | Acessibilidade **corrigida em 02/11** ([MELHORIA-20261102](MELHORIA-20261102-acessibilidade.md)); **áudio da interface e volume em 03/11** ([MELHORIA-20261103](MELHORIA-20261103-audio-interface.md)), **áudio completo em 04/11**: passos, blocos, batida, porta, água, dano, forno e ambiente ([passos](MELHORIA-20261104-passos.md), [blocos](MELHORIA-20261104-sons-de-bloco.md), [batida](MELHORIA-20261104-batida-de-mineracao.md), [porta](MELHORIA-20261104-som-de-porta.md), [água](MELHORIA-20261104-som-de-agua.md), [dano](MELHORIA-20261104-som-de-dano.md), [forno](MELHORIA-20261104-som-de-forno.md), [ambiente](MELHORIA-20261104-ambiente.md)); **toque em 04/11** ([MELHORIA-20261104](MELHORIA-20261104-toque.md)); **PWA instalável/offline em 04/11** ([MELHORIA-20261104](MELHORIA-20261104-pwa.md)); conteúdo e ambiente por bioma seguem abertos

---

## Achados detalhados

### 1. `?reset` é permanente e pode apagar progresso repetidamente

**Prioridade:** alta, condicionada ao uso do parâmetro.

`loadGame()` decide resetar olhando a URL atual:

```js
return saveManager.load({ reset: new URLSearchParams(location.search).has('reset') });
```

O problema é que voltar à seleção de mundos usa `location.reload()`, preservando a query string. Se a pessoa entrou com `?reset`, saiu para o menu e entrou de novo no mesmo mundo, o reset roda outra vez.

**Reprodução observada em navegador:**

1. Abrir `/?debug&reset`.
2. Criar/entrar em um mundo.
3. Adicionar 64 madeiras e salvar.
4. Voltar à seleção de mundos.
5. Entrar novamente no mesmo mundo.

Resultado medido:

```json
{
  "firstSave": { "exists": true, "firstStack": { "id": 3, "count": 64, "damage": 0 } },
  "urlAfterReturn": "http://127.0.0.1:8080/?debug&reset",
  "secondEntry": { "primaryExists": false, "firstStack": null, "hotbar": "1" }
}
```

**Risco:** perda de progresso sem uma nova confirmação. Mesmo sendo um parâmetro de depuração, ele está acessível por URL e não é consumido.

**Melhoria recomendada:**

- Tratar reset como ação única, não como estado permanente da URL.
- Consumir o parâmetro com `history.replaceState` antes ou imediatamente após aplicar.
- Exigir confirmação explícita com nome do mundo/seed.
- Idealmente, remover o reset por URL em produção e deixar apenas uma ação administrativa protegida.
- Teste de aceitação: depois de um reset confirmado, voltar ao menu e reentrar não pode apagar um novo save.

---

### 2. A busca do livro de receitas marca itens como ocultos, mas o CSS continua mostrando

**Prioridade:** alta.

O filtro faz:

```js
entry.hidden = !matches;
```

Mas `.recipe-entry-craft` tem `display: grid` em CSS de autor. Isso vence o `display: none` padrão do atributo `hidden` no user-agent. Resultado: receitas não correspondentes continuam renderizadas.

**Reprodução observada:**

- Abrir inventário → Receitas.
- Buscar `porta`.
- Resultado medido: **26 receitas visíveis**, das quais **25 estavam com `hidden=true` mas ainda tinham largura renderizada**.

**Melhoria recomendada:**

Adicionar regra explícita, por exemplo:

```css
.recipe-entry[hidden],
.recipe-section[hidden] {
  display: none !important;
}
```

Ou usar uma classe de filtro em vez de depender apenas de `hidden`.

**Teste de aceitação:** buscar `porta` deve deixar visível apenas a receita da porta; buscar algo inexistente deve esconder todas as entradas e mostrar o estado vazio.

---

### 3. Iluminação de fronteira é apagada ao recalcular um chunk vizinho

**Prioridade:** alta.

`rebuildSkyLight()` monta um anel 3×3 de chunks, zera `blockLight` desse anel e só propaga novamente a partir de emissores dentro do próprio anel. Uma tocha em um chunk fora do anel ainda pode iluminar a borda de um chunk de dentro do anel; essa contribuição é perdida.

**Reprodução controlada:**

- Tocha em `x=32, y=60, z=0` (chunk `cx=2`).
- Célula de fronteira em `x=31, y=60, z=0` (chunk `cx=1`).
- Depois de calcular a luz do chunk da tocha, a célula tinha `blockLight=13`.
- Ao recalcular o chunk `cx=0`, a mesma célula caiu para `blockLight=0`, embora a tocha continuasse existindo.

Resultado medido:

```json
{ "before": 13, "after": 0, "sourceStillThere": true, "expected": 13 }
```

**Impacto:** manchas escuras que aparecem/desaparecem conforme o jogador edita blocos, especialmente perto de divisas de chunk.

**Melhoria recomendada:**

- Ao reconstruir uma região, incluir um halo de emissores externos capazes de alcançar a borda, ou
- Fazer atualização incremental de luz em vez de zerar e reconstruir um anel inteiro, ou
- Preservar/repropagar contribuições de fronteira antes de remalhar.

**Teste de aceitação:** uma tocha a um bloco da divisa deve manter `blockLight > 0` no chunk vizinho depois de uma edição em um chunk vizinho desse vizinho.

---

### 4. Falha de pointer lock ao fechar o inventário deixa a tela sem menu

**Prioridade:** alta.

`closeInventory(true)` esconde o menu de pausa antes de garantir que o pointer lock foi readquirido:

```js
menu.style.display = 'none';
requestLock();
```

Se o navegador recusar o lock — por exemplo, cooldown depois de `Esc` — o jogo fica sem inventário, sem menu de pausa e sem mensagem clara. O usuário ainda pode conseguir clicar no canvas para tentar de novo, mas não há orientação visível.

**Reprodução observada em Chromium headless:**

- Abrir inventário e livro de receitas.
- Fechar com `Esc` em sequência rápida.
- O navegador registrou `THREE.PointerLockControls: Unable to use Pointer Lock API`.
- `#menu` permaneceu oculto (`menuAfterFailedRelock=false`).

**Melhoria recomendada:**

- Só esconder o menu no evento de lock bem-sucedido.
- Fazer `requestLock()` retornar uma Promise/resultado e tratar falha.
- Em falha, reabrir o menu de pausa com botão “Tentar novamente”.
- Evitar esconder a UI com base em um `setTimeout` otimista.

**Teste de aceitação:** simular `requestPointerLock()` rejeitado e verificar que o menu de pausa continua visível e acionável.

---

### 5. HUD e inventário não são responsivos

**Prioridade:** média; alta se celular for um alvo oficial.

Em viewport de **390×844**, a página apresentou `innerWidth=433` por overflow, e a hotbar mediu **476 px** de largura, com `left=-43`. O diálogo de criar mundo também ficou mais largo que a viewport útil.

Medições:

```json
{
  "viewport": 433,
  "hotbar": { "width": 476, "left": -43, "right": 433 },
  "dialog": { "width": 396 }
}
```

Além disso, o grid do inventário usa 9 colunas fixas de 44 px, o que não cabe confortavelmente em telas estreitas.

**Melhoria recomendada:**

- Escalar a HUD com `clamp()`, `vmin` ou uma variável de escala.
- Ocultar a HUD de jogo enquanto o menu inicial estiver ativo.
- Tornar o inventário rolável/compacto ou usar grid responsivo.
- Definir explicitamente se o jogo é desktop-only; se for, mostrar aviso claro em telas sem mouse/teclado.
- Se celular for alvo, adicionar joystick virtual, arrastar para olhar e botões de ação.

**Teste de aceitação:** em 360, 390 e 768 px, nenhum botão essencial pode ficar cortado; `scrollWidth <= clientWidth` nos containers principais.

---

### 6. Quebrar bloco adjacente à água cria uma fonte permanente

**Prioridade:** média. **Status:** ~~aberto~~ corrigido em 02/11.

`breakBlock()` faz:

```js
const touchesWater = world.water.isAdjacent(world, x, y, z);
world.setBlock(x, y, z, touchesWater ? ID.WATER : 0);
```

`ID.WATER` é fonte (`waterSource=true`). Então minerar ao lado de água cria uma nascente permanente.

**Reprodução observada:**

- Colocar pedra ao lado de água.
- Quebrar a pedra.
- O bloco virou `type=16` com `waterSource=true`.

**Impacto:** permite duplicar água e contraria a ideia de fluxo que evapora longe da fonte.

**Melhoria recomendada:**

- Deixar ar e chamar `world.water.activate(...)` para o fluxo preencher com água corrente.
- Ou criar uma regra explícita de formação de fonte, se isso for uma mecânica desejada.

**Teste de aceitação:** quebrar um bloco adjacente a uma fonte não pode aumentar o número de fontes permanentes.

**Correção aplicada (02/11):** a regra saiu de `breakBlock()` e foi para
`WaterSystem.onBlockBroken()`: a célula vira ar e, se havia líquido em volta, o
fluxo reenfileira os vizinhos e preenche o vão com água corrente. O número de
fontes permanentes não muda — coberto por `tests/water-source.test.mjs`. Detalhes
em [[BUG-20261102-agua-fonte-infinita]].

---

### 7. Porta aberta é visualmente sólida, mas fisicamente inexistente

**Prioridade:** média. **Status:** resolvido em 03/11
([MELHORIA-20261103](MELHORIA-20261103-porta-aberta.md)).

As portas abertas são marcadas com `solid: false`, e `woodDoorCollision()` retorna `null` quando `part.open`.

**Reprodução observada:**

```json
{ "placed": true, "openType": 89, "solid": false, "collision": null }
```

O painel aberto ainda é desenhado fino na borda do voxel, mas o jogador pode atravessá-lo.

**Melhoria aplicada:** a porta aberta bloqueia, com a **caixa fina rotacionada**
que o mesher já desenhava. `woodDoorCollision()` devolve a caixa nos dois
estados; `collides()` resolve a porta antes do teste de solidez (a aberta é
`solid: false` para não vedar o vão, mas o painel colide); abrir a porta também
recusa quando o painel nasceria em cima do jogador; e `unstickPlayer()` tira o
jogador de dentro do painel ao carregar um save antigo. O vão segue passável
(0,875 livre para um corpo de 0,6).

**Teste de aceitação:** coberto por `tests/door-collision.test.mjs` — a colisão
da porta aberta agora é regra explícita, não efeito colateral de `solid: false`.

---

### 8. A lista de mundos lê saves completos só para mostrar data/status

**Prioridade:** média. **Status:** ~~aberto~~ corrigido em 02/11
([MELHORIA-20261102](MELHORIA-20261102-lista-de-mundos.md)).

`getWorlds()` faz `store.get(world.saveKey)` para cada mundo e usa apenas `save.time`. Isso traz o blob inteiro do save para a memória, mesmo quando a tela só precisa de metadados.

**Risco:** com muitos mundos ou mundos grandes, abrir o menu fica mais lento e consome mais memória do que o necessário.

**Melhoria recomendada:**

- Guardar `lastSavedAt`, `hasSave`, `hasBackup` etc. em metadados ou índice.
- Usar `getKey()`/contadores para existência de cópias, sem ler o conteúdo.
- Atualizar metadados no mesmo fluxo de save.

**Teste de aceitação:** abrir a lista com N mundos grandes deve ter custo proporcional aos metadados, não ao tamanho total dos saves.

**Correção aplicada (02/11):**

- A data do último save passou a morar no metadado do mundo (`lastSavedAt`), gravada
  por `markWorldSaved()` no mesmo fluxo do save: salvamento normal, recuperação no
  carregamento e restauração de cópia pelo menu.
- Existência de save/backup/rejeitado/importado é checada com `getKey()`, que
  devolve só a chave (antes, "o save existe?" também abria o blob inteiro).
- Metadados antigos sem data: o save é lido uma única vez e a data volta para o meta.
- Resultado para N mundos: **0 leituras de save** por abertura do menu (era N), 4N
  checagens de chave. Coberto por `tests/world-list-metadata.test.mjs` com 20 mundos
  "grandes".

---

### 9. Desempenho: ainda há trabalho síncrono evitável

**Prioridade:** média. **Status:** parcialmente resolvido em 02/11 — fornos já
simulam só em chunks carregados ([MELHORIA-20261102](MELHORIA-20261102-fornos-por-chunk.md))
o mesher já reaproveita buffers ([MELHORIA-20261102](MELHORIA-20261102-buffers-malha.md)) e a
fila da água deixou de usar `shift()` ([MELHORIA-20261102](MELHORIA-20261102-fila-de-agua.md));
malha em worker, nuvens, BFS de água e save seguem abertos.

A revisão anterior já apontava parte disso, e o código atual continua com os mesmos padrões:

- **Malha na thread principal:** `World.meshChunk()` percorre voxels e monta buffers no quadro atual.
  *(Os buffers de rascunho já são reaproveitados entre chunks desde 02/11 — ver
  [MELHORIA-20261102](MELHORIA-20261102-buffers-malha.md); falta tirar a travessia
  dos voxels da thread principal.)*
- **Nuvens:** `worldClouds.update()` reconstrói a geometria quando muda a célula da câmera/scroll.
- **Água:** `hasNearbySource()` faz BFS por célula de fluxo; a fila pode chegar a 4096 células.
  *(A fila já não usa `shift()` — custo O(fila) por célula — e os limites viraram
  constantes testáveis desde 02/11: ver [MELHORIA-20261102](MELHORIA-20261102-fila-de-agua.md).
  O BFS continua sendo o custo dominante.)*
- ~~**Fornos:** `updateFurnaces()` percorre todos os fornos do mundo, não só os carregados/próximos.~~ **Corrigido em 02/11**: o passo virou `stepFurnace()`
  (`world-furnace-rules.js`) e só roda para chunks carregados; forno distante congela em vez de
  fundir sozinho. Ver [MELHORIA-20261102](MELHORIA-20261102-fornos-por-chunk.md).
- **Save:** `buildSave()` serializa todas as edições; o formato cresce com o histórico de alterações.

**Melhoria recomendada, em ordem:**

1. Medir com Performance no navegador antes de otimizar.
2. Mover geração de malha para worker com buffers transferíveis.
3. ~~Reutilizar buffers de rascunho no mesher.~~ Feito em 02/11 (rascunho por mundo +
   cópia exata para a geometria).
4. Reconstruir nuvens com menos frequência ou usar instancing/shader.
5. Cachear conectividade/fontes de água. *(A fila já foi refeita sem `shift()`; falta o cache do BFS.)*
6. ~~Limitar atualização de fornos a chunks ativos.~~ Feito em 02/11.
7. Considerar compressão/RLE ou formato por chunk para saves grandes.

**Nota:** os FPS baixos observados nesta auditoria vieram de Chromium headless com SwiftShader/software rendering. Eles não devem ser tratados como desempenho real em GPU do usuário.

---

### 10. Arquitetura e manutenção

**Prioridade:** média. **Status:** ~~aberto~~ parcialmente resolvido em 02/11 —
`package.json`, CI, README e remoção dos assets mortos feitos; **limpeza de 04/11**
tirou o sintonizador desligado do item na mão e os imports órfãos, com teste de
higiene para não voltarem. A extração de `game.js` começou em 04/11 pela física e
colisão do jogador ([MELHORIA-20261104](MELHORIA-20261104-fisica-do-jogador.md));
malha, HUD e interação seguem pendentes.

Pontos positivos: já existem muitos módulos puros (`world-*`, `inventory-*`) e testes sem DOM.

O que ainda pesa:

- `game.js` tem **3.871 linhas** e concentra mundo, mesher, física, UI, sobrevivência, interação e save
  (era 3.420 na análise, 3.927 antes da primeira extração; a colisão e o
  deslocamento do jogador já saíram para `player-physics.js`).
- Não há `package.json`, então não existe um comando padrão de projeto para testar/validar.
- Não há CI configurado no repositório.
- Não há README de onboarding.
- ~~Há assets antigos não referenciados: `tall-grass-*.png` na raiz; o jogo usa `assets/*-v2.png`.~~ Removidos em 02/11 (~580 KB).
- Há código experimental/não usado em `world-terrain.js`, como greedy meshing e testes expostos em `window`.

**Melhoria recomendada:**

- ~~Criar `package.json` com scripts~~ — feito (`start`, `test`, `check`, `stamp`).
- ~~Adicionar workflow de CI rodando esses scripts~~ — feito (`.github/workflows/ci.yml`).
- ~~Escrever README com requisitos, comandos e arquitetura~~ — feito (`README.md`).
- Extrair gradualmente de `game.js`: ~~`player.js`~~ ([física](MELHORIA-20261104-fisica-do-jogador.md), etapa 1 de 4),
  `mesher.js`, `hud.js`, `interaction.js`, `game-loop.js`.
- ~~Remover assets/código morto ou movê-los para uma área explicitamente experimental.~~
  Assets removidos em 02/11; **código morto em 04/11**: o sintonizador `HELD_DEBUG`
  (constante fixa em `false`, ouvinte de teclado e `console.log`) saiu, e
  `tests/hygiene.test.mjs` passa a barrar import órfão, `console.log`, `debugger`,
  arquivo sem importador e constante de debug fixa.

---

### 11. Acessibilidade da interface de jogo

**Prioridade:** média. **Status:** ~~aberto~~ corrigido em 02/11
([MELHORIA-20261102](MELHORIA-20261102-acessibilidade.md)).

O menu inicial é razoavelmente semântico, mas o inventário e a HUD não são.

Medição no inventário:

```json
{
  "slots": 76,
  "namedSlots": 0,
  "focusableSlots": 0,
  "healthRole": null,
  "healthLabel": null
}
```

Os slots são `div` com `mousedown`; não são focáveis nem operáveis por teclado. Barras de vida/fome/fôlego não têm rótulos/valores acessíveis.

**Melhoria recomendada:**

- Usar botões ou `role="grid"`/`gridcell` com navegação por teclado.
- Dar `aria-label` aos slots com item e quantidade.
- Expor vida/fome/fôlego como valores acessíveis, não só ícones.
- Garantir foco visível e ordem de foco previsível.
- Respeitar `prefers-reduced-motion` também em animações de jogo quando aplicável.

**Correção aplicada (02/11):**

- `inventory-a11y.js` (novo, puro): `slotLabel`, `nextSlotIndex`,
  `keyToSlotAction` e `statusLabels` — testados em `tests/inventory-a11y.test.mjs`.
- Slots viraram `role="gridcell"` com nome em texto; grades viraram `role="grid"`
  com rótulo e `data-columns`; roving tabindex (1 slot por grade no `Tab`).
- Teclado: setas/`Home`/`End` navegam, `Enter`/`Espaço` clicam (esquerdo/direito)
  e com `Shift` fazem movimento rápido, tudo pelo mesmo `activateSlot()` do mouse.
- Vida/fome/fôlego têm `aria-label` com valor e faixa; `#toast` é região viva;
  hotbar tem rótulo por casinha.
- `#death` é `alertdialog`, recebe foco e passa o foco ao botão `Renascer`.
- `prefers-reduced-motion` também desliga o pulinho do slot ativo da hotbar.
- Resultado: 76 → 6 paradas de `Tab` no inventário, 76 slots nomeados.

---

### 12. Testes: bons módulos puros, mas faltam fluxos críticos

**Prioridade:** média. **Status:** resolvido em 03/11 nos módulos puros —
concorrência ([TESTES-20261102](TESTES-20261102-concorrencia-do-save.md)),
recuperação de save ([TESTES-20261102](TESTES-20261102-recuperacao-de-save.md)) e
qualidade gráfica ([TESTES-20261103](TESTES-20261103-qualidade-grafica.md)).

Os 62 testes existentes passaram, mas ainda não cobrem bem:

- ~~`world-save-manager.js` e `world-save-lock.js` em cenários de erro/concorrência.~~
  **Coberto em 02/11** (16 testes com IndexedDB falso): lease entre abas, expiração,
  `write` sem posse, backup/`deleteKey`, `release`, falha ao abrir o banco, heartbeat,
  e o save manager recusando gravar por cima de outra aba + debounce.
- ~~Recuperação/importação de save com dados corrompidos.~~ **Coberto em 02/11**:
  `parseSaveCopy`, `stageImportedSaveCopy`, `preserveRejectedSave`,
  `restoreSaveCopy` e o carregamento (save inválido → backup/rejeitado/importada,
  `reset` e falha de leitura bloqueando gravação).
- ~~Busca/visibilidade real do livro de receitas.~~ Coberto por
  `tests/recipe-search.test.mjs`.
- ~~Pointer lock falhando.~~ Coberto por `tests/game-menu-state.test.mjs` (requisição
  memoizada, retentativa sem `unadjustedMovement`, timeout, `pointerlockerror` e a
  regra de quando o menu de pausa aparece).
- ~~Iluminação entre chunks.~~ Coberto por `tests/light-region.test.mjs`.
- ~~Responsividade da HUD/inventário.~~ Coberto por `tests/ui-layout.test.mjs`
  (regras de layout; o comportamento visual real depende de navegador).
- ~~Regras de água/fonte.~~ Coberto por `tests/water-source.test.mjs` e
  `tests/water-flow-queue.test.mjs`; a **busca de fonte próxima** ganhou testes
  próprios em 04/11 ([TESTES-20261104](TESTES-20261104-busca-fonte-proxima.md),
  12 testes): limite exato de 7 passos, caminho em curva, vertical de graça,
  limite do mundo, ciclo sem fonte e custo medido (~2,4 mil leituras num lago).
- ~~Qualidade gráfica automática.~~ **Coberto em 03/11**: histerese de subida/descida,
  critério GPU × CPU, desligamento quando baixar a resolução não melhora o FPS,
  `cycle()` do F4 e a ligação com o loop em `game.js`.

**Melhoria recomendada:**

- Adicionar testes de DOM com browser real para UI — **único ponto ainda aberto**:
  depende de um navegador no CI (o sandbox não tem Chromium), então fica registrado
  como validação manual.
- ~~Adicionar testes de integração para save/lock/recuperação.~~ Lock, save manager
  e recuperação com dados corrompidos cobertos em 02/11; falta só a integração real
  entre duas abas do navegador.
- Transformar cada bug desta análise em teste de regressão antes de corrigir.
- **Higiene automatizada em 04/11** (`tests/hygiene.test.mjs`, 6 testes): import
  órfão, `console.log` esquecido, `debugger`, módulo sem importador e constante de
  debug fixa. São sobras que não dão erro — só teste pega.
- **Falha silenciosa no save em 04/11**
  ([BUG-20261104](BUG-20261104-save-falha-silenciosa.md)): erro lançado dentro do
  `onsuccess` do `preservePrevious` escapava do `transact()` e a transação
  commitava sem gravar — save dado como concluído. Agora o erro aborta e rejeita,
  e o manager cai no retry.
- ~~Retry do save (`scheduleSaveRetry`, falha permanente, disco cheio).~~
  **Coberto em 04/11** (`tests/save-retry.test.mjs`, 9 testes): aviso único, escada
  2 s→5 s→12 s→30 s com teto, sucesso zerando a escada, `QuotaExceededError` sem
  retry, duas falhas gerando um retry só e o flush cancelando o retry pendente.

---

### 13. Conteúdo e polish

**Prioridade:** baixa até os itens acima estabilizarem.

Faltam ou estão simples:

- Áudio: **interface pronta em 03/11** ([MELHORIA-20261103](MELHORIA-20261103-audio-interface.md)) —
  clique/passada de mouse sintetizados, com opção de volume e troca por arquivo
  próprio — **passos por material em 04/11** ([MELHORIA-20261104](MELHORIA-20261104-passos.md))
  **quebrar/colocar bloco em 04/11** ([MELHORIA-20261104](MELHORIA-20261104-sons-de-bloco.md))
  e a **batida de cada golpe** ([MELHORIA-20261104](MELHORIA-20261104-batida-de-mineracao.md));
  **porta em 04/11** ([MELHORIA-20261104](MELHORIA-20261104-som-de-porta.md)) e
  **água em 04/11** ([MELHORIA-20261104](MELHORIA-20261104-som-de-agua.md)) e
  **dano/morte e forno em 04/11** ([dano](MELHORIA-20261104-som-de-dano.md),
  [forno](MELHORIA-20261104-som-de-forno.md)) e o **ambiente em 04/11**
  ([MELHORIA-20261104](MELHORIA-20261104-ambiente.md)) — **áudio do item 13
  completo**.
- Mobs: hoje há apenas criatura passiva sem drop/interação relevante.
- Estruturas: ruínas, vilas, dungeons.
- Vegetação/clima mais variados.
- ~~Controles de toque~~ (pronto em 04/11: joystick, olhar por arrasto e botões).
- ~~PWA/instalável/offline~~ (pronto em 04/11: manifest, service worker e ícones).
- ~~Opções de volume~~ (pronto em 03/11, junto do áudio) e escala de HUD.

Esses itens aumentam a sensação de jogo, mas não devem vir antes de corrigir perda de save, busca quebrada e iluminação incorreta.

---

## O que já está bem encaminhado

- **Modularização parcial:** regras puras de inventário, terreno, ferramentas, sobrevivência, portas e save.
- **Worker de terreno:** existe teste de paridade worker × thread principal.
- **Save:** lock por aba, backup, rejeição preservada, importação/exportação e indicador de estado.
- **Cache:** importmap com hash de conteúdo e teste de consistência.
- **Atlas:** testes de grade, UV e desenho.
- **Opções:** sensibilidade, FOV e distância de render persistidos e sanitizados.
- **Roundtrip normal de save:** verificado em navegador; 64 madeiras persistiram após voltar ao menu e reentrar.

## Verificações executadas

```bash
node --test tests/*.test.mjs
# 62 testes, 62 passaram

for f in *.js tools/*.mjs tests/*.mjs; do node --check "$f"; done
# sintaxe válida

node tools/stamp-importmap.mjs --check
# importmap e hashes em dia

git diff --check
# sem problemas de whitespace
```

Também foi executado um smoke em Chromium headless:

- criar mundo;
- entrar no mundo;
- abrir inventário;
- buscar receita;
- salvar e reentrar;
- medir layout mobile;
- sondar iluminação, água, porta e `?reset`.

## Ordem recomendada de trabalho

### Sprint 1 — segurança e UX crítica

1. Tornar `?reset` one-shot e confirmado.
2. Corrigir `hidden` no livro de receitas.
3. Tratar falha de pointer lock sem esconder o menu.
4. Corrigir iluminação de fronteira e adicionar teste.

### Sprint 2 — responsividade e acessibilidade

1. Escalar HUD/hotbar.
2. Ajustar inventário para telas estreitas.
3. Tornar slots navegáveis por teclado e rotulados.
4. Definir suporte oficial a mobile ou avisar que é desktop-only.

### Sprint 3 — desempenho e escala

1. Metadados leves na lista de mundos.
2. Malha em worker e buffers reutilizáveis.
3. Nuvens/água/fornos com menos trabalho síncrono.
4. Medir saves grandes e considerar compressão.

### Sprint 4 — polish e conteúdo

1. Áudio básico.
2. Interação/drops de mobs.
3. Estruturas e vegetação.
4. ~~PWA/offline~~ (pronto em 04/11).

## Critério geral de pronto

Uma melhoria só deve ser considerada concluída quando:

- tiver teste de regressão;
- passar nos 62 testes atuais e nos novos;
- mantiver `stamp-importmap --check` verde;
- for verificada no navegador quando envolver UI/WebGL;
- não introduzir perda de save nem mistura de versões de módulo.
