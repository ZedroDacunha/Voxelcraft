# Teste no navegador de verdade

O CI e os testes automáticos cobrem a **lógica**: o manifest, os ícones (pixel a
pixel), a decisão do botão de instalar e o comportamento do service worker. O que
eles não conseguem cobrir é o que só existe num navegador de verdade — o convite
de instalação, o recorte do launcher, a tela sem rede.

Este roteiro é para rodar **antes de publicar uma leva** que mexa em PWA, em
cache ou em ícones. Leva uns 15 minutos e evita o tipo de erro que só aparece no
aparelho do jogador.

## Antes de começar

- **Sirva por `http://localhost` ou HTTPS.** Em `file://` não existe service
  worker — metade do roteiro não roda.
- **Abra numa aba de verdade.** Em pré-visualização embutida (iframe) o Chrome
  **não dispara** `beforeinstallprompt`, então o botão "Instalar app" nunca
  aparece — não é bug do jogo.
- Tenha o DevTools aberto em **Application**: *Manifest* (instalabilidade),
  *Service Workers*, *Cache Storage* e *IndexedDB* (os mundos salvos).
- Para "descolar" de uma versão antiga: `?sw=0` na URL desliga o service worker,
  e DevTools → *Service Workers* → **Unregister** limpa o registro.

## 1. Chrome desktop (Windows, macOS, Linux)

- [ ] O menu inicial mostra **Instalar app** logo abaixo de "Opções... / Sair do jogo".
- [ ] DevTools → *Application* → *Manifest*: **Installability: yes**, com os
      ícones 192, 512 e maskable carregando.
- [ ] Clicar no botão abre o convite do navegador; aceitar abre o jogo numa
      **janela própria**, sem barra de endereço.
- [ ] O ícone na barra de tarefas (ou no dock) é o bloco inteiro, sem borda
      preta e sem corte.
- [ ] O favicon na aba lê como um bloco, não como um borrão.

## 2. Chrome no Android

- [ ] O botão **Instalar app** aparece no menu inicial e instala.
- [ ] No launcher, o ícone é o bloco inteiro **com fundo de céu**, tanto no
      recorte circular quanto no quadrado arredondado (alguns launchers deixam
      escolher; se der, teste os dois).
- [ ] Abrir pelo ícone: sem barra do navegador (`display: standalone`).
- [ ] Jogar uns 10 segundos: andar, quebrar um bloco, colocar outro e sair.

## 3. iPhone ou iPad (Safari)

- [ ] O botão **Instalar app** aparece e, no toque, revela a instrução — no iOS
      não existe convite programático.
- [ ] Compartilhar → **Adicionar à Tela de Início**: o ícone aparece **sem fundo
      preto** (o iOS pinta transparência de preto, por isso o ícone do iOS é
      opaco e separado).
- [ ] Abrir pelo ícone: sem barra do Safari.
- [ ] No iOS, só o Safari adiciona à tela de início — Chrome e Firefox de iPhone
      usam o mesmo motor e não têm esse caminho.

## 4. Offline (é o teste que importa)

- [ ] Com o jogo **já jogado uma vez** nesta sessão do navegador, fechar a aba.
- [ ] Ativar modo avião (ou desligar o Wi-Fi do computador).
- [ ] Abrir o jogo pelo ícone ou pela URL: o **menu** aparece.
- [ ] **Entrar no mundo** — criar ou continuar: a ilha carrega, dá para andar,
      minerar e salvar. (Chegar ao menu não basta: era exatamente esse o furo
      corrigido na leva 2 do offline.)
- [ ] Recarregar ainda offline: continua abrindo.
- [ ] Sem rede **e sem nunca ter aberto online** (janela anônima, offline):
      aparece a página "Conecte-se uma vez para poder jogar sem rede", não uma
      tela em branco nem erro de rede.

## 5. Atualização depois de um deploy

- [ ] Com o jogo instalado, abrir **online**, fechar e abrir de novo.
- [ ] DevTools → *Cache Storage*: existe o cache `voxel-sandbox-v<N>` novo (o
      número atual está em `CACHE_VERSION`, no topo de `service-worker.js`), e o
      cache da versão anterior sumiu.
- [ ] As entradas de módulo têm o `?v=<hash>` novo e **não sobrou** versão
      antiga de módulo (a ativação apaga o que ninguém mais pede).
