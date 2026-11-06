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
- [ ] O ícone na barra de tarefas (ou no dock) é o bloco de grama em pixel art
      (com a grama caída pelas laterais), inteiro, sem borda preta e sem corte.
- [ ] O favicon na aba lê como um bloco, não como um borrão.

## 2. Chrome no Android

- [ ] O botão **Instalar app** aparece no menu inicial e instala.
- [ ] No launcher, o ícone é o bloco de grama **com fundo de céu**, inteiro e
      sem corte, tanto no recorte circular quanto no quadrado arredondado (alguns
      launchers deixam escolher; se der, teste os dois).
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
- [ ] Ao escolher uma resolução fixa aparece um **aviso** no padrão do jogo por
      cima da janela de Opções (`Resolução: 1920×1080`) — antes ele ficava atrás
      do diálogo.
- [ ] Junto aparece a pergunta **`Manter 1920×1080? · 10`** com `Manter` e
      `Reverter`. A contagem desce sozinha e, se ninguém mexer, **volta para a
      resolução anterior** em 10 segundos.
- [ ] A pergunta **não** aparece no meio do arrasto, só ao soltar a barra.
- [ ] `Manter` fecha a pergunta e a resolução fica; `Reverter` volta na hora.
- [ ] Fechar as Opções com a pergunta aberta **mantém** a escolha (não reverte).
- [ ] Ir para outra categoria (Áudio, Controles…) tira a pergunta da frente e
      mantém a resolução.
- [ ] Em **Opções → Gráficos**, mudar a **Distância de render** mostra o aviso
      dentro da janela (antes ele ficava escondido atrás dela).
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
- [ ] Num aparelho que não aceita a resolução (GPU pequena), o jogo avisa
      `Resolução: … (limite do aparelho)` e a imagem **não** fica achatada.
- [ ] Redimensionar a janela (ou girar a tela) com resolução fixa: a imagem
      continua ocupando tudo, sem engasgo a cada arrasto da borda.

## 20. Título do menu

Abra o jogo e pare na tela inicial (só olhar, não precisa entrar em mundo).

- [ ] O título é **VOXELCRAFT**, numa linha só, em letras grossas de pedra com a
      laje escura saindo na diagonal e inclinação leve — no estilo do logo
      clássico do Minecraft.
- [ ] O mosaico de pedra aparece nas letras (manchas claras e escuras, não cor
      chapada) e cada letra tem o topo mais claro que a base.
- [ ] Embaixo das letras aparece a **faixa clara** do fundo da laje, seguida da
      massa escura e de um contorno preto.
- [ ] A palavra se lê inteira: V-O-X-E-L-C-R-A-F-T, sem letra colada nem sumida.
- [ ] A frase `um mundo de blocos!` **não** aparece mais.
- [ ] A borda das letras fica nítida em qualquer tamanho de janela — sem
      serrilhado, mesmo em tela grande.
- [ ] Redimensionar a janela: o título acompanha a largura e **nunca** empurra os
      botões (`Um jogador`, `Opções...`, `Sair do jogo`) para fora da tela.
- [ ] Deitar o celular (tela baixa): o título encolhe junto e os botões
      continuam visíveis e clicáveis.
- [ ] Teclado: `Tab` continua indo do título para os botões, e o leitor de tela
      anuncia a tela como **Voxelcraft**.
- [ ] Zoom do navegador em 200 %: o título continua legível e dentro da tela.
- [ ] Trocar de mundo e voltar ao menu: o título aparece igual, sem piscar.

## 21. Capim: a arte certa, sem cintilar

O capim usa PNGs próprios em `assets/`, e o que já deu errado ali foi: arte
antiga em cache, tufo esticado e folhas sumindo à distância.

- [ ] O tufo no chão parece o desenho de `assets/tall-grass-*-v2.png`: mesma
      proporção (não é um capim largo e baixo, "amassado").
- [ ] Existem **três alturas** de tufo (rasteiro, médio, alto) e elas se
      misturam pelo mundo.
- [ ] Andando para frente e para trás, o capim do fundo **não cintila** nem
      rasga; só balança com o vento.
- [ ] O tufo **na mão** (item da barra) é o mesmo desenho e fica parado.
- [ ] Depois de trocar um PNG de `assets/` (e rodar `npm run stamp`), a arte
      nova aparece **no primeiro recarregamento**, sem precisar limpar cache.
- [ ] No DevTools → *Network*, a URL da textura termina em
      `tall-grass-*.png?v=<10 caracteres>` — e esse `v` é diferente do de antes
      da troca do arquivo.
- [ ] No DevTools → *Application* → *Cache Storage*, existe **uma** cópia de
      cada PNG do capim (não várias versões empilhadas).
- [ ] Com rede desligada depois de jogar uma vez, o capim continua aparecendo.

## 22. Porta de carvalho

A porta é a única textura do jogo desenhada em duas metades que precisam
combinar. Antes cada metade pintava a própria borda e a porta ficava com uma
faixa escura no meio.

- [ ] A porta fechada parece **uma peça**: nenhuma faixa escura no meio, entre o
      bloco de baixo e o de cima.
- [ ] Dá para ver o **batente** (moldura) em volta e **dois painéis rebaixados**,
      um em cada metade, alinhados.
- [ ] As **dobradiças de ferro** aparecem do lado da charneira, uma em cada
      metade, e a **maçaneta dourada** do lado oposto, na altura do meio.
