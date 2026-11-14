# Cabelo independente no personagem

Adiciona ao pivô da cabeça a peça 3D aprovada em prévia, com formato em blocos e tons de marrom escuro. A peça possui sua própria geometria e material, podendo ser separada do modelo em etapas futuras; não é item de inventário nem implementa customização. O corpo, o rosto, a roupa e a primeira pessoa não mudam.

A malha é construída pela união de cubos, sem faces internas entre células vizinhas; recursos são liberados com o modelo. O personagem aparece com cabelo na terceira pessoa e na prévia do inventário. `tools/cabelo-no-personagem.html` mostra o modelo real em um visualizador; a referência está em `tools/referencia-personagem-aventureiro.png`. As costas são interpretação, não uma vista disponível na referência.

## Avaliação manual pendente
- Girar a prévia e o personagem no inventário para examinar topo, franja, laterais e nuca; conferir se há lacunas, superfícies piscando ou sobreposição com a cabeça.
- Testar câmeras de costas e de frente, caminhada, nado, distintas iluminações e uso em celular, inclusive desempenho ao girar a prévia.
- Conferir que abrir/fechar o inventário repetidamente não prejudica o jogo. Os testes automáticos não substituem inspeção visual.