- [ ] Se nada mudou no código, o comportamento é o mesmo — `CACHE_VERSION` só
      sobe quando a casca ou a estratégia mudam.

## 6. Pausa e opções (não é PWA, mas passa por aqui)

- [ ] Dentro do mundo, `ESC` solta o mouse e mostra **Jogo pausado** com
      `Voltar ao jogo`, `Opções…` e `Salvar e sair para os mundos`.
- [ ] `Opções…` abre a grade; **arrastar** a barra de campo de visão muda a
      câmera na hora, sem fechar a tela.
- [ ] Sensibilidade e volume também valem na hora; **Gráficos** muda a resolução
      igual ao `F4`.
- [ ] `Distância de render` mostra o valor novo e, ao mudar, avisa num recado
      rápido que vale **no próximo mundo** que você entrar.
- [ ] Com as opções abertas, o cartão de pausa **não** aparece mais atrás; ao
      fechar (`Concluído` ou `ESC`), ele volta.
- [ ] Ao pausar, o **mundo de onde você parou** aparece borrado atrás do cartão,
      sem HUD e sem a mão; numa tela grande (≥ 1600×900) o menu vem maior.
- [ ] `Tab` percorre as opções e as setas mudam o valor; `ESC` fecha a tela e
      volta para o menu de pausa.
- [ ] No celular, o botão **Pausar** abre o mesmo cartão e dá para arrastar as
      barras com o dedo.

## 7. Mofim (criatura da noite)

- [ ] Ao anoitecer (céu ainda alaranjado) os Mofins **chegam andando de longe**,
      do mesmo lado, um alguns segundos atrás do outro; param a uns 12 blocos e
      passam a passear. Nenhum aparece já parado ao lado do jogador.
- [ ] Eles andam, pulam degraus e chiam.
- [ ] De perto, o bicho tem **orelhas, focinho, pés no chão e cauda**, e a luzinha
      fica na ponta de uma antena (não boiando acima da cabeça).
- [ ] As asas são de mariposa: **duas peças** por lado (dianteira maior com mancha
      clara, traseira menor atrás), borda escura na ponta, e elas **articulam no
      ombro** — a de trás acompanha o bater com atraso.
- [ ] À noite os **olhos acendem** (duas luzinhas âmbar) e ele **pisca** de vez em
      quando; de dia os olhos são só dois pontos escuros.
- [ ] Os três da noite não têm exatamente a mesma cor.
- [ ] De vez em quando ele faz um **voo curto**: sai do chão, sobe ~1,5 bloco e
      pousa adiante (não é o tempo todo — é a cada 11–22 s por bicho).
- [ ] Encurralado na beira de um lago, ele **voa** para a margem em vez de ficar
      tremendo contra a água.
- [ ] Num lago **largo** (ou numa ravina), ele faz a **travessia**: sai do chão,
      plana baixo por vários blocos e pousa do outro lado. Num barranco alto, não
      atravessa — dá a volta.
- [ ] Correndo perto ele se assusta; **agachado** não; um golpe assusta e
      empurra. Ao amanhecer ele sobe e some, sem deixar pó.

## 8. A luz do Mofim

- [ ] De noite, o chão em volta dele **clareia de verdade** (não é só o pontinho
      brilhante da antena): dá para ver o tom de grama, terra ou pedra.
- [ ] Quando ele **chia**, a luz dá um **pulso** curto (meio segundo) e volta —
      o som e o clarão acontecem juntos.
- [ ] O pulso **não pisca aos saltos**: sobe e desce suave, mesmo com o bicho
      andando.
- [ ] A luz do Mofim **não briga** com a tocha: com duas fontes por perto, as
      duas vagas se revezam para as mais próximas (chegar perto da tocha não
      apaga o bicho de vez, e vice-versa).
- [ ] Quando ele vai embora ao amanhecer, a luz **apaga com ele** (não fica uma
      poça acesa no ar).
- [ ] Em **Gráficos → Baixa**, o bicho **não** pega vaga do pool: continuam só
      tochas e fornalhas, e ele fica apenas com o brilho próprio.
- [ ] Fora do alcance (~13 blocos) a luz dele cai a zero, como a das tochas.

## 9. O rastro de pó

- [ ] Andando de noite, ele deixa uma **fileira de pontinhos luminosos** atrás
      (somem em ~1,5 s, subindo devagar).
