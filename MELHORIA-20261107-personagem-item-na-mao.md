# Item na mão do personagem em terceira pessoa

O personagem segura o item selecionado na barra quando visto pela frente ou
pelas costas. O ponto de fixação é filho do braço, então o item acompanha a
passada e o movimento de golpe. Ao selecionar um slot vazio, o item desaparece.

A representação reutiliza as geometrias e materiais já criados para a mão de
primeira pessoa: blocos, sprites, cama 3D e chama da tocha. Os objetos e suas
transformações são separados, portanto a primeira pessoa não muda. Na troca,
o item anterior é apenas removido da cena; os recursos compartilhados não são
liberados indevidamente. A imagem estática do inventário não mostra o item.

## Teste no navegador

- V para terceira pessoa pelas costas e depois pela frente; selecionar bloco,
  ferramenta, alimento, tocha e as três camas; olhar o item junto à mão.
- Andar, correr, agachar e golpear: o item acompanha o braço. Selecionar um
  slot vazio e conferir se desaparece; trocar rapidamente e reabrir inventário.
- Voltar à primeira pessoa e conferir que os itens, a tocha e a cama continuam
  como antes. Experimentar em local iluminado e à noite.

Os testes automatizados cobrem vínculo ao braço, troca, slot vazio, posição de
sprite e compartilhamento de recursos. O posicionamento visual precisa ser
conferido no navegador.
