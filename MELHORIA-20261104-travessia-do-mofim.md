# MELHORIA: travessia do Mofim (o voo maior)

- **Data:** 04/11/2026 (depois do [voo curto](MELHORIA-20261104-voo-do-mofim.md))
- **Status:** implementado
- **Arquivos:** `world-creature.js`, `tests/creature.test.mjs`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

O voo curto resolveu a beirada: encurralado a dois blocos da margem, o Mofim
salta. Mas ele só alcança **2,6 blocos** — e o mundo tem lago de seis, ravina de
quatro de profundidade, barranco. Contra esses ele continuava do jeito antigo:
tentava o passo, não dava, sorteava outro alvo e ia embora. Na prática o bicho
**nunca atravessava nada**, e a asa continuava servindo só para o pulinho.

A travessia é o outro voo: mais longe (até **9 blocos**), mais tempo no ar (até
1,8 s) e rente ao chão — rasante, não escalada. Ele sobe rápido, plana baixo e
pousa do outro lado.

## 1. Quando (regra pura)

`crossFlightFor({ at, nextCrossAt, blocked })` só diz **sim** com duas condições:

1. **o chão barrou o passo** — travessia não é atalho, é conserto de caminho;
2. **passou a espera** da última tentativa (`CROSS_COOLDOWN`, 6 s).

A espera é o que impede a cena feia de tentar de novo a cada quadro contra a
mesma margem. Ela anda **mesmo quando a travessia é recusada** (não há pouso do
outro lado) — senão a recusa viraria laço.

Diferente do voo curto, não existe relógio de passeio: a travessia não é
sortuda, ela depende do terreno. Se o caminho está livre, ele anda.

## 2. O arco (pura)

`crossHeightAt(from, to, progress)`:

| Trecho | Curva |
| --- | --- |
| 0 → 32% do trajeto | sobe com `smoothstep` até `max(from, to) + 2,2` |
| 32% → 100% | desce com `smoothstep` até `to` |

`smoothstep` nas duas pontas tem um motivo por lado:

- na **subida**, acelera no meio e trava no alto: é o impulso das asas, não uma
  rampa;
- na **descida**, segura a altura no começo e alivia no fim. Segurar no começo é
  o que dá a cara de **rasante**; aliviar no fim é o que faz o pouso ser macio em
  vez de tombo.

O pico ficar em 32% (e não no meio) também é escolha de leitura: no meio do
trajeto o corpo já está na altura de planeio, então o voo inteiro parece baixo —
que é o que ele é.

## 3. Onde pousa

`crossTarget()` varre a direção pedida **do mais longe para o mais perto**, de 9
a 3,5 blocos, e devolve o primeiro ponto com chão firme e ar livre no caminho.

A ordem importa: atravessar é o ponto. Parar no primeiro metro de grama depois da
água não cruza nada — e o mais longe possível é justamente o que faz a travessia
parecer travessia.

O mínimo de 3,5 blocos existe para não virar atalho do voo curto: o que está
perto se resolve com um pulo de asa.

O ar é checado da altura do corpo até o pico da travessia (`2,2` acima). Duas
consequências:

- **lago e ravina passam** — a água ocupa a célula do chão, o corredor do voo
  começa uma célula acima do corpo e vai até o pico, então é ar livre;
- **barranco de dois blocos não passa** — a parede está dentro do corredor, e o
  bicho nunca atravessa pedra.

## 4. Onde entra no quadro

```js
// fuga, depois de o passo direto falhar:
const saltou = flightFor({ at, fleeing: true, blocked: true }) === 'escape'
    && this.startFlight(e, dxp, dzp, at);          // 2,6 blocos
const cruzou = !saltou && this.startCrossFlight(e, dxp, dzp, at);  // até 9
if (!saltou && !cruzou) this.fleeStep(e, dxp, dzp, dt);            // desvio pelo chão

// passeio, quando o passo é barrado:
if (!this.stepToward(e, dx, dz, WANDER_SPEED, dt)) {
    const tentar = crossFlightFor({ at, nextCrossAt: e.nextCrossAt, blocked: true });
    if (!tentar || !this.startCrossFlight(e, dx, dz, at)) e.turnAt = at;  // sorteia outro alvo
}
```

Três degraus na fuga — pulo, travessia, desvio — em ordem de custo: o que está
perto se resolve com a asa curta, o que está longe com a travessia, e o que não
tem pouso nenhum com as pernas.

No ar, a travessia tem a sua própria pose: asas **abertas na horizontal**
(`wingBase` 0), batidas **lentas e largas** (13 rad/s, amplitude 0,3 — contra
26/0,5 do voo curto), peito erguido na subida e bico baixo no planeio.

## 5. Testes (5 novos, 582 no total)

| Teste | O que garante |
| --- | --- |
| arco da travessia | pico em 32% do trajeto, continua alto no começo do planeio, nunca abaixo do chão, pouso macio, altura certa começando mais alto |
| regra da travessia | só com o chão barrado e depois da espera; e a travessia é mesmo maior que o voo curto |
| lago largo no passeio | seis blocos de água: ele chega na beirada, atravessa **até a margem oposta** (≥ 8 blocos) e pousa na grama |
| fuga em lago largo | o voo curto não alcança a margem, então a fuga é a travessia |
| barranco de dois blocos | nenhuma travessia atravessa a parede, e o relógio da tentativa anda mesmo recusada |

## 6. O que sobra (de propósito)

- **atravessar o mapa**: não. Nove blocos é o teto, e do outro lado tem de haver
  chão;
- **travessia de passeio sem motivo** (dar uma volta pelo céu): não. Ela existe
  para consertar o caminho; o passeio voador continua sendo o pulinho do voo
  curto;
- **validar no navegador**: precisa de um lago largo ou ravina por perto. O item
  7 do [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md) cobre.
