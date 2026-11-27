# MELHORIA: Efeitos — partículas, nuvens, folhas, balanço e flash ligáveis

- **Data:** 27/11/2026 (depois das [opções por categorias](MELHORIA-20261105-opcoes-por-categorias.md))
- **Status:** implementado
- **Arquivos:** `world-game-settings.js`, `world-options-view.js`, `index.html`,
  `game.js`, `world-clouds.js`, `world-break-particles.js`,
  `tests/options-effects.test.mjs` (novo), `tests/game-settings.test.mjs`,
  `tests/gait.test.mjs`, `tests/world-clouds.test.mjs`,
  `tests/break-particles.test.mjs`, `service-worker.js`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

O jogo tinha duas formas de desligar o que incomoda: o modo gráfico (`F4`) e a
resolução. Nada mais. Quem jogava em celular fraco queria **menos partículas**,
quem sentia enjoo do balanço da câmera queria **câmera firme**, quem tem
fotosensibilidade queria **menos flash vermelho** — e não havia por onde. A
sensação era a de um jogo bonito que não deixava o jogador apertar o que ele
precisa apertar.

A resposta não foi enfiar mais cinco linhas na grade de Gráficos (voltaríamos à
parede de barras que as [categorias](MELHORIA-20261105-opcoes-por-categorias.md)
resolveram), e sim uma **sub-tela `Efeitos` dentro de Gráficos** — o mesmo
padrão do toque dentro de Controles: uma linha de navegação na grade de
Gráficos, uma grade própria com as cinco opções, `Voltar` caindo em Gráficos.

## Antes

```
Gráficos                          Efeitos (nova sub-tela)
[ Gráficos: Automática ]          [ Partículas: Ligadas  ]
[ Resolução: Janela ]             [ Nuvens: Ligadas      ]
[ Campo de visão: 75° ]           [ Folhas: Ligadas      ]
[ Distância de render: 4 chunks ] [ Balanço da câmera: Ligado ]
[ Escala da interface: Automática ] [ Flash de dano: Ligado ]
```

## Depois

Cinco campos `on/off` em `GAME_SETTING_FIELDS` (formato `Ligadas/Desligadas` e
`Ligado/Desligado`, padrão `on`), a tela `effects` em `OPTION_SCREENS` com
`parent: 'graphics'`, e cada um com o seu portão no `game.js`:

| Campo | O que desliga |
| --- | --- |
| `particles` | lascas de quebra e de golpe (`breakParticles` recebe `enabled`), fumaça de fornos (o update ganha um mapa vazio), pó de criatura (`dustQuality` vira 0) e migalhas da maçã (primeira e terceira pessoa) |
| `clouds` | `worldClouds.setVisible(false)`: some da cena e **congela** o deslocamento — religar continua de onde parou, sem salto |
| `leaves` | `quality: 0` no update das folhas — o sistema apaga as que estão no ar no próprio quadro |
| `cameraBob` | sai o vai-e-vem da câmera, a rolagem da passada e o balanço da mão (o nadar e o golpe continuam, são outros) |
| `hurtFlash` | a opacidade do overlay de dano fica em `0`; a contagem segue para religar no meio da pancada |

As nuvens são o único caso que precisa de notícia imediata fora do laço de
animação: `applyGameSettings` chama `worldClouds.setVisible`, e o valor fica
guardado no módulo para a malha do **próximo mundo** nascer já escondida.

## Validação

- `npm test` — **1447 testes, 0 falhas** (10 novos: `options-effects` com os
  campos, a sub-tela, o markup e os seis portões; `world-clouds` com
  esconder/congelar/sobreviver ao carregar; `break-particles` com `enabled`).
- `npm run check` — sintaxe em dia, importmap carimbado (`npm run stamp`).
- Testes que travam a arquitetura continuam verdes e foram atualizados de
  propósito: `options-categories` (a lista de categorias de topo segue com
  três), `game-settings` (save agora com os 17 campos, telas com `effects`),
  `pause-options` (contadores por linha se ajustam sozinhos) e `gait` (o corte
  do balanço ficou no regex da rolagem).
- No navegador: `README` ganhou as cinco linhas na tabela de opções e
  `TESTE-EM-NAVEGADOR.md` a seção 75 com o roteiro visual.

## Limitações conhecidas

- **Fumaça de forno** desligada congela o cronômetro de emissão dos fornos
  ligados (o mapa vazio faz o update pular a fase de emitir); ao religar, o
  primeiro quadro pode soltar a fumaça acumulada de uma vez — invisível na
  prática, mas é assim que fica.
- **Balanço da câmera** desligado não afeta o balanço de **nadai** nem o
  balanço do modelo em terceira pessoa: são animação de corpo, não de câmera.
- O **vento na grama** e a **chama das tochas** continuam sempre ligados: não
  são partículas, são animação de bloco — se um dia pedirem, é outro toggle.
- As cinco opções são `on/off` mesmo; um dia pode virar faixa (ex.: 25%, 50%,
  100% das partículas), mas isso é escolha de balanceamento, não de interface.
