# Personagem no inventário

O inventário pessoal (criação 2×2) mostra o mesmo modelo 3D do personagem ao
lado da grade. A prévia é estática e frontal, em pose neutra; não adiciona
customização, equipamento ou animação. Bancada 3×3, baú e forno conservam seus
layouts sem o retrato.

A imagem é desenhada ao abrir o inventário, usando o renderer WebGL existente e
um alvo temporário; os pixels são copiados para um canvas 2D e os recursos 3D
liberados. Assim não há outro contexto WebGL nem renderização a cada quadro. Se
a prévia falhar, ela é ocultada e o inventário permanece utilizável.

## Teste no navegador

- Abrir o inventário com E e pelo toque: o personagem aparece junto à criação
  2×2; seus slots, receita e livro continuam utilizáveis.
- Abrir e fechar várias vezes; conferir também em tela pequena, com rolagem,
  teclado, toque e livro de receitas aberto.
- Abrir bancada, forno e baú: layouts e operações continuam como antes, sem o
  retrato. Conferir que voltar ao inventário pessoal exibe o personagem.
- Conferir primeiro/terceira pessoa, morte/renascimento e posição livre dos
  controles de toque; abrir o inventário não deve alterar a câmera do mundo.
