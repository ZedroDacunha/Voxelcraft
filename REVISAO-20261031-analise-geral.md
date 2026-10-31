---
type: revisao
status: concluido
data: 2026-10-31
component:
  - "[[game.js]]"
  - "[[world-terrain.js]]"
  - "[[world-catalog.js]]"
tags:
  - revisão
  - voxel
  - desempenho
  - arquitetura
  - jogabilidade
---

# Revisão geral do Voxel Sandbox (Parte 11)

## 📌 Resumo executivo

O projeto está em um patamar bem acima do "protótipo": já existem geração de terreno
com biomas/rios/cavernas/minérios, água com fluxo, iluminação por voxel com
propagação, sobrevivência, inventário completo com receitas, fornos e baús,
salvamento em IndexedDB com trava por aba, backup, exportação/importação e
recuperação de saves. A base é sólida e o cuidado com casos de erro (save
inválido, quota cheia, outra aba, contexto WebGL perdido) é incomum para um
projeto deste tipo.

Os principais problemas não estão na arquitetura, e sim em **detalhes que se
perderam entre as partes**: um Web Worker que nunca funcionou, uma colisão de
IDs que transformava porta em picareta e um custo de iluminação que remalhava
9 chunks a cada bloco editado. Corrigi esses três (e mais alguns pontos) nesta
revisão; o restante está priorizado abaixo.

Legenda de prioridade:

- **P0** — quebra conteúdo/desempenho de forma perceptível (corrigido aqui).
- **P1** — próximo passo com melhor relação impacto/esforço.
- **P2** — evolução de conteúdo e manutenção.

---

## ✅ O que já foi corrigido nesta revisão

| # | Problema | Onde | Efeito |
|---|----------|------|--------|
| 1 | Web Worker do terreno nunca iniciava | `game.js` › `World.createTerrainWorker()` | Toda a geração rodava na thread principal |
| 2 | Porta e ferramentas compartilhavam IDs | `world-catalog.js` › `ID` | Craftar porta entregava **picareta de ouro** |
| 3 | Porta existia no catálogo mas não no jogo | `world-door.js` era código morto | Não dava para colocar, abrir ou quebrar |
| 4 | Iluminação remalhava 9 chunks por edição | `game.js` › `World.rebuildSkyLight()` | Picos de CPU ao colocar/quebrar blocos |
| 5 | Loading esperava 81 chunks | `game.js` › `waitForWorldRegion()` | Entrada no mundo demorava vários segundos |
| 6 | Three.js vinha de CDN externa | `index.html`, `game.js` | Sem CDN o jogo não abre; versão não é garantida |
| 7 | Sem nenhum teste automatizado | `tests/` (novo) | Regressões passavam silenciosamente |
| 8 | Atlas de textura em uma única fileira de 2080 px | `world-catalog.js`, mesher, `inventory-assets.js`, `menu-background.js` | Risco de textura recusada em GPUs antigas (limite garantido: 2048) |
| 9 | Módulos ES sem versão (cache misto após deploy) | `index.html` + `tools/stamp-importmap.mjs` | Pós-deploy podia misturar `game.js` novo com módulo antigo |
| 10 | Comida só era consumida mirando no ar | `game.js` › clique direito + `world-interaction-rules.js` | Era preciso "olhar para o céu" para comer |
| 11 | Opções só listavam controles; nada era configurável | `world-game-settings.js`, `world-options-view.js`, `index.html` | Sensibilidade, FOV e distância de render eram constantes |
| 12 | Fome zerada parava em 1 de vida, sem matar nem avisar | `world-survival-rules.js`, `game.js`, `styles.css`, `index.html` | Jogador ficava preso a 1 de vida, sem regeneração e sem entender o motivo |

### 1. O Web Worker do terreno estava desligado

O worker é criado a partir de uma string gerada em `createTerrainWorker()`. Essa
string injeta `Noise2D`, `hash2`, `mulberry32`, `smoothstep`, `clamp01` e
`TerrainGenerator`, mas **não injeta `OreGenerator`** (usado no construtor do
gerador) nem `COAL_VEIN_CONFIG` (usado na máscara de veios de carvão).

Reprodução controlada do código exato que o jogo montava:

```
ReferenceError: OreGenerator is not defined
```