- [ ] **Parado**, não sai pó nenhum — por mais tempo que ele fique no lugar.
- [ ] **Correndo** (assustado) o rastro fica bem mais denso, e **voando**
      (travessia) vira uma cauda comprida atrás dele.
- [ ] Ao **pousar** depois de um voo, sobe uma nuvenzinha no ponto do pouso.
      Pular um degrau **não** levanta nuvem.
- [ ] Ao amanhecer, ele sobe e some **sem deixar pó**.
- [ ] Em **Gráficos → Baixa** não sai pó nenhum; em **Média** sai a metade.
      Voltando de Baixa para Alta, **não** aparece um punhado de pó atrasado.
- [ ] O jogo não engasga com três Mofins juntos (o pool é fixo: 40 partículas).

## 10. O vento no capim

- [ ] O capim **balança devagar**, vergando sempre para o mesmo lado (não é
      zumbido de um lado para o outro).
- [ ] Na **maior parte do tempo** ele está quase parado: o balanço forte só
      acontece quando o **som de vento** está tocando. Ouça e olhe junto — os
      dois têm de começar e terminar praticamente na mesma hora.
- [ ] A troca **não dá salto**: quando a fase de vento acaba, o capim vai
      assentando por alguns segundos em vez de parar de repente.
- [ ] Tufos vizinhos **não balançam em sincronia** (cada um tem seu tempo).
- [ ] No alto de um morro balança mais do que no vale.
- [ ] Pausando o jogo (ESC), o fundo desfocado **não** continua balançando; ao
      voltar, ele retoma de onde estava.
- [ ] O tufo de capim **na mão** do jogador continua parado.
- [ ] Nenhum outro bloco (grama baixa, folhas, flores) passou a se mexer.

## 11. O pó ao vento

- [ ] O rastro do Mofim vai **para o mesmo lado** que o capim verga. O teste de
      ouro é olhar os dois juntos: eles têm de concordar.
- [ ] Numa fase de **vento** (som de vento tocando), o rastro é levado bem mais
      longe do que no silêncio — no silêncio ele quase só sobe.
- [ ] Quando a **rajada** aperta, o pó acelera junto com o capim, na mesma hora.
- [ ] As partículas **não andam em bloco**: cada uma tem seu tempo (o rastro
      farfalha em vez de deslizar como uma placa).
- [ ] A nuvem do **pouso** também é levada pelo vento.
- [ ] Sem vento (silêncio), o pó sobe reto e cai para trás — como era antes.
- [ ] Pausando (ESC), o pó **congela** no ar; ao voltar, retoma de onde estava.
- [ ] O pó atravessa parede (é fumaça), mas desbota em 1,5 s sem deixar sujeira.

## 12. O sol no menu

- [ ] Ao abrir o jogo, o **sol aparece** no céu do menu, logo acima da linha das
      árvores — um quadrado amarelo, do mesmo jeito que no jogo.
- [ ] O céu está **laranja de fim de tarde** e a luz na ilha é dourada (não é mais
      meio-dia branco).
- [ ] A ilha fica um pouco **menor** que antes e há céu de verdade em cima dela
      (antes eram só uns 5% de céu no topo).
- [ ] A câmera gira devagar e, depois de alguns minutos, o sol **sai de quadro**
      — e isso é esperado (não é bug).
- [ ] Com "reduzir movimento" ligado no sistema, a câmera **não gira** e o sol
      fica parado em cena.
- [ ] Em celular (retrato e paisagem) e em tela larga o sol continua visível.
- [ ] Ao entrar no mundo, o céu do **jogo** está normal (o mesmo de antes, com
      sol, lua e estrelas se movendo).
- [ ] Nada do menu (título, botões) ficou ilegível com o céu laranja.

## 13. Toque no mundo (celular e tablet)

Abra com `?touch=1` num aparelho de dedo (ou no Chrome com "modo dispositivo"
ligado). No menu, o aviso de toque já explica: joystick à esquerda, arraste para
olhar, toque para usar, segure para cavar.

- [ ] Os botões da direita são **só ícones** (seta ↑ Pular, picareta Cavar, mão
      Usar, seta ↓ Agachar, mochila Mochila, duas barras Pausar), no mesmo cinza
      de borda preta do menu, sem texto escrito.
- [ ] Ler em voz alta (leitor de tela) diz "Pular", "Cavar", "Usar"… e não lê o
      desenho do ícone.