- [ ] De longe (uns 20 blocos) a porta ainda se lê como porta, não como um
      retângulo de madeira.
- [ ] Ao abrir a porta, o painel girado mostra a metade de baixo do desenho (é a
      mesma arte, sem versão própria para a porta aberta).
- [ ] O ícone da porta no inventário mostra a metade de baixo com batente e
      painel.

## 23. Ovelha no pasto

A primeira criatura de **dia**. Ela nasce longe (16–30 blocos) e chega andando, em
vez de aparecer parada ao lado — então o teste é esperar e procurar.

- [ ] De dia (céu claro) aparecem **até quatro** ovelhas no campo, brancas,
      cinzas e pretas. De noite não aparece nenhuma.
- [ ] Todas nascem **em grama** — nenhuma em cima de areia, pedra ou água.
- [ ] Elas **andam devagar** e mudam de rumo sozinhas; as quatro patas se mexem
      no passo, em diagonal, e param quando ela para.
- [ ] A lã é **fofa**: dá para ver os tufos em volta do corpo (nove), o topete
      entre as orelhas e o rabo de lã — não é um bloco liso com pernas.
- [ ] Dá para ver a **cara**: focinho claro, dois olhos escuros com um
      **brilhinho branco** em cada um, e as duas orelhas caídas para os lados.
- [ ] As quatro patas têm **casco escuro** na ponta, e o casco anda junto com a
      pata no passo (não fica plantado no chão).
- [ ] De perto a ovelha tem uns 1,05 bloco de altura: dá para ver por cima dela.
- [ ] De vez em quando ela **para de andar**, abaixa a cabeça até encostar no
      chão, mastiga e fica 4–6 s assim (a primeira vez vem logo depois de nascer;
      depois, a cada 30–60 s). Pastando, ela não anda nem desliza.
- [ ] Quando a cabeça chega no chão, a grama **à frente do focinho** vira
      **terra**, e a touceira de grama alta que estava nela desaparece.
- [ ] Em cima de areia, pedra ou terra batida ela abaixa a cabeça e **nada
      muda** — ovelha come grama, não praia.
- [ ] A terra comida **volta a ser grama em 5 a 10 minutos** (deixe a tela
      aberta e volte). Se você puser outro bloco no lugar, o seu bloco fica.
- [ ] Com a **tesoura** na mão, clicar na ovelha a deixa **tosquiada** (lã baixa
      e lisa, sem topete) e solta de um a três fardos da cor dela — o resto está
      na seção 26.
- [ ] Tosquiada, ela **continua pastando**, e cada pastagem adianta a volta da lã.
- [ ] Chegar correndo, de perto, agachado ou não, **não espanta** a ovelha: é
      mansa (o susto só entra na parte 6).
- [ ] Subir um degrau de **um** bloco ela sobe; um barranco de dois ela contorna.
- [ ] Andar uns 44 blocos para longe faz as ovelhas mais distantes sumirem da
      cena, e voltar traz outras.

## 24. Chat e comandos

O chat é a única porta para comandos no jogo (não há console no navegador).

- [ ] **T** abre a linha de digitação no canto de baixo, com o mundo rodando
      atrás (o sol continua andando) e **sem** o menu de pausa aparecer.
- [ ] **/** abre já com a barra escrita.
- [ ] Digitar `ola` e apertar **Enter** mostra `Jogador: ola` no log, e a linha
      **apaga sozinha em ~10 s**.
- [ ] **Esc** fecha sem enviar; abrir de novo mostra a linha vazia.
- [ ] **↑** traz o último comando enviado e **↓** volta ao que estava escrevendo.
- [ ] `/help` lista os oito comandos; `/help give` mostra o uso do `/give`.
- [ ] `/time set night` escurece na hora e responde a hora nova;
      `/time add 120` adianta duas horas.
- [ ] `/give terra 10` põe 10 blocos de terra na mochila;
      `/give picareta de diamante` dá 1 (e não 64);
      `/give chuveiro` responde em vermelho que não conhece o item.
- [ ] `/tp 0 40 0` leva para o alto (o jogador cai);
      `/tp ~ ~5 ~` sobe cinco blocos a partir de onde está.
- [ ] `/clear` esvazia a mochila e diz quantos itens saíram; `/seed` mostra a
      semente; `/kill` leva à tela de morte.
- [ ] Depois de fechar o chat, **andar e olhar** voltam a funcionar (o mouse é
      recapturado).
- [ ] No celular, o botão de chat (topo, ao lado de Mochila) abre a linha e o
      teclado virtual aparece.

## 25. Tab no chat (pré-seleção)

- [ ] Abrir o chat (T) e digitar só **/** — a lista mostra os oito comandos, com
      `/help` destacado.
- [ ] Digitar `/gi` e apertar **Tab**: a linha vira `/give ` e a lista passa a
      mostrar os itens.
- [ ] Digitar `/give picareta` e apertar **Tab** várias vezes: passa por Cobre,
      Diamante, Ferro, Madeira, Ouro, Pedra e volta ao começo. **Shift+Tab** anda
      para trás.
- [ ] Depois de completar, **digitar uma letra e apertar Tab de novo**: a volta
      recomeça do primeiro candidato.
- [ ] `/time set n` + **Tab** → `noon`; **Tab** de novo → `night`.
- [ ] `/give PÓ` acha **Pó luminoso** (acento e maiúscula não atrapalham), e
      `/give ter` acha **Terra**.
