# MELHORIA: resolução do jogo (360p a 4K)

- **Data:** 05/11/2026 (depois das [opções por categorias](MELHORIA-20261105-opcoes-por-categorias.md))
- **Status:** implementado
- **Arquivos:** `world-render-resolution.js` (novo), `world-game-settings.js`,
  `world-options-view.js`, `index.html`, `game.js`,
  `tests/resolution.test.mjs` (novo), `tests/game-settings.test.mjs`,
  `tests/graphics-quality.test.mjs`, `tests/options-categories.test.mjs`,
  `tests/pause-options.test.mjs`, `service-worker.js`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## O que o navegador deixa (e o que não deixa)

Não deixa mudar a resolução da janela ou do sistema — isso é do sistema
operacional, e uma página não tem essa API. Então a opção faz a única coisa
honesta que existe no navegador: escolhe **quantos pixels o jogo desenha**. A
imagem é esticada para ocupar a tela.

- **1280×720** num monitor 1080p: desenha 0,9 M de pixels em vez de 2,1 M — mais
  rápido e mais macio, o mesmo efeito de baixar a resolução num jogo de PC;
- **3840×2160** numa tela 1080p: desenha o dobro (supersampling) — mais
  definido, mais caro;
- **Janela (nativa)**: o comportamento de antes — canvas do tamanho da tela com
  a escala automática de qualidade.

Duas decisões do jogador, tomadas antes do código: **esticar** para preencher a
tela (sem faixas pretas, mesmo quando a proporção escolhida difere da tela) e
**pedir tela cheia** ao escolher uma resolução fixa — é o único jeito de a janela
acompanhar, e sem ela o esticamento ficaria espremido entre barras do navegador.

## 1. A lista

`RESOLUTION_MODES` em `world-render-resolution.js`: **19 resoluções + a janela**,
ordenadas por número de pixels, das comuns de monitor (4:3, 5:4, 16:10, 16:9,
21:9) até 4K:

```
640×360 · 854×480 · 960×540 · 1024×576 · 1024×768 · 1280×720 · 1366×768 ·
1440×900 · 1600×900 · 1680×1050 · 1600×1200 · 1920×1080 · 1920×1200 ·
2048×1152 · 2560×1440 · 2560×1600 · 2880×1620 · 3440×1440 · 3840×2160
```

O id de cada uma é o próprio tamanho (`'1920x1080'`), então o storage guarda algo
legível e estável mesmo se a lista mudar de ordem; id desconhecido volta para
`Janela`.

## 2. Uma barra, não vinte cliques

Resolução é **lista**, mas com `slider: true` — o campo novo do
`world-game-settings.js` que manda desenhar uma lista como barra:

- arrastar percorre os degraus (a posição é o índice, o texto é a resolução);
- seta do teclado anda **uma** resolução;
- `Home`/`End` vão às pontas;
- **não dá a volta** nas pontas (é o que se espera de uma escada), diferente das
  listas de clique como Gráficos, que continuam ciclando;
- no leitor de tela: `role="slider"` com `aria-valuemin`/`max` como **índice**
  (0…19) e `aria-valuetext` com a resolução — é o que faz sentido para quem ouve.

A linha mora na categoria **Gráficos**, logo abaixo de Gráficos (qualidade).

## 3. O que vai para o renderer

`renderTarget(resolution, { width, height, scale })` decide:

| escolha | buffer | `pixelRatio` |
| --- | --- | --- |
| Janela | tamanho da tela | escala de qualidade (`--pr`, até 1,5) |
| resolução fixa | exatamente a escolhida | **1** |

O `pixelRatio` 1 na resolução fixa é o detalhe que impede a opção de mentir:
com a escala automática por cima, "1920×1080" viraria 2880×1620 num aparelho com
`devicePixelRatio` 1,5. Com resolução fixa, a escala automática (e o `F4`) fica
guardada para quando o jogador voltar para Janela.

No `game.js`, `applyRenderResolution()` faz o serviço:

