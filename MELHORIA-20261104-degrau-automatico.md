# MELHORIA: degrau automático de um bloco

- **Data:** 04/11/2026 (física do jogador; depois do [pulo tardio](MELHORIA-20261104-pulo-tardio.md))
- **Status:** implementado
- **Arquivos:** `player-physics.js`, `game.js`, `tests/player-physics.test.mjs`, `README.md`

## Por que

O terreno é feito de blocos, então quase todo relevo tem degraus de **um bloco**:
escadinha de terra, beirada de praia, batente de porta, a borda de uma toca. Até
aqui o jogador tinha de **pular** cada um deles — e o pulo é calibrado para dois
blocos (`JUMP_SPEED = 9.5` sobre `GRAVITY`), então subir um degrau obrigava a dar
um pulo alto demais, aterrissando com a câmera subindo e descendo à toa.

Andar para o lado e ser barrado por um bloco que dá para subir sem pular é o tipo
de atrito que não ensina nada e cansa em cinco minutos de jogo.

## 1. A regra (pura)

`stepUpInWorld(world, pos, dx, dz, height, radius)` em `player-physics.js`, ao
lado de `movePlayerAxis` — mesma forma: recebe o mundo, a posição e devolve
`true`/`false`, mexendo em `pos.y` só quando dá certo.

Tenta subir **exatamente um bloco** (`AUTO_STEP_HEIGHT = 1`), e só se as três
coisas passarem, na ordem em que podem falhar:

1. **espaço para a cabeça** onde o corpo está, já na altura de cima — se a parede
   tem dois blocos, ou se o teto é baixo demais para ficar em pé ali, não há
   degrau e o passo continua barrado;
2. **destino livre** na altura de cima (o bloco que barrava fica abaixo dos pés,
   então o caminho abre);
3. **chão do outro lado** — sem isso o corpo subiria para o vazio, cairia no mesmo
   lugar no quadro seguinte e o jogador veria a câmera tremer **parado** contra a
   parede.

O `dx`/`dz` é o passo horizontal que foi barrado: é com ele que se descobre se o
corpo já tem parte sobre o degrau (a ponta do pé pousa nele antes de o centro
chegar). Sem passo (`dx = dz = 0`) não há degrau.

Três decisões que valem registro:

- **nada de dois blocos.** Dois blocos continuam sendo assunto do pulo. Subir
  dois "de graça" achataria o relevo e tiraria a razão de existir do pulo;
- **painel de porta não é chão.** A porta colide pelo painel fino mas não é
  sólida para a física (`isSolidForPhysics`), então a checagem 3 recusa — o mesmo
  cuidado que já existia no apoio do agachado;
- **o degrau não é um pulo.** Não mexe em `vel.y`, não zera a queda, não conta
  como estar no ar. Quem sobe é o **corpo**, no mesmo lugar — igual a uma
  escadinha.

## 2. Onde entra no quadro

Em `updatePhysics`, o passo horizontal passou a guardar o deslocamento:

```js
let blockedX = moveAxis('x', stepX, guardEdge);
let blockedZ = moveAxis('z', stepZ, guardEdge);

if ((blockedX || blockedZ) && player.onGround && !inWater
    && climbStep(blockedX ? stepX : 0, blockedZ ? stepZ : 0)) {
    blockedX = moveAxis('x', stepX, guardEdge);   // repete o passo, agora livre
    blockedZ = moveAxis('z', stepZ, guardEdge);
}
```

A ordem importa e virou teste:

- **depois** do passo barrado — só se sabe que há degrau quando algo barra;
- **antes** da gravidade (`moveAxis('y', vel.y * dt)`) — subir e já cair no mesmo
  quadro daria um solavanco;
- o passo é **repetido**, senão o jogador sobe e fica parado em cima do degrau até
  o quadro seguinte (a velocidade zerada por `blockedX` mataria o embalo);
- **só apoiado no chão e fora da água.** No ar o degrau viraria um pulo extra
  invisível; na água a natação tem regra própria.

`player.onGround` ainda é o do quadro anterior nesse ponto do código — que é
exatamente o que se quer: "estava apoiado quando tentou andar".

Agachado continua igual: o `guardEdge` (não sair andando pelo vazio) roda antes,
e o degrau só sobe se houver chão do outro lado. Espiar a beirada não virou
escalada.

## 3. O que não muda

- **A regra do Mofim** (T1): correr/andar perto assusta, agachado perto **não**
  assusta, golpe assusta. O degrau não mexe em velocidade nem em altura de
  agachamento, e o Mofim não olha para `pos.y`;
- **sons de passo**: contam distância **horizontal** (`stepDistanceThisFrame`), e
  o degrau repete o mesmo passo horizontal — nenhum passo a mais;
- **dano de queda**: `fallDistance` só acumula no ar; subir apoiado não zera nem
  inventa queda;
- **pulo**: `JUMP_SPEED`, `GRAVITY` e a janela do pulo tardio intactos.

## 4. Testes (6 novos, 548 no total)

Em `tests/player-physics.test.mjs`, com o mundo fake que o arquivo já tinha:

| Teste | O que garante |
| --- | --- |
| sobe um degrau de um bloco | barra → `stepUpInWorld` → passo repetido passa → apoio no degrau |
| parede de dois blocos | recusa e não mexe em `pos.y` |
| teto baixo | recusa mesmo com o degrau existindo (checagem 1) |
| painel de porta | não sobe para o que não é chão (checagem 3) |
| sem passo horizontal | `dx = dz = 0` não sobe |
| ordem no `game.js` | degrau depois do passo e antes da gravidade, só apoiado e fora da água |

## 5. O que sobra (de propósito)

- **passo de meio bloco** não existe no jogo (sem lajes): a altura é sempre
  inteira, então `AUTO_STEP_HEIGHT = 1` cobre todo degrau possível;
- **deslizar em parede de dois blocos** continua sendo pulo — é a diferença entre
  "terreno" e "obstáculo";
- **validar no navegador**: subir uma escadinha de terra, encostar numa parede de
  dois blocos (não deve subir), agachado espiar uma beirada (não deve subir) e
  entrar na água (não deve subir).
