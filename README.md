# Voxelcraft

Sandbox voxel no navegador, no estilo Minecraft, escrito em JavaScript puro —
**sem etapa de build, sem bundler e sem dependências de runtime**. A cópia do
three.js vive em `vendor/three/`, o jogo é servido como está e a lógica de jogo
está dividida em módulos pequenos, a maioria testável sem DOM.

## Requisitos

- **Navegador** com WebGL2, ES modules + import map e IndexedDB (Chrome, Edge ou
  Firefox recentes).
- **Node 20.11+** apenas para rodar os testes e as ferramentas. O jogo em si não
  usa Node.

## Rodando

```bash
npm start          # http://localhost:8000
```

`npm start` sobe `tools/serve.mjs`, um servidor estático sem dependências
(porta alternativa: `npm start 8080`). Qualquer servidor HTTP serve, por exemplo:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

> Abrir `index.html` por `file://` **não** funciona: `type="module"`, o import
> map e o Web Worker do terreno exigem HTTP.

## Publicando (GitHub Pages)

O jogo fica em <https://zedrodacunha.github.io/Voxelcraft/> e **a publicação é
automática**: todo push em `main` dispara o workflow **Pages**
(`.github/workflows/pages.yml`), que empacota o site e publica. O jogo não tem
etapa de build — o que está no repositório é o que vai para o ar.

- Para publicar na hora, sem esperar um merge: **Actions** → **Pages** →
  **Run workflow** (branch `main`).
- A fonte do Pages precisa ser **GitHub Actions** (Settings → Pages → Source).
  No modo antigo, “Deploy from a branch”, quem publica é o construtor do Pages —
  o `.nojekyll` na raiz é o que mantém esse caminho funcionando.
- Site “parado na versão velha” depois de uma publicação costuma ser o **service
  worker** do PWA: `Ctrl+Shift+R`, ou DevTools → *Application* → *Service
  workers* → **Unregister** + *Clear site data*. Para depurar sem cache, abra com
  `?sw=0`.

## Testes e validação

```bash
npm test           # 1164 testes de módulos puros (node --test)
npm run check      # sintaxe de todos os módulos + importmap em dia
npm run stamp      # regrava os hashes de cache no index.html
```

O `check` é o que o CI (`.github/workflows/ci.yml`) roda em todo PR para `main`.

## Como o jogo está organizado