- [ ] Tab em `/tp 12` não estraga a linha (não há o que completar ali).
- [ ] Com mais de oito candidatos aparece a linha `+N — Tab percorre todas`, e o
      candidato destacado nunca sai da lista.
- [ ] No celular, **tocar** num nome da lista insere aquele item no lugar do que
      estava digitado.
- [ ] Fechar o chat (Esc) apaga a lista; abrir de novo mostra a lista limpa.

## Se algo falhar

| Sintoma | Onde olhar |
| --- | --- |
| Botão "Instalar app" não aparece | Abriu em iframe? É Firefox/Safari de desktop (não têm convite)? Já está instalado? O *Manifest* diz "Installability: no" com algum motivo? |
| Manifest diz "no" | Rode em HTTPS/localhost; confira as abas *Manifest* (ícones com erro) e *Service Workers* (script não ativou) |
| Instalou, mas o ícone está cortado | Recorte do launcher maior que o esperado: baixe o `blockRatio` em `tools/make-icons.mjs`, rode `node tools/make-icons.mjs` e olhe o círculo seguro em `tests/icons.test.mjs` |
| Ícone com fundo preto no iPhone | O `apple-touch-icon` está transparente: ele precisa ser opaco (teste cobre) |
| Offline mostra erro 504 ou tela de branco | *Cache Storage*: o arquivo está lá? A instalação falhou (veja *Network* com o filtro "service worker")? |
| Parece a versão antiga | `?sw=0` para confirmar que é cache; depois confira se `npm run stamp` foi rodado (hash novo = URL nova). Imagem de `assets/` também tem hash: se o `?v=` da textura não mudou, o carimbo não foi rodado |
| Capim largo/achatado ou cintilando | `world-tall-grass.js`: proporção da placa (`√2`) e filtros da textura; `tests/tall-grass.test.mjs` cobre os dois |
| Porta com faixa escura no meio | A arte tem que ser desenhada na folha inteira (32×64) e recortada nas metades: `tests/door-texture.test.mjs` reprova costura, painel torto e ferragem do lado errado |
| Nenhuma ovelha aparece | É dia? (`worldSky.day` acima de 0,45). O chão em volta é grama? Já existem seis vivas? Veja `tests/sheep.test.mjs` — ele cobre nascimento, cores, passeio, rebanho e o corpo caixa por caixa |
| Ovelhas nascendo sozinhas ou espalhadas pelo pasto | Elas nascem em **bando** (2 a 4, mesmo `herd`, em volta da líder); bandos diferentes ficam a 6 blocos. `tests/sheep.test.mjs` reprova bando de um só |
| Ovelha correndo atrás do jogador ou fugindo sem motivo | Só o **golpe** faz correr; chegando perto correndo ela apenas para e encara por 1,8 s. Agachado não assusta |
| Clicar num bicho e não acontecer nada | O golpe exige a cruz **em cima do corpo** (abertura de ~31°) e até 3,5 blocos; o corpo tem altura própria (`bodyOffset`: Mofim 0,45; ovelha 0,6) e o bloco na mira ganha 0,75 de folga. `tests/mob-hit.test.mjs` cobre a mira e a folga |
| Braço balançando fora do ritmo dos passos | O braço, o som e a câmera leem a mesma fase (`world-gait.js`): o passo soa no ponto baixo do balanço. `tests/gait.test.mjs` reprova quem voltar a usar um cronômetro à parte |
| Balanço da visão exagerado ou tremendo | São 5 cm para baixo, 3 cm de lado e 0,32° de rolagem, com a amplitude entrando e saindo em ~0,5 s; no ar e parado o balanço é zero (`tests/gait.test.mjs`) |
| Ovelha parada no mesmo lugar para sempre | `pickTarget()` é chamado quando vence o `turnAt` (o bug antigo era ele nunca ser chamado): `tests/sheep.test.mjs` cobre a seguidora indo atrás da líder |
| Ovelha sem casco, sem brilho no olho ou com a lã lisa demais | O modelo é montado em `createModel` com `SHEEP_TUFTS`, casco e brilho: `tests/sheep.test.mjs` conta os tufos, os cascos, os brilhos e confere que o casco toca o chão |
| Ovelha mexendo a cabeça sem parar, ou abaixando sem comer nada | Só pasta de vez em quando e só come grama: `tests/sheep.test.mjs` confere o pasto (para, baixa, come a célula da frente) e o crescimento em 5–10 min |
| Ovelha flutuando ou afundada | O modelo tem o pé em `y = 0` e o grupo é posto na altura do chão: `groundTypeAt`/`surfaceAt` em `world-creature-base.js` |
| Ovelha atravessando água ou encosta | `stepToward` (na base) recusa o passo quando o chão à frente não serve; o teste "barrada por uma encosta" cobre |
| T não abre o chat | O mouse está capturado? (T só vale com o jogo rodando). Alguma extensão do navegador com atalho em T? Veja `tests/chat.test.mjs` |
| Digitar no chat anda com o jogador | O teclado tem que estar todo no chat: `if (chat.open) return;` no `keydown` — teste "a tecla T e a barra abrem o chat" cobre |
| Menu de pausa aparece ao abrir o chat | `chatOpen` em `game-pause-menu.js`; o `unlock` do chat é ignorado em `game.js` |
| Tab não faz nada | Foco na linha do chat? (Tab só vale ali; fora dele o navegador troca de elemento). Veja `tests/chat-completion.test.mjs` |
| Tab completa errado o item | A lista sai do catálogo (`world-catalog.js`): nome novo de item aparece sozinho, e a comparação ignora acento/maiúscula |
| Comando não faz nada | Digite `/help`; item errado responde em vermelho. O `/give` aceita nome do código, nome do jogo e apelidos (`dirt`, `terra`) |
| Hora do comando não bate com a HUD | O relógio começa às 06:00 com fração 0: `formatTimeOfDay` e `world-clock.js` têm a mesma conta (teste cobre) |
| Offline abre o menu mas o mundo não carrega | Alguma coisa nova no jogo não está no `index.html` (importmap/`<link>`) — é de lá que o worker tira a lista |

