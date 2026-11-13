# Animação de mineração da picareta

- Para todas as picaretas, durante a mineração contínua, o braço levanta antes do impacto e desce: primeira pessoa e personagem usam a mesma fase e suavização já existentes. Os picos continuam sincronizados com a batida de mineração.
- A pose padrão da ferramenta em repouso é preservada; ataques, uso, mão vazia, machado, pá e tesoura continuam com a animação anterior. A alteração é visual e não muda dureza, drops, durabilidade ou mira. No fim da mineração, o movimento adicional decai junto à animação existente.
- A quebra instantânea ainda usa o golpe genérico porque o laço de mineração pode não aparecer; esta mudança atua na mineração contínua.
- `tools/animacao-picareta.html` é uma ilustração animada esquemática, não o modelo real.

## Avaliação pendente no jogo
1. Testar picaretas de materiais diferentes em pedra, segurar e soltar: checar preparação, impacto, sincronismo do som e retorno suave.
2. Comparar mão, machado e pá; golpear criatura e usar item não devem adotar a animação de mineração.
3. Conferir primeira pessoa e câmeras costas e frente, inclusive andando e nadando, e troca de item durante mineração. Verificar se ferramenta atravessa personagem ou tela, além de mouse e toque.
4. A validação visual e em celular real ainda não foi realizada; as amplitudes podem precisar de ajuste após avaliação.
