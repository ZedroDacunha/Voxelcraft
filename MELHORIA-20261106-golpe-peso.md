# MELHORIA: o peso do golpe — cadência do braço, recuo animado e reação de dano

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-creature-base.js`, `world-creature.js`, `world-sheep.js`, `game.js`, `tests/mob-hit.test.mjs`, `tests/creature.test.mjs`

## As escolhas (feitas antes de codar)

O pacote **A + B + C** do menu do golpe:

| # | Problema | Correção |
| --- | --- | --- |
| **A** | o cooldown era **por bicho** (0,35 s cada): dois bichos na frente levavam dois golpes em quadros seguidos com **um** swing | `ATTACK_COOLDOWN` (0,45 s) e `attackReady()`: a cadência é **do braço** |
| **B** | o recuo era um **teleporte**: `stepToward(…, 0,35, dt = 1)` movia 35 cm no mesmo quadro | `pushAway()` + `stepKnock()`: velocidade que freia até zero em `KNOCK_TIME` (0,16 s) |
| **C** | o dano só acendia o material — o corpo não reagia | amassa (encolhe na altura, alarga nos lados), as orelhas deitam e a cabeça dá um tranco |

## Antes

O golpe do #93 já tinha clarão, som, lascas e empurrão — mas o "peso" não existia:

- **dois bichos, um swing**: cada bicho tinha o seu relógio, então o braço podia
  acertar dois alvos em dois quadros com uma animação só;
- **o empurrão era um pulo**: 35 cm no mesmo quadro, sem deslize nem inércia;
- **o corpo não sentia**: além da cor, nada mudava.

## Depois

### A · a cadência é do braço

```js
export const ATTACK_COOLDOWN = 0.45;
export function attackReady(lastAttackAt, at, cooldown = ATTACK_COOLDOWN) { … }
```

`game.js` guarda `lastAttackAt` e, com um bicho na mira, **o quadro é do combate**:
enquanto o braço não volta, o clique não vira mineração do bloco atrás do bicho
(antes ele minerava). Um swing = um golpe, com qualquer alvo — a mão reinicia a
animação junto (`startPunch`).

### B · o recuo é uma velocidade

O empurrão agora é **armado** e **gasto** em quadros:

| Peça | Onde | O que faz |
| --- | --- | --- |
| `pushAway(e, dx, dz, dist, tempo)` | base | guarda a velocidade inicial `2 · dist / tempo` (área do triângulo) |
| `stepKnock(e, dt)` | base | anda a cada quadro com a velocidade **do meio** do quadro (integral certa) até frear em zero |

O recuo respeita o chão: se o caminho estiver barrado (parede, água), ele acaba
ali — nunca atravessa. Para o Mofim, continua sem empurrar no ar (o voo manda).

### C · o corpo reage

O mesmo clarão de 0,22 s que acende o material agora **deforma o corpo**:

| Peça | Efeito | Constante |
| --- | --- | --- |
| corpo (os dois bichos) | `scale.y × (1 − 0,09)`, `scale.x/z × (1 + 0,05)` | `HURT_SQUASH`, `HURT_SPREAD` |
| cabeça da ovelha | tranco para cima (+0,32 rad) | `HURT_HEAD_KICK` |
| orelhas | as **duas** deitam de vez (+0,45 rad) | `HURT_EAR_FLAT` |

Como o clarão decai, tudo volta ao normal sozinho — nada fica amassado.

## Provas

- **950** testes na suíte (14 em `mob-hit`, 75 em `creature`).
- Três testes novos e dois ajustados:
  - **o recuo desliza, freia e para** — no quadro do golpe o corpo não sai do
    lugar; o primeiro quadro anda menos de 25% do empurrão; a soma dos quadros dá
    o empurrão exato; o recuo acaba; e contra uma parede ele para antes dela;
  - **o braço tem a sua cadência** — pronto no começo, travado no meio do swing,
    liberado depois, e trocar de alvo não acelera;
  - **o golpe amassa, deita as orelhas e sacode a cabeça** — mede o `scale` do
    corpo, o desvio de cada orelha e o tranco da cabeça contra o mesmo instante
    sem clarão (a fuga é igual nos dois);
  - ajustes: o empurrão da ovelha (teste do #93) e o do Mofim deixaram de ser
    instantâneos, então passaram a medir "armado → alguns quadros → recuou" — e o
    teste do Mofim ganhou a checagem do amassado.
- **Prova de força** (8 mutações, 7 derrubam teste):

| Mutação | Testes que quebram |
| --- | --- |
| cadência sempre pronta | 88 (mob-hit) |
| recuo instantâneo (teleporte) | 14 (creature), 77 e 87 (mob-hit) |
| recuo sem freio | 87 |
| ovelha não amassa | 89 |
| Mofim não amassa | 15 (creature) |
| orelhas não deitam no golpe | 89 |
| cabeça não dá tranco | 89 |
| recuo "atravessa" parede (só o `moveTo` falha) | — (o `moveTo` já é atômico: nada muda) |

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 36.
