# Fechar telas no celular

- Um X acessível no cabeçalho compartilhado fecha inventário, bancada, forno e baú pelo mesmo fluxo de teclado: devolve itens da grade e do cursor, fecha o baú e salva. O cabeçalho continua visível ao rolar.
- O chat tem X para sair sem enviar; o livro de receitas mantém o seu X, ampliado para toque. As opções e outras telas já têm botões de voltar/concluir.
- Tela cheia continua ativa durante inventário e pausa. Se o navegador a tiver encerrado, ao retornar pelo X ou enviar o chat o jogo tenta retomá-la diretamente no gesto. Ao voltar da pausa já há tentativa existente. Nunca impede jogar em navegador sem suporte; não pede a tela cheia sem gesto nem no desktop.

## Testes manuais pendentes
1. No celular, abrir e fechar inventário, bancada, baú e forno; verificar itens na grade e no cursor, fechamento do baú e retorno ao jogo.
2. Rolar a tela com livro de receitas aberto, fechar o livro e fechar inventário. Conferir o X e o teclado virtual em telas pequenas/retrato/paisagem.
3. Abrir chat, fechar sem enviar e enviar mensagem; conferir se o mundo/controles retornam. Testar também mouse/teclado.
4. Testar fullscreen e saída externa da tela cheia em Android Chrome e iPhone Safari. No iPhone Safari ou em iframe as APIs podem estar indisponíveis. A prévia `tools/fechar-inventario-celular.html` é esquemática.