| Área | Arquivos |
| --- | --- |
| Entrada | `world-menu.js` (menu, seleção/criação de mundo), `world-options-view.js` (tela de opções em categorias, aberta no menu e no ESC do jogo), `game-pause-menu.js` (menu de pausa) |
| Panorama do menu | `menu-background.js` (a câmera que gira e o céu) e `menu-panorama.js` (a ilha em malha única, com sombra de canto) |
| Loop e estado do jogo | `game.js` (mundo, HUD, interação, save) |
| Chat e comandos | `world-chat.js` (log, rascunho e histórico do ↑), `world-chat-commands.js` (tecla T, `/help`, `/give`, `/clear`, `/time`, `/tp`, `/kill`, `/seed`), `world-chat-completion.js` (**Tab** completa comando e argumento, Shift+Tab volta, e a lista de sugestões sai do catálogo) |
| Física e colisão do jogador | `player-physics.js` (AABB × voxels, passo subdividido, destravar, ocupação de célula, apoio no chão agachado), `player-jump.js` (janela do pulo tardio) |
| Criaturas | `world-creature-base.js` (chão, passo, degrau, corpo de caixas e o **golpe** — `takeHit` — que **todas** as criaturas usam), `world-mob-hit.js` (o **kit do golpe**: mira, clarão, amassado, recuo e a trava por bicho, iguais para todo mob — `tests/mob-kit.test.mjs` cobra o contrato de cada bicho novo), `world-creature.js` (Mofim: **orelhas, focinho, pés, cauda e olhos acesos à noite**, **asas de mariposa** em duas peças, **chegada andando no crepúsculo**, passeio, medo, chilreio, pulo de degrau, planeio na descida, **voo curto** para escapar ou passear, **travessia** para cruzar lago/ravina, brilho noturno e o pó luminoso que o corpo derrubado solta), `world-sheep.js` (**ovelha**: lã de nove tufos com topete, casco escuro e brilho no olho; nasce de dia no capim a 16–30 blocos, mansa mas desconfiada, **em rebanho** de 2 a 4 com líder e seguidoras (até seis no mundo), cada uma no **seu ritmo** (0,48–0,62 bloco/s) e no **seu canto** em volta da líder, vagando devagar com as quatro patas em diagonal (o corpo **gira** até o rumo, a velocidade entra e sai em rampa e a passada anda pela **distância** — o pé não escorrega nem correndo); parada, **respira** (a lã sobe e desce), balança a **cauda**, treme **uma** orelha de vez em quando e **espia** para os lados, cada uma no seu próprio tempo e **parando para encarar** quem chega correndo (agachado, não; golpe, ela corre para longe e leva o bando) — mas **só quem percebe**: campo de visão de ~140°, raio de 7 blocos e um sorteio por ovelha, com a reação entrando em décimos de segundo; quem sente a vizinha assustada entra com atraso, e o contágio **não sai em cadeia**; ao encarar, **vira a cara primeiro e o corpo acompanha devagar**, erguendo a cabeça e **inclinando de lado** (e um **pescoço** de lã grosso, sentado numa **gola** no ombro, mantém a cabeça ligada ao corpo quando ela pasta), em três lãs — branca, cinza e preta; **pasta** de vez em quando, comendo a grama da frente (que vira terra e volta a crescer em 5–10 min); com a **tesoura** (duas barras de ferro na diagonal) fica **tosquiada** — lã baixa e sem topete — e solta 1–3 fardos de lã da sua cor, que voltam a crescer em 5–8 min, mais rápido se ela pastar; e **bale** — de vez em quando e quando o jogador chega perto, com o volume caindo pela distância; leva **golpe** como o Mofim: clarão no corpo, **amassado**, **recuo que desliza e freia**, lascas e som de impacto (e a cadência é do braço: um swing, um golpe), caindo no quarto golpe e soltando **lã (se tiver velo) e carne de ovelha** — crua, que **assa na fornalha**) |
| Catálogo de blocos e receitas | `world-catalog.js`, `inventory-recipe-book.js` |
| Carnes e forno | `world-meats.js` (a tabela das carnes — crua e **assada**, comida de cada uma, tempo de forno e cores da arte; dela saem os itens, o `SMELT` e o par de sprites, então bicho novo que solta carne entra numa linha só), `world-furnace-rules.js` (a simulação do forno), `world-furnace-effects.js`/`world-furnace-sounds.js` (fumaça, brasa e crepitar) |
| Blocos com forma própria | `world-bed.js` (**a cama**: um bloco de dois voxels — cabeceira e pés — em doze caixas puras: pernas e travessa de carvalho claro por baixo, colchão vermelho com aba de 1 px no topo e travesseiro branco em duas caixas na cabeceira; a geometria gira nas quatro direções, a colisão é o voxel inteiro até 9/16 de altura — dá para subir nela — e a metade que falta sai junto ao quebrar), `world-door.js` (o painel fino da porta) |
| Geração de terreno | `world-terrain.js`, `world-terrain-worker.js`, `world-ore-generation.js`, `world-math.js` |
| Malha e render | `world-grid.js`, `world-instanced-manager.js`, `world-mesh-buffers.js`, `world-textures.js`, `world-sky.js`, `world-clouds.js`, `world-water.js`, `world-graphics-quality.js` (escala automática), `world-render-resolution.js` (resoluções de 360p a 4K) |
| Luz | `world-lighting-effects.js` (tremor/efeitos de shader), `world-light-region.js` (região de recomputação), `world-point-lights.js` (PointLight real das fontes próximas e da mão) |
| Sobrevivência e regras | `world-survival-rules.js`, `world-interaction-rules.js`, `world-tool-rules.js`, `world-door.js`, `world-furnace-rules.js` |
| Save e armazenamento | `world-save-*.js`, `world-storage.js`, `world-list-store.js` |
| Inventário | `inventory-*.js`, `inventory.css` |
| Áudio | `world-audio.js` (síntese em WebAudio; arquivos opcionais em `assets/sounds/`) |
| Cachoeira | `world-waterfall.js` (acha água caindo perto, ganho por distância e histerese do laço) |
| Passos e sons de bloco | `world-block-materials.js` (família por bloco), `world-step-sounds.js` (qual som e de quanto em quanto) e `world-gait.js` (**a passada**: a mesma fase que conta os passos, balança o braço e balança a visão — sobe-e-desce, vai e vem lateral e microinclinação) |
| Mão em primeira pessoa | `world-hand-animation.js` (laço de mineração + golpe) |
| Ferramentas | `tools/serve.mjs`, `tools/check.mjs`, `tools/stamp-importmap.mjs` |
| Testes | `tests/*.test.mjs` |

