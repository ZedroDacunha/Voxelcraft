# MELHORIA: a textura da porta

- **Data:** 05/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-textures.js`, `tests/door-texture.test.mjs`

## Antes

A porta de carvalho é um bloco de **dois** voxels, desenhado em duas células do
atlas (`WOOD_DOOR_LOWER` e `WOOD_DOOR_UPPER`). Cada célula era pintada sozinha,
como se fosse um bloco independente — e o resultado tinha cinco problemas:

| Problema | O que se via |
| --- | --- |
| Costura | cada metade pintava a própria borda de 2 px, então no meio da porta aparecia uma faixa escura de **4 px**: a porta lia como dois blocos empilhados |
| Grão manchado | ruído por célula de 3×5 px com ±8 de amplitude; em tamanho de jogo virava mancha de sujeira, não madeira |
| Painéis desalinhados | o de cima tinha 10 px de altura (y 6–15) e o de baixo 8 px, colado no pé (y 20–27), com 4 px vazios no meio — parecia um capacho dentro de uma moldura |
| Maçaneta chapada | 3×3 de dourado puro, sem luz nem sombra, no terço de baixo |
| Nada dizia "porta" | sem dobradiças e sem batente, de longe era um retângulo de madeira |

## Depois

A arte passou a ser desenhada na **folha inteira** (32×64) e só então recortada
nas metades: `upper` usa as linhas 0–31, `lower` usa 32–63. Todo o desenho é
calculado numa coordenada só (`gy`), então o que está em cima continua embaixo
sem emenda — inclusive a maçaneta, que chega até a linha da junção.

O desenho escolhido (entre cinco propostas renderizadas e comparadas antes de
codar) junta três ideias: **batente com dobradiças**, **painéis em relevo** e o
**vão da janelinha** da metade de cima, sem vidro. Tudo na mesma madeira clara do
carvalho — a moldura não é marrom escuro, é a mesma madeira com um vinco.

- **Batente** de 2 px: borda de fora em `−46` de tom e vinco de luz em `+22` por
  dentro. O degrau é maior que o do veio de propósito: com pouco contraste o
  vinco sumia no ruído da madeira.
- **Dois painéis rebaixados**, um por metade, simétricos: borda escurecida,
  sombra por dentro em cima/à esquerda e luz embaixo/à direita (luz do sol vem
  de cima). O miolo é mais escuro que a prancha, que é o que dá a leitura de
  "rebaixado".
- **Dobradiças de ferro** (chapa de 6×3 com brilho na ponta e dois cravos) nas
  duas metades, coladas na borda esquerda — é o que faz o bloco se ler como porta
  mesmo a 16 px de distância.
- **Maçaneta** dourada na altura da mão (linhas 29–31), com luz em cima à
  esquerda e sombra embaixo à direita, do lado oposto às dobradiças.
- **Veio curto** entre os painéis (duas colunas, ±10 de tom) e grão mais calmo
  (±8 em vez de ±11): a madeira não fica chapada nem vira mancha.

## Validação

```bash
npm test        # 781 testes (7 novos em tests/door-texture.test.mjs)
npm run check   # sintaxe + importmap em dia
```

O teste novo lê a arte **do atlas de verdade** (canvas de mentira que grava os
`fillRect`), empilha as duas metades numa folha de 32×64 — que é como o jogador
vê a porta — e cobra o que o desenho promete:

- nenhum pixel ainda é o magenta do fallback;
- a junção (linhas 31/32) é madeira como o resto: nenhum pixel escuro, mesmo tom
  nas duas linhas e nenhum salto de tom coluna por coluna (fora as colunas da
  maçaneta);
- batente mais escuro na borda de fora, vinco mais claro por dentro;
- os dois painéis têm sombra, luz e miolo rebaixado, iguais nas duas metades;
- dobradiças de ferro à esquerda nas duas metades, e madeira do lado direito;
- maçaneta dourada com brilho, corpo e sombra, longe das dobradiças.

Com a arte antiga, 4 dos 7 casos falham (conferido trocando o arquivo) — o teste
não é um selo que sempre passa.

## Limitações conhecidas

- A comparação é feita **na arte**, não na tela: nada aqui garante como a porta
  fica com a luz do mundo no shader. A conferência visual está em
  [TESTE-EM-NAVEGADOR.md](TESTE-EM-NAVEGADOR.md) §22.
- A porta giratória (aberta) usa as mesmas duas células: a face de frente é a
  mesma arte, então o painel aberto fica com a metade correspondente do desenho.
  Não foi criada arte própria para o estado aberto.
- O ícone da porta no inventário reusa `block.tiles.front` (a metade de baixo),
  como antes — com batente e painel agora, mas ainda sem a porta inteira.
- A maçaneta está na metade de **cima** da folha (linhas 29–31, encostada na
  junção) porque a altura da mão é o meio da porta. Se a porta for colocada com
  o bloco de cima faltando (não acontece pelo jogo), a maçaneta fica no bloco de
  baixo.
