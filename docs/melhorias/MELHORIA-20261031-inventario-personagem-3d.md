# Personagem giratório no inventário

No inventário pessoal, arraste a prévia para girar o modelo 3D no eixo vertical (dedo ou botão esquerdo do mouse). No teclado, Tab até a prévia e setas esquerda/direita para girar. O ângulo inicial volta ao abrir novamente. Forno, baú e bancada continuam sem personagem. Não altera a aparência nem mostra o item segurado.

Reutiliza o renderizador do jogo e desenha apenas ao abrir ou interagir, até uma vez por quadro. Se a renderização falhar, a prévia é escondida e o inventário segue utilizável; arrasto é cancelado ao fechar ou perder foco. O desenho em `tools/inventario-personagem-3d.html` é esquemático; `tools/personagem-modelo.html` permite explorar o modelo 3D.

## Testes manuais pendentes
- Com mouse, arrastar em ambos os sentidos, soltar fora da prévia, trocar para teclado e usar as setas; verificar frente, lado e costas e reabertura.
- No celular, arrastar a prévia, testar dois dedos, cancelar o gesto, fechar e reabrir; conferir que slots e rolagem fora da prévia continuam funcionando.
- Verificar inventário pessoal, bancada, baú e forno, perda de foco, mudança de aba, orientação e desempenho em aparelhos reais.
