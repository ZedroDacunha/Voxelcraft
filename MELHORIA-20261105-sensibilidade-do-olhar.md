# MELHORIA: sensibilidade do olhar no toque

- **Data:** 05/11/2026 (depois da [posição livre dos botões](MELHORIA-20261105-posicao-livre-dos-botoes.md))
- **Status:** implementado
- **Arquivos:** `world-game-settings.js`, `world-touch-controls.js`,
  `world-options-view.js`, `index.html`, `game.js`,
  `tests/touch-look.test.mjs` (novo), `tests/touch-controls.test.mjs`,
  `tests/game-settings.test.mjs`, `service-worker.js`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

No celular o olhar é o gesto que mais erra. O dedo não tem a precisão do mouse,
e a mesma distância arrastada gira **muito** mais fácil do que se quer: quem
tenta olhar para o lado acaba olhando para trás, e no meio de uma briga isso é
fatal.

Até aqui o toque usava a barra **Sensibilidade do mouse**, que existe para outro
gesto (mouse com *pointer lock*, `movementX`). Ajustar uma mexia na outra — e
quem jogava no celular e no PC ficava refém de uma barra só.

## 1. Uma barra própria, independente

`touchSensitivity` é um campo novo das preferências, na sub-tela
**Configurações de toque**:

| | |
| --- | --- |
| faixa | 0,5 a 2 |
| passo | 0,05 (5%) |
| padrão | **0,8 (80%)** |
| formato | `80%` |

Padrão em 80% porque o giro de fábrica era um pouco nervoso no dedo: quem nunca
mexer sente uma melhora discreta, e quem gostava do antigo sobe para 100% numa
arrastada.

A barra do mouse (`sensitivity`) continua valendo **só para o mouse**. São dois
gestos diferentes; uma barra só para os dois é o tipo de economia que atrapalha.

## 2. A conta

```js
export function touchLookSensitivity(settings) {
    const value = Number(settings?.touchSensitivity);
    const scale = Number.isFinite(value) && value > 0 ? value : DEFAULT_GAME_SETTINGS.touchSensitivity;
    return TOUCH_LOOK_SENSITIVITY * scale;
}
```

`TOUCH_LOOK_SENSITIVITY` (0,0045 rad por pixel) é a base do módulo
`world-touch-controls.js`; a opção multiplica por cima. Duas decisões dentro
dessa função pequena:

- **valor estranho cai no padrão, nunca em zero** — storage velho, campo
  ausente ou `0` gravado à mão dariam olhar travado, e o jogador não teria como
  desconfiar da barra;
- **o teto vertical continua no `lookAfterDrag`**: a sensibilidade muda o quanto
  gira, não o limite de olhar para cima/baixo. Em 200% o olhar chega ao teto com
  metade do arrasto, e para ali.

`game.js` guarda o resultado em `touchLookScale`, recalculado em
`applyTouchLayout()` — que roda no começo e a cada mudança de opção. Arrastar a
barra com o jogo pausado muda o giro **na hora**, sem recarregar o mundo.

## 3. Onde a linha mora

Configurações de toque, **primeira** da lista: é a que mais se mexe. As outras
(Mão, Tamanho, Vibração, Editar posições) seguem embaixo.

É `option-slider` — barra `role="slider"`, trilho e cursor, arrastável com o
dedo e com as setas/`Home`/`End` no teclado, igual às barras da grade principal.
Nada de CSS novo: o padrão `.classic-btn` do menu já cobre.

## 4. O que não mudou

- **mouse**: `look.yaw -= mx * LOOK_SPEED * LOOK_SENSITIVITY` continua igual;
- **toque curto/segurar**: a sensibilidade só entra no modo `look` do gesto —
  tocar para usar e segurar para cavar não dependem dela;
- **joystick**: anda, não olha;
- **valores salvos**: quem já tinha preferências ganha o campo novo com 0,8 (o
  sanitizador preenche o que falta), sem perder nada do que estava gravado.

## Decisões de escopo

- **independente** da barra do mouse (escolha do jogador) — as duas não se
  multiplicam;
- **80%** de fábrica (escolha do jogador), não 100%;
- **não** entrou: aceleração, giro por inércia, botão de "inverter eixo" nem
  sensibilidade separada para horizontal/vertical.

## O que ficou coberto por teste (`npm test`, 712)

`tests/touch-look.test.mjs` (11 testes):

- campo: padrão 0,8, faixa 0,5–2, passo 0,05, formato `80%`/`100%`/`50%`;
- sanitização: fora da faixa é preso, valor quebrado arredonda no passo, `'abc'`
  e `null` não deixam `NaN` no storage;
- barra: posição ↔ valor (0,5 = 0, 2 = 1, 1,25 = 0,5), passo a passo e limites;
- conta: base × opção, 80% de fábrica, e valor inválido (`undefined`, `{}`, `0`,
  negativo) caindo no padrão — nunca em zero;
- independência: mexer em `sensitivity` não muda o giro do dedo, e o mouse
  continua na barra dele;
- proporção: metade da barra = metade do giro, e o teto vertical vale em 200%;
- tela: linha na grade de toque, `option-slider` com trilho e cursor, `aria-label`
  e valor `80%`;
- fiação: `touchLookScale` no import, no topo e em `applyTouchLayout`, e o
  `pointermove` do canvas usando `sensitivity: touchLookScale` **sem** tocar em
  `LOOK_SENSITIVITY`.

O que só o aparelho mostra está no [roteiro](TESTE-EM-NAVEGADOR.md) §17 — em
especial se 80% é o ponto certo para o polegar do jogador.