Qualquer erro dentro do `onmessage` dispara `onerror`, que chama
`failTerrainWorker()`: o worker é encerrado e **todo o terreno passa a ser
gerado na thread principal**, em fatias de ~3 ms por quadro, para sempre. É
provável que isso explique boa parte dos "picos de 60 ms" registrados no F3.

Correção: a montagem do código foi extraída para `world-terrain-worker.js`
(`createTerrainWorkerSource()`), com todas as dependências, e um teste compara
byte a byte o chunk gerado pelo worker com o gerado pela thread principal.

### 2. A porta era, na prática, uma picareta de ouro

`ID.WOOD_DOOR` valia `65`, exatamente o primeiro ID das ferramentas de ouro
(`65`, `66`, `67`); as de diamante ocupavam `68`-`70`. Como `ITEMS` é montado em
etapas, o item "Porta de carvalho" (65) era sobrescrito por "Picareta de Ouro"
(65) e, depois, `ITEMS[ID.WOOD_DOOR]` era redefinido de volta para porta —
deixando o mapa inconsistente:

- craftar a receita de porta (6 tábuas) devolvia **3 picaretas de ouro**;
- o item porta não tinha `block`, então nunca podia ser colocado.

Além disso, `world-door.js` (que já tinha `woodDoorPart`, `woodDoorType` e
`woodDoorShape`) **não era importado por ninguém**: não havia colocação das duas
metades, abertura, colisão nem geometria fina.

Correção aplicada:

- porta e blocos movidos para a faixa livre **86-90**;
- `render: 'door'` e geometria fina (0,125 de espessura) no mesher, reaproveitando
  o caminho de formas não cúbicas da tocha;
- colocação das duas metades de uma vez (com apoio sólido e espaço livre);
- clique direito abre/fecha as duas metades e atualiza a colisão;
- quebrar uma metade remove a outra e dropa **uma** porta (sem duplicar item);
- a receita continua rendendo 3 portas.

A **colisão** também acompanhou a geometria: a porta fechada usa uma caixa fina
igual ao painel e o `moveAxis()` passou a resolver a parada por bissecção, então
dá para encostar no painel (antes o jogador parava na borda do voxel, com um vão
de ~0,44 bloco). Detalhes em [[BUG-20261031-colisao-porta]].

> ⚠️ Falta apenas validação visual no navegador: a textura das duas metades já
> foi conferida gerando o atlas fora do navegador, mas o formato 3D, o
> alinhamento entre as metades e a "dobradiça" (a porta aberta ocupa a borda do
> voxel) foram verificados por cálculo, não por captura de tela.

### 3. Custo de iluminação por edição

`rebuildSkyLight()` recalcula a luz de um anel 3×3 e, no final, marcava **todos
os 9 chunks** como sujos para remalhar. Ou seja: cada bloco colocado ou quebrado
gerava 9 remalhas completas de chunk (cada uma percorrendo até 16×16×64 voxels),
mesmo quando a luz da vizinhança não mudava.

Agora cada chunk carrega `lightChanged`; só entra na fila de remalha quem
realmente teve alteração de `skyLight`/`blockLight`. Na prática, uma edição
comum passa de 9 remalhas para 1-3.

### 4. Entrada no mundo

`waitForWorldRegion()` exigia os 81 chunks do raio de renderização prontos antes
de liberar o jogador. Passou a esperar um raio inicial de 2 chunks (25 chunks =
~1/3 do trabalho); o restante continua carregando em segundo plano, com a névoa
cobrindo a borda. O texto do loading agora explica isso.

### 5. Three.js local

`vendor/three/` (r160: `three.module.js`, `addons/controls/PointerLockControls.js` e a licença MIT) foi
adicionado e virou a primeira opção de carregamento; unpkg/jsDelivr continuam
como reserva. Isso torna o jogo **offline-first**, elimina uma dependência
externa no `importmap` e garante que todos os módulos usem a mesma instância do
Three.

### 6. Testes

`tests/*.test.mjs` com `node:test` cobre os módulos puros (sem DOM/WebGL):

```bash
node --test tests/*.test.mjs
```

- paridade worker × thread principal do terreno;
- IDs de itens/blocos sem colisão acidental;
- receita da porta e alternância aberta/fechada;
- formato da porta (eixo e espessura);
- ida e volta do save, rejeição por seed/versão e descarte de item inválido.
- grade do atlas: cada tile em uma célula exclusiva, dentro dos limites de textura
  e sem sobreposição de UV entre vizinhos (incluindo o `flipY`);
