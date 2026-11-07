# Ferramenta na mão — primeira pessoa

Picareta, machado, pá e tesoura recebem uma pose de primeira pessoa que gira em
torno da empunhadura. A cabeça aponta para cima na tela, e o cabo encontra
aproximadamente a ponta da mão. Após o print mostrando a picareta deitada, a rotação foi corrigida considerando
o braço e a projeção da câmera. A referência enviada pelo jogador orientou a
pose; a arte continua sendo a própria do Voxelcraft e a adaptação precisa de
validação visual, não é uma promessa de identidade exata.

A posição é configurada em `world-first-person-tool.js`; a animação de passada,
golpe e quebra continua no braço existente. A terceira pessoa conserva sua
própria transformação. Blocos, cama, tocha e demais itens não foram alterados.

## Testar no navegador

- Selecionar picareta, machado, pá e tesoura em primeira pessoa, de materiais
  diferentes. Conferir encaixe do cabo, ângulo e tamanho sem obstruir a mira.
- Caminhar, cavar, golpear e trocar de slot; observar a mão e a ferramenta.
- Conferir cama, bloco, tocha e mão vazia; alternar terceira pessoa para
  garantir que continua como antes.
- A prévia `tools/primeira-pessoa-ferramentas.html` mostra o braço e as
  ferramentas, com um botão de golpe e a imagem de referência embutida.