- [ ] **Toque curto** num bloco com o dedo parado: o bloco sob o dedo ganha o
      contorno de mira e o item da mão é usado ali (colocar bloco, abrir forno,
      porta, comer). Não precisa acertar a cruz do centro.
- [ ] **Segurar** o dedo parado no mesmo lugar: depois de ~0,25 s o bloco
      começa a quebrar, o botão Cavar acende e o braço bate. Soltar para.
- [ ] **Arrastar** o dedo: a câmera gira e **nada** é usado nem quebrado.
- [ ] Segurar e **deslizar** o dedo cava a fileira de blocos por onde ele passa,
      e a mira acompanha o dedo.
- [ ] Tocar na **água/sem bloco** com comida na mão come; com bloco na mão nada
      acontece (não dá para colocar no ar).
- [ ] Tocar em cima do **Mofim** com o dedo (segurando) dá o golpe nele, e o
      bloco atrás dele não é minerado.
- [ ] Tocar na **hotbar** troca a casa; tocar **entre** as casas da hotbar agora
      vale como toque no mundo (a faixa do HUD não engole mais o dedo).
- [ ] A dica do topo some sozinha depois de alguns segundos.
- [ ] Em **paisagem baixa** (altura ≤ 460 px) os botões ficam menores e não
      cobrem a hotbar.
- [ ] No desktop com mouse nada mudou: clique esquerdo cava, direito usa, e o
      modo toque só liga se o jogador entrou por toque (ou com `?touch=1`).

## 14. Controles de toque (mão e tamanho)

Menu → **Opções** → **Controles** → **Controles de toque** (a mesma
tela abre pelo ESC durante o jogo).

- [ ] O botão mostra um resumo (`Destro · 100%`) e **abre a sub-tela na mesma
      janela** — não aparece uma segunda janela por cima.
- [ ] A sub-tela tem **Sensibilidade do olhar**, **Mão**, **Tamanho dos botões**,
      **Vibração** (e **Editar posições**, dentro do mundo); o título vira
      "Controles de toque".
- [ ] **Voltar** devolve a categoria **Controles**, e de lá o `Voltar` devolve a
      lista; ao fechar e reabrir as Opções, volta sempre para a lista.
- [ ] **Mão: Canhoto** espelha na hora o joystick (vai para a direita), os
      botões (vão para a esquerda), `Mochila`/`Pausar` (canto superior esquerdo)
      e a dica do topo.
- [ ] No canhoto, `Pular` e `Cavar` ficam do lado do polegar (a coluna perto da
      mão), não `Agachar`/`Usar`.
- [ ] **Tamanho dos botões**: arrastar a barra muda os botões **e o joystick**
      na hora; a hotbar continua acima dos botões em 80% e em 140%.
- [ ] Em 140% num celular estreito os controles **não se encostam** (a trava de
      largura entra em ação) e nenhum botão sai da tela.
- [ ] Girar o celular (paisagem baixa, altura ≤ 460 px) mantém a proporção.
- [ ] Fechar o jogo e abrir de novo mantém mão e tamanho escolhidos.
- [ ] **Restaurar padrões** volta para `Destro · 100%` e devolve os controles ao
      canto de sempre.
- [ ] No desktop com mouse nada muda: os controles de toque não aparecem, e a
      tela de Opções continua abrindo normalmente.

## 15. Vibração no toque

Menu → Opções → Controles → Controles de toque → **Vibração: Ligada** (padrão). Use num
**Android** (no iPhone o Safari não vibra — é limitação do navegador, não bug).

- [ ] **Quebrar bloco**: um pulso curto no fim da quebra (e a grama alta também).
- [ ] **Colocar bloco**: um tique bem leve, menor que o da quebra.
- [ ] **Bater no Mofim** (segurando o dedo nele): pulso curto no golpe.
- [ ] **Andar e correr**: cadência de vibração acompanhando os passos no chão —
      parado, nadando ou pulando, nada vibra.
- [ ] **Levar dano**: o padrão mais forte de todos (três pulsos, ~0,1 s).
- [ ] **Botões**: um tique ao apertar `Pular`, `Cavar`, `Usar`, `Agachar`,
      `Mochila` ou `Pausar` — inclusive quando o botão não faz nada no momento
      (apertar `Usar` sem item escolhido vibra igual; é confirmação do toque).
- [ ] **Vibração: Desligada** para tudo, na hora, sem recarregar o mundo.
- [ ] **Pausar no meio de um dano** corta o padrão (não fica vibrando no bolso).
- [ ] A vibração **não** atrapalha o áudio nem o desempenho: andando devagar,
      olhando o F3, o FPS continua igual ao de antes.
