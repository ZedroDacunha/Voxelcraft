# Maçã 3D e animação completa de comer (1ª/3ª pessoa, mordidas e som)

A maçã aparecia como sprite 2D chapado tanto caída no chão quanto na mão do
jogador, e a ação de comer apenas sacudia o braço em primeira pessoa sem
movimento em terceira pessoa, sem desgaste visual da fruta e sem som.

Agora a maçã e o ato de comer funcionam de ponta a ponta:

- **Modelo 3D voxel da maçã (`world-apple-model.js`)**: geometria em blocos
  clássicos escalonados com covinha no topo, cabinho em dois tons e folha em
  três degraus, vestida com mapa pixel-art contínuo 12×12 (`APPLE_SKIN_T3`)
  na mesma paleta de 12 cores do ícone 2D, compartilhada entre a maçã caída
  no mundo (`DROP_APPLE_SCALE`) e a segurada nas mãos.
- **Mordidas progressivas 3D e farelos (`createProgressiveAppleModel`,
  `setAppleBiteStage`, `createAppleCrumbSystem`)**: quatro estágios visuais
  (`0` intacta → `1` primeira mordida → `2` mordida funda com sementes →
  `3` miolo fino → `4` consumida) com polpa cremosa, casquinha na borda do
  corte e partículas voxel recicladas a cada mordida.
- **Animação sincronizada em 1ª e 3ª pessoa (`player-eat-animation.js`,
  `player-held-item.js`, `game.js`)**: ciclo calmo de `1,54 s` com giro
  progressivo no punho entre as mordidas e leve aceno visual na câmera em 1ª
  pessoa; em 3ª pessoa, ombro + cotovelo em dobradiça pura (`elbows[1].x`,
  preservando o alinhamento da manga quadrada) levam a maçã até a altura da
  boca com aceno da cabeça e sobreposição suave sobre a caminhada.
- **Sons sintetizados em WebAudio (`world-audio.js`)**: `'eat-crunch'`
  (mordida crocante da maçã com progressão sutil de tom até o miolo),
  `'eat-chew'` (mastigação macia para carnes) e `'eat-swallow'` ao engolir.

Estudos visuais: `tools/maca-3d-exemplos.html` e
`tools/maca-animacao-comer.html`. Testes automatizados:
`tests/apple-eat-animation.test.mjs` e `tests/audio-ui.test.mjs`. Importmap
recarimbado com `node tools/stamp-importmap.mjs`.
