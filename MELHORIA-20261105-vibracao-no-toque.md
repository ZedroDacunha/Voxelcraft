# MELHORIA: vibração no toque

- **Data:** 05/11/2026 (depois das [configurações de toque](MELHORIA-20261105-opcoes-de-toque.md))
- **Status:** implementado
- **Arquivos:** `world-haptics.js` (novo), `world-game-settings.js`,
  `world-options-view.js`, `game.js`, `index.html`,
  `tests/haptics.test.mjs` (novo), `tests/game-settings.test.mjs`,
  `tests/touch-controls.test.mjs`, `service-worker.js`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

O dedo não recebe confirmação de nada. No desktop o jogador **vê** o bloco sumir,
o braço bater, a tela piscar vermelha; no celular, sem som (ou com o som baixo),
quebrar um bloco e levar dano podem passar em branco — e apertar um botão de
ícone, sem retorno nenhum, é pior ainda.

A vibração resolve isso pelo tato, com uma regra de ouro: **confirmar, não
incomodar**. Vibração que repete demais vira zumbido e o jogador desliga o som e
o telefone.

## 1. O que vibra, e com que força

`HAPTIC_PATTERNS` (ms ligado/desligado):

| acontecimento | padrão | por quê |
| --- | --- | --- |
| passo | `[4]` | confirmação mínima, ~4/s correndo |
| botão | `[5]` | "o dedo pegou" — mais leve que quebrar |
| colocar bloco | `[7]` | ação pequena |
| quebrar bloco | `[12]` | ação com esforço |
| golpe no Mofim | `[15]` | acertar bicho |
| dano | `[28, 40, 55]` | o mais forte: três pulsos, ~0,12 s |

A ordem de intensidade é testada: `dano > quebrar > passo` e `botão ≤ colocar`.

## 2. Cadência: a folga entre repetições

Cada acontecimento tem uma **folga mínima** (`HAPTIC_GAPS_MS`) e memória própria.
Repetir o mesmo acontecimento dentro da folga **não** vibra de novo:

```js
hapticPattern('step', state, { now: 1000 })  // [4]
hapticPattern('step', state, { now: 1100 })  // null — 100 ms < 220 ms de folga
hapticPattern('step', state, { now: 1220 })  // [4]
```

Isso é o que segura dois casos que estragariam a ideia:

- **passos**: `advanceStepTracker` pode devolver 2 batidas no mesmo quadro (num
  solavanco); a folga de 220 ms transforma isso em um pulso só;
- **dano**: invulnerabilidade já bloqueia a maior parte, mas dois danos legítimos
  seguidos (queda + afogamento) viram um padrão, não dois colados.

A memória é **por acontecimento**: quebrar um bloco não engole o "colocar" que
vem em seguida.

## 3. Onde o jogo chama

A chamada fica colada no som/efeito de cada acontecimento, para não existir duas
verdades:

| evento | onde |
| --- | --- |
| `break` | `breakBlock()`, junto do som de quebra |
| `place` | `useHeldItem()`, **depois** de `world.setBlock` dar certo |
| `punch` | `strikeCreature()`, só quando o golpe acontece |
| `hurt` | `takeDamage()`, junto do som de dano |
| `step` | `playFootsteps()`, **fora** do laço (um pulso por batida) |
| `button` | `pointerdown` de cada botão de toque |

E `stopHaptics()` (`navigator.vibrate(0)`) dentro de `resetInputFlags()`: pausar,
morrer ou abrir inventário no meio de um padrão de dano corta a vibração — nada
de telefone vibrando sozinho no bolso com o jogo pausado.

## 4. Três condições para vibrar

```js
if (!touchMode || !hapticOn || !canVibrate(navigator)) return;
```

1. **modo toque** — no desktop com mouse não faz sentido;
2. **opção ligada** — `touchVibration`, lida junto das outras opções de toque,
   então muda ao vivo no ESC;
3. **o aparelho sabe** — `typeof navigator.vibrate === 'function'`.

Sobre o item 3, vale ser honesto: **o Safari do iPhone não tem
`navigator.vibrate`** (nem o Firefox de desktop). Lá a opção existe, aparece
"Ligada", e nada acontece — é limitação do navegador, não bug do jogo. Preferi
não esconder a linha: a mesma preferência acompanha a conta se o jogador abrir no
Android, e esconder/mostrar por *user agent* é o tipo de esperteza que envelhece
mal.

## 5. A opção

`touchVibration` é lista de dois modos (`on`/`off`), como Gráficos: **clique
alterna**. Mora na sub-tela **Configurações de toque**, ao lado de Mão e Tamanho.

Não é barra de propósito: vibração não tem "meio ligada" no navegador — `vibrate`
recebe ms, não intensidade.

## Decisões de escopo

- **passos vibram** (escolha do jogador): é o evento mais frequente, então é o
  mais curto e o de maior folga — quem não gostar desliga a opção inteira;
- **não** vibra em: pular, nadar, abrir inventário, erro ("não pode colocar
  aqui"), menus, morte (o dano que mata já vibra);
- **não** entrou intensidade configurável, nem vibração em eventos de UI do menu
  fora do modo toque;
- nenhuma dependência nova e nada de arquivo: é a API do navegador.

## O que ficou coberto por teste (`npm test`, 688)

- catálogo: todo acontecimento tem padrão com partes positivas e curtas, folga
  coerente (a folga não é menor que o próprio pulso) e a ordem de intensidade
  (`dano > quebrar > passo`, `botão ≤ colocar`);
- cadência: primeira vibra, repetição dentro da folga **não**, passada a folga
  vibra; memória separada por acontecimento; `NaN`/`Infinity` no tempo não
  quebram a conta;
- aparelho e opção: `canVibrate` (com e sem `vibrate`), `vibrationEnabled`
  (lixo não desliga), `formatSetting` (`Ligada`/`Desligada`) e sanitização;
- tela: a linha existe na sub-tela de toque, é botão de clique (sem trilho/
  cursor), com `aria-label` e valor na tela;
- fiação: as três condições no `haptic()`, cada evento chamado **na função
  certa**, `place` só depois de colocar de verdade, `step` fora do laço, botão no
  `pointerdown` e `stopHaptics()` ao resetar a entrada.

O que só o aparelho mostra está no [roteiro](TESTE-EM-NAVEGADOR.md) §15 — em
especial se a cadência dos passos incomoda andando (dá para afrouxar a folga em
uma linha) e se o pulso de dano é forte o bastante no celular do jogador.