- [ ] No **desktop** (mouse) e no **iPhone** o jogo funciona exatamente como
      antes: a opção existe, mas nada vibra.
- [ ] Fechar e abrir o jogo mantém a escolha de vibração.

## 16. Posição livre dos botões

No meio do jogo (modo toque), ESC → Opções → Controles → Controles de toque →
**Editar posições**.

- [ ] A janela de opções fecha, o cartão de pausa some e a tela escurece com os
      controles em cima, cada peça com **contorno tracejado**.
- [ ] A barra do topo tem **Restaurar** e **Pronto** (e a dica de jogar some).
- [ ] **Arrastar o joystick** para o canto direito: ele anda e o jogador **não**
      anda junto (o modo de edição não move o personagem).
- [ ] Arrastar cada botão (Pular, Cavar, Usar, Agachar, Mochila, Pausar) para
      onde o polegar alcança; o contorno fica **cheio** enquanto arrasta.
- [ ] Nenhuma peça consegue sair da tela (some a metade do dedo na borda? ela
      para com uma folga de ~6 px).
- [ ] **Pronto** volta para o menu de pausa; ao continuar o jogo, cada peça está
      onde foi deixada e **funciona** ali (pular, cavar, usar, mochila, pausar).
- [ ] **Restaurar** (dentro da edição) devolve tudo ao lugar de fábrica na hora.
- [ ] **Opções → Restaurar padrões** também devolve as peças ao lugar.
- [ ] Girar o celular com as peças fora do lugar: elas continuam na mesma
      posição **relativa** e não somem da tela.
- [ ] Fechar o jogo e voltar: as posições continuam salvas.
- [ ] Mudar **Destro/Canhoto** depois de arrastar: o espelho vale como base e o
      deslocamento soma por cima (nada desaparece).
- [ ] Aumentar o **Tamanho dos botões** depois de arrastar: as peças continuam
      presas dentro da tela.
- [ ] No menu do título (sem mundo aberto), a linha **Editar posições** não
      aparece.

## 17. Sensibilidade do olhar no toque

No celular (modo toque), ESC → Opções → Controles → Controles de toque →
**Sensibilidade do olhar** (primeira linha da sub-tela).

- [ ] A linha mostra **80%** de fábrica, com trilho e cursor de barra.
- [ ] Arrastar a barra até **50%**: voltar ao jogo e arrastar o dedo na tela gira
      **devagar** (dá para parar em qualquer ponto do horizonte).
- [ ] Arrastar até **200%**: o mesmo arrasto gira o dobro, e ainda assim o olhar
      **para** no limite de cima/baixo (não vira cambalhota).
- [ ] **A barra do mouse não muda o dedo**: em Opções, mexer em "Sensibilidade
      do mouse" e voltar ao jogo — o giro do dedo continua o mesmo.
- [ ] Olhar para cima no máximo em 200%: o teto vertical continua valendo.
- [ ] Tocar curto e segurar continuam funcionando igual (usar/cavar não dependem
      da barra).
- [ ] Fechar e abrir o jogo mantém o valor; **Restaurar padrões** volta para 80%.
- [ ] A barra funciona também no teclado (setas de 5 em 5, `Home`/`End` nos
      extremos) e no menu do título, antes de entrar no mundo.

## 18. Opções separadas por categorias

Menu → **Opções** (e também ESC → Opções, com o jogo rodando).

- [ ] A janela abre com **três botões**: `Áudio`, `Gráficos` e `Controles` — só
      o nome, sem valor e sem trilho.
- [ ] **Áudio** abre uma grade com uma linha só (**Volume**) e o título vira
      "Áudio"; arrastar muda o volume na hora (o som de clicar nos botões já
      acompanha).
- [ ] **Gráficos** abre **Gráficos**, **Campo de visão** e **Distância de
      render**, todos funcionando como antes (clique no primeiro, barra nos
      outros dois).
- [ ] **Controles** abre **Sensibilidade do mouse** e o botão **Controles de
      toque** (com o resumo `Destro · 100%`); é também onde aparece a lista de
      teclas recolhida (`Controles`).
- [ ] Em **Controles**, o botão `Controles de toque` abre a sub-tela; **Voltar**
      de lá cai em **Controles**, e o segundo **Voltar** cai na lista — nunca
      aparece uma segunda janela por cima.
