# MELHORIA: o minério senta na pedra de verdade

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-textures.js`, `world-mineral-textures.js`, `tests/ore-textures.test.mjs`

## O pedido

"Podemos trabalhar nas texturas dos minérios — está muito genérico. Use de base
para a pedra a nova textura feita da pedra; ainda está a antiga."

## O problema

O bloco de pedra tinha a textura de sempre (estratos, grão e respingos), mas o
**fundo dos minérios** era outro desenho: um cinza chapado com um ruído próprio,
feito dentro de `createMineralOrePixel`. Encostado num bloco de pedra, o minério
parecia **outro material com pintinhas** — a pedra em volta e a pedra de trás não
combinavam.

## O que mudou

| Antes | Depois |
| --- | --- |
| a pedra era desenhada dentro do `switch` do atlas | virou `stonePixel(x, y, alt)`, uma função só |
| o minério desenhava um cinza liso por conta própria | o fundo do minério **é** `stonePixel` — o mesmo pixel da pedra |
| a arte dos tiles só existia dentro de `createAtlasTexture` (precisa de canvas) | `createTilePixelSource()` devolve a arte **pura** (tile, x, y) → RGBA |

Com isso: mudar a pedra muda o fundo de **todo** minério junto (carvão, cobre,
ferro, ouro, diamante), e dá para olhar um pixel sem abrir o jogo.

## Provas

- **977** testes na suíte (6 novos em `tests/ore-textures.test.mjs`).
  - o bloco de pedra e a variante (`STONE_ALT`) saem da mesma `stonePixel`;
  - **todo** pixel de fundo de cada um dos cinco minérios é **idêntico** à pedra;
  - o fundo mantém a média (~124) e o grão da pedra (desvio > 4), ou seja, não é
    mais o cinza chapado;
  - cada minério tem a sua paleta (carvão escuro, ouro claro, diamante claro);
  - nada estoura a faixa 0–255.
- **Prova de força**: voltando o fundo antigo (`116 + ruído`), 3 dos 6 testes
  caem.

## Próximo passo

Os veios de cada minério, um por vez — começando pelo **carvão**, com opções
A–E para escolher (comparador em `preview/carvao.html`).
