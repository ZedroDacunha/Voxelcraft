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

## Decisões de escopo

- **esticar** em vez de faixas pretas (escolha do jogador);
- **tela cheia** ao escolher resolução fixa (escolha do jogador);
- **barra** em vez de grade de botões (escolha do jogador);
- **não** entrou: lista de resoluções do sistema (não existe na web), proporção
  travada ao escolher, resolução diferente por mundo, nem limite de GPU — quem
  quiser 4K num celular descobre o custo no FPS.

## O que ficou coberto por teste (`npm test`, 739)

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

O que só o aparelho mostra está no [roteiro](TESTE-EM-NAVEGADOR.md) §19 — em
especial se a tela cheia pedida pela resolução aparece sem sustos no navegador
que o jogador usa.