## O que **não** precisa ser testado à mão

Já coberto por `npm test` (922 testes):

- manifest e ícones — tamanho, opacidade, círculo seguro do maskable, favicon
  chapado (`tests/icons.test.mjs`);
- decisão do botão de instalar, sem DOM (`tests/install-prompt.test.mjs`);
- service worker rodando de verdade numa VM, com `caches`/`fetch` de mentira
  (`tests/service-worker-runtime.test.mjs`), incluindo a lista de arquivos tirada
  do `index.html` real;
- importmap, hashes de cache e `index.html` carimbado
  (`tests/cache-versioning.test.mjs`).

## 26. Lã e tesoura

- [ ] Na bancada, **duas barras de ferro na diagonal** fazem uma **tesoura**
      (uma barra sozinha não faz nada).
- [ ] Com a tesoura na mão, clicar numa ovelha a **tosquia**: ela fica com a lã
      baixa e lisa, sem os tufos e sem o topete, e cai no chão de **1 a 3 fardos
      de lã da cor dela** (branca, cinza ou preta).
- [ ] Clicar de novo na mesma ovelha **não tosquia** (ela está sem lã) e o clique
      não quebra o chão atrás dela.
- [ ] Tosquiar gasta a **durabilidade** da tesoura (a barra de durabilidade no
      inventário desce um ponto).
- [ ] A lã volta em **5 a 8 minutos**; cada pastagem dela adianta esse relógio.
      Quando volta, os tufos e o topete reaparecem.
- [ ] Quatro fardos **da mesma cor** na bancada fazem o **bloco de lã** daquela
      cor (2×2). Misturar cores não fecha receita.
- [ ] O bloco de lã quebra na mão, rápido, com som **abafado** — e o passo em
      cima dele também é macio.
- [ ] `/give la 4` dá lã branca e `/give tesoura` dá a tesoura (o `/help` lista os
      itens com o nome que aparece no jogo).

## 27. Balido da ovelha

- [ ] Perto de uma ovelha, dá para ouvir o **chamado de passeio** de vez em
      quando (a cada 14–34 s), andando, parada ou pastando. É discreto.
- [ ] Chegando a menos de **5 blocos** dela, sai um balido **diferente**: mais
      agudo e mais curto.
- [ ] **Ficar** do lado dela não repete o balido; sair do raio e voltar também
      não repete na hora (espera de 22 s).
- [ ] Andando para longe, o balido **enfraquece** e depois de ~20 blocos some.
- [ ] Com `assets/sounds/sheep-bleat.ogg` na pasta (e Ctrl+F5), o som passa a ser
      o do arquivo; sem o arquivo, continua a síntese.

## 28. Rebanho e susto

- [ ] De dia, aparecem ovelhas **em grupo**: duas a quatro juntas, andando no
      mesmo canto do pasto (e nunca mais de **seis** no mundo).
- [ ] As companheiras andam **em volta da líder**; quando a líder se afasta
      demais (mais de 7 blocos), a seguidora vai atrás dela.
- [ ] Chegando **correndo** a menos de ~4 blocos (de pé), a ovelha e o bando
      **param, erguem a cabeça e encaram** o jogador por ~2 s, e depois voltam a
      pastar. Elas **não** correm.
- [ ] Chegando **agachado** (ou andando devagar) a mesma distância, elas não se
      assustam — dá para chegar colado.
- [ ] Dando um **golpe** (clique com a mão vazia) numa ovelha, ela **corre para
      longe** por ~3,5 s, mais rápido que o passo normal, e leva o bando junto.
      O clique duplo não conta duas vezes (espera de 0,35 s).
- [ ] Outro bando, mais longe, **não** se assusta junto (o contágio é do mesmo
      grupo).
- [ ] Sumindo a líder do mundo, uma das outras assume e o grupo continua junto.
- [ ] O balido de perto continua valendo — e agora toca também no susto do golpe,
      mais agudo.

## 29. Golpe nos bichos

- [ ] Clicando (mão vazia) numa **ovelha**, ela leva o golpe: o corpo **pisca**,
      recua um dedo, solta **lascas da cor da lã** e toca um **baque** — e ela
      corre para longe com o bando.
- [ ] A ovelha cai no **quarto** golpe (esperando ~0,35 s entre um e outro); o
      Mofim continua caindo no **terceiro**.
- [ ] Morta, a ovelha solta no chão de **1 a 3 fardos de lã da cor dela** — mas
      só se ainda tiver velo; tosquiada, não solta lã.
- [ ] A **carne de ovelha** cai sempre (1 a 2), com ou sem lã, e é comestível:
      segurando na mão e usando, a barra de fome sobe (3 de fome, menos que a
      maçã).