```js
renderer.setPixelRatio(target.pixelRatio);
renderer.setSize(target.width, target.height, false);   // buffer escolhido
canvasEl.style.width = `${window.innerWidth}px`;        // imagem esticada
canvasEl.style.height = `${window.innerHeight}px`;
camera.aspect = renderAspect(target);                   // proporção do buffer
```

- **a câmera usa a proporção do buffer**, não a da janela — 1024×768 numa janela
  16:9 enxerga 4:3 e é esticado depois, que é o que o jogador pediu;
- a **câmera da mão** acompanha, senão o braço apareceria com outra proporção;
- **resize**: com resolução fixa o buffer não muda; só a imagem esticada (e a
  tela cheia, que entra e sai no mesmo gesto) acompanham a janela;
- o renderer **nasce** já com a resolução salva, e o F3 passou a mostrar qual é.

## 4. Tela cheia com cuidado

`requestResolutionFullscreen()` só age quando a escolha **muda** e só a partir do
clique/arraste do jogador (o navegador exige gesto):

- resolução fixa e ainda fora da tela cheia → `requestFullscreen()` na página;
- de volta para Janela → `exitFullscreen()`, **só** se foi a resolução que entrou
  nela (um `F11` escolhido à mão não é derrubado);
- `fullscreenchange` desliga a marca se a saída foi por fora (Esc/F11);
- tudo dentro de `try` e com `?.`: o Safari do iPhone não tem
  `requestFullscreen`, e lá a resolução vale, a tela cheia não.

## 5. Confirmação: aviso e pergunta

Trocar a resolução muda o que o jogo desenha e, junto, pede tela cheia. Um engano
— 4K num celular — deixaria o jogo em camera lenta sem o jogador saber como
voltar. Então a escolha passa por **duas** mensagens, escolhidas pelo jogador:

- **aviso** no padrão do jogo (`Resolução: 1920×1080`, 3 s), agora visível **por
  cima** da janela de Opções (ver os problemas corrigidos abaixo);
- **pergunta** dentro da janela, ao soltar a barra (não a cada degrau do
  arrasto): `Manter 1920×1080? · 10` com `Manter` e `Reverter`. Sem resposta em
  **10 s** (`RESOLUTION_CONFIRM_MS`), volta sozinha para a anterior — como em
  jogo de PC. No teclado a pergunta vem depois de cada mudança, já que não existe
  "soltar";
- **fechar as Opções mantém** a escolha (quem saiu da tela já decidiu), e sair da
  categoria Gráficos também tira a pergunta da frente sem reverter;
- `Restaurar padrões` cancela a pergunta pendente;
- a contagem é `aria-hidden`: quem usa leitor de tela ouve a pergunta uma vez, e
  não um "9, 8, 7…".

## 6. Problemas encontrados no caminho (e corrigidos)

Ao revisar a primeira versão da opção, apareceram cinco coisas que valiam
conserto — todas no mesmo PR, porque são do mesmo assunto:

1. **o aviso ficava invisível.** `#toast` é `position: absolute; z-index: 6`, e um
   `<dialog>` aberto com `showModal()` vive na *top layer*, na frente de tudo. Ou
   seja: **todo** aviso disparado dentro da tela de opções (resolução, qualidade,
   distância de render) nunca aparecia. Agora, com a janela aberta, o mesmo texto
   cai numa linha `role="status"` dentro do diálogo (`.options-status`), que some
   quando vazia e é limpa ao fechar;
2. **pedidos de tela cheia empilhados.** Arrastar a barra dispara uma mudança por
   degrau e o pedido é assíncrono; sem trava, cada passo abria outro pedido.
   `resolutionFullscreenPending` garante um por vez;
3. **resolução acima da GPU.** Pedir 4K num aparelho que não aceita o buffer não
   melhora nada e o resultado fica indefinido. Agora o tamanho é limitado pelo
   `maxTextureSize` do renderer — **mantendo a proporção** (3840×2160 com teto
   2048 vira 2048×1152, não 2048×2048) — e o aviso conta o tamanho aplicado:
   `Resolução: 2048×1152 (limite do aparelho)`;