Os mundos ficam no IndexedDB do navegador (banco `voxel-sandbox`), com backup,
recuperação e importação/exportação de save.

## Flags de URL

| Flag | Efeito |
| --- | --- |
| `?debug` | expõe `window.dbg` (dar itens, mudar fome, testar portas, ler blocos) e o painel F3 |
| `?gpu=default` | força a preferência de GPU para `default` em vez de `high-performance` |
| `?pr=1` | limita o `devicePixelRatio` usado no render |
| `?reset` | apaga o save do mundo atual **uma vez** (o parâmetro é consumido e removido da URL) |
| `?touch` | força os controles de toque mesmo no desktop (útil para testar); `?touch=0` desliga num aparelho de toque |
| `?sw=0` | não registra o service worker (depurar cache sem limpar os dados do site) |

## Toque (celular e tablet)

No toque não existe *pointer lock*, então o jogo entra por outro caminho: nada de
capturar o mouse, e sim um joystick e botões na própria tela.

- **Joystick** (canto inferior esquerdo): arraste a partir de onde o dedo encostou.
  A zona morta é por eixo (tremor de dedo não anda) e empurrar até o fim **corre**.
- **Dedo na tela é a mira** (como no Minecraft de celular): o bloco escolhido é o
  que está embaixo do dedo, não o da cruz do centro. Três gestos, um dedo só:
  - **arrastar** → olha em volta (a sensibilidade do dedo é uma barra própria,
    em Controles → Controles de toque);
  - **toque curto parado** → usa/coloca naquele bloco (o mesmo "usar" do botão
    direito do mouse);
  - **segurar parado** (~0,25 s) → cava aquele bloco, e deslizar o dedo cava a
    fileira por onde ele passa.
- **Botões**: só ícones, grandes — `Pular` (seta ↑) e `Cavar` (picareta) seguram
  enquanto o dedo estiver neles; `Usar` (mão), `Agachar` (seta ↓, alterna),
  `Mochila` e `Pausar` são de um toque. O nome de cada um fica no `aria-label`.
- **Hotbar**: cada casa é um botão (não há roda do mouse).
- **Opções → Controles → Controles de toque** (um nível dentro da mesma janela, no
  menu e no ESC): **Mão** (Destro/Canhoto espelha joystick, botões e dica),
  **Sensibilidade do olhar** (50%–200%, 80% de fábrica, separada da do mouse),
  **Tamanho dos botões** (80%–140%, com o joystick e a hotbar acompanhando) e
  **Vibração** (Ligada/Desligada). Fica gravado em `localStorage` junto das
  outras preferências.
- **Posição livre**: em **Editar posições** (na mesma sub-tela), o mundo pausa e
  cada peça — joystick, Pular, Cavar, Usar, Agachar, Mochila, Pausar — pode ser
  arrastada para onde o polegar alcançar. `Pronto` grava, `Restaurar` devolve
  tudo ao lugar. As posições ficam em % da tela, então valem no celular e no
  tablet e sobrevivem a girar o aparelho.
- **Vibração** (onde o aparelho deixa — Android vibra, iPhone não): pulso curto
  ao quebrar, colocar, bater no Mofim, andar/correr e apertar botão; padrão mais
  forte ao levar dano. Cada acontecimento tem folga mínima, então não vira
  zumbido, e pausar/morrer cancela um pulso no meio.
- **Híbrido**: notebook com tela de toque também joga com mouse — se o clique for
  do mouse, o jogo pede *pointer lock* como sempre; se for do dedo, vira toque.

A interface de toque só aparece quando o jogador entra por esse caminho, e usa os
mesmos botões cinza do menu (`.classic-btn`).

## Acessibilidade

A interface é operável sem mouse:

- **Inventário**: `Tab` entra na grade, setas/`Home`/`End` navegam, `Enter` =
  clique esquerdo, `Espaço` = clique direito, `Shift` + esses dois = movimento
  rápido. Cada slot tem `aria-label` com item, quantidade e durabilidade.
- **Barras de status**: vida, fome e fôlego expõem o valor em texto
  (`"Fome: 6 de 20 (fome baixa)"`) e os avisos do jogo são anunciados.
- **Tela de morte**: aparece com foco e leva o foco ao botão `Renascer` quando
  ele fica disponível.
