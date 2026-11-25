# Ícone da maçã redesenhado

O ícone da maçã (`Maçã`, cai das folhas com 6%) era um círculo perfeito de
raio 4,5 com 2 px de brilho e uma folha de 2 px solta — lia como bola, não
como maçã, na barra de itens e no inventário.

Agora é pixel art desenhada na grade 16×16, no mesmo padrão da semente de
trigo e da porta (`world-textures.js`, `spritePixels('apple', 'food')`):

- **dois lobos com a covinha no topo**, sombreada logo abaixo do cabinho;
- **cabinho** de madeira em dois tons saindo da covinha;
- **folha diagonal em três tons** grudada no cabinho;
- **brilho lustroso com halo** (GUIA-DE-ARTE §5): o reflexo (`#fdc2a6`) fica
  1 px para dentro da borda no ombro superior esquerdo, almofadado pelo
  meio-brilho (`#f68062`) e pela luz escarlate quente (`#ea4c3a`), evitando
  um quadrado chapado no canto;
- **sombra curva em meia-lua** em dois níveis: meia-sombra (`#ac1c27`) e
  sombra funda puxando para o vinho frio (`#881422`), abraçando a lateral
  direita e toda a base arredondada;
- **contorno tingido** (`#60101a`), nunca preto puro.

Comparador de evolução (ampliado, 16 px e slot da barra, lendo o sprite direto
do código do jogo): `tools/maca-icone.html`. Teste que trava forma, rampa de
luz/sombra e paleta: `tests/apple-icon.test.mjs`. Os hashes do importmap foram
recarimbados (`npm run stamp`).
