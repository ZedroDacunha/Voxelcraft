# MELHORIA: agachado, o jogador não cai da beirada (T4, leva 1)

- **Data:** 04/11/2026 (tema 4 — física do jogador)
- **Status:** implementado
- **Arquivos:** `player-physics.js`, `game.js`, `tests/player-physics.test.mjs`

## Por que

Agachar já fazia duas coisas: **não assustar o Mofim** (regra do T1) e **mergulhar**
na água. Mas andar agachado até a beirada de um penhasco não mudava nada — o
jogador saía andando pelo vazio do mesmo jeito. Justamente na hora em que ele
está espiando o precipício (ou se aproximando devagar de um bicho), a física não
ajudava em nada.

## A regra

Três condições, todas já conhecidas pelo `updatePhysics()`:

```js
guardEdge = isCrouching && player.onGround && !inWater
```

Com a guarda ligada, o deslocamento **horizontal** (`x` e `z`) passa a testar se
o corpo continua com chão embaixo; o passo que tiraria o último apoio é barrado
e **refinado por bisseção** (mesma técnica da parede), senão o jogador pararia até
um quarto de bloco antes da borda — que é o tamanho do sub-passo.

`hasGroundSupport()` olha **cinco pontos** da base (quatro cantos + centro) um
fio (`SUPPORT_PROBE`, 0,05) abaixo dos pés: **basta um** estar sobre bloco sólido.

Isso significa que ainda dá para **espiar a beirada** — o corpo avança até o
último canto apoiado, ~0,3 bloco além da linha do bloco (o raio do jogador), que
é o mesmo comportamento de Minecraft. O que não dá mais é atravessar a beirada e
cair sem querer.

Casos que **não** mudam:

| Situação | Guarda | Por quê |
| --- | --- | --- |
| em pé, andando | desligada | comportamento antigo intacto |
| no ar (pulando/caindo) | desligada | `onGround` é falso; o eixo `y` nunca é guardado |
| dentro da água | desligada | ali agachar é **mergulhar**, não freio |
| pulando agachado | — | já não era possível: o pulo exige `!isCrouching` |

## Testes

`tests/player-physics.test.mjs` (16 → **22**):

- `hasGroundSupport`: plataforma × vazio × ar; **um canto apoiado já segura** e
  passou do último canto não segura; um fio acima do chão já conta como vazio;
- agachado na plataforma, andar 3 blocos para o vazio **para na beirada**
  (x entre 4,20 e 4,31 para uma plataforma que termina em 4) e o corpo segue
  apoiado;
- controle: sem a guarda o mesmo passo anda os 3 blocos e termina no ar;
- andar para dentro da plataforma continua com distância exata;
- pilar de 1 bloco: anda até +1,3 / −0,3 (último canto apoiado) e para, sem cair;
- a guarda é só horizontal: cair no ar não é barrado e o chão continua parando o
  corpo no eixo `y`.

## O que ficou de fora

- **Coyote time** (pulinho tolerante por ~0,1 s depois de sair da borda): é a
  leva 2 deste tema.
- Apoio em painel de porta: o painel não é piso (é fino e só colide), então
  agachar em cima dele não é um caso real hoje.
- Rebobinar a queda (subir de volta na beirada) — não, o corpo simplesmente não
  sai.
