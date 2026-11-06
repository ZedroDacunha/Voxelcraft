# MELHORIA: o andar da ovelha — corpo que gira, velocidade que entra e pés que não escorregam

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-sheep.js`, `world-creature-base.js`, `tests/sheep.test.mjs`

## As escolhas (feitas antes de codar)

Três defeitos de movimento, todos no mesmo lugar — o pacote A + B + C:

| # | Defeito | Correção |
| --- | --- | --- |
| **A** | o corpo **estalava** de rumo: `heading = atan2(...)` a cada quadro | gira a `SHEEP_TURN_RATE` (3,4 rad/s) e só anda de frente |
| **B** | as patas andavam por **tempo**, não por distância → pé escorregando na fuga | fase da passada pela distância (`strideAdvance`) |
| **C** | velocidade ia de 0 a 0,55 (ou 1,55) num quadro | rampa de arranque e freio (`approachSpeed`) |

## Antes

`stepToward()` (a base das criaturas) fazia, no mesmo passo: mover na direção do
alvo e **reatribuir o rumo**:

```js
e.x = nx; e.z = nz; e.y = ny;
e.heading = Math.atan2(dirX, dirZ);   // ← a cada quadro
```

Consequências:

- sortear um alvo atrás de si fazia a ovelha **teleportar 180°** de rotação, com
  as patas em pleno passo;
- ela andava **de lado e de costas** sempre que o alvo não estava à frente;
- a velocidade era a mesma do primeiro ao último quadro (0 → 0,55 m/s de estalo,
  e 0,55 → 0 na hora de parar);
- a fase das patas subia com `dt * 5,4` e levava um multiplicador de 1,7 na fuga:
  a 1,55 bloco/s o **passo continuava com o mesmo ciclo**, e o pé deslizava na
  grama. (Era o mesmo problema que o jogador teve, resolvido no `world-gait.js`.)

## Depois

### A · o corpo gira (e só anda de frente)

`walkStep(heading, dirX, dirZ, speed, dt)` devolve o rumo novo, a distância deste
quadro e se ainda está girando:

| Situação | O que acontece |
| --- | --- |
| alvo à frente | anda `velocidade × dt` no rumo do corpo |
| alvo até 52° de lado (`SHEEP_TURN_DEADZONE`) | anda **curvando**, girando a 3,4 rad/s |
| alvo atrás | **gira parada** (distância 0) e sai depois: nada de andar de lado |

A base ganhou o par que faltava: `stepHeading(e, distância)` dá o passo **no rumo
do corpo** (devolve quanto andou, 0 se barrado) e `moveTo(e, x, z)` é a conta de
chão/pulo/planeio que os dois passos compartilham — `stepToward` continua
existindo para o Mofim, que não mudou.

### B · a passada anda pela distância

```js
e.stride = strideAdvance(e.stride, andou);   // andou = blocos andados no quadro
```

`SHEEP_STRIDE_PER_BLOCK = SHEEP_STRIDE_SPEED / SHEEP_WANDER_SPEED` (≈ 9,82 rad por
bloco) veio da conta antiga, então **andando** o passo ficou idêntico ao de antes.
O que muda é na fuga: a 1,55 bloco/s a perna passa 2,8× mais rápido, casando com o
chão — o pé para de escorregar. Barrada (parede, água), a fase não anda.

### C · arranque e freio em rampa

| Constante | Valor | Efeito |
| --- | --- | --- |
| `SHEEP_ACCEL` | 2,4 bloco/s² | 0 → 0,55 em ~0,23 s |
| `SHEEP_BRAKE` | 3,6 bloco/s² | 0,55 → 0 em ~0,15 s (freia mais que arranca) |

`approachSpeed()` cuida disso, e a velocidade atual fica em `e.speed`. Freando
sem alvo, ela **termina o passo no rumo em que está** em vez de parar de uma vez.

## Provas

- 84 testes em `tests/sheep.test.mjs` (941 na suíte).
- Seis novos:
  - **o passo vira o corpo aos poucos e nunca anda de lado** (alvo nas costas =
    gira parada; desvio pequeno = anda curvando; alinhada = distância exata);
  - **a velocidade entra e sai por rampa** (arranque, cruzeiro, freio, nunca
    negativa);
  - **a passada anda pela distância** (dobro da distância = dobro da fase;
    parada, a fase não anda);
  - **andando, o corpo não vira num quadro só** (no jogo: ≤ 3,4 rad/s por quadro,
    e depois de 1,5 s ela encara o alvo e anda para lá);
  - **correndo, a perna acompanha o chão** (60 quadros de fuga: fase acumulada =
    distância × cadência, com erro < 1e-6);
  - **saindo do pasto, ela arranca devagar** (primeiro quadro com velocidade
    parcial e passo curto; meio segundo depois, no cruzeiro).
- **Prova de força** (mutações, todas derrubam teste):

| Mutação | Testes que quebram |
| --- | --- |
| rumo estalando (`heading = alvo`) | 82 |
| sem zona morta (anda de lado) | 79 |
| velocidade sem rampa | 84 |
| passada pelo tempo | 83 |
| giro instantâneo no `walkStep` | 79, 82 |
| aceleração instantânea na função pura | 80, 84 |

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 33.
