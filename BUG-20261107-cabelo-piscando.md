# Cabelo piscando em terceira pessoa

O topo da cabeça e o topo do cabelo estavam exatamente no mesmo plano. Além
disso, as caixas do cabelo se atravessavam. A disputa no buffer de profundidade
(z-fighting) podia produzir listras piscando ao mover a câmera.

A pele agora termina discretamente abaixo do cabelo. O topo cobre a cabeça, e
as partes laterais e traseira se encontram sem atravessar umas às outras. A
altura total de 1,8 bloco e as cores permanecem iguais. O teste do modelo verifica
a separação da superfície superior e a ausência de sobreposição entre peças.

## Conferência no navegador

- Entrar no mundo, apertar V e olhar a cabeça por cima, atrás e pelos lados.
- Mover a câmera e o personagem devagar e conferir se não aparecem listras
  piscando. Repetir andando e agachando, em diferentes distâncias.
- Conferir a prévia `tools/personagem-modelo.html`, inclusive frente e costas.
