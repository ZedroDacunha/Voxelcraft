# MELHORIA: a ovelha olha, cada uma por si — e ganha pescoço

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-sheep.js`, `tests/sheep.test.mjs`

## As escolhas (feitas antes de codar)

| Pergunta | Resposta |
| --- | --- |
| Quem repara no jogador | **Campo de visão (~140°) + sorteio por ovelha (~60%) + raio de 7 blocos** |
| Como ela olha | **A cabeça vira rápido e o corpo acompanha devagar** |
| O susto contagia o bando | **Sim, mas com atraso** de fração de segundo |
| O detalhe do olhar | **Vira, ergue e inclina de lado** (curiosidade) |
| O pescoço | **Peça nova** ligando corpo e cabeça, sem mudar a altura nem o alcance do focinho |

## Antes

Três coisas incomodavam:

- **o bando era um só bicho repetido**: bastava o jogador passar correndo para as
  quatro ovelhas pararem e virarem a cara **no mesmo quadro**, em uníssono. Não
  parecia bicho, parecia coreografia;
- **a virada era um teleporte**: o rumo saltava de um quadro para o outro e a
  cabeça subia de uma vez, sem transição;
- **pastando, a cabeça desgrudava do corpo**: ela descia 0,36 bloco e inclinava
  o focinho até o chão, mas o pescoço não existia — a cara ficava **flutuando**
  um palmo à frente da lã.

## Depois

### Cada uma repara por conta própria

O susto de chegada (`canScare` → `alert`) passou a passar por um filtro de
**percepção** (`sheepNotices`), com três condições ao mesmo tempo:

| Condição | Constante | O que faz |
| --- | --- | --- |
| raio | `SHEEP_NOTICE_RADIUS = 7` | longe demais, não repara (o raio do susto continua 4,5) |
| campo de visão | `SHEEP_VIEW_MIN_DOT = -0.34` | ~140° de abertura: vê à frente e dos lados, **não vê de costas** |
| atenção | `SHEEP_NOTICE_CHANCE = 0.6` | cada ovelha nasce com a sua (`attention`, 0..1); acima de 0,6 ela está distraída e **continua pastando** |

O campo de visão usa o mesmo `heading` que o corpo já usa para andar: o vetor da
cara (`sin/cos`) contra o vetor até o jogador, normalizado pela distância.

Quem entra no susto assim reage com um **atraso sorteado** de 0,12 a 0,5 s
(`noticeDelayFor`), então nem as que perceberam viram juntas.

### O contágio dá um passo só

O P6 continua valendo — a vizinha assustada puxa as outras —, mas:

- o contágio agora **também depende da atenção** (`SHEEP_CONTAGION_CHANCE = 0.8`,
  mais frouxo que a percepção de propósito: o bicho sente a vizinha correndo
  mesmo sem ter visto o jogador);
- entra com **atraso** de 0,18 a 0,45 s (`SHEEP_CONTAGION_DELAY_MIN/MAX`);
- e **não sai em cadeia**: `alert(..., { spread: false })` na reação da vizinha,
  senão o bando inteiro acabava encarando de qualquer jeito, por tabela.

### O olhar é animação

A cabeça e o corpo andam em ritmos diferentes:

| Peça | Como se move |
| --- | --- |
| cabeça (yaw) | suavizada a `SHEEP_LOOK_SMOOTH` (9/s), limitada a `SHEEP_LOOK_MAX_YAW` (1,1 rad) |
| cabeça (roll) | inclina `SHEEP_LOOK_TILT` (0,22 rad) de lado — a curiosidade |
| corpo | gira a `SHEEP_BODY_TURN_SPEED` (1,8 rad/s) até encarar quem chegou |

O resultado é o que se vê num bicho de verdade: ela **vira a cara primeiro**, e o
corpo vai chegando depois. Quando o corpo alcança, o yaw da cabeça volta sozinho
para zero — sem solavanco, porque tudo passa pelo mesmo amortecedor.

O `lookAmount` (0 = cabeça no pasto, 1 = cabeça erguida) faz a transição do
pasto: o envelope do pasto é multiplicado por `1 - lookAmount`, então a cabeça
**sobe em animação**. E a subida também é suavizada por `pastoAmount` (a descida,
não: o envelope do pasto já tem a sua rampa) — se o susto interrompe a mordida, o
focinho sai da grama em vez de pular.

### O pescoço

Uma caixa de lã (0,2 × 0,22) filha do grupo do corpo, criada em `neckPoseFor`:

- nasce no ombro (`SHEEP_NECK_ANCHOR_Y/Z` = 0,72 / 0,3);
- encontra a cabeça no pivô dela (`SHEEP_NECK_HEAD_Y/Z` = 0,06 / −0,02);
- a cada quadro o jogo recalcula **centro, comprimento e inclinação** e aplica em
  `position.y/z`, `scale.y` e `rotation.x`.

Em pé o pescoço tem ~8 cm e fica **escondido dentro da lã**; pastando estica até
~36 cm e aparece ligando o corpo à cabeça. As medidas do focinho não mudaram —
`headPoseFor` continua mandando na cabeça, o pescoço só a acompanha.

## Provas

- 76 testes em `tests/sheep.test.mjs` (933 na suíte inteira). Os novos:
  pescoço em pé/pastando no modelo real, encaixe sem vão, percepção (visão, raio,
  atenção), atraso sorteado, pastando de costas, duas ovelhas reagindo diferente
  ao mesmo jogador, olhar suave que volta, contágio de um passo só, matemática do
  rumo (`wrapAngle`/`angleTo`/`turnTowardAngle`) e "levantar a cabeça é animação".
- **Prova de força**: 12 mutações no código, todas derrubam pelo menos um teste —

| Mutação | Testes que quebram |
| --- | --- |
| ignorar o campo de visão | 68, 70 |
| ignorar a atenção | 68, 70, 71 |
| reagir sem atraso | 62, 72, 74 |
| contágio sem filtro de atenção | 62, 71 |
| contágio em cadeia (`spread: true`) | 74 |
| pescoço não estica | 75 |
| pescoço não acompanha a cabeça | 75 |
| cabeça vira de uma vez | 72 |
| corpo vira de uma vez | 72 |
| nunca inclinar de lado | 17 |
| envelope do pasto duro (sem `lookAmount`) | 76 |
| subida do pasto sem suavização | 76 |

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 31.
