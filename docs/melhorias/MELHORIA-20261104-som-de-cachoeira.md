# MELHORIA: som de cachoeira

- **Data:** 04/11/2026 (áudio do item 13; depois do [pulo tardio](MELHORIA-20261104-pulo-tardio.md))
- **Status:** implementado
- **Arquivos:** `world-waterfall.js` (novo), `world-audio.js`, `game.js`,
  `tests/waterfall-sound.test.mjs` (novo), `tests/helpers/fake-audio.mjs` (novo), `tests/ambient-sounds.test.mjs`

## Por que

O jogo já tinha os dois tipos de som: **evento** (algo acontece, toca curto — splash,
passo, chilreio) e **ambiente** (vento e grilos, em fases sorteadas). Faltava o
som que não é nem um nem outro: o que **depende do lugar**.

Água caindo é exatamente isso. Uma cachoeira era muda: o jogador via a parede de
água descendo e ouvia o mesmo silêncio de sempre. E ela não pode ser ambiente —
fase sorteada em qualquer canto seria mentira; se está tocando, é porque existe
uma queda por perto.

## 1. O que é uma cachoeira (puro)

`world-waterfall.js`, sem Three e sem áudio:

- `isFallingWater(tipo)` → só `ID.WATER_FALL` (o bloco de queda). Lago parado e
  correnteza horizontal não fazem barulho de queda.
- `scanWaterfall(world, pos)` varre uma caixa de 10 blocos em volta
  (**12 para cima**, 6 para baixo — a água cai de cima) e devolve:
  - `columns` — colunas distintas (x,z) com queda: queda larga é mais água;
  - `height` — maior sequência **vertical** (contada de cima para baixo, na
    ordem em que a água cai);
  - `distance` — a célula de água caindo mais próxima (3D).
- `waterfallGain({ columns, height, distance })`:
  - **tamanho**: `log2(colunas × altura + 1)` saturado em 4×3 (uma queda 1×1 já
    rende 27% do tamanho máximo — fio de água continua sendo água);
  - **distância**: linear até `WATERFALL_AUDIBLE` = 16 blocos;
  - **teto** de `0.55`: é fundo, não pode engolir o resto do jogo;
  - **piso** de `0.02`: abaixo disso é silêncio, nunca um chiado que o jogador
    não sabe de onde vem.

## 2. Laço sem piscar

`updateWaterfallSound(state, alvo, dt)` abre o laço em **0,05** e só fecha abaixo
de **0,02**, depois de ter tocado pelo menos 0,3 s — histerese para o vaivém de
quem anda na borda do alcance. O ganho é uma **rampa linear** (0,5 s de ataque,
1,1 s de saída) que **chega** ao alvo: aproximação exponencial nunca chega e o
laço nunca fecharia.

Devolve `{ action, gain }` (`'start'`, `'update'`, `'stop'` ou `null`) — o áudio
só obedece ao ganho; o jogo só reescreve o grafo quando ele muda de verdade
(≥ 0,01), igual ao ambiente.

## 3. O som (síntese, como todo o resto)

`WATERFALL_RECIPE` em `world-audio.js` e um gerador de buffer próprio:

- três pesos de ruído (grave = volume de água, médio = corpo, agudo = respingo),
  cada um com seu passa-baixa de um polo;
- ondulação lenta de 3 e 5 ciclos por laço (faz parecer caudal, não chuva);
- **emenda dobrada**: os últimos 80 ms do buffer são misturados sobre o começo,
  então o laço não estala;
- normalizado no pico (0,9) para não saturar;
- ganho da receita 0,5 × o ganho pedido pelo jogo.

A máquina é a mesma das camadas de ambiente (um nó por laço, `setTargetAtTime`
em vez de degrau, contexto criado só quando há som): `setWaterfallLevel(0)` sem
nada tocando **não** abre `AudioContext`.

## 4. No jogo

`updateWaterfall(dt)` (chamado junto de `updateAmbient`): a busca roda a cada
0,35 s em volta do jogador — ~8 mil leituras de bloco por varredura, o mesmo
orçamento da luz real — e o alvo vira 0 no menu, na pausa, na morte e com a aba
escondida.

## Testes

`tests/waterfall-sound.test.mjs` (novo, **16**):

- só `WATER_FALL` conta; lago e correnteza não; bloco desconhecido não estoura;
- varredura: colunas, altura e distância 3D; sem água devolve tudo vazio; caixa
  tem alcance (queda a 40 blocos e queda no céu ficam de fora); sequência alta
  conta como sequência;
- ganho: zero na borda e além do alcance, cresce com colunas × altura, cai com a
  distância, satura no teto, piso corta o irrisório, entradas inválidas viram 0;
- laço: só abre no piso de partida, sobe em rampa (não de uma vez), chega ao
  alvo, fecha só depois da saída, histerese sobrevive a 300 quadros de vaivém,
  `dt` inválido não move e alvo inválido não vira `NaN`;
- áudio de verdade (contexto falso): um nó só para a vida do laço, buffer de
  segundos, fade com o ganho da receita, subir o volume não duplica o laço,
  buffer com corpo e sem saturação, emenda suave, e ambiente × cachoeira
  independentes.

`tests/helpers/fake-audio.mjs` (novo): o `AudioContext` de mentira que já vivia
dentro de `tests/ambient-sounds.test.mjs` virou apoio compartilhado — os dois
arquivos testam laços contínuos com o mesmo dublê (17 testes do ambiente seguem
passando, sem mudança de comportamento).

## Validação

```bash
npm test        # 517 testes
npm run check   # sintaxe 114/114 + importmap em dia
```

O sandbox não tem áudio nem navegador: **conferir no aparelho** — achar uma
queda d'água (ou fazer uma: cavar um canal e derramar água de um barranco),
aproximar e ouvir o volume subir, afastar e ver o som sumir sem piscar, e pausar
(o laço tem que calar).

## O que ficou de fora

- Arquivo gravado em `assets/sounds/waterfall.ogg`: o carregador híbrido já
  aceitaria, mas o laço de síntese é o padrão (e não há arquivo no repositório).
- Cachoeira como **evento** (o "tapa" de quando a água encontra o chão): o laço
  contínuo já cobre.
- Rios com correnteza audível: som de fluxo foi decidido contra no [som de
  água](MELHORIA-20261104-som-de-agua.md) — laço constante cansa.