- [ ] A cada troca de tela o título acompanha e o resto da janela (Concluído,
      Restaurar padrões) fica no lugar.
- [ ] **Restaurar padrões** funciona dentro de qualquer categoria.
- [ ] Fechar com `ESC` e reabrir: a janela volta na **lista de categorias**, não
      na última categoria aberta.
- [ ] Teclado: `Tab` anda só entre os botões da tela visível (o que está
      escondido não recebe foco); depois de abrir uma categoria o foco cai na
      primeira linha dela, e depois de `Voltar` volta no botão que abriu.
- [ ] No celular a grade vira **uma coluna** e cada categoria abre normalmente,
      com o dedo arrastando as barras.

## 19. Resolução do jogo

Menu → **Opções** → **Gráficos** → **Resolução** (a segunda linha da categoria).
No celular, dá para fazer o mesmo sem entrar num mundo.

- [ ] A linha começa em **Janela (nativa)** e é uma barra (trilho e cursor).
- [ ] Arrastar para a direita anda pelas resoluções: 640×360, 854×480, … até
      **3840×2160**; o texto muda junto e o F3 (no jogo) mostra a mesma escolha.
- [ ] Escolher **1280×720**: a imagem fica mais macia e o FPS sobe num aparelho
      fraco — o jogo continua ocupando a **tela toda**, sem faixas pretas.
- [ ] Escolher **1920×1080** num monitor 1080p: a imagem fica no ponto (sem
      esticar) e o custo é o de sempre.
- [ ] Ao escolher uma resolução fixa o navegador **pede tela cheia**; voltar para
      **Janela (nativa)** sai dela.
- [ ] Se você mesmo entrou em tela cheia (F11) e depois escolhe Janela, o jogo
      **não** derruba a sua tela cheia.
- [ ] Girar o celular ou redimensionar a janela: a imagem continua ocupando a
      tela toda e a escolha não muda.
- [ ] Teclado: setas andam **uma** resolução, `Home`/`End` vão às pontas e não dá
      a volta.
- [ ] Fechar o jogo e voltar: a resolução escolhida continua valendo.
- [ ] **Restaurar padrões** volta para Janela (nativa).
- [ ] No iPhone (Safari não tem tela cheia em página): a resolução muda a nitidez
      e **nada quebra** — só não entra em tela cheia.
- [ ] Com resolução fixa, apertar **F4** (qualidade) não muda a nitidez — a
      escolha é sua; ao voltar para Janela, a qualidade volta a mandar.

## Se algo falhar

| Sintoma | Onde olhar |
| --- | --- |
| Botão "Instalar app" não aparece | Abriu em iframe? É Firefox/Safari de desktop (não têm convite)? Já está instalado? O *Manifest* diz "Installability: no" com algum motivo? |
| Manifest diz "no" | Rode em HTTPS/localhost; confira as abas *Manifest* (ícones com erro) e *Service Workers* (script não ativou) |
| Instalou, mas o ícone está cortado | Recorte do launcher maior que o esperado: refaça o desenho com `node tools/make-icons.mjs` e olhe o círculo seguro em `tests/icons.test.mjs` |
| Ícone com fundo preto no iPhone | O `apple-touch-icon` está transparente: ele precisa ser opaco (teste cobre) |
| Offline mostra erro 504 ou tela de branco | *Cache Storage*: o arquivo está lá? A instalação falhou (veja *Network* com o filtro "service worker")? |
| Parece a versão antiga | `?sw=0` para confirmar que é cache; depois confira se `npm run stamp` foi rodado (hash novo = URL nova) |
| Offline abre o menu mas o mundo não carrega | Alguma coisa nova no jogo não está no `index.html` (importmap/`<link>`) — é de lá que o worker tira a lista |

## O que **não** precisa ser testado à mão

Já coberto por `npm test` (541 testes):

- manifest e ícones — tamanho, opacidade, círculo seguro do maskable, favicon
  chapado (`tests/icons.test.mjs`);
- decisão do botão de instalar, sem DOM (`tests/install-prompt.test.mjs`);
- service worker rodando de verdade numa VM, com `caches`/`fetch` de mentira
  (`tests/service-worker-runtime.test.mjs`), incluindo a lista de arquivos tirada
  do `index.html` real;
- importmap, hashes de cache e `index.html` carimbado
  (`tests/cache-versioning.test.mjs`).
