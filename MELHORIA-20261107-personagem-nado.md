# Animação de nado do personagem

Em terceira pessoa, quando se desloca em água funda, o corpo passa suavemente
para a horizontal, com braços e pernas alternando. Ao parar ou sair da água,
retorna suavemente à pose em pé. Água rasa com pés apoiados continua sendo
caminhada; água cobrindo a cabeça permite nado mesmo com os pés apoiados.

A animação usa a amplitude da passada (derivada da distância realmente andada)
para identificar deslocamento, em vez de animar só porque uma tecla foi
apertada. Sua fase é própria e o estado avança uma vez por quadro, também em
primeira pessoa, para a troca de câmera não reiniciar o movimento. Dormir e
morrer limpam a pose; pausa congela a animação. O corpo visual gira em torno do
centro, sem alterar física, colisões, posição dos olhos, fôlego, mira ou controle.
O item continua preso ao braço; golpe é somado à braçada.

Por ser somente visual, o corpo horizontal pode atravessar visualmente paredes ou
margens estreitas: a colisão continua sendo a caixa em pé existente. Não há
animação específica para deslocamento apenas vertical.

## Primeira pessoa

O braço direito visível e o item acompanham a mesma fase do braço direito do
modelo de terceira pessoa, em movimentos leves; a passada anterior é atenuada
durante o nado. Golpe, troca de item e comida continuam se somando ao movimento.
A cena é desenhada com uma câmera visual que sobe e desce até 1,5 cm, sem
inclinar o horizonte. A câmera original continua sendo usada pela mira e pelas
interações, então o pequeno deslocamento visual pode gerar discreta paralaxe,
mas não altera o alcance nem a física. Ao parar ou sair, o movimento desaparece
com a mesma transição suave do corpo. A animação respeita a pausa e a cama.

## Testar no navegador

- [ ] Em terceira pessoa, nadar em água funda; conferir frente, costas e ambos
      os lados, braços/pernas alternados e a ferramenta acompanhando a mão.
- [ ] Parar, voltar a nadar, sair na margem e andar em água rasa; conferir a
      transição suave e ausência de pose horizontal em água rasa apoiado.
- [ ] Mergulhar e subir, agachar, golpear, mudar de câmera, pausar e retomar;
      ver que a física, o alcance, a respiração e os controles não mudaram.
- [ ] Abrir inventário, morrer/renascer e dormir; não ficar preso na pose.
- [ ] Prévia em `tools/personagem-nado.html`: controles de nado/parar/sair e
      giro por arraste; o desenho no topo é um esquema, não uma captura do jogo.

## Testar primeira pessoa

- [ ] Nadar em água funda com a mão vazia, ferramentas, bloco e tocha; conferir
      a braçada e o balanço leve, sem giro do horizonte.
- [ ] Parar, sair, caminhar em água rasa e voltar a nadar; a transição é suave.
- [ ] Cavar, golpear, comer, trocar item e alternar câmeras enquanto nada;
      conferir mira, alcance, pausa, inventário, cama e controles de toque.
- [ ] A prévia `tools/nado-primeira-pessoa.html` mostra um esquema e uma cena
      demonstrativa com os botões Nadar e Parar; validar também no jogo real.