- desenho real do atlas em um canvas falso: todo tile/ícone cai dentro da própria
  célula e nenhum usa o fallback magenta.
- prioridade do clique direito (bancada/forno/baú > porta > comer > colocar) e
  comer mirando em bloco ou no ar.
- preferências do jogo: limites, arredondamento, storage corrompido e a ligação
  entre os controles da tela de opções e o `index.html`.

### 7. Atlas de textura em grade

Antes, o atlas era uma fileira única: `ATLAS_COLUMNS = 65` × `TILE_PX = 32` =
**2080×32**, acima do limite garantido de 2048 px em WebGL. A cada ~13 tiles
novos a textura dobraria de faixa.

Agora `world-catalog.js` define a grade (`ATLAS_COLUMNS = 16`, `ATLAS_ROWS`
calculado a partir do maior tile) e expõe quatro funções compartilhadas:

| função | uso |
|---|---|
| `atlasCell(tile)` | `{ col, row }` do tile na grade |
| `atlasTileRect(tile)` | retângulo em pixels para desenhar/copiar (`drawImage`, `getImageData`) |
| `atlasUV(tile, padPx)` | retângulo em UV, já considerando o `flipY` do three e o afastamento das bordas |
| `atlasUVInto(tile, padPx, out)` | a mesma conta escrevendo em um objeto reaproveitado |

Com os 65 tiles atuais o atlas fica em **512×160** e cresce em linhas, não em
largura. Os quatro pontos que assumiam uma fileira só passaram a usar os
helpers: o mesher e o `buildCubeGeo` (`game.js`), o `createAtlasTexture`
(`world-textures.js`), os ícones do inventário (`inventory-assets.js`) e o
panorama do menu (`menu-background.js`). O afastamento agora é medido em pixels
(meio texel), em vez de um valor em UV que valia 1 px na horizontal e quase nada
na vertical. No mesher a conta é feita com `atlasUVInto`, que escreve em um
objeto reaproveitado — a malha chama isso uma vez por face de bloco e não pode
alocar um objeto por chamada.

Ao escrever o teste que desenha o atlas em um canvas falso, apareceram duas
falhas que o olho não pegava sem abrir o jogo: as duas metades da porta
(`TILE.WOOD_DOOR_UPPER/LOWER`) não tinham arte e caíam no **fallback magenta** do
`pixel()`, e o item porta tinha `sprite: { kind: 'door' }` sem nenhum caso em
`spritePixels()`, então o ícone saía vazio no inventário. Ambos foram
desenhados agora (tábuas com moldura, maçaneta e o ícone 16×16).

### 8. Cache de módulos em todo o grafo

Antes, só a entrada (`world-menu.js?v=...`) e o `game.js?v=...` tinham versão;
todo o resto do grafo vinha sem query string — e depois de um deploy o navegador
podia reusar um `world-catalog.js` antigo junto com o `game.js` novo (o mesmo
mecanismo de [[BUG-20261029-textura-grama-cache]], que com a mudança de IDs da
porta deixaria de ser cosmético).

`tools/stamp-importmap.mjs` gera o importmap a partir do **sha256 do conteúdo**
de cada arquivo, com uma entrada `"./arquivo.js": "./arquivo.js?v=<hash>"` por
módulo (o importmap aceita chaves relativas, então nenhum `?v=` precisa ser
escrito à mão nos imports). O mesmo script carimba o `<script type="module">` de
entrada e os `<link rel="stylesheet">`, que não passam pelo mapa.

Consequências: módulo alterado muda de URL e fura o cache; módulo intacto
continua em cache (o `three.js` de 1,3 MB só baixa de novo quando muda); e o
grafo nunca mistura versões. Detalhes e fluxo de manutenção em
[[BUG-20261031-cache-modulos]].

### 9. Tela de opções com preferências persistentes

O diálogo "Opções..." só listava os controles. `RENDER_DISTANCE`, `LOOK_SPEED` e
o FOV eram constantes no código.

Agora existem três preferências persistidas em `localStorage`
(`voxel-sandbox/game-settings/v1`), com a mesma linguagem visual do menu
(`world-dialog`, `classic-btn`, `world-field`):

