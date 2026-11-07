# Personagem — parte 2: terceira pessoa

A tecla **V** percorre primeira pessoa (padrão), terceira pessoa pelas costas
e terceira pessoa pela frente, voltando então à primeira pessoa. No toque, o botão de ícone de câmera faz a mesma troca e pode ser
reposicionado nas opções de controles. A mão de primeira pessoa fica oculta na
terceira pessoa. Ao dormir, a visão da cama tem prioridade.

A câmera de interação permanece nos olhos do jogador: movimento, alcance,
mineração, uso e golpes continuam partindo da mesma posição. A câmera visual
recuada segue a mesma direção e se aproxima ao encontrar blocos sólidos; perto
demais, o modelo desaparece para não preencher a tela. Na vista pelas costas, a mira por toque parte dos olhos em direção ao ponto visto
sob o dedo. Na vista frontal, a câmera olha na direção oposta à do jogador: as
ações continuam na direção do olhar do personagem e a mira central é ocultada.
Para mirar com precisão, volte à visão pelas costas ou à primeira pessoa. O modelo acompanha a
posição e o olhar, reduz a altura ao agachar e usa a fase da passada para
movimentar braços e pernas; o braço direito também reage ao golpe.

Não há ainda exibição no inventário, modelo de item na mão de terceira pessoa,
animação própria para dormir/nadar ou suporte a multiplayer.

## Roteiro manual

- [ ] Num mundo, apertar V: costas → frente → primeira pessoa; F5 permanece recarregar.
- [ ] Andar, correr, pular e agachar; observar a posição e as pernas.
- [ ] Tentar cavar, colocar blocos e golpear perto do alcance nas duas visões.
- [ ] Encostar em uma parede atrás e depois à frente, e entrar num espaço apertado: a câmera não
      deve atravessar a parede e a primeira pessoa deve continuar utilizável.
- [ ] No toque, alternar pelo botão de câmera, usar o dedo na tela e mover o
      botão no editor de posições; pausar e voltar.
- [ ] Dormir e acordar; abrir inventário e fechar; testar proporções/resolução.

Os testes automatizados cobrem a distância da câmera, a fase dos membros e o
contrato do botão; o roteiro acima depende de validação no navegador.