- [ ] Mirando no **lombo** do bicho o golpe pega (antes o clique se perdia no
      chão atrás dele); mirando para o lado, não pega em ninguém.
- [ ] `/give carne` dá a carne (o `/help` lista com o nome do jogo).
- [ ] Só a ovelha que levou o golpe pisca: as companheiras do bando continuam
      apagadas.

## 30. Passada e balanço da visão

- [ ] Andando, o **som do passo** sai no mesmo instante em que a visão **desce**
      e o **braço** chega ao ponto baixo — nada de mão fora do ritmo do barulho.
- [ ] A visão faz um **sobe-e-desce discreto** (uns 5 cm) e um **vai e vem
      lateral** curto (uns 3 cm), com o horizonte jogando ~0,3° para cada lado.
      Nada de enjoo.
- [ ] **Correndo**, o balanço fica um pouco maior; **agachado**, menor; **nadando**,
      menor ainda (e sem som de passo, só o da água).
- [ ] **Parado** o balanço some suave, em meio segundo, e não corta de um quadro
      para o outro. **Pulando**, não há balanço de caminhada.
- [ ] O vai e vem é **para os lados de quem anda**: olhando para o norte ou
      virando a câmera, o corpo continua balançando nas laterais.
- [ ] A **mira acompanha** o balanço (a cruz se desloca com a câmera), como no
      Minecraft.
- [ ] Empurrando uma parede o som de passo **não** dispara (não se anda), e um
      respawn/teleporte não vira rajada de passos.

## 31. A ovelha olha, cada uma por si — e o pescoço

- [ ] Pastando, a ovelha **não abre um vão** entre a cabeça e o corpo: dá para ver
      o pescoço de lã esticado ligando as duas partes. Em pé, ele desaparece na lã.
- [ ] Chegando **correndo** por trás de uma ovelha, ela continua pastando (não vê
      de costas). Passando **na frente**, ela pode levantar a cabeça.
- [ ] Num bando, **não reagem todas juntas**: uma vira primeiro, outra vira um
      instante depois e uma terceira pode continuar comendo.
- [ ] A virada é **animação**: a cabeça começa a girar, o corpo vai acompanhando
      devagar e no fim ela está encarando o jogador — nada de virar de um quadro
      para o outro.
- [ ] Enquanto encara, a cabeça fica **um pouco inclinada de lado** (curiosidade)
      e erguida, sem o focinho na grama.
- [ ] Quando o susto acaba, a cabeça **volta suave** para a frente e a inclinação
      some; se ela estava pastando, o focinho desce de novo.
- [ ] A vizinha de um bando assustado entra no susto **com atraso** — mas o susto
      **não** se espalha pelo bando inteiro em cadeia: quem está longe do acontecido
      continua pastando.
- [ ] Agachado ou com o jogador longe, nada muda: ovelha mansa, no pasto.

## 32. O pescoço grosso e a gola

- [ ] De perto, o pescoço tem **grossura de pescoço**: dá para ver que ele é quase
      tão largo quanto a cabeça, e não um cano fino saindo da lã.
- [ ] Onde ele entra no corpo existe uma **gola de lã** em volta do ombro — o peito
      fica fofo e a junta não aparece como uma costura reta.
- [ ] **Em pé**, o pescoço não aparece: fica escondido dentro da gola.
- [ ] **Pastando**, ele estica e sai por baixo da gola, ligando o corpo à cabeça
      sem vão nenhum — e a gola **não** desce junto: fica no ombro.
- [ ] Olhando de lado, o pescoço acompanha a cabeça e continua encaixado.
- [ ] Tosquiada, a ovelha continua com o pescoço ligado ao corpo.

## 33. O andar da ovelha

- [ ] Olhando uma ovelha de perto: quando ela escolhe outro trecho de pasto, o
      corpo **gira** até lá — nada de dar meia-volta num quadro.
- [ ] Alvo atrás dela: ela **para e gira** no lugar antes de sair andando; nunca
      desliza de lado nem de costas.
- [ ] Alvo de lado: ela sai **curvando**, com o corpo apontando para onde vai.
- [ ] Partindo do pasto, a velocidade **entra aos poucos** (~0,2 s) e, ao parar,
      freia em vez de congelar.
- [ ] Batendo nela: na fuga as patas passam **bem mais rápido** e casam com o
      chão — nenhum pé escorregando na grama.
- [ ] Empurrando contra uma parede/água, as patas **param** (não fica marchando
      no lugar) e ela sorteia outro alvo.

## 34. A vida parada

- [ ] Parada e de perto, a ovelha **respira**: a lã sobe e desce devagar (uns 2 cm
      no total), sem as patas saírem do chão.
- [ ] O **rabo** balança de um lado para o outro, num ritmo mais rápido que a
      respiração.
- [ ] De vez em quando **uma** orelha treme por um instante — nunca as duas
      juntas.
- [ ] A cada alguns segundos ela **espia** para um lado, segura a cabeça virada e
      volta — e o lado muda de vez em quando.
- [ ] Pastando com o focinho na grama, ela **não** espia; o espiar volta quando a
      cabeça sobe.
- [ ] Num bando, elas **não fazem tudo junto**: cada uma respira, balança a cauda
      e espia no seu próprio tempo.
- [ ] Chegando perto correndo, o susto continua mandando: ela para, ergue a
      cabeça e encara — o espiar sai de cena.

