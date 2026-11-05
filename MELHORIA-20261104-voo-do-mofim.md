# MELHORIA: voo curto do Mofim

- **Data:** 04/11/2026 (depois do [menu de pausa](MELHORIA-20261104-menu-de-pausa-e-opcoes.md))
- **Status:** implementado
- **Arquivos:** `world-creature.js`, `tests/creature.test.mjs`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

O Mofim já tinha asa, planeio e pulo de degrau — mas **nunca saía do chão**. Um
bicho com asa que só anda deixa a impressão de que a asa é enfeite; e mais
chato que isso: encurralado na beira de um lago, ele ficava **tremendo contra a
água** (nenhuma direção de fuga passava) até o susto acabar.

O voo curto resolve as duas coisas sem virar outro bicho: ele sai do chão,
cruza dois ou três blocos e pousa. É curto de propósito — quem voa o tempo todo
não tem mais por que pular degrau, planar na descida ou se assustar.

## 1. A regra (pura)

`flightFor({ at, nextFlightAt, fleeing, blocked })` devolve o motivo do voo ou
`null`:

| Situação | Resultado |
| --- | --- |
| fugindo e o passo para longe está barrado | **`'escape'`** — na hora, sem sorteio |
| fugindo com o caminho livre | `null` — corre (voar seria fuga fácil demais) |
| passeando e o relógio do próximo voo chegou | **`'wander'`** |
| barrado sem estar fugindo | `null` — o passeio não precisa de asa |

O passeio é **de vez em quando**: cada bicho sorteia o próximo voo entre 11 e
22 s (`FLIGHT_IDLE_MIN/MAX`), então três Mofins não saem voando juntos.

## 2. O arco (pura)

`flightHeightAt(from, to, progress)`:

```
y = from + (to − from)·p + FLIGHT_HEIGHT·sen(π·p)
```

Sai de `from`, **pousa exatamente em `to`** e o pico cai no meio do trajeto,
`FLIGHT_HEIGHT` (1,5 bloco) acima da reta entre os dois. Linear puro passaria
raspando no chão e o voo viraria um deslize; a parábola do pulo de degrau não
serve porque o voo pode começar e terminar em alturas diferentes.

## 3. Quem decide o pouso

Voar sem destino é teleporte. `flightTarget()` anda `FLIGHT_DISTANCE` (2,6
blocos) na direção pedida e exige:

1. **chão firme** no destino (`surfaceAt` — o mesmo critério do passo: bloco
   sólido com dois de ar em cima);
2. **ar livre no caminho**, amostrado a cada meio bloco, da altura do corpo até
   o pico (`flightPathClear`).

Se o destino comprido não presta, tenta 70% e 45% da distância. **Sem pouso, não
levanta voo** — e aí volta ao comportamento antigo (desviar correndo ou ficar).

O critério do ar livre usa a altura **do corpo**, não a do pouso: assim uma
parede de dois blocos no meio do caminho barra o voo, e um degrau de um bloco
não. É o mesmo critério do passo, só que pelo ar.

## 4. Onde entra no quadro

No `update`, antes do passo:

```js
const flying = this.updateFlight(e, dt);
if (!flying) {
    if (fleeing) {
        if (!this.stepToward(e, dxp, dzp, FLEE_SPEED, dt)) {   // caminho direto
            const voou = flightFor({ at, fleeing: true, blocked: true }) === 'escape'
                && this.startFlight(e, dxp, dzp, at);
            if (!voou) this.fleeStep(e, dxp, dzp, dt);          // desvia como antes
        }
    } else { /* passeio + voo de passeio */ }
}
```

Detalhes que evitam brigas:

- **no ar, só o arco manda**: o passeio não roda no quadro em que ele saiu
  voando, e pulo/planeio ficam parados (os dois escrevem o mesmo `visualY`);
- **asas**: no voo batem rápido e largo (`26 rad/s`, amplitude 0,5), o corpo sobe
  de peito erguido e desce de bico baixo (pitch ±0,2);
- **golpe no ar** não empurra (o empurrão brigaria com o arco): o dano conta
  igual, o corpo só não se mexe até pousar;
- **na mira**, a altura que vale é a do desenho (`entity.visualY`), não a do
  chão — antes o golpe mirava no chão enquanto ele pulava;
- **amanhecer** interrompe tudo como antes: `leaving` continua sendo a primeira
  coisa que o laço olha.

A fuga ganhou uma ordem explícita: **primeiro o caminho direto**, e só se ele
está barrado é que o bicho tenta o ar (e depois os desvios de sempre). Antes o
`fleeStep` tentava sete ângulos de uma vez, inclusive para trás — e "barrado"
acabava significando "cercado por todos os lados", que quase nunca acontece.

## 5. Testes (5 novos, 577 no total)

| Teste | O que garante |
| --- | --- |
| arco do voo | sai de `from`, pousa em `to`, pico no meio, nunca abaixo do chão, e fica acima da reta ao descer |
| regra do voo | `'escape'` só encurralado fugindo, `'wander'` só no relógio, barrado sem fuga não voa |
| voo de passeio | sai do chão, avança mais de 70% do alcance, o corpo sobe no desenho e pousa no chão |
| encurralado no lago | ilhota cercada de água: ele anda até a beirada, **voa** e pousa na outra margem |
| parede de dois blocos | o voo é recusado e ele nunca atravessa a encosta |

Também mudou um teste antigo: **"nasce a uma distância segura"** passou a medir
a distância **no nascimento** (antes media depois de 200 s de mundo — e agora,
com o passeio voador, ele podia legitimamente ter se aproximado).

## 6. O que sobra (de propósito)

- **voar para fugir com o caminho livre**: não. Correr é a fuga; voar é a saída
  do encurralado — senão o susto perde o sentido;
- **voo longo / atravessar o mapa**: não. `FLIGHT_DISTANCE` é 2,6 blocos e o
  pouso precisa existir;
- **validar no navegador**: o voo é raro (11–22 s por bicho), então a melhor
  hora de ver é ao anoitecer, quando nascem até três. O item 7 do
  [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md) cobre isso.