| opção | faixa | efeito |
|---|---|---|
| Sensibilidade do mouse | 50–200% | multiplica a rotação da câmera |
| Campo de visão | 60–100° | FOV base (correr continua somando 10°) |
| Distância de render | 2–6 chunks | raio de chunks gerados e da névoa |

- `world-game-settings.js` guarda os campos (min/max/passo/padrão/formato),
  sanitiza qualquer coisa vinda do storage (clamp + arredondamento no passo) e
  trata `localStorage` bloqueado/quebrado sem lançar.
- `world-options-view.js` liga os `input[type=range]` do diálogo ao storage e
  atualiza o `<output>` com o valor formatado; "Restaurar padrões" volta tudo.
- `game.js` lê as preferências ao ser importado (ou seja, ao entrar em um
  mundo) e usa em `RENDER_DISTANCE`, `LOOK_SENSITIVITY` e no FOV da câmera.
  Como voltar ao menu recarrega a página, a mudança sempre vale no próximo
  mundo — o diálogo avisa isso.

`tests/game-settings.test.mjs` cobre limites, arredondamento, lixo no storage,
roundtrip e a ligação entre os campos e os ids do `index.html` (se um input for
renomeado, o teste reprova).

### 10. Fome que mata e avisa

A fome zerava em silêncio: sem aviso na tela, sem som e — pior — sem punição de
fato. O dano existia, mas com `if (health > 1)`: a vida parava em 1 coração para
sempre. O jogador não morria, não regenerava (regeneração exige fome ≥ 18) e não
tinha pista nenhuma do que estava acontecendo.

| antes | agora |
|---|---|
| vida parava em 1 | inanição pode matar |
| nada na tela | barra de fome pisca com fome ≤ 6 e fica vermelha ao zerar |
| nada na tela | aviso ("Fome baixa…", "Você está morrendo de fome!") na troca de faixa |
| tela de morte genérica | título por causa: fome, afogamento, queda |

- `world-survival-rules.js` (novo): `hungerStage()`, `advanceStarvation()`
  (sem DOM, no máximo um tique de dano por quadro para um `dt` grande não virar
  rajada), `HUNGER_WARNINGS` e `DEATH_CAUSES`.
- `game.js`: a contagem da inanição passou a usar `advanceStarvation()`,
  `syncHungerWarning()` cuida do aviso/classes e `die(source)` escolhe o título.
- `styles.css`: pulso na barra com `prefers-reduced-motion` respeitado.
- `tests/survival-rules.test.mjs`: faixas, acúmulo do relógio, tique único,
  `dt` negativo, textos de morte e a garantia de que o piso de 1 de vida sumiu.

---

## 🐞 Bugs e riscos ainda abertos

### P1 — Faixas sem árvores nas bordas dos chunks

`TerrainGenerator.plantTrees()` só planta entre `lx/lz = 2..13`, porque a copa
tem raio 2 e o código só escreve dentro do próprio chunk. Resultado medido em
49 chunks (seed 4242): **59 troncos, nenhum** em `lx`/`lz` 0, 1, 14 ou 15 — ou
seja, uma faixa de 4 blocos sem árvores a cada 16 blocos, visível como grade em
florestas.

Sugestão: gerar árvores para uma margem de -2..17 usando o mesmo hash por
coluna e escrever apenas as células que caem dentro do chunk. A mesma ideia
resolve copas cortadas na divisa. Isso altera a geração de chunks não editados
(saves antigos ganham árvores nas bordas), então convém combinar com um incremento
de versão do mundo/save.

### P1 — Nuvens reconstroem a geometria ao andar

`worldClouds.update()` reconstrói toda a malha da grade 32×32 quando o jogador
atravessa a fronteira de uma célula de 8 blocos (a cada ~2 s andando). São até
~1000 células com até 6 faces cada, montadas de forma síncrona — um engasgo
periódico, justamente enquanto o jogador se move.

Sugestão: grade maior (64×64) recentralizada só na borda, reconstrução fora do
quadro ou nuvens por `InstancedMesh`/shader.

### P1 — Sem áudio e sem toque

- **Áudio**: não há nenhuma API de áudio no projeto. Passos, quebrar/colocar,
  água, forno, dano e uma trilha simples mudariam muito a sensação do jogo.
- **Celular**: depende de teclado + mouse + pointer lock, que não existe em
  iOS. Um modo toque precisaria de joystick virtual, arrastar para olhar e
  botões de ação (e `touch-action: none`).