## 35. O rebanho no seu ritmo

- [ ] Olhando um bando andando, elas **não andam em pelotão**: uma puxa um pouco
      à frente, outra fica um pouco atrás, e a distância entre elas muda.
- [ ] Quando a líder se afasta, as seguidoras vão atrás e param **em volta dela**,
      cada uma num canto — não viram um monte no mesmo ponto.
- [ ] Depois do reencontro, nenhuma fica **em cima** da outra nem do corpo da
      líder.
- [ ] Batendo numa delas, o bando corre junto, mas **fora de ritmo**: uma chega
      antes, outra depois.
- [ ] A líder continuando a andar, o grupo segue — as de trás alcançam aos poucos.

## 36. O peso do golpe

- [ ] Batendo **seguido** (botão apertado), sai **um golpe por vez** no ritmo do
      braço — a mão bate e o bicho leva o golpe naquele swing, não antes.
- [ ] Com **dois bichos** na frente, um swing acerta **um**; o outro leva o
      próximo golpe, alguns décimos depois.
- [ ] Acertando um bicho, o clique **não** começa a minerar o bloco atrás dele.
- [ ] No golpe, o corpo do bicho **desliza para trás e freia** (uns 35 cm em
      0,15 s) — não pisca de um lugar para o outro.
- [ ] O corpo **amassa** no impacto (fica um instante mais baixo e mais largo) e
      volta ao normal junto com o clarão.
- [ ] Na **ovelha**, as duas orelhas deitam e a cabeça dá um tranco para cima.
- [ ] No **Mofim**, o mesmo amassado aparece junto com o clarão laranja.
- [ ] Empurrando contra uma parede, o recuo para ali (o bicho não atravessa).

## 37. A morte: tombar antes de sumir

- [ ] Abatendo uma **ovelha** (quatro golpes), ela **não some no ar**: o corpo
      tomba de lado até o chão, fica um instante caído e **encolhe até sumir**.
- [ ] A queda inteira leva menos de um segundo — dá para ver o tombo, não é um
      piscar.
- [ ] A **lã e a carne** saem no golpe fatal, com o corpo ainda no chão (dá tempo
      de ver os itens caírem ao lado do cadáver).
- [ ] Dando mais golpes no corpo caído, ele **não** leva outro golpe, não solta
      item de novo e **não** é minerado através dele.
- [ ] Batendo na **líder** do bando, as outras não ficam paradas olhando o corpo:
      outra assume e o grupo segue.
- [ ] Uma ovelha caindo **não anda, não pasta e não foge** — nada de patas
      marchando no chão.
- [ ] Abatendo um **Mofim**, o mesmo tombo; a luzinha dele apaga e encolhe junto
      com o corpo, e o clarão laranja do golpe apaga durante a queda.
- [ ] Ao **amanhecer**, um Mofim caindo termina de cair (não sai voando no meio).
- [ ] Longe do jogador, o corpo sai de cena na hora — não se vê o cadáver
      distante.

## 38. O golpe é o mesmo em todo bicho

- [ ] Batendo no **Mofim** e na **ovelha**, a resposta é igual: clarão, corpo
      amassado (mais baixo e mais largo por um instante), recuo que desliza e
      freia, lascas e som.
- [ ] Batendo **seguido**, o mesmo bicho não leva dois golpes no mesmo instante —
      nem trocando de alvo no meio do swing.
- [ ] A ovelha morre no **quarto** golpe e o Mofim no **terceiro** — sem nenhum
      dos dois cair antes nem aguentar um golpe a mais.
- [ ] Morrendo, os dois **tombam** e só então somem; o que eles soltam sai no
      golpe fatal, com o corpo ainda no chão.
- [ ] Um Mofim que **não** foge (por exemplo, no ar) continua com a trava do
      golpe: dois cliques seguidos não tiram dois pontos de vida dele.

## 39. O minério na pedra de verdade

- [ ] Encostando um bloco de minério num de **pedra**, o fundo dos dois é a
      **mesma** textura (mesmos estratos, mesmo grão) — não parece outro material.
- [ ] Os cinco minérios (carvão, cobre, ferro, ouro, diamante) têm esse mesmo
      fundo de pedra, cada um com o seu veio por cima.
- [ ] O bloco de pedra **escuro** (variante) também combina com o fundo do
      minério, só com o sorteio diferente.
- [ ] De perto, o fundo do minério tem grão e mancha — nada de cinza liso.

## 40. O carvão antracito

- [ ] No escuro de uma caverna, o minério de carvão **salta** da parede de pedra
      antes de chegar perto: pedaços grandes e escuros, não pintinhas.
- [ ] De perto, cada pedaço tem beirada clara em cima/à esquerda e escura
      embaixo/à direita — o relevo do pixel art.
- [ ] Os pedaços são **quadrados** (blocos de 2×2 px), sem listra fina de 1 px.
- [ ] O fundo entre os pedaços é a **mesma pedra** do bloco de pedra ao lado.
- [ ] Quebrando o bloco, cai o item de carvão mineral (a arte do **item** mudou
      depois, na seção 41).

## 41. Os dois itens de carvão

Pegue os dois carvões (`/give coal` e `/give charcoal`) e deixe lado a lado na
barra. Na mão, o ícone aparece grande na tela.

- [ ] **Dá para dizer qual é qual sem ler o nome**: o mineral é um punhado de
      pedaços gordos e **cinza-azulado**; o vegetal são três gravetos finos e
      **marrons**.
