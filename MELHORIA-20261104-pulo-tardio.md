# MELHORIA: pulo tardio na beirada (coyote time) — T4, leva 2

- **Data:** 04/11/2026 (tema 4 — física do jogador, depois da [beirada](MELHORIA-20261104-agachar-beirada.md))
- **Status:** implementado
- **Arquivos:** `player-jump.js` (novo), `game.js`, `tests/player-jump.test.mjs` (novo)

## Por que

O pulo só valia enquanto `player.onGround` era verdadeiro, e esse valor é
decidido **no fim** do quadro — ou seja, ao andar para fora de um bloco o apoio
já chega `false` no quadro seguinte. Quem aperta o pulo uma fração de segundo
depois de sair da borda não pula: o corpo cai e o jogador culpa o jogo, não o
reflexo.

É o ajuste clássico de plataforma 3D (`coyote time`): dar uma janela curta de
perdão para o pulo que chega atrasado.

## A regra

`player-jump.js`, puro e sem Three/mundo — só a janela:

| Situação no fim do quadro | `coyoteLeft` |
| --- | --- |
| pé no chão | recarrega em **`COYOTE_TIME` = 0,12 s** |
| acabou de pular | `0` (nada de pulo duplo) |
| na água | `0` (nadar tem regra própria) |
| no ar | escorre com o `dt`, nunca negativo |

`canJumpFrom(state, { onGround })` devolve `onGround || coyoteLeft > 0`, e o
`updatePhysics()` passou a perguntar isso em vez de exigir `onGround`.

O estado nasce **fechado** (`coyoteLeft = 0`): nascer no ar ou cair de um
teleporte não ganha um pulo de graça no primeiro quadro.

Por que 0,12 s: é tempo de reagir a um erro de mira no pé da borda (~7 quadros a
60 fps) sem virar pulo flutuante. Acima de 0,2 s o jogador consegue pular
visivelmente já no vazio, e aí a física deixa de ser crível.

## O que **não** mudou

- **Pular segurando o botão** continua igual: no chão o pulo segue saindo a cada
  apoio (é o que faz o toque funcionar sem duplo-toque).
- O pulo continua exigindo `!isCrouching` — agachado na beirada (leva 1) não
  vira pulo.
- Natação (`swimStrokeLocked`, subida na superfície) intocada; a janela só
  **fecha** ao entrar na água.
- Buffer de pulo (apertar antes de aterrissar) não foi feito porque não faz falta
  aqui: como o comando é **segurado**, o pulo já sai no primeiro quadro de chão.

## Testes

`tests/player-jump.test.mjs` (8):

- janela nasce fechada: cair não dá pulo de graça; no chão sempre dá;
- no chão a janela recarrega inteira a cada quadro;
- sair da borda: ainda dá no primeiro quadro e na metade da janela, e para de dar
  quando ela zera (sem ficar negativa);
- um quadro longo (1/3 s) consome a janela de uma vez;
- pular fecha a janela e ela não reabre enquanto o corpo estiver no ar (sem pulo
  duplo);
- água fecha a janela e sair dela não devolve pulo;
- `dt` inválido (`NaN`, negativo, ausente) não estraga a janela;
- o tempo é curto de propósito (entre 0,05 s e 0,2 s).

## O que ficou de fora

- Buffer de pulo com comando de toque único (ver acima).
- Escadinha automática / auto-jump: mudaria o jeito de andar no mundo inteiro;
  se um dia entrar, é tema próprio.
- Pulo variável (segurar para pular mais alto) — `JUMP_SPEED` continua fixo.
