# Carne de ovelha (crua e assada): ícone pixel art, modelo 3D e animação de comer

A carne de ovelha (`MUTTON` = 100 e `COOKED_MUTTON` = 101) usava um sprite
elíptico chapado sem volume 3D nem desgaste visual ao comer.

Agora toda a experiência visual e interativa da carne de ovelha funciona de
ponta a ponta:

- **Ícone 2D pixel art 16×16 (`world-meats.js`, `world-textures.js`)**:
  redesenhado na Opção B (*Costela Rústica em Gota*) com espessura 3D inferior,
  capa de gordura dorsal, marmoreio interno, osso marfim e contorno tingido; a
  versão assada preserva exatamente a mesma silhueta, com crosta dourada de
  Maillard, gordura caramelizada e marcas de grelha diagonais.
- **Modelo 3D voxelizado e mordidas progressivas (`world-mutton-model.js`,
  `game.js`)**: geometria compartilhada entre crua e assada (11 fatias
  chanfradas em 3 camadas + costela curvada octogonal), exibida em 3D tanto
  dropada no chão (`DROP_MUTTON_SCALE`) quanto segurada na mão pelo cabo do
  osso com a carne apontada para cima e 4 estágios progressivos de mordida de
  cima para baixo até restar o osso roído antes de engolir.
- **Animação em 1ª e 3ª pessoa, migalhas e som (`player-eat-animation.js`,
  `player-held-item.js`, `game.js`)**: em 1ª pessoa leva a carne à altura da
  boca sem obstruir a mira central (`+`), compensando a altura conforme a carne
  encolhe rumo ao osso; em 3ª pessoa mantém afastamento limpo da manga em
  repouso e alinha o topo da carne (inclusive o osso roído no estágio 3) à boca
  com dobradiça pura no cotovelo, disparando migalhas voxelizadas na paleta
  correspondente (assada ou crua) sincronizadas com `eat-chew` e `eat-swallow`.

Estudos visuais: `tools/carne-ovelha-icone.html`,
`tools/carne-ovelha-3d-exemplos.html` e
`tools/carne-ovelha-animacao-comer.html`. Testes automatizados:
`tests/mutton-3d-eat.test.mjs` e `tests/meat.test.mjs`. Importmap recarimbado
com `node tools/stamp-importmap.mjs`.