- [ ] Cada pedaço tem beirada clara em cima/à esquerda e escura embaixo/à direita
      (o relevo), em vez do amontoado chapado de antes.
- [ ] Nos gravetos do vegetal há **riscos escuros** no meio do pedaço (o grão da
      madeira queimada) — no mineral não tem nada disso.
- [ ] Nenhum dos dois encosta na borda do quadradinho: sobra um pixel de respiro.
- [ ] Na barra de itens (ícone pequeno) a diferença continua legível — não vira
      dois borrões escuros iguais.

## 42. Os blocos em 3D no inventário

Abra a barra (1–9) e depois o inventário (E). Vale para todo bloco coletável.

- [ ] Cada bloco aparece como um **cubo visto de quina**: face de cima, lateral
      esquerda e lateral direita — não mais uma face esticada.
- [ ] A face de cima é a mais clara e a lateral direita a mais escura; dá para
      contar as três faces de longe.
- [ ] As quinas de baixo do quadradinho são **vazias** (fundo do slot aparece): o
      bloco tem silhueta de cubo, não de quadrado.
- [ ] Cada bloco mostra a **sua** arte nas três faces: grama verde em cima e terra
      nos lados; madeira com o anel no topo e o veio nas laterais; pedregulho
      pedregulho mesmo.
- [ ] No **forno** e no **baú** a frente (a boca do forno, a fechadura) aparece na
      lateral direita.
- [ ] O ícone tem detalhe: nada de borrão — de perto dá para ver o grão da pedra e
      as tábuas.
- [ ] A tocha continua com o desenho de item (graveto + chama), e não como cubo.
- [ ] Na lã branca o cubo continua legível sobre o fundo claro do slot.

## 43. O bloco na mão e no chão

- [ ] Segurando um bloco (terra, pedra, tábuas...), a mão mostra o **cubo** de
      sempre — pequeno, com as três faces, e não um bloco gigante cortado.
- [ ] O mesmo bloco **caído no chão** (quebre e olhe antes de pegar) também
      aparece como cubo do tamanho de sempre.
- [ ] Segurando uma **ferramenta**, a maçã ou o carvão, o desenho plano de sempre
      continua igual.
- [ ] A **tocha** na mão continua graveto com chama (não virou cubo).
- [ ] Na barra e no inventário os ícones continuam em 3D (seção 42).

## 44. O cobre em escamas

Ande até uma parede com **minério de cobre** (ou `/give copper_ore`) e ponha ao
lado de um bloco de pedra.

- [ ] O cobre aparece como **lascas alongadas na diagonal**, e não como os
      losangos miúdos que ele tinha antes.
- [ ] A cor é **laranja quente** (bem diferente do carvão, que é preto-azulado).
- [ ] De longe, o cobre salta da parede sem virar um bloco laranja inteiro.
- [ ] De perto, cada pedaço tem beirada clara em cima/à esquerda e escura
      embaixo/à direita (o relevo), e os pedaços são quadrados (blocos de 2×2 px).
- [ ] O fundo entre as lascas é a **mesma pedra** do bloco de pedra ao lado.
- [ ] O carvão continua como estava (pedaços grandes e escuros) — os dois veios
      não se parecem.

## 45. O ferro clássico

Ande até uma parede com **minério de ferro** (ou `/give iron_ore`) e ponha ao lado
de um bloco de cobre e de um de pedra.

- [ ] O ferro aparece como **cinco pedaços médios e arredondados** — nem migalha
      como os nódulos, nem filão gordo como o carvão.
- [ ] A cor é **pêssego** (quente, mais clara e mais “lavada” que o laranja do
      cobre) — de relance dá para dizer qual é qual.
- [ ] A pedra ao lado é cinza e o ferro é claramente colorido, a ponto de os dois
      não se confundirem mesmo com brilho parecido.
- [ ] De perto, cada pedaço tem beirada clara em cima/à esquerda e escura
      embaixo/à direita, em blocos de 2×2 px.
- [ ] O fundo entre os pedaços é a **mesma pedra** do bloco de pedra ao lado.
- [ ] Carvão e cobre continuam com os veios deles (nada mudou nesses dois).

## 46. O ouro em pepitas

Ande até uma parede com **minério de ouro** (ou `/give gold_ore`) e ponha ao lado
de um bloco de ferro, um de cobre e um de pedra.

- [ ] O ouro aparece como **muitas pepitas miúdas espalhadas** pelo bloco — o
      oposto do ferro, que são poucos pedaços médios.
- [ ] A cor é **amarela de verdade** (não laranja): mais clara e mais saturada
      que o ferro e o cobre, e o verde junto com o vermelho é o que faz o amarelo.
- [ ] De longe, o ouro salta da parede sem virar um bloco amarelo inteiro.
- [ ] De perto, cada pepita tem beirada clara em cima/à esquerda e escura
      embaixo/à direita, em blocos de 2×2 px, e nenhuma pepita é um pixel solto.
- [ ] O fundo entre as pepitas é a **mesma pedra** do bloco de pedra ao lado.
- [ ] Carvão, cobre e ferro continuam com os veios deles (nada mudou).

## 47. O diamante em estilhaços

Ande até uma parede com **minério de diamante** (ou `/give diamond_ore`) e ponha
ao lado de um bloco de ouro, um de ferro e um de pedra.

