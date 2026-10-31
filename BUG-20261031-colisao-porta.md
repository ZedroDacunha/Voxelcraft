---
type: bug-report
status: resolvido
component:
  - "[[Porta]]"
  - "[[Física do jogador]]"
  - "[[Colisão]]"
tags:
  - bug-report
  - voxel
  - colisão
  - porta
---

# Porta com colisão de bloco inteiro (jogador não encostava)

## 📌 Contexto e Sintomas

A porta desenhada era fina (0,125 de espessura, centralizada no voxel), mas a
colisão continuava sendo a do bloco inteiro: ao andar de frente para ela, o
jogador parava na borda do voxel e sobrava um vão visível de **~0,44 bloco**
entre o corpo e o painel. Também não era possível "grudar" na porta para abrir
com calma ou encostar de lado.

## 🔍 Causa Raiz

Dois pontos, e o segundo anulava qualquer correção isolada no primeiro:

1. `collides()` (`game.js`) só perguntava `world.isSolidForPhysics(x, y, z)` —
   sim/não por voxel. Não havia como representar uma caixa menor que 1×1.
2. `moveAxis()` resolvia a colisão "encostando" o jogador na borda do voxel:

   ```js
   if (step > 0) p[axis] = Math.floor(p[axis] + hi) - hi - 0.001;
   ```

   Ou seja, mesmo que a colisão soubesse que o painel está em 0,4375, o
   reposicionamento jogaria o jogador de volta para 0 (e o corpo pararia em
   -0,3).

## 🛠️ Solução Aplicada (Antes e Depois)

**Antes:** porta = cubo sólido de 1×1×1 para a física; parada na borda do voxel
com um vão de 0,4375 bloco até o painel.

**Depois:**

- `world-door.js` exporta `woodDoorCollision(part, facing)`, que devolve a caixa
  local do **painel fechado** (mesma geometria do mesher) ou `null` para porta
  aberta (o catálogo já a marca `solid: false`, então continua passável).
- `World.doorCollisionBox(x, y, z, type)` converte essa caixa para coordenadas
  do mundo usando o `facing` salvo em `BlockFacingStore`.
- `collides()` faz teste de AABB entre o corpo do jogador (raio 0,3 × altura) e
  a caixa do painel; blocos comuns continuam sendo cubos inteiros.
- `moveAxis()` trocou o "snap" na borda do voxel por uma **bissecção** (6
  iterações) entre a última posição livre e a posição bloqueada. Blocos comuns
  param no mesmo lugar de antes (fica ~0,1 mm antes da face); a porta deixa o
  jogador encostar no painel.
- `toggleWoodDoor()` recusa **fechar** a porta se o corpo do jogador estiver no
  vão do painel (aviso "Saia do vão da porta para fechá-la"), evitando ficar
  preso dentro da geometria.

Números medidos em simulação da física com a porta em `(0, 0, 0)` e o jogador
andando em +z: parada em `z = 0,1366` (vão de 0,0009 bloco até o painel) em vez
de `z = -0,3` (vão de 0,44). Contra um bloco de pedra a parada continua em
`x = 4,7` — a mudança não afeta blocos cúbicos. Queda no chão continua em
`y = 0`.

Verificação realizada: `node --test tests/*.test.mjs` (26/26, incluindo
`tests/door-collision.test.mjs`) e `node --check` em `game.js`/`world-door.js`.

## 🤖 Regra de Evolução para a IA

> Ao dar forma a um bloco (porta, tocha, placa, cerca), ajuste **colisão e
> resolução de movimento juntas**: ensinar o `collides()` a usar uma caixa fina
> não serve de nada se o `moveAxis()` ainda reposiciona o jogador na borda do
> voxel. Prefira a bissecção na posição livre mais próxima e teste com números
> (distância até a face) em vez de "parece certo". Se a caixa fina for criada
> ou removida em tempo real (abrir/fechar porta), confira antes se o jogador
> não vai ficar preso dentro dela.
