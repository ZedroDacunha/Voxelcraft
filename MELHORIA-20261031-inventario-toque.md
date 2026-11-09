# Inventário no celular: toque e segurar

- Toque em uma casa pega, coloca, empilha ou troca a pilha usando as mesmas regras do clique esquerdo. Segurar 500 ms pega metade (arredonda para cima) ou coloca uma unidade, usando as regras do botão direito. A saída de craft respeita o rendimento da receita e não é dividida.
- Um aviso informa qual item e quantidade estão sendo segurados; fechar o inventário devolve as pilhas ao inventário como antes. No toque, encostar fora do painel não joga fora a pilha acidentalmente.
- Mover o dedo antes de completar o gesto cancela a ação para permitir rolagem; troca de slot, cancelamento, perda de foco, tela oculta ou fechamento não executam gesto pendente. Um segundo dedo não toma controle da ação. O mouse e teclado conservam as regras anteriores.
- Esta etapa não adiciona arrastar itens nem redimensiona slots. Baú, bancada e forno usam os mesmos gestos e regras já existentes, inclusive restrições de entrada e saída do forno.

## Teste manual pendente
1. Com 9 itens, segurar uma casa: confirmar 5 na mão e 4 no slot. Segurar uma casa vazia para colocar um, tocar outra para colocar o restante.
2. Testar itens iguais/diferentes, itens com durabilidade, pilha cheia, baú, bancada, receita de múltiplas unidades, forno e restrições de combustível/entrada. Fechar com itens no cursor ou na grade.
3. Rolar inventário/receitas, cancelar gesto, tocar fora do painel e usar dois dedos. Confirmar que nada é descartado ou movido sem querer e que botões/X continuam funcionando.
4. Testar em aparelhos reais Android/iOS, paisagem e retrato, além de mouse e teclado. A imagem em `tools/inventario-toque.html` é apenas esquemática.
