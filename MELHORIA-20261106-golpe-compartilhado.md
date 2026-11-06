# MELHORIA: o golpe é um kit — igual para todo bicho, hoje e nos próximos

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mob-hit.js` (**novo**), `world-creature-base.js`, `world-creature.js`, `world-sheep.js`, `game.js`, `tests/mob-kit.test.mjs`

## O pedido

"Pode implementar esse hit no outro mob também? E em todos os que vamos criar em seguida."

O pacote do golpe (mira, clarão, amassado, recuo, trava e morte com queda) já
valia para os dois bichos — mas **cada um com o seu código**, e a ovelha
importava as constantes do arquivo do **Mofim**. Nada garantia que um bicho novo
tivesse o mesmo golpe: bastava esquecer uma peça para ele ficar diferente, e o
jeito de descobrir era jogando.

Agora o golpe é **um kit** e um **contrato cobrado por teste**.

## O que mudou

| Antes | Depois |
| --- | --- |
| as contas do golpe (mira, clarão, amassado) moravam em `world-creature.js` | moram em **`world-mob-hit.js`**, sem nada de Mofim dentro |
| a ovelha importava as constantes do Mofim | as duas espécies importam **o kit** |
| cada `hitFrom`/`hitAt` repetia vida, clarão, recuo, morte e `onDeath` | os dois chamam **`takeHit`**, o mesmo método da base |
| um bicho novo podia nascer sem golpe (ou com um golpe diferente) | **`tests/mob-kit.test.mjs` varre os módulos** e cobra o contrato de cada bicho |
| a trava por bicho do Mofim era efeito colateral do `scare` | a trava é do kit: **vale para quem não foge também** |

## Como ficou

### `world-mob-hit.js` — as contas (puras)

| Peça | O que é |
| --- | --- |
| `HIT_REACH` (3,5) / `HIT_MIN_DOT` (0,86) | alcance e abertura da mira |
| `HIT_COOLDOWN` (0,35) | a trava **do bicho**: dois golpes no mesmo instante não valem dois |
| `HURT_FLASH` (0,22) / `KNOCKBACK_DISTANCE` (0,35) | clarão e empurrão |
| `HURT_SQUASH` (0,09) / `HURT_SPREAD` (0,05) | o amassado do corpo |
| `HURT_HEAD_KICK` (0,32) / `HURT_EAR_FLAT` (0,45) | tranco da cabeça e orelhas deitadas |
| `creatureInReach(…)` | quem está na mira (corpo caído e quem está saindo de cena não são alvo) |
| `hurtFlashFor(…)` | quanto do clarão ainda está aceso (0..1) |
| `hurtScaleFor(flash)` | **novo**: a escala do corpo no impacto, para ninguém recalcular o amassado por conta própria |

### `takeHit` — o golpe aplicado (na base)

```js
this.takeHit(target, { at, from, flash, cooldown, knockback, onHurt, dropsFor, onDeath })
// → { entity, killed, drops } | null
```

Em ordem: ignora corpo caído → cobra a trava do bicho (com a mesma folga de
`1e-9` do `attackReady`) → tira vida → acende o clarão → empurra (menos no ar) →
chama a reação da espécie (`onHurt`) → se a vida acabou, calcula o que solta
(`dropsFor`), **derruba** (`startDying`, o corpo tomba) e avisa o jogo
(`onDeath`, que põe os itens no chão **na hora**).

O que sobra para cada espécie é só o que é dela:

| Bicho | `onHurt` | `dropsFor` | `onDeath` |
| --- | --- | --- | --- |
| Mofim | `scare` (foge de quem bateu) | — | nada (o jogo solta o pó luminoso) |
| Ovelha | `flee` (corre levando o bando) | lã (se tiver velo) + carne | `game.js` põe os fardos no chão |

### Bicho novo: o que ele herda e o que precisa declarar

Para entrar no jogo, o módulo `world-<bicho>.js` **importa a base de criaturas**
e declara:

1. a vida (`export const …_HEALTH`) — o número de golpes que ele aguenta;
2. uma entrada de golpe (`hitFrom`/`hitAt`) que chama **`this.takeHit`**;
3. o resto é da espécie: modelo, movimento, som e a reação (`onHurt`).

Clarão, amassado, recuo, trava, tombo, queda e a saída do mundo vêm de graça.

## Provas

- **971** testes na suíte (7 novos em `tests/mob-kit.test.mjs`).
- O teste de contrato **não tem lista fixa de bichos**: ele varre os
  `world-*.js` que estendem a base e roda, em cada um, o mesmo roteiro —
  - tira vida, acende o clarão do kit, arma o recuo;
  - o segundo golpe no mesmo instante não entra; passado o cooldown, entra;
  - morre **no golpe da vida dele** (nem antes, nem depois), avisando o jogo uma vez;
  - corpo caído não é alvo (nem pelo golpe, nem pelo `takeHit`);
  - o corpo tomba e só sai do mundo no fim da queda (~`DYING_TIME`).
  - E no texto: usa `this.takeHit`, tem entrada de golpe, importa o kit e **não**
    recalcula o amassado (`HURT_SPREAD *`).
- **Prova de força** (12 mutações, todas derrubam teste):

| Mutação | Testes que quebram |
| --- | --- |
| o kit não trava dois golpes no mesmo instante | 4 |
| o golpe não acende o clarão | 7 |
| o golpe não empurra o corpo | 3 |
| o golpe não derruba no fim da vida (some no ar) | 5 |
| o kit deixa bater em corpo caído | 2 |
| o golpe esquece a reação da espécie (`onHurt`) | 5 |
| o golpe esquece o que o bicho solta (`dropsFor`) | 3 |
| o golpe esquece de avisar o jogo (`onDeath`) | 6 |
| a mira volta a aceitar bicho caído | 2 |
| o amassado perde o limite de 0..1 | 1 |
| a ovelha volta a escrever o golpe à mão | 17 |
| o Mofim volta a escrever o golpe à mão | 8 |

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 38.
