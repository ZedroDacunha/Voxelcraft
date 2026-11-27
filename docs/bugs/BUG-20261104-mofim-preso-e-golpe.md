# BUG: Mofim preso na grama alta e blocos que não quebram perto dele

- **Data:** 04/11/2026 (relatado jogando, depois do [#43](https://github.com/ZedroDacunha/SiteCraft/pull/43) e do [#44](https://github.com/ZedroDacunha/SiteCraft/pull/44))
- **Status:** corrigido
- **Arquivos:** `world-creature.js`, `game.js`, `tests/creature.test.mjs`

Dois problemas com a mesma origem: o Mofim "ocupa" o mundo de um jeito que não
combina com o que o jogador vê.

## 1. Ele fica preso na grama e para de correr

**Sintoma:** ao se assustar, ele às vezes ficava parado, vibrando contra a grama
alta, em vez de fugir.

**Causa:** `surfaceAt()` — que decide se a coluna serve para ele pisar — recusava a
coluna se as duas células acima do chão **não estivessem vazias**:

```js
if (this.world.getBlock(bx, y + 1, bz) !== 0 || this.world.getBlock(bx, y + 2, bz) !== 0) return null;
```

Grama alta é um bloco (`ID.TALL_GRASS`) e ocupa justamente a célula acima do chão.
Ou seja: **toda touceira era uma parede** para o Mofim — e o capim é gerado aos
montes. Pior: num campo cheio de grama alta ele nem nascia, porque não havia coluna
válida em lugar nenhum.

O segundo defeito era o desvio: a fuga recalculava o alvo a cada quadro a partir de
"para longe do jogador", e o desvio calculado quando batia num obstáculo era
descartado no quadro seguinte. Resultado: preso, tremendo no lugar.

**Reprodução (antes da correção):** mundo plano de grama com grama alta a partir de
x = 2, jogador correndo ao lado. O bicho ficava assustado (`scaredUntil` ativo) e a
posição **não mudava um milímetro**:

```
x inicial 3 | assustado até 11.00 | x final 3.000
```

**Correção:**

- `surfaceAt()` agora olha **solidez**, não vazio: chão vale se for sólido (grama,
  terra, areia, pedra, neve) e o que está em cima só precisa **não ser sólido nem
  água** — grama alta, tocha e flor são atravessáveis; água continua barrada;
- a fuga virou um **leque de direções**: reto para longe e, se o chão barra,
  diagonais cada vez mais abertas (até ~109°). Os ângulos grandes são o que salva
  o caso de encosta/lago: encostado num obstáculo, todas as direções "para longe"
  ainda apontam para dentro dele, e ele precisa poder correr **ao longo** dele;
- o passo passou a ser uma função só (`stepToward`), usada pela fuga e pelo
  passeio, e ela devolve se andou — quem chama decide (fuga tenta outra direção,
  passeio sorteia outro alvo).

**Depois da correção**, mesmo cenário: `x final 7.650` — atravessou a touceira e
correu 4,6 blocos.

## 2. Não dava para quebrar blocos perto do Mofim

**Sintoma:** com um Mofim por perto, os blocos em volta simplesmente não quebravam.

**Causa:** o golpe em criatura ([#43](https://github.com/ZedroDacunha/SiteCraft/pull/43)) reservava o clique sempre que o bicho estava na mira:

```js
if (!creatureInReach(...)) return false;
if (creatureSystem.hitFrom(...)) startPunch(handAnim);
resetMining();     // ← todo quadro, mesmo no cooldown
return true;       // ← nunca minera
```

Três coisas somadas:

1. o cone era largo (**44°**) e o alcance de 3,5 blocos — o Mofim "pegava" a mira
   em quase qualquer direção;
2. a mineração era zerada **todos os quadros**, inclusive durante o cooldown de
   0,35 s do golpe, então o progresso nunca passava de 0,35 s;
3. nada comparava a distância do bicho com a do **bloco** que estava na mira.

Como o bicho passeia perto do jogador, na prática "perto do Mofim" era uma área
onde nada quebrava.

**Correção:**

- **oclusão:** o golpe só vale se o Mofim estiver **mais perto que o bloco na
  mira** (`maxDistance` = distância do bloco atingido pelo raio). Se o bloco está
  na frente, o bicho está atrás dele — e o golpe é do bloco;
- cone de **31°** (`HIT_MIN_DOT` 0,72 → 0,86): mirar no bicho, não "perto dele";
- a mineração só é suspensa **no quadro em que o golpe acontece**. No cooldown,
  minerar segue normalmente.

## Testes de regressão

`tests/creature.test.mjs` — 6 testes novos (31 no arquivo, 453 na suíte):

- **grama alta não prende:** fugindo com capim no caminho, ele se afasta mais de 1
  bloco (antes: zero);
- **campo todo de grama alta:** ele ainda nasce e passeia;
- **água barra o passo:** fugindo para o lado do lago, não entra e **desvia para o
  lado** (é o caso que obrigou o leque a ir até ~109°);
- **areia e pedra servem de chão** (antes só grama/terra, e ele encalhava na praia);
- **bloco mais perto na mira:** o Mofim atrás não leva o golpe;
- **mirar de raspão (~35°)** não rouba mais o golpe do bloco.

## Validação

```bash
npm test        # 453 testes (6 novos)
npm run check   # sintaxe 114/114 + importmap em dia
```

**Validação manual pendente no aparelho do usuário:** assustar um Mofim no capim e
ver se ele corre de verdade; quebrar blocos com ele por perto.
