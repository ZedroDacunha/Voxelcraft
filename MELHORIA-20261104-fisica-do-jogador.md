# MELHORIA: física e colisão do jogador saem do `game.js`

- **Data:** 04/11/2026 (item 10 da [análise de 31/10](ANALISE-20261031-melhorias.md), etapa 1 de 4)
- **Status:** implementado
- **Arquivos:** `player-physics.js` (novo), `game.js`, `tests/player-physics.test.mjs` (novo), `tests/door-collision.test.mjs`

## Por que começar por aqui

`game.js` concentrava colisão e deslocamento do jogador — a AABB contra voxels,
o passo subdividido, o "encostar na superfície" com bisseção, a saída de dentro de
uma porta e o teste de ocupação de célula. São ~90 linhas de **geometria pura**
presas dentro de um arquivo que também precisa de Three, áudio e DOM para rodar.
Resultado: a parte que mais erra (e que mais vai crescer quando entrarem mobs) era
a que não dava para testar.

Colisão é ainda o tipo de código em que o erro é difícil de ver: atravessar 1 cm de
parede, travar num canto, ficar preso dentro de uma porta não aparece em revisão —
aparece jogando.

## O que mudou

Novo módulo `player-physics.js`, sem estado global e sem Three:

| Função | Papel |
| --- | --- |
| `collidesInWorld(world, x, y, z, height, radius)` | AABB do corpo × voxels sólidos, com o painel da porta tratado antes do teste de solidez |
| `movePlayerAxis(world, pos, axis, amount, height, radius)` | move um eixo em passos de ≤ 0,25 e, ao bater, encosta na superfície por bisseção |
| `unstickInWorld(world, pos, height, radius)` | tira o corpo de dentro de bloco (mesmo nível e até 2 acima) |
| `playerIntersectsBlock(pos, height, bx, by, bz, radius)` | ocupação de célula, usada ao colocar blocos |
| `PLAYER_RADIUS`, `COLLISION_EPSILON`, `MAX_MOVE_STEP`, `MOVE_REFINE_STEPS`, `UNSTICK_OFFSETS` | as constantes que antes estavam soltas no `game.js` |

O `game.js` mantém **quatro wrappers com a assinatura antiga** (`collides`,
`moveAxis`, `unstickPlayer`, `intersectsPlayer`), que só completam os argumentos
com `world`, `player.pos` e `player.height`. Assim nenhum ponto de chamada mudou e
o `updatePhysics()` continua sendo o orquestrador que conhece o estado do jogo
(água, áudio, câmera, dano de queda, exaustão).

Isso é intencional: `updatePhysics()` mistura simulação com efeitos — extrair tudo
de uma vez exigiria injetar meia dúzia de dependências e aumentaria o risco sem
ganho de teste. A fronteira escolhida é onde há geometria pura.

## Testes

`tests/player-physics.test.mjs` — 16 testes:

- **folga de borda:** pé no chão exato não colide; afundar `COLLISION_EPSILON`
  colide (o valor exato da tolerância fica fixado);
- **teto e altura:** corpo de 1,8 cabe em 2 blocos de vão, 1,3 de altura bate no teto
  em y = 3, agachado (1,5) passa;
- **raio:** encostar na face não colide, 1 mm além colide; corredor de 1 bloco
  barra os dois lados;
- **porta:** colide pelo painel fino (0,4375–0,5625), não pelo voxel inteiro;
- **movimento:** distância exata em campo livre, parada encostada na parede com
  erro menor que 1/64 de sub-passo, movimento de 30 blocos **não atravessa** uma
  parede de 1 bloco (subdivisão funciona), sentido negativo, deslocamento nulo;
- **destravar:** corpo livre não mexe, painel de porta sai pelo primeiro
  deslocamento livre no mesmo nível, coluna maciça sobe até a primeira altura
  livre, sem ponto livre devolve `false` e não move;
- **ocupação de célula:** borda conta como fora, altura cobre as células 1 e 2.

Em `tests/door-collision.test.mjs`, um teste que era **grep no `game.js`**
("colide com o painel antes de descartar blocos não sólidos") virou teste de
comportamento: monta um mundo em que **todo** bloco é porta aberta (`solid: false`
+ painel fino) e verifica que o painel colide e o lado de fora do painel passa.
O grep existia só porque o código era inalcançável de teste.

## Efeito no tamanho

`game.js`: 3.927 → **3.871 linhas**; `player-physics.js`: 111. O número de linhas
é o menos importante — o ganho é que 90 linhas de física agora são testáveis e o
`game.js` encolhe na direção certa para as próximas etapas.

## Próximas etapas (uma por PR)

2. malha/chunks; 3. HUD/inventário; 4. interação (quebrar/colocar, raycast).

## Validação

```bash
npm test        # 421 testes (17 novos)
npm run check   # sintaxe 112/112 + importmap em dia
```

Validação manual pendente no aparelho do usuário (o sandbox não tem navegador):
andar, encostar em parede, atravessar porta aberta, passar por vão agachado e
nascer em save antigo preso.