- **Opções**: resolvido — veja a seção 9. Faltam apenas volume (não há áudio) e
  escala da HUD.

### P2 — Desempenho

- **Malha na thread principal**: só o terreno está no worker. Gerar a malha
  (laço de 16×16×maxY por chunk) também em worker, com buffers transferíveis,
  elimina os picos restantes de `meshChunk`.
- **Alocação por chunk**: `meshChunk` cria 7 `TypedArray` grandes a cada
  remalha; reutilizar buffers de rascunho reduz GC (e os engasgos).
- **Fluxo de água**: `updateFlow` roda um BFS (`hasNearbySource`) por célula,
  com até 4096 células na fila e 8 por tick de 180 ms. Em uma enchente grande
  isso pode travar por segundos. Vale marcar componentes/fontes ao ativar a
  água em vez de buscar a cada passo.
- **Fornos**: `updateFurnaces` percorre todos os fornos do mundo a cada quadro;
  limitar aos carregados/perto do jogador.
- **Save**: `buildSave()` serializa todas as edições do mundo. Com dezenas de
  milhares de edições, o custo cresce e o `JSON` de exportação fica grande.
  Formato por chunk, RLE ou compressão resolveria.

### P2 — Jogabilidade e conteúdo

- ~~**Comer só mirando no ar**~~: resolvido. O clique direito com comida agora
  come mirando em qualquer lugar; a ordem de prioridade (bancada/forno/baú >
  porta > comer > colocar bloco, com agachar ignorando as interações de bloco)
  ficou explícita em `world-interaction-rules.js` e coberta por testes.
- ~~**Fome não mata**~~: resolvido. A inanição agora consome a vida até a morte
  (sem o piso de 1), a barra de fome pisca e fica vermelha quando zera, um
  aviso aparece ao entrar nas faixas de alerta e a tela de morte diz a causa
  ("Você morreu de fome"). Regras puras em `world-survival-rules.js`.
- **Mobs**: só o "Mofim" passivo, sem drop nem interação. Ou ele vira um recurso
  (lã/carne), ou entra um inimigo noturno com spawn por luz.
- **Conteúdo de mundo**: cavernas, rios, praias e minérios já existem; faltam
  estruturas (ruínas, vilas), vegetação variada e clima.
- **Água infinita ao minerar**: `breakBlock()` troca o bloco quebrado por
  `ID.WATER` (fonte) sempre que há água adjacente. Isso cria nascentes
  permanentes e permite "duplicar" água. Se a intenção for só preencher a
  escavação, deixar ar e chamar `activate()` faz o fluxo preencher com água
  corrente (que evapora longe da fonte).
- **Tocha no teto**: `ny < 0` é rejeitado no clique direito; falta a variante de
  tocha pendurada.
- **Ferramentas de ouro**: `tier 1` (não minera ferro/diamante) mas `speed 12`.
  É consistente com o gênero, só vale documentar no livro de receitas.

### P2 — Arquitetura e manutenção

- **`game.js` com ~3.350 linhas** concentra mundo, mesher, jogador, UI,
  sobrevivência e save. Separar em módulos (`player.js`, `mesher.js`, `hud.js`,
  `interaction.js`) tornaria as próximas partes muito menos arriscadas. O
  arquivo já importa 25 módulos; falta o passo de sair dele.
- **Código morto**: `tall-grass-*.png` na raiz (~580 KB, substituídos por
  `assets/*-v2.png`), `HELD_DEBUG`/`console.log` de ajuste, `buildChunkGreedyGeometry`
  e os testes `testOcclusionCulling`/`testGreedyMeshing` em `world-terrain.js`
  (não usados pelo jogo). `world-door.js` deixou de ser morto nesta revisão.
- **Versionamento do conteúdo**: título da aba, tela de início, menu e F3 ainda
  dizem "Parte 11". Centralizar em uma constante evitaria divergência.
- **Acessibilidade**: os slots do inventário são `div` com `mousedown` (não são
  focáveis nem operáveis por teclado); barras de vida/fome/fôlego não têm
  rótulos ARIA; a HUD não tem alternativa textual. O menu já é bem cuidado —
  vale estender ao jogo.
- **Sem favicon/meta description/PWA**: com o Three local, um service worker
  simples deixaria o jogo instalável e jogável offline.