- `prefers-reduced-motion` desliga as animações de HUD.

Detalhes em [`MELHORIA-20261102-acessibilidade.md`](MELHORIA-20261102-acessibilidade.md).

## Som

Não há arquivos de som no repositório: cada efeito é **sintetizado** em WebAudio
(`world-audio.js`) e o áudio só é criado no primeiro clique/tecla, como os
navegadores exigem. O volume fica nas opções (0% = mudo) e vale na hora.

Os **passos** vêm do bloco sob os pés (grama, terra, pedra, madeira, areia) e a
cadência é por distância andada — andar devagar espaça os passos, correr
aumenta a frequência; no ar e na água não há passo. **Quebrar** e **colocar**
bloco usam a mesma família de material (ruído + baque grave), com tom variando a
cada golpe. Durante a mineração, a **batida** de cada golpe sai no ritmo do braço
(a fase da animação dita o som, não um cronômetro). A **porta** tem som próprio
para abrir (rangido de dobradiça) e fechar (batida no batente), e a **água** só
soa na transição — splash ao entrar (mais forte quanto maior a queda), saída,
mergulho abafado e braçada — sem laço contínuo. **Dano** tem gemido grave que
cresce com o tamanho do golpe, e a morte tem som próprio. **Forno** crepita ao
acender, sopra ao apagar e avisa quando a peça fica pronta — e o som afina com a
distância, para um forno esquecido longe não soar ao lado do jogador. O **Mofim**
chia em dois trinados curtos: um grito quando se assusta, um chiado enquanto foge
e, de vez em quando, um chamado de passeio.

