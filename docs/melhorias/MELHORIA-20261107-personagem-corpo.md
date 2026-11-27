# Personagem — parte 1: corpo do aventureiro

Primeira etapa isolada: modelo visual humanoide de 1,8 bloco de altura, com
cabeça, tronco, braços e pernas em caixas. A frente aponta para +Z e os pés
ficam em y=0. Os braços têm pivô nos ombros e as pernas nos quadris. O visual
usa uma roupa de aventureiro própria: túnica verde, mangas claras, cinto,
calças escuras e botas. A paleta pode ser passada à criação do modelo e as
instâncias têm materiais independentes, preparando personalizações futuras.

`player-model.js` recebe THREE e retorna as partes e `dispose()` para liberar
geometrias e materiais. O protótipo `tools/personagem-modelo.html` permite girar
o modelo e ver frente, lado e costas. A referência aprovada fica em
`tools/referencia-personagem-aventureiro.html` (imagem embutida).

Este recorte **não** muda a câmera nem coloca o personagem no jogo ou no
inventário. Terceira pessoa, animação, inventário, multiplayer e interface de
customização são etapas futuras separadas.

## Testar

Execute `node tools/serve.mjs 8000` e abra `/tools/personagem-modelo.html`.
Confira as três vistas, o giro por arraste e se roupa e rosto aparecem. Rode
`npm run check` e `npm test` para os testes automatizados.
