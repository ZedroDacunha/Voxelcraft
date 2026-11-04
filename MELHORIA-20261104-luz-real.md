# MELHORIA: luz de verdade (PointLight) nas fontes próximas (T3, leva 1)

- **Data:** 04/11/2026 (tema 3 de criaturas/luz, depois do [T2](MELHORIA-20261104-mofim-poeira-e-lanterna.md))
- **Status:** implementado
- **Arquivos:** `world-point-lights.js` (novo), `game.js`, `tests/point-lights.test.mjs` (novo)

## Por que

A luz do mundo é **assada por voxel**: cada face de bloco recebe o nível do
vizinho, o que dá o degradê certo do cômodo e não custa nada por quadro. O que
ela **não** faz é "iluminar de verdade": o Mofim, os itens no chão e o próprio
jogador são desenhados com `MeshLambertMaterial` + `vertexColors`, e o único
que enxerga um `PointLight` no mundo é quem estiver perto dele.

Resultado visível antes desta leva: uma tocha acesa encostada no chão deixava o
chão iluminado e **o pó do Mofim caído ao lado, apagado** — dois objetos no mesmo
lugar com luzes diferentes.

## O que entrou

### 1. Pool de duas PointLights

Duas fontes próximas do jogador ganham **luz real**: posição, cor e intensidade
vindas do bloco (`torch` 14, `mofim_lantern` 13, cor mais dourada para o pó).

- A busca é uma **caixa** de 13 blocos em volta da câmera, 10 para cima/baixo,
  refeita **4× por segundo** (~15 mil leituras de bloco por varredura — barato,
  e a luz não muda de lugar entre dois quadros).
- `pickEmitters()` escolhe as **mais próximas** que ainda alcançam e devolve
  intensidade já com a queda quadrática (`(1 − d/alcance)²`, escalada pelo
  nível do bloco, teto de 1,2).
- Cada luz tremula (±7%) com fase própria: duas tochas no mesmo ritmo parecem
  um fogo só.

### 2. A luz da mão vale para a lanterna

`updateHeldTorchLight` virou "luz do item na mão": qualquer item com
`heldLightFor()` ilumina, com **cor, alcance, tremor e ponto de encaixe** da
tabela. A lanterna (bloco do T2) é mais firme e alcança 9 blocos (a tocha, 7):
pó de vaga-lume não tremula como chama. Debaixo d'água nenhuma das duas.

### 3. Nada de recompilar material no meio do jogo

O detalhe que faz essa ideia caber: o Three **recompila todos os materiais
quando a quantidade de luzes da cena muda**. Por isso o pool é fixo, criado no
`init()` **antes** de o mundo compilar seus materiais, e uma fonte que sai de
alcance tem **intensidade 0** — nunca `visible = false` nem `remove()`. Assim o
custo é um shader com 3 point lights desde o primeiro quadro, sem engasgo ao
acender a primeira tocha.

## Testes

`tests/point-lights.test.mjs` (9, tudo puro — sem Three, sem DOM):

- tocha e lanterna iluminam na mão; pedra, tábua, pó (item) e lixo não;
- lanterna alcança mais e tremula menos que a tocha, e o ponto de encaixe fica à
  frente e abaixo do olho;
- intensidade da mão: nunca apaga, não estoura e varia de verdade; lanterna varia
  menos; sem item é zero;
- queda por distância: mais forte de perto, zero na borda do alcance, teto 1,2,
  escala com o nível do bloco;
- escolha: pega as duas mais perto, em ordem, com posição no centro do bloco
  (y + 0,6, onde a chama/pó fica); ignora nível 0, fora de alcance e candidato
  quebrado; sem origem/limite/lista devolve nada; empate mantém a ordem da busca.

## O que ficou de fora

- **Aparição noturna do Mofim**: é a leva 2 deste tema (o bicho só nascer de
  noite e sumir ao amanhecer).
- Sombras (`castShadow`): uma sombra de point light custa seis mapas por fonte —
  fora de cogitação num voxel com milhares de faces.
- Luz real para **toda** tocha do mundo: só valeria para poucas ao mesmo tempo,
  e o pool de 2 já cobre o que está ao redor de quem joga.