A **cachoeira** é o outro som contínuo, mas não é ambiente: ela só existe onde
há água caindo (blocos de queda d'água) e o volume é a **distância** — some a 16
blocos, cresce com o tamanho da queda (colunas × altura) e tem teto de ~55% para
não engolir o resto. Entra e sai por fade, com histerese: andar na borda do
alcance não faz o som piscar. O laço é um ruído gerado em JS (grave de volume,
corpo e respingo, com emenda dobrada para não estalar), e o achado é refeito ~3
vezes por segundo em volta do jogador.

O **ambiente** é o outro som contínuo, e é escasso de propósito: fases de
silêncio, vento, grilos (só de noite, perto do nível do mar) e, de vez em quando,
os dois juntos — nunca a mesma fase duas vezes seguidas, sempre com pausa entre
elas. Duas camadas em laço (um nó de áudio cada, criadas uma vez) com fade na
entrada e na saída, e silêncio na pausa, no menu e com a aba escondida.

Para usar um som gravado, copie o arquivo com o nome do efeito para
`assets/sounds/` — o carregador prefere `ui-click.ogg`/`.wav` (e assim por
diante) e cai na síntese quando o arquivo não existe. Lista completa em
[`assets/sounds/LEIA-ME.md`](assets/sounds/LEIA-ME.md).

## O menu inicial

O panorama que gira atrás do título **não é um cenário de enfeite**: ele é
montado com as mesmas regras do mundo. A ilha sai de `menu-panorama.js` em duas
malhas (opaca e recortada), com as faces escondidas fora e a **sombra de canto**
escrita em cor de vértice — a mesma conta de `ambientOcclusionAt` no `game.js` —,
e o material é o mesmo par `MeshLambertMaterial` + `vertexColors` dos pedaços do
jogo. A luz e o céu vêm do `world-sky.js`: cor do fundo, nevoeiro, sol, lua,
estrelas e a intensidade/cor do sol e da hemisférica. O relógio dele fica parado
numa manhã de sol (`MENU_SUN_TIME`), porque menu que escurece sozinho deixa o
título ilegível.

## Pausa e opções (ESC)

`ESC` durante o jogo solta o mouse e abre o **menu de pausa**: `Voltar ao jogo`,
`Opções…` e `Salvar e sair para os mundos` — todos no `.classic-btn` cinza do
menu, e as teclas ficam num `Controles` recolhido. No toque, o botão `Pausar`
abre o mesmo cartão.

O fundo é **o mundo de onde você parou**, borrado e escurecido como no
Minecraft: o `backdrop-filter` do CSS borra o canvas do jogo que continua
pintado atrás (nada de imagem estática), e pausado o HUD e a mão em primeira
pessoa saem da frente. Os menus crescem junto com a tela (`--ui-scale`: 1×, 1,3×,
1,6× e 2× conforme a resolução) — as medidas deles são em `em`, então tudo
acompanha, enquanto o HUD do jogo fica no tamanho de sempre.

A tela de opções é a **mesma** do menu inicial, agora também com o jogo rodando
atrás, no formato do Minecraft — e **separada por categorias**: a janela abre
com três botões (`Áudio`, `Gráficos`, `Controles`) e cada um troca a grade no
lugar, com o título acompanhando e `Voltar` para a lista. O toque mora dentro de
`Controles` (`Controles de toque`), porque é onde o jogador procura o mouse e o
dedo juntos; a lista de teclas recolhida também é de lá. Uma janela só, nunca
duas empilhadas.

Dentro de uma categoria, o nome e o valor ficam **centrados** no botão
(`Campo de visão: 75°`) e, nas opções de faixa, um trilho escuro com o **cursor**
mostra onde o valor está. Clique e arraste na barra mudam pela posição (é o gesto
que serve no dedo também), setas andam um passo e `Home`/`End` vão aos extremos;
o leitor de tela recebe `role="slider"` com `aria-value*`. Já as opções de
**lista** — hoje só `Gráficos` — são botão: cada clique passa para o modo
seguinte, sem trilho nem cursor.

| Opção | Categoria | Vale quando |
| --- | --- | --- |
| Volume | Áudio | na hora |
| Sensibilidade do mouse | Controles | na hora |
| Campo de visão | Gráficos | na hora |
| Gráficos (automática/máxima/alta/média) | Gráficos | na hora — o mesmo caminho do `F4` |
| Resolução (Janela/360p…4K) | Gráficos | na hora — numa resolução fixa o jogo entra em tela cheia e pede confirmação (10 s, senão volta) |
| Distância de render | Gráficos | no próximo mundo (recarregar chunks ao vivo é outro assunto) — um recado avisa quando você muda |

A **Resolução** é a do jogo, não a da janela: o navegador não deixa a página
mudar a resolução do sistema, então o que se escolhe é **quantos pixels o canvas
desenha** (de 640×360 a 3840×2160, mais `Janela (nativa)`, que é o tamanho da
tela com a escala automática). A imagem é esticada para ocupar a tela toda —
sem faixas pretas — e escolher uma resolução fixa pede tela cheia, que é o único
jeito de a janela acompanhar. Como a troca pode deixar um aparelho fraco em
camera lenta, ela passa por uma **confirmação** (`Manter`/`Reverter`, 10 s): sem
resposta, volta sozinha para a anterior. Ver `world-render-resolution.js`.

Quem grava é `world-game-settings.js` (localStorage), que também **avisa** os
assinantes — o jogo aplica o que dá na hora e o áudio da interface troca de
volume sem recarregar a página.

## Instalar e jogar sem rede (PWA)

O jogo é um **PWA**: dá para instalar pelo próprio navegador e jogar offline
depois da primeira visita. A tela inicial tem um botão **Instalar app** (padrão
cinza do menu) que aparece quando há como instalar:

- **Chrome/Edge**: o navegador dispara `beforeinstallprompt`, o jogo guarda o
  evento e o botão abre o convite nativo no clique;
- **Safari (iPhone/iPad)**: não existe convite programático, então o botão
  revela o caminho manual — Compartilhar → "Adicionar à Tela de Início";
- **já instalado** (janela própria) ou navegador sem nenhum dos dois: o botão
  simplesmente não aparece.

| Peça | Onde | O que faz |
| --- | --- | --- |
| Manifest | `manifest.webmanifest` | nome, ícones (192, 512 e maskable), `display: standalone`, cores |
| Service worker | `service-worker.js` | guarda **o jogo inteiro** na instalação (a lista sai do `index.html`) |
| Registro | `world-pwa.js` | registra só em `http(s)`; `?sw=0` desliga |
| Botão de instalar | `world-install-prompt.js` | decide quando mostrar e chama o convite do navegador (testado sem DOM) |
| Ícones | `icons/`, `tools/grass-block.png` | `tools/make-icons.mjs` reamostra a arte do bloco (`tools/grass-block.png`) e escreve os PNGs sem dependência: bloco transparente para desktop, maskable com fundo para o Android e um opaco de 180 para o iOS |

**O que guardar vem do próprio `index.html`.** Na instalação o worker busca a
página e lê duas coisas: o importmap (que já lista **todos** os módulos com o
`?v=<hash>` do conteúdo) e os `src`/`href` dela (script de entrada, CSS, manifest
e ícones). É exatamente a lista de URLs que o navegador vai pedir — então não
existe segunda lista para envelhecer em silêncio, e **depois da primeira visita o
jogo inteiro abre sem rede**, não só o menu. Se a página não puder ser lida
(instalação sem rede no meio), fica uma casca mínima escrita no worker.

Três estratégias, porque os tipos de requisição têm problemas opostos:

- **documento** (`index.html`): rede primeiro — versão nova chega na hora; sem
  rede, cai na cópia guardada. Se nunca abriu online, mostra uma página dizendo
  isso em vez de tela em branco.
- **módulos e CSS**: cache primeiro com atualização em segundo plano. Como já
  vêm com `?v=<hash>` no importmap, servir do cache nunca entrega código velho:
  hash diferente é URL diferente. Na ativação, as versões antigas de módulo saem
  do cache (a URL de hoje é conhecida, então dá para limpar o resto).
- **imagens** (`assets/`): iguais às anteriores, com o `?v=` na chave. A versão
  de cada PNG é o **hash do próprio arquivo** (carimbado em `asset-versions.js`),
  então trocar a arte muda a URL e a imagem nova chega na hora. Guardar sem a
  versão foi o bug do capim: o arquivo trocado continuava sendo pedido na URL do
  velho e o cache devolvia a arte antiga para sempre. Sem rede, uma versão
  anterior da mesma imagem ainda serve de rede de segurança (só imagem — código
  velho nunca é servido).

Só a própria origem é cacheada — CDN de terceiros fica de fora. O `three.js` já
está em `vendor/`, então o jogo não depende de CDN para abrir.

Para conferir de verdade: abra o jogo, jogue alguns segundos, feche a aba, entre
em modo avião (ou desligue o Wi-Fi) e abra de novo — o mundo carrega e dá para
jogar. O passo a passo completo (Chrome, Android e iPhone, com o que olhar no
DevTools e o que fazer quando falha) está em
[TESTE-EM-NAVEGADOR.md](TESTE-EM-NAVEGADOR.md).

## Import map e cache

O `index.html` aponta cada módulo com um sufixo `?v=<sha256>`, gerado por
`tools/stamp-importmap.mjs` a partir do conteúdo do arquivo. Isso evita a
mistura clássica de módulo novo com módulo velho em cache depois de um deploy.

O mesmo carimbo gera `asset-versions.js`, com o hash de cada imagem de
`assets/`: é de lá que sai o `?v=` das texturas do capim (imagem não passa pelo
importmap). Nenhuma versão de asset é escrita à mão.

**Ao editar qualquer `.js`/`.css` referenciado pelo `index.html` — ou trocar um
PNG de `assets/` — rode:**

```bash
npm run stamp
```

Se esquecer, o teste `cache-versioning` e o `npm run check` reprovam.

## Arte

A arte do jogo é **nossa**: ícones desenhados aqui, em 16×16, com paleta própria,
contorno tingido e o cabo de madeira das tábuas do jogo. As três — **picareta**, **machado** e **pá** — partem da leitura clássica
com pequenos ajustes: cor nossa, forma reconhecível, cabo de tábua, sem acento e
sem faixa de couro. As regras estão em
[`GUIA-DE-ARTE.md`](GUIA-DE-ARTE.md), e os testes de `tests/art-style.test.mjs`
cobram cada uma delas — inclusive **nenhuma silhueta igual à do sprite clássico**.

O Voxelcraft é um projeto de fã, **não oficial**: não tem vínculo com a Mojang ou
a Microsoft, e não usa arte, som, código ou marca de nenhum jogo comercial.

## Convenções do projeto

- **Um tema por PR**: correções e melhorias entram separadas, cada uma com seu
  teste e sua documentação.
- Regra de jogo em **módulo puro** (sem DOM, sem three.js) sempre que possível —
  é o que permite testar com `node --test`.
- Bug corrigido ganha um `BUG-AAAAMMDD-*.md` com sintoma, causa, correção e
  validação.
- Análises e revisões ficam em `ANALISE-*.md` e `REVISAO-*.md`; melhoria de
  interface/polimento ganha um `MELHORIA-AAAAMMDD-*.md` com antes, depois,
  validação e limitações; cobertura de teste nova ganha um
  `TESTES-AAAAMMDD-*.md` dizendo o que passou a ser verificado.