4. **redimensionar recriava o buffer.** Com resolução fixa, cada evento de
   `resize` chamava `setSize` de novo (e `canvas.width` reallocava o buffer à
   toa). O resize agora usa `applyRenderResolution({ buffer: false })`: só a
   imagem esticada e a proporção mudam;
5. **aviso de resolução não dizia o tamanho real.** Passou a usar o alvo de
   verdade (`resolutionMessage`), que é também o que deixa o item 3 visível.

## Decisões de escopo

- **esticar** em vez de faixas pretas (escolha do jogador);
- **tela cheia** ao escolher resolução fixa (escolha do jogador);
- **barra** em vez de grade de botões (escolha do jogador);
- **não** entrou: lista de resoluções do sistema (não existe na web), proporção
  travada ao escolher, resolução diferente por mundo, nem limite de GPU — quem
  quiser 4K num celular descobre o custo no FPS.

## O que ficou coberto por teste (`npm test`, 750)

`tests/resolution.test.mjs` (14 testes):

- catálogo: 19 resoluções + janela, em ordem crescente de pixels, sem repetição,
  com o id batendo com o tamanho, e as pedidas presentes (1080p, 720p, 1440p,
  4K, 360p);
- texto e tamanho: `1920×1080`, `Janela (nativa)`, id desconhecido caindo na
  janela, `null` só para a janela;
- alvo do renderer: janela = tela + escala; fixa = tamanho exato e `pixelRatio`
  1 mesmo com escala 1,5; valores estranhos não viram NaN;
- proporção: 16:9, 4:3 e o caso inválido;
- opção: default, lista da tela igual à do módulo, formato, sanitização (número e
  id inválido voltam para janela), degraus, `Home`/`End` e **sem dar a volta**
  (enquanto Gráficos continua ciclando);
- tela: linha em Gráficos, `option-slider` com trilho e cursor, valor
  `Janela (nativa)`;
- fiação: `renderTarget`/`renderAspect` no `applyRenderResolution`,
  `setSize(..., false)` com o CSS esticado, a mão acompanhando, o pedido/saída de
  tela cheia com todas as guardas, o aviso e a ordem (depois da qualidade), o
  renderer nascendo com a resolução salva, o resize e a escala automática
  ignorada enquanto há resolução fixa.

Também conferi a barra num DOM de verdade (jsdom, fora do repo): arrastar para
63% cai em 1920×1080, as pontas dão 360p e 4K, `Home` volta para Janela e as
setas andam um degrau sem dar a volta.

`tests/resolution-confirm.test.mjs` (11 testes) cobre o resto:

- o aviso espelhado na janela (e limpo quando ela está fechada ou vazia), com a
  linha `role="status"` e o CSS que a esconde vazia;
- a pergunta: HTML no padrão do menu (`classic-btn`, sem trilho, contagem
  `aria-hidden`), a constante de 10 s, a regra "só resolução fixa pergunta", o
  revert salvando o valor anterior sem abrir pergunta nova, a pergunta só no
  `pointerup`/`pointercancel` (nunca no `pointermove`) e no teclado, `Manter`
  devolvendo o foco à barra, fechar mantendo a escolha e `Restaurar padrões`
  cancelando;
- timers: `clearTimeout`/`clearInterval` ao esconder e a contagem parando no zero;
- limite da GPU com proporção preservada e o aviso do tamanho aplicado;
- o resize sem recriar o buffer.

Além da suíte, rodei a janela num DOM de verdade (jsdom, fora do repo) e
percorri o fluxo: arrastar até 1920×1080 (a pergunta **não** aparece durante o
arrasto), soltar (aparece "Manter 1920×1080?" com `10`), seta mudando para
1920×1200, `Manter` fechando, nova escolha e `Reverter` voltando ao anterior,
`Home` indo para Janela sem perguntar, e fechar a janela mantendo a escolha.

O que só o aparelho mostra está no [roteiro](TESTE-EM-NAVEGADOR.md) §19 — em
especial se a tela cheia pedida pela resolução aparece sem sustos no navegador
que o jogador usa e se os 10 segundos são confortáveis.
