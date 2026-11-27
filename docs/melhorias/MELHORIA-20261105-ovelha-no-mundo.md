# MELHORIA: a ovelha no mundo (parte 1 — ela existe e vaga)

- **Data:** 05/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-sheep.js` (novo), `world-creature-base.js`
  (novo), `world-creature.js`, `game.js`, `tests/sheep.test.mjs` (novo)

## O plano, em seis partes

A ovelha foi pedida **por partes**, como o Mofim. Esta é a primeira:

| Parte | O que entra | Estado |
| --- | --- | --- |
| **P1** | o bicho existe, nasce no pasto e vaga | **este PR** |
| P2 | aparência: tufos de lã, orelhas caídas, olhos, tons | depois |
| P3 | pastar: cabeça baixa, grama vira terra | depois |
| P4 | lã + tesoura (tosquia) | depois |
| P5 | balido (precisa de um `.ogg`) | depois |
| P6 | rebanho: 2–4 juntas, susto igual ao do Mofim | depois |

Decisões fechadas com o pedido: começar pelo **P1 andando**, ovelha **mansa** (só
corre se levar golpe, e o susto fica para o P6) e **três cores** — branca, cinza e
preta.

## Antes

Só existia um bicho no mundo, o **Mofim**, e ele morava inteiro num arquivo só:
`world-creature.js`, 1.130 linhas, com o modelo, o nascimento, o medo, o voo, o
chilreio, a luz e o pó no mesmo lugar. E as regras que **não** são do Mofim
estavam lá dentro:

- `surfaceAt(x, z)` — onde fica o chão;
- `isGround` / `isClear` — o que é chão e o que é ar livre;
- `stepToward` — dar um passo, subir um degrau, descer planando;
- `addPart` / `removeEntity` — montar o corpo de caixas e tirá-lo da cena.

Escrever a ovelha copiando isso seria a receita para os dois divergirem — um
aceitando areia, o outro não; um subindo degrau, o outro travando na escada.

## Depois

### Uma base para os dois bichos (`world-creature-base.js`)

Para baixo do Mofim, sem mudar comportamento nenhum: `createCreatureBaseClass`
entrega `isGround`, `isClear`, `surfaceAt`, `groundTypeAt`, `addPart`,
`removeEntity`, `stepToward` e `countNear`, mais as constantes do chão
(`CREATURE_STEP_UP = 1`, `CREATURE_HOP_HEIGHT`) e os dois arcos do degrau
(`hopHeightAt`, `glideHeightAt`). O `world-creature.js` continua exportando os
arcos, para nenhum import antigo quebrar.

O Mofim virou `class CreatureSystem extends CreatureBase` e **perdeu** essas
funções: o arquivo ficou com o que é dele (medo, voo, chilreio, luz, pó). Os 75
testes da criatura passaram sem uma linha de teste alterada — é a prova de que a
extração não mexeu em nada.

### A ovelha (`world-sheep.js`)

**Nasce de dia, no pasto.** `isPastureTime(day)` libera o nascimento a partir de
`SHEEP_DAY_THRESHOLD = 0.45` do dia (o jogo passa `worldSky.day`, 0 = noite
fechada, 1 = dia claro). Nasce entre **16 e 30 blocos** do jogador, só em grama
(areia, pedra e água ficam de fora), com **no mínimo 6 blocos** de outra ovelha e
no máximo **quatro** vivas ao mesmo tempo. Some da cena a **44 blocos** — como o
Mofim, ninguém precisa ver a ovelha que ficou do outro lado do mundo.

**Vaga devagar.** `SHEEP_WANDER_SPEED = 0.55` bloco/s (o Mofim passeia a 0,72),
sorteando um alvo entre 1,4 e 4,2 blocos a cada 3,2–8 s. Barrada (encosta, água,
buraco), desiste na hora e sorteia outro caminho em vez de empurrar a parede até
o tempo acabar.

**É mansa.** Não existe `shouldFlee` na ovelha: jogador correndo, colado, agachado
ou não — o pasto segue igual. O susto entra no P6, junto com o golpe.

**O corpo é de caixas**, com o pé em `y = 0` (o grupo é posto na altura do chão,
então nada flutua nem afunda):

| Peça | Medida (blocos) | Papel |
| --- | --- | --- |
| corpo | 0,58 × 0,52 × 0,86 | a silhueta de lã, que se lê de longe |
| cabeça + focinho | 0,38 × 0,34 × 0,34 + 0,24 × 0,16 | a cara |
| olhos | 2 × 0,05 × 0,06 | dois pontos escuros |
| orelhas | 2, deitadas para os lados | o que separa de um porco |
| patas | 4 × 0,14 × 0,36 | o passo |
| rabo | 0,10 × 0,14 × 0,10 | o detalhe de trás |

As patas andam **em diagonal** (frente-esquerda com trás-direita), com amplitude
de 0,5 rad, e a fase só avança quando ela anda de verdade — parada, as quatro
voltam ao chão devagar, sem congelar no meio do passo. A cabeça balança um fio
junto.

**Três lãs**, sorteadas no nascimento por `coatFor(roll)` (função pura): branca
68%, cinza 20%, preta 12%. Os materiais são **compartilhados** por cor (uma
ovelha não pisca nem leva golpe neste recorte, então nada pinta o corpo dela em
tempo de execução); o `bodyMaterial` fica de fora de propósito, porque
`removeEntity` descarta esse material e descartaria a lã de todas as outras.

## Validação

```bash
npm test        # 807 testes (26 novos em tests/sheep.test.mjs)
npm run check   # sintaxe (151 arquivos) + importmap em dia
npm run stamp   # index.html recarimbado com os módulos novos
```

**Prova de força** — cada regra da ovelha quebrada de propósito derruba o teste
que a defende:

| Quebra proposital | Teste que reprova |
| --- | --- |
| limiar de dia = 0 (nasce de noite) | "ovelha é bicho de dia" e "de noite não nasce nenhuma" |
| lã toda branca | "o sorteio da cor cai nas três faixas" e "as três cores aparecem no mundo" |
| patas em fila em vez de diagonal | "as patas andam em diagonal" |
| nasce a 4 blocos do jogador | "o ponto de nascimento fica entre 16 e 30 blocos" |
| sem checar o tipo de chão | "só nasce em grama: areia e pedra ficam de fora" |
| passo de 3,5 em vez de 0,55 | "vaga devagar: anda para o alvo e não sai do raio" |
| limite de 9 ovelhas | "nasce de dia, no capim… no máximo quatro por vez" |
| afastamento mínimo 0 | "duas ovelhas não nascem no mesmo canto do pasto" |
| corpo flutuando 0,2 acima do chão | "a ovelha pisa no chão" |

## O que ainda **não** existe (de propósito)

- não foge, não leva golpe e não morre — `strikeCreature()` só olha o Mofim;
- não pasta (a cabeça não abaixa, a grama não vira terra) — P3;
- não dá lã e não há tesoura — P4;
- não bali — P5 (falta o `.ogg`);
- nasce sozinha, não em rebanho — P6.