- [ ] O diamante aparece como **lascas pequenas e irregulares espalhadas** pelo
      bloco — nem pedaço gordo como o carvão, nem pepita redonda como o ouro.
- [ ] A cor é **ciano-gelo**: é o único minério frio da parede. Ao lado do ouro,
      do ferro e do cobre, salta aos olhos na hora.
- [ ] De longe, o diamante se anuncia na parede sem virar um bloco azul inteiro.
- [ ] De perto, cada lasca tem beirada clara em cima/à esquerda e escura
      embaixo/à direita, em blocos de 2×2 px, e nenhuma lasca é um pixel solto.
- [ ] O fundo entre as lascas é a **mesma pedra** do bloco de pedra ao lado.
- [ ] Carvão, cobre, ferro e ouro continuam com os veios deles (nada mudou).
- [ ] Nenhum minério do jogo ficou no veio genérico (losangos miúdos listrados).

## 48. O item de cobre bruto

Abra o inventário (ou olhe a barra) com **Cobre bruto** — dá para pegar com
`/give raw_copper` — e ponha ao lado de **Carvão** e de **Ferro bruto**.

- [ ] O cobre bruto aparece como **quatro grumos de tamanhos diferentes** (um
      grande em cima, três embaixo), e não mais como três bolhas redondas.
- [ ] A silhueta é diferente da do carvão (três pedaços iguais), então os dois se
      distinguem mesmo em preto e branco.
- [ ] A cor é **laranja queimado**, a mesma família do veio do bloco de cobre.
- [ ] Cada grumo tem beirada clara em cima/à esquerda e escura embaixo/à direita.
- [ ] Fora dos grumos o ícone é **transparente**: aparece o fundo da casa do
      inventário, sem quadrado em volta.
- [ ] O **Ferro bruto** continua com o desenho antigo (três bolhas) — só o cobre
      mudou nesta rodada.

## 49. O item de ferro bruto

Abra o inventário com **Ferro bruto** (`/give raw_iron`) e ponha ao lado de
**Cobre bruto**, de **Ouro bruto** e de **Carvão**.

- [ ] O ferro bruto aparece como **quatro grumos**, com o maior em cima **à
      direita** — o cobre tem o maior em cima à esquerda: os dois itens não são o
      mesmo desenho.
- [ ] A cor é **pêssego** (mais clara e menos saturada que o laranja do cobre);
      de relance dá para dizer qual é qual.
- [ ] Cada grumo tem beirada clara em cima/à esquerda e escura embaixo/à direita.
- [ ] Fora dos grumos o ícone é **transparente** (aparece o fundo da casa).
- [ ] O **Ouro bruto** continua com o desenho antigo (três bolhas) — só o ferro
      mudou nesta rodada.

## 50. O item de ouro bruto

Abra o inventário com **Ouro bruto** (`/give raw_gold`) e ponha ao lado de
**Cobre bruto**, de **Ferro bruto** e de **Carvão**.

- [ ] O ouro bruto aparece como **oito pepitas miúdas espalhadas** — nem o punhado
      do carvão, nem os grumos do cobre e do ferro.
- [ ] A cor é **amarelo quente**: o mais claro e o mais amarelo dos três brutos.
- [ ] Cada pepita tem beirada clara em cima/à esquerda e escura embaixo/à direita.
- [ ] Fora das pepitas o ícone é **transparente** (aparece o fundo da casa).
- [ ] Nenhum item de minério ficou com o desenho genérico de três bolhas.
- [ ] Cobre e ferro brutos continuam como estavam (nada mudou neles).

## 51. O item de diamante

Abra o inventário com **Diamante** (`/give diamond`) e ponha ao lado de **Ouro
bruto** e de **Carvão**.

- [ ] O diamante aparece como **uma lasca grande na diagonal**, e não mais como o
      losango redondo do sprite automático.
- [ ] Tem **um pixel de brilho** (branco-gelo) na face da pedra — nenhum outro
      item do jogo tem esse branco.
- [ ] A cor é **ciano-gelo**: é o único item frio da barra; ao lado do ouro e do
      carvão, salta aos olhos.
- [ ] O relevo: beirada clara em cima/à esquerda, escura embaixo/à direita.
- [ ] Fora da lasca o ícone é **transparente** (aparece o fundo da casa).
- [ ] Carvão, cobre, ferro e ouro brutos continuam como estavam.

## 52. O item de lingote de cobre

Abra o inventário com **Lingote de cobre** (`/give copper_ingot`) e ponha ao lado
de **Cobre bruto** e de **Carvão**.

- [ ] O lingote aparece como a **barra clássica**, tombada na diagonal: face de
      cima clara, corpo em sombra embaixo e à direita, contorno escuro, pontas
      afinando (uma em cima à direita, outra embaixo à esquerda).
- [ ] A cor é de **cobre fundido**: mais vermelha e mais clara que o minério bruto.
- [ ] Tem **reflexo** (1 px quase branco) na face de cima.
- [ ] Fora da barra o ícone é **transparente** (aparece o fundo da casa).
- [ ] Ao lado do **cobre bruto** não se confunde: o bruto são grumos soltos; o
      lingote é uma peça só.
- [ ] O **lingote de ferro** e o **lingote de ouro** continuam no retângulo
      genérico, iguais a antes (só o de cobre foi redesenhado).
- [ ] Carvão, cobre, ferro, ouro e diamante (itens) continuam como estavam.
