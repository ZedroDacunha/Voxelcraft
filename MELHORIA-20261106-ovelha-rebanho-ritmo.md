# MELHORIA: o rebanho menos sincronizado — ritmo próprio e lugar de cada uma

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-sheep.js`, `tests/sheep.test.mjs`

## As escolhas (feitas antes de codar)

O pacote **E** do menu de movimentação: tirar o bando do pelotão.

| Peça | Antes | Depois |
| --- | --- | --- |
| **ritmo** | todas andavam a exatamente **0,55** bloco/s | ±12% por ovelha (`walkSpeedFor`): **0,48 a 0,62** |
| **fuga** | todas corriam a **1,55** | a fuga guarda o ritmo dela: 1,55 × o fator do passo |
| **lugar no bando** | a seguidora mirava o **ponto exato** da líder quando ficava para trás | mira o **seu** lugar num círculo em volta dela (`herdSlotFor`) |

## Antes

O rebanho andava como um pelotão e, quando a líder se afastava, **todas as
seguidoras miravam o mesmo ponto** — o corpo da líder. Resultado: quatro ovelhas
convergindo para o mesmo metro quadrado, empilhando-se umas nas outras e virando
juntas no mesmo instante.

## Depois

### Cada uma no seu ritmo

`walkSpeedFor(id)` sorteia **uma vez**, do `id`, um fator de 0,88 a 1,12 sobre o
passo do pasto:

```js
SHEEP_WANDER_SPEED = 0,55  →  0,484 … 0,616 bloco/s
```

O valor fica em `e.walkSpeed` no nascimento. Quem anda mais devagar **fica para
trás de verdade** (e depois alcança, porque as outras param para pastar), em vez
de todas andarem coladas num bloco só.

A fuga usa o mesmo fator (`SHEEP_FLEE_SPEED × walkSpeed / SHEEP_WANDER_SPEED`):
assustadas, elas correm na direção do susto mas **não no mesmo ritmo** — o que já
vinha do `SHEEP_ACCEL` do #97 (arranque em rampa) continua valendo.

### Cada uma no seu lugar

`herdSlotFor(id)` sorteia um **ângulo** (0–2π) e um **raio** (1,3–2,8 blocos) por
ovelha, fixos. Quando a seguidora fica para trás (`SHEEP_FOLLOW_GAP` = 7), o alvo
passa a ser `herdSlotSpot(líder, id)` — o lugar dela em volta da líder, não o
corpo dela.

O resultado é o bando abrindo em **círculo** em vez de formar fila: cada uma
chega ao seu canto, para a uma distância própria e ninguém sobe no lombo de
ninguém.

## Provas

- 90 testes em `tests/sheep.test.mjs` (947 na suíte).
- Quatro novos:
  - **cada ovelha anda no seu ritmo, dentro de ±12%** — 40 ids dentro da faixa,
    todos diferentes, amplitude > 0,08 e `spread: 0` devolvendo o passo do pasto;
  - **cada seguidora tem o seu lugar em volta da líder** — raio dentro da faixa,
    ângulos diferentes e o ponto exatamente à distância do raio;
  - **o bando não anda em pelotão nem vira um monte atrás da líder** — no jogo:
    ritmos distintos no nascimento, e depois de 20 s de reencontro todas encostam
    na líder **sem** ficar em cima dela (0,5–3,8 blocos) e **sem** se empilhar
    (> 0,6 bloco entre seguidoras);
  - **na fuga cada uma mantém o seu ritmo** — velocidade de cruzeiro igual a
    `SHEEP_FLEE_SPEED × fator`, e diferente entre as duas.
- **Prova de força** (7 mutações, todas derrubam teste):

| Mutação | Testes que quebram |
| --- | --- |
| todas no mesmo ritmo | 87, 89, 90 |
| ritmo ignorado ao andar | 84 |
| fuga sem ritmo próprio | 90 |
| seguidora mirando a líder exata | 59 |
| lugar com raio zero | 59, 88 |
| mesmo ângulo para todas | 88 |
| ritmo fora da faixa (±200%) | 15, 87, 89 |

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 35.
