# MELHORIA: chegada ao anoitecer

- **Data:** 04/11/2026 (depois da [travessia](MELHORIA-20261104-travessia-do-mofim.md))
- **Status:** implementado
- **Arquivos:** `world-creature.js`, `tests/creature.test.mjs`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

O Mofim "aparecia" ao anoitecer — mas aparecer, do jeito que estava, era
**surgir**: ele nascia já parado a 9–24 blocos do jogador, num ponto sorteado ao
redor, e só então começava a passear. De longe isso lê como um bicho que piscou
para existir, e os três da noite surgiam em pontos quaisquer do horizonte, cada
um por seu lado.

O pedido foi o contrário disso: **chegar**. Ele entra em cena mais cedo, com o
sol ainda no horizonte, vem **andando de longe** e **do mesmo lado** que os
outros da noite — um grupo chegando, não três aparições.

## 1. Mais cedo: o limiar da noite

`NIGHT_SPAWN_THRESHOLD` desceu de **0,50 para 0,38**.

O céu entrega `night = 1 - day`, e `day` é uma curva suave da elevação do sol. Em
0,50 o bicho entrava quando a noite já estava pela metade; em 0,38 ele entra com
o sol ainda acima do horizonte — o crepúsculo, que é a hora certa para um bicho
de hábitos noturnos começar o dia.

O mesmo limiar governa a saída (quando o dia volta), então o efeito é simétrico:
ele aparece mais cedo e vai embora mais tarde, sempre no azul.

## 2. De longe: onde ele nasce

`SPAWN_MIN_DISTANCE`/`SPAWN_MAX_DISTANCE` passaram de **9–24** para **20–30**
blocos. `DESPAWN_DISTANCE` continua em 38 — oito blocos de folga para o jogador
não apagar o bicho que acabou de chegar só por andar um pouco.

A 20–30 blocos ele é uma silhueta pequena que vai crescendo enquanto atravessa o
capim. É essa caminhada que faz a chegada existir.

## 3. Do mesmo lado: a fila

Um sorteio por noite decide o **rumo da chegada** (`arrivalBearing`). Os três
nascem naquele rumo, com uma abertura de só `ARRIVE_SPREAD` (0,22 rad ≈ 12°), em
vez de cada um num ângulo qualquer. O relógio de spawn (4,5 s) faz o resto: um
sai andando, o próximo nasce atrás dele no mesmo rumo.

O rumo zera quando o dia volta, então cada noite chega de um lado diferente.

Efeito colateral que precisou de conserto: o espaço mínimo entre bichos era de
**8 blocos** (`< 64` no teste de distância), o que fazia sentido com aparições
paradas em pontos sorteados e passou a **recusar a fila** — a noite ficava com
dois. Agora o mínimo é `ARRIVE_MIN_GAP = 4`: eles chegam andando, alguns blocos
um do outro, de propósito.

## 4. Andando: o passo da chegada

Enquanto `arriving` é verdadeiro, o Mofim **não passeia nem sorteia alvo**: o
caminho dele é o jogador.

- **passo** de `ARRIVE_SPEED` (1,15 bloco/s) — mais rápido que o vagar (0,72),
  bem mais lento que a fuga (3,1): é caminhada decidida, não disparada;
- **leque** de desvios quando o caminho reto está barrado (`ARRIVE_FAN`, cada
  bicho para o seu lado) — encosta e cerca não travam a chegada;
- **para** a `ARRIVE_STOP_DISTANCE` (12 blocos): perto o bastante para ser visto,
  longe o bastante para não encostar no jogador (e o raio do susto é 7, então ele
  não se assusta com quem só está parado olhando).

A chegada acaba por quatro motivos, todos simples: **chegou perto**; **demorou
demais** (`ARRIVE_TIMEOUT`, 30 s — o jogador foi embora ou o caminho enroscou);
**não há por onde vir** (o leque inteiro barrado — ilha, barranco em volta); ou
**levou um susto** (`scare` corta a chegada, porque quem se assusta corre).

A decisão de terminar é pura (`arrivalDone`), testável sem mundo e sem relógio.

## 5. Simulação (ciclo completo)

Mundo plano, jogador parado, noite subindo de 0,1 a 1 em 40 s:

```
limiar da noite atingido em 12.4 s
t=12.4s nasce #1 a 26.2 blocos (night 0.38)
t=16.9s nasce #2 a 27.5 blocos (night 0.48)
t=21.5s nasce #3 a 28.1 blocos (night 0.58)
t=24.9s #1 termina a chegada a 12.0 blocos
t=30.5s #2 termina a chegada a 12.0 blocos
t=35.5s #3 termina a chegada a 12.0 blocos
no fim: 0 criaturas (amanheceu, todas foram embora)
```

Cada um leva ~12 s para atravessar os ~15 blocos que separam o nascimento do
ponto de parada. A noite inteira chega em 23 s.

## 6. Testes (7 novos, 589 no total)

| Teste | O que garante |
| --- | --- |
| a chegada termina ao chegar perto | `arrivalDone` por distância e por tempo; e o passo é de passeio, entre vagar e fugir |
| aparece no crepúsculo | limiar abaixo de 0,5 e `isMofimTime` respeitando-o nas duas bordas |
| nasce longe e vem andando | nasce a 20–30, `arriving` ligado, aproxima-se sem dar voltas e para a 12 blocos |
| os da mesma noite vêm do mesmo lado | dois nascimentos com menos de `ARRIVE_SPREAD` de diferença angular |
| chegada sem caminho | ilhota cercada de água: ele desiste em vez de travar |
| assustado, a chegada acaba | o jogador chega correndo perto e ele passa a fugir |
| a fila cabe no limite | três por noite, nenhum em cima do outro |

Os testes que dirigem o bicho à mão (`spawnOne`) desligam a chegada de propósito:
ali quem escolhe o caminho é o teste.

## 7. O que sobra (de propósito)

- **chegar em bando de cinco**: não. O limite continua três (`CREATURE_LIMIT`) —
  é bicho, não enxame;
- **vir de qualquer lado**: não. O grupo vem do mesmo lado; é o que se vê de
  longe e dá a impressão de grupo;
- **validar no navegador**: precisa de um anoitecer inteiro. O item 7 do
  [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md) cobre.
