# MELHORIA: asas de mariposa

- **Data:** 04/11/2026 (depois da [aparência do Mofim](MELHORIA-20261104-aparencia-do-mofim.md))
- **Status:** implementado
- **Arquivos:** `world-creature.js`, `tests/creature.test.mjs`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

A asa do Mofim era **uma placa só**: um retângulo de `0,24 × 0,12` girando em
torno do **próprio meio**. Duas consequências, as duas visíveis:

- **a ponta mal se mexia** — girar no meio faz a ponta percorrer metade do arco;
- **não era asa** — era um remo translúcido. Sem borda, sem traseira, sem nada
  que dissesse "mariposa" justo no bicho que tem nome de mariposa.

A PR anterior (anatomia + olhos) resolveu corpo e olhos; esta resolve a asa —
o caminho **B** que ficou combinado de fazer depois.

## 1. A asa agora tem estrutura

Cada lado virou um **conjunto preso no ombro** (`THREE.Group` em `±0,23 · 0,34`),
com quatro peças:

| peça | o que é |
| --- | --- |
| **dianteira** (`0,26 × 0,13`) | a asa grande, com a mancha clara em cima |
| **traseira** (`0,20 × 0,10`) | menor, atrás e abaixo: é o que separa "mariposa" de "placa" |
| **borda** (`0,03 × 0,13`) | fita escura na ponta — recorta a asa contra o céu da noite |
| **mancha** (`0,07 × 0,07`) | ocelo claro no meio da dianteira |

Envergadura ponta a ponta: **0,82 → ~0,96**.

## 2. O ombro muda o bater

Antes a rotação era no centro da peça; agora é no ombro, e a ponta percorre o
arco inteiro. Como o arco dobrou, as amplitudes caíram ~35%:

| situação | antes | agora |
| --- | --- | --- |
| passeio | 0,18 | **0,12** |
| fuga | 0,36 | **0,24** |
| voo curto | 0,50 | **0,32** |
| travessia | 0,30 | **0,20** |
| planeio | 0,07 | **0,05** |

Sem essa correção o bater exagerado virava borboleta — e o bicho perdia o ar de
"peso" que ele tem.

## 3. A traseira atrasa

A asa de trás tem rotação **própria**, no sentido oposto ao do pivô
(`flap · 0,3`): ela abre quando a dianteira fecha. É a articulação que faz o
conjunto parecer asa em vez de peça única — e sai de graça, porque o
`Group` do ombro já era o pai dela.

Vale também na saída ao amanhecer, quando ele bate as asas e sobe.

## 4. Testes (3 novos, 597 no total)

| Teste | O que garante |
| --- | --- |
| peças da asa | dianteira, traseira, borda e mancha existem nos dois lados; a borda é opaca e mais escura que a mancha |
| gira no ombro | o pivô fica junto do corpo (`x < 0,25`), a envergadura passa de 0,9 e girar o ombro move a ponta |
| traseira articulada | a traseira ganha rotação própria, oposta à do pivô |

O teste antigo do planeio continua valendo com as amplitudes novas: planeando, a
asa fica abaixo de 0,12 rad do plano; pousando, volta para além de 0,1.

## 5. O que sobra (de propósito)

- **asa com dedos/recortes** (três ou quatro peças): não. Em voxel de três
  caixas por asa, o recorte já vira ruído na distância em que o bicho é visto;
- **bater fora de fase entre os lados** (assimetria): não. Mariposa bate junto;
- **validar no navegador**: o item 7 do
  [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md) cobre o que olhar.
