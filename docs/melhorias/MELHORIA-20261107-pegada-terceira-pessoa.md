# Ferramenta na mão — terceira pessoa

Picareta, machado, pá e tesoura agora têm uma pose própria na terceira pessoa.
O sprite gira em torno da empunhadura, com a cabeça projetada à frente do braço,
e acompanha a passada e os golpes. A ferramenta usa a arte já aprovada do jogo;
nenhuma textura de terceiros foi incorporada. Blocos, camas e outros itens mantêm
suas posições anteriores. A primeira pessoa não foi alterada.

A referência de pose é a transformação `thirdperson_righthand` do modelo
`handheld` da versão 1.21.4: rotação `[0, -90, 55]` e escala 0,85. A
conversão para as coordenadas e dimensões próprias do personagem é aproximada:
serve como ponto de partida para conferência visual, não garantia de identidade
pixel a pixel. Fonte: https://github.com/InventivetalentDev/minecraft-assets/blob/1.21.4/assets/minecraft/models/item/handheld.json

## Conferir no navegador

- Usar V para ver o personagem pela frente e pelas costas; segurar picareta,
  machado, pá e tesoura e verificar cabo, ângulo, escala e contato com a mão.
- Andar, correr, agachar, cavar e bater; a ferramenta deve acompanhar o braço.
- Trocar entre ferramenta, bloco, comida, tocha e cama e para um slot vazio;
  demais itens e primeira pessoa devem continuar como antes.
- Prévia comparativa: `tools/terceira-pessoa-ferramentas.html` (referência
  enviada embutida, personagem e ferramentas do jogo em 3D girável).