- **Sem CI**: os testes novos rodam com `node --test`; um workflow mínimo no
  GitHub já impede regressões nos módulos puros.

---

## 🧪 Como testar o que mudou

```bash
# testes dos módulos puros
node --test tests/*.test.mjs

# sintaxe de todos os arquivos
for f in *.js; do node --check "$f"; done

# versões de cache do importmap/CSS/entrada em dia com o conteúdo dos arquivos
node tools/stamp-importmap.mjs --check
```

> Depois de editar qualquer `.js` ou `.css`, rode `node tools/stamp-importmap.mjs`
> para regravar os hashes no `index.html` (o teste `cache-versioning` reprova se
> esquecer).

No navegador (o preview desta sessão serve a raiz do projeto):

1. criar um mundo e entrar — o carregamento deve liberar antes com "Preparando
   as áreas próximas" e o resto do terreno aparece durante o jogo;
2. pegar tábuas, abrir a bancada 3×3 e craftar a porta (devem vir 3 portas);
3. colocar a porta em um piso sólido: duas metades, clique direito abre/fecha;
4. quebrar uma metade: a outra some e cai uma única porta;
5. andar de frente para a porta fechada: o corpo deve encostar no painel, sem
   vão; tentar fechar a porta estando no vão mostra "Saia do vão da porta";
6. colocar/quebrar blocos e observar no F3 `malha … ms` e os picos de CPU;
7. comer uma maçã mirando no chão, numa parede e no céu (as três devem comer);
   agachado em frente ao baú com comida na mão também come, sem abrir o baú;
   com a barra cheia aparece "Você não está com fome".
8. abrir "Opções..." no menu, mexer nos três controles e conferir que os valores
   são lembrados ao reabrir o diálogo; entrar em um mundo e sentir a
   sensibilidade/FOV e ver o alcance da névoa mudando com a distância;
9. fome: com `?debug`, rode `dbg.hunger(6)` (a barra começa a piscar) e depois
   `dbg.hunger(0)` — aparece "Você está morrendo de fome!", os ícones ficam
   vermelhos e a vida cai 1 a cada 4 s até a morte, com a tela dizendo "Você
   morreu de fome"; comer uma maçã no meio da contagem para o dano;
10. com `?debug` na URL, o console expõe `dbg.placeDoorAt(x, y, z)`, `dbg.toggleDoor(x, y, z)` e
    `dbg.blockAt(x, y, z)` para testar a porta sem mirar com o mouse.

> Se algo parecer estranho na porta (textura girada ou face faltando), o ponto
> a ajustar é `doorPartShape()` em `game.js` e `woodDoorShape()` em
> `world-door.js`.

---

## 🗺️ Roadmap sugerido

As melhorias são entregues em módulos pequenos e independentes, cada um com
teste próprio e um commit/PR separado. O primeiro foi o **atlas em grade**.

**Agora (1-2 sessões)**

1. Validar visualmente a porta e o novo carregamento.
2. ~~Resolver o cache de módulos~~ — feito (`tools/stamp-importmap.mjs`).
3. ~~Atlas em grade (16 colunas)~~ — feito.
4. ~~Permitir comer olhando para blocos~~ — feito.
5. ~~Tela de opções com distância de render e sensibilidade~~ — feito.
6. ~~Fome que mata, avisa e informa a causa da morte~~ — feito.

**Próximo**

7. Áudio básico e controles de toque.
8. Nuvens sem reconstrução síncrona e orçamento do fluxo de água.
9. Malha de chunk em worker.
10. Árvores com margem entre chunks (com bump de versão do save).

**Depois**

11. Combate/inimigos, drops e progressão.
12. Estruturas e mais conteúdo de bioma.
13. Split de `game.js`, service worker/PWA e CI.

---

## 🤖 Regra de evolução para a IA

> Antes de gerar código que roda em Web Worker, liste **todas** as dependências
> de módulo que a função usa (classes, constantes, helpers) e teste a saída do
> worker contra a execução na thread principal. Nunca atribua IDs de item e de
> bloco em faixas que possam se sobrepor: mantenha um teste que verifique
> colisões. Ao mexer em iluminação ou malha, meça quantos chunks são remalhados
> por edição — não marque a vizinhança inteira como suja sem comparar o estado
> da luz.
