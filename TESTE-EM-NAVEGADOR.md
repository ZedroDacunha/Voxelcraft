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
