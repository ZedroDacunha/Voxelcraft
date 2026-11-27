# MELHORIA: o menu com a luz e as sombras do mundo

- **Data:** 04/11/2026 (panorama do menu; depois do [som de cachoeira](MELHORIA-20261104-som-de-cachoeira.md))
- **Status:** implementado
- **Arquivos:** `menu-panorama.js` (novo), `menu-background.js` (reescrito),
  `world-sky.js` (parâmetros opcionais), `tests/menu-panorama.test.mjs` (novo), `README.md`

## O problema

O panorama do título era **uma cópia parecida** do mundo, não o mundo:

- cada bloco era um cubo inteiro, com as seis faces, mesmo as que estavam
  encostadas em outro bloco — duas vezes mais triângulos para desenhar o que
  ninguém vê;
- o material não tinha cor de vértice, então **não havia sombra de canto**: o
  relevo achatava nas quinas e embaixo das copas;
- a luz era um par de números escritos à mão (hemisférica 2,2 e direcional 2,4 —
  bem acima do que o jogo usa), sem cor de fim de tarde, sem nevoeiro ligado ao
  céu e sem sol, lua ou estrelas.

No mundo os blocos são outra coisa: face escondida fica fora e o canto encostado
escurece (`ambientOcclusionAt` em `game.js`, escrito em cor de vértice). É esse
acabamento que dá o relevo — e era o que faltava atrás do título.

## 1. A ilha virou malha de verdade (`menu-panorama.js`, novo)

Módulo puro, sem Three e sem DOM: entra a paisagem (um `Map` de blocos), saem as
arrays prontas.

- `buildMenuPanorama()` — a mesma ilha de antes (relevo por seno, lago elíptico
  com margem de areia, lençol de terra e pedra, árvores longe da água). Nada na
  paisagem mudou de lugar.
- `panoramaGeometry()` — duas geometrias: **opaca** (chão, terra, pedra, tronco)
  e **recortada** (folhas, com `alphaTest` e duas faces).
  - **face encostada em bloco cheio não existe** — a malha fica com 44 mil faces
    onde um cubo por bloco daria 102 mil;
  - **sombra de canto**: os três vizinhos (dois lados e a quina) pesam 1 (bloco
    cheio), 0,35 (folha recortada) ou 0 (água/ar), e o nível 0–3 vira
    `0,58 + nível × 0,14` — exatamente as constantes do `game.js`;
  - UV do atlas com as variantes de textura (sem elas, chão e pedra viram papel
    de parede), na mesma ordem de cantos do jogo (trocar a ordem espelharia as
    texturas).

Diferença proposital: o panorama é céu aberto, então não há luz de tocha nem céu
por bloco — a iluminação é 1 em todo lugar e a sombra é só o canto.

## 2. O céu do mundo cuida do menu (`world-sky.js`)

O menu passou a usar `createWorldSkySystem`, o mesmo sistema do jogo:

- cor do fundo e do nevoeiro saem do mesmo degradê (noite → dia → fim de tarde);
- sol, lua e as 400 estrelas são criados;
- a hemisférica e a direcional nascem com os valores do `init()` do jogo e são
  reescritas a cada quadro (intensidade e cor do sol, com o tom quente quando ele
  está baixo).

Três parâmetros viraram opcionais para o menu caber sem gambiarra: `handAmbient`
(o menu não tem mão), `clouds` (as nuvens do menu só precisam do tom) e
`fogNear`/`fogFar` (o panorama tem enquadramento próprio, então manda as
distâncias). O jogo não mudou de comportamento: continua passando tudo.

**Relógio parado de propósito.** `MENU_SUN_TIME = 0.06` — manhã de céu limpo:
dia cheio, luz branca e o ponto mais claro da escala de sombra. Menu que escurece
sozinho deixaria o título e os botões ilegíveis depois de alguns minutos. É uma
constante só: perto de 0,02 vira fim de tarde laranja; acima de 0,15 passa do
meio-dia.

## 3. O que muda na tela

- **Relevo**: quinas, base de encosta e chão embaixo das copas escurecem;
- **Luz do jogo**: a ilha fica com o brilho do mundo, mais contido que o
  panorama anterior (que era quase o dobro de luz e sem sombra) — é o preço de
  ficar igual;
- **Nuvens** acompanham a hora pelo mesmo tom do jogo (noite/dia/fim de tarde);
- **Câmera, órbita, nuvens andando e `prefers-reduced-motion`**: intactos.

## Testes

`tests/menu-panorama.test.mjs` (novo, **11**):

- um bloco sozinho dá seis faces e a luz cheia (que tem de dar 1);
- face entre dois blocos cheios não existe — lado a lado, empilhado e um cubo
  3×3×3 que só mostra a casca (54 faces);
- piso 5×5 gastando só as bordas (25 topos + 25 fundos + 20 laterais);
- folhas vão para a parte recortada, mantêm a face contra face das copas e não
  tapam a pedra atrás delas;
- vizinho encostado escurece **só o canto** (dois tons na face, um nível abaixo);
- a sombra nunca sai de `0,58..1` em toda a ilha;
- todo índice aponta para vértice que existe, arrays com o tamanho certo, UV
  dentro do atlas, nenhum `NaN`;
- a malha é menor que meio cubo por bloco;
- a paisagem de antes continua lá (lago de areia, grama por cima da terra na
  quina, os seis tipos de bloco);
- a malha é idêntica entre duas montagens (nada de sorteio solto);
- grama usa três tiles diferentes (topo, lado, fundo).

## Validação

```bash
npm test        # 528 testes
npm run check   # sintaxe 114/114 + importmap em dia
```

O sandbox não abre navegador (falta biblioteca do Chromium), então **a conferência
visual é no aparelho**: abrir o jogo, olhar o panorama e checar três coisas —
o relevo nas quinas e sob as copas, o brilho parecido com o do jogo e a ilha
inteira girando sem buraco na malha.

## O que ficou de fora

- **O disco do sol na tela**: o enquadramento do menu olha para baixo (a câmera
  está 18,5 blocos acima do chão, mirando o centro da ilha), e a faixa de céu
  visível é de uns 2°. O sol existe na cena — só não cai no quadro. Trazê-lo
  para a tela pede um enquadramento rasante (câmera baixa, olhando o horizonte)
  e uma hora do dia mais baixa, que muda a paleta; fica para uma leva própria, se
  você quiser.
- **Ciclo de dia e noite no menu**: decidido contra (legibilidade do título).
