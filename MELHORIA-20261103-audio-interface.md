# MELHORIA: som na interface (síntese em WebAudio, com espaço para arquivos)

- **Data:** 03/11/2026 (item 13 da [análise de 31/10](ANALISE-20261031-melhorias.md), primeiro recorte — áudio)
- **Status:** implementado (interface; sons de jogo ficam para o próximo recorte)
- **Arquivos principais:** `world-audio.js` (novo), `world-menu.js`,
  `world-options-view.js`, `world-game-settings.js`, `index.html`,
  `assets/sounds/LEIA-ME.md` (novo), `tests/audio-ui.test.mjs` (novo)

## Antes

O jogo era totalmente silencioso: nenhuma linha de áudio, e o único feedback de
clique era visual. A análise listava "áudio" e "opções de volume" no item 13.

## A decisão: sintetizar, não versionar sons

O repositório não guarda binários de mídia (só 3 PNGs de grama; texturas,
minérios e panorama são gerados por código). Para áudio, duas opções:

| Caminho | Ganho | Custo |
| --- | --- | --- |
| Baixar gravações (CC0) | timbre natural | MB no repo, licença a registrar, PR refém de achar o asset |
| **Sintetizar em WebAudio** | 0 KB, 0 licença, som reativo (varia por material) | timbre sintético |

Escolhemos a síntese **com uma porta aberta**: o carregador procura primeiro
`assets/sounds/<nome>.ogg` e depois `.wav`; se existir, toca o arquivo do
jogador; se não, usa a receita. Assim dá para trocar um som por vez depois, sem
tocar em código — e o PR não depende de nenhum asset.

## Depois

### `world-audio.js`

- `SOUND_RECIPES`: cada efeito é **dado**, não código — onda, frequência
  inicial/final, ataque, duração e ganho. Hoje: `ui-click` (triângulo
  640→420 Hz, 80 ms) e `ui-hover` (seno 940→900 Hz, 35 ms).
- `createAudioSystem({ AudioContextClass, fetchImpl, volume, warn })`: tudo
  injetável, por isso o módulo é testável sem navegador.
  - O `AudioContext` **só nasce no primeiro gesto** (clique/tecla) — exigência
    dos navegadores, e evita o aviso de contexto bloqueado no carregamento.
  - Volume 0 ou mudo não cria contexto nenhum: silêncio é silêncio.
  - `play(name)` toca a síntese na hora e busca o arquivo em segundo plano; o
    próximo toque já usa o arquivo. A busca é **uma vez por som** (resultado em
    cache, inclusive quando o arquivo não existe).
  - Sem `AudioContext` ou com o contexto falhando, o jogo segue em silêncio com
    um aviso — áudio nunca derruba nada.
- `bindUiSounds(audio, doc)`: **um** listener delegado no documento
  (`pointerdown`, `pointerover`, `keydown`) cobre menu, diálogos e inventário.
  Botão desabilitado (`disabled`/`aria-disabled`), clique com botão direito e
  hover repetido no mesmo elemento ficam de fora; hover tem throttle de 60 ms.

### Opção de volume

- Novo campo `volume` em `GAME_SETTING_FIELDS` (0–1, passo 0,05, padrão 0,7,
  formatado como `70%` ou `mudo`), com slider na tela de opções.
- `createOptionsView(dialog, { onChange })` avisa a cada mudança: o volume vale
  **na hora**, enquanto as outras opções continuam valendo no próximo mundo.

## O que continua fora deste recorte

Passos por material, quebrar/colocar bloco, porta, água, forno, dano e ambiente.
Todos entram na mesma estrutura: uma receita nova em `SOUND_RECIPES`, um nome de
arquivo correspondente e uma chamada no ponto do jogo.

## Validação

```bash
npm test        # 257 testes (18 novos de áudio + 1 de volume)
npm run check   # sintaxe 85/85 + importmap em dia
```

Os testes usam um `AudioContext` falso que registra osciladores, rampas e
buffers: cobrem criação única do contexto, contexto suspenso, volume/mudo,
receita aplicada, prioridade do arquivo sobre a síntese, arquivo ausente,
`fetch` que lança, `dispose` e a delegação de cliques/hover.

## Limitações conhecidas

- O som real não pode ser ouvido no sandbox (sem navegador): a validação é a
  árvore de chamadas do WebAudio, não o timbre.
- Navegadores não tocam áudio antes de um gesto do usuário; o primeiro clique
  serve para liberar e já toca.
- Arquivos em `assets/sounds/` entram no repo: precisam de licença compatível
  (CC0 recomendado) e crédito registrado.
