# MELHORIA: passada sincronizada e balanço da visão

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-gait.js` (novo), `game.js`, `world-step-sounds.js`

## As escolhas (feitas antes de codar)

| Pergunta | Resposta |
| --- | --- |
| Estilo do balanço | **Vertical + lateral + microinclinação** do horizonte (~0,3°) |
| Intensidade | **Sutil**: ~5 cm para baixo, ~3 cm de lado |
| Quando vale | **Chão, corrida (mais forte), nado (mais devagar) e agachado (menor)**; parado, zero |
| A mira | **Segue o balanço** (a câmera se desloca de verdade, como no Minecraft) |

## Antes

Três relógios diferentes para a mesma caminhada:

- o **som do passo** andava pela distância (`advanceStepTracker`, um passo a cada
  1,7 m);
- o **braço** andava por um cronômetro paralelo (`bobTimer`) que subia com a
  **velocidade** — não com a distância —, então som e mão podiam sair de fase e
  ficar assim para sempre;
- a **câmera** não balançava: a posição era o olho, exato, quadro a quadro. O
  caminhar parecia um trenó.

## Depois

### Uma cadência só (`world-gait.js`)

A fase da passada anda pela **distância real andada** (empurrar parede não
conta, teleporte de respawn também não) e fecha uma volta a cada `STEP_STRIDE`
(1,7 m) — a mesma distância de antes entre um passo e outro. Quem quiser saber
onde o corpo está na passada lê essa fase:

| Leitor | O que usa |
| --- | --- |
| som do passo | `advanceGait` devolve quantos passos fecharam (e o jogo só toca com o pé no chão, fora da água) |
| câmera | `gaitPose`: `bobY` (desce no passo), `sway` (vai e vem lateral), `roll` (microinclinação) |
| braço | `gaitPose`: `handX` / `handY` — a mão desce junto com o corpo no passo |

Sincronia **por construção**: o passo soa exatamente no ponto baixo do balanço,
e o vai e vem lateral/inclinação cruzam o zero ali (corpo reto, peso no pé que
acabou de tocar).

### O balanço da visão

- **Vertical**: `bobY = −5 cm × amplitude × (0,5 + 0,5·cos φ)` — ponto baixo no
  passo, alto na meia passada, e o cosseno não tem degrau na emenda da volta.
- **Lateral**: até **3 cm**, aplicado nos **lados da câmera** (não nos eixos do
  mundo): olhando para o norte o corpo continua balançando nas laterais de quem
  anda.
- **Microinclinação**: até **0,0055 rad (~0,32°)** de rolagem, entrando no
  quatérnio do olhar (`applyLook`). Como é rolagem em torno do eixo da frente, o
  ponto para onde se aponta não muda.
- **Suave de verdade**: a amplitude entra e sai com `GAIT_FADE` (6/s) — começar a
  andar leva ~0,5 s para o balanço chegar ao tamanho final e parar não corta
  nada de um quadro para o outro.
- **Por situação**: chão = 1, correndo = 1,25, nadando = 0,7, agachado = 0,6,
  no ar = 0. Parado = 0 (a fase até continua onde estava, mas a amplitude zera).
- A mira **acompanha**: o deslocamento é da câmera, então o clique e a cruz
  seguem o balanço, como no Minecraft.

### O braço

Saiu o `bobTimer`. A mão agora lê a fase da passada: desce junto com o corpo no
passo (`handY`) e vai e vem de lado no mesmo compasso (`handX`), com os campos
de quem carrega algo somando por cima — mineração (`swing`), comer e troca de
item continuam iguais.

## Validação

```bash
npm test        # 922 testes (11 novos em tests/gait.test.mjs)
npm run check   # sintaxe + importmap em dia
npm run stamp   # index.html recarimbado
```

**Prova de força** — cada quebra proposital derruba o teste que a defende:

| Quebra proposital | Teste que reprova |
| --- | --- |
| cadência pela metade (`distance * 0.5`) | "um passo a cada STEP_STRIDE…" e mais 3 |
| inverter o cosseno (`ponto baixo` no alto) | "no passo o corpo está no ponto baixo…" e mais 2 |
| amplitude sem suavização (salta para o alvo) | "o balanço entra e sai suave…" |
| tirar a escala de agachado | "quanto balança em cada situação…" |
| câmera sem descer (`bobY` ignorado) | "game.js lê a passada…" |
| `applyLook` sem rolagem | "game.js lê a passada…" |
| som do passo sem a checagem de chão | "game.js lê a passada…" |

## Limites conhecidos

- O balanço é da **caminhada**: no pulo e na queda ele zera (o arco do pulo já
  mexe a câmera; somar balanço em cima viraria tremor).
- Não há opção de intensidade nas Opções: os números são fixos (5 cm / 3 cm /
  0,32°) e ficam todos em `world-gait.js`, um por constante.
- `advanceStepTracker`/`createStepTracker` **saíram** de `world-step-sounds.js`:
  a contagem de passos agora é da passada, e os testes dela moraram para
  `tests/gait.test.mjs`.
