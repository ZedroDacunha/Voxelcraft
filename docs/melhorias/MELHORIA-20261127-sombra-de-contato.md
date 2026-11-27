# MELHORIA: Sombra de contato sob criaturas e jogador

- **Data:** 27/11/2026 (depois do [anti-bandas](MELHORIA-20261127-antibandas-de-luz.md))
- **Status:** implementado
- **Arquivos:** `world-contact-shadows.js` (novo), `game.js`,
  `tests/contact-shadows.test.mjs` (novo), `index.html` (carimbo de importmap)

## Por que

As criaturas do mundo são **caixas** sobre o chão, e o jogo não tem nenhuma
sombra que lasque o chão sob elas: o bicho parece estar flutuando uns
centímetros acima do terreno, especialmente em primeira pessoa, onde não
se vê o corpo do jogador e a falta de "chão" fica mais evidente. Um
elemento de luz faltando no chão é a referência mais forte de que
algo está **apoiado** nele — e é a mais barata que existe.

## Antes

Nenhum blob de sombra: ovelha, zumbi e jogador (em terceira pessoa)
deslizavam sobre o chão sem nenhuma marca no terreno.

## Depois

Novo sistema `world-contact-shadows.js` com um **pool fixo de blobs**
(16, suficiente para o limite de criaturas do jogo + o jogador):

- Cada blob é um **plano deitado** com uma **textura radial** (canvas:
  opaca no centro, suave até sumir na borda) e material semitransparente
  escuro, com `depthWrite: false` — o blob não escreve profundidade, então
  ele não esconde o que está por trás dele (o chão/céu atrás aparece
  normalmente);
- O blob **acompanha o chão**, não a criatura: ele fica em `y + 0.02`
  (levantamento para evitar z-fighting com a face do bloco) e **não
  acompanha o salto** — a criatura pula sobre o próprio blob, que
  permanece no chão;
- O pool é criado com o mundo, e o `update()` só **posiciona** blobs a
  cada quadro — o mesmo princípio do pool de PointLights das tochas
  (mudar a quantidade depois faria o Three remontá-los);
- **Alvos**: ovelha, zumbi e o **jogador em terceira pessoa**. O
  **Mofim** flutua e não toca o chão, então não ganha blob; o jogador
  **mergulhado** também não (a água cobre o chão). Criaturas caídas
  (`dying`) não ganham blob.

Os tamanhos e opacidades são de arte: ovelha 0,75 de raio / 0,4 de
opacidade; zumbi 0,8 / 0,42; jogador 0,85 / 0,45.

## Custo

Quase zero. O pool é criado uma vez; a cada quadro, só se posicionam
até 16 planos (atribuições de posição/escala/opacidade) — sem ray
tracing, sem shadow map, sem passe de render, sem recompilar shader.
Os blobs são objetos simples com material `MeshBasicMaterial`.

## Validação

- `npm test` — **1465 testes, 0 falhas** (4 novos em
  `tests/contact-shadows.test.mjs`: o pool nasce com a quantidade e
  todos escondidos; o `update()` posiciona blobs e os livres somem;
  alvos além do pool são ignorados; opacidade zero e lista vazia limpam);
- `npm run check` — sintaxe em dia, importmap carimbado;
- No navegador: seção 79 do `TESTE-EM-NAVEGADOR.md` (ovelha e zumbi com
  blob no chão, jogador em terceira pessoa, salto, Mofim sem blob).

## Limitações conhecidas

- **Não é uma sombra de verdade**: é um plano plano no chão. De lado,
  o blob some (é um plano); de cima, é o que se vê no jogo. É o
  compromisso de custo zero — o jogo não faz shadow map (justamente
  por custar um passe e artefatos em voxel);
- O blob **não segue a forma do corpo**, é um círculo: em bichos
  alongados (ovelha comprida) ele é uma aproximação;
- O blob não é afetado pela **hora do dia**: é um quadrado de luz
  faltando, não uma sombra de luz direcional. Isso é de propósito —
  ele representa a oclusão da luz difusa, e sua opacidade é fixa;
- **Não há opt-out**: o custo é mínimo e o benefício é de qualidade de
  imagem, não de jogabilidade.
