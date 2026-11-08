# Hotbar no celular

- Em paisagem, quando há espaço suficiente, a hotbar fica centralizada junto à borda inferior e usa casas de até 38px; vida, fome e fôlego acompanham o tamanho.
- O espaço é calculado a partir da posição real do joystick e dos quatro botões de ação, incluindo modo canhoto, escala e posições personalizadas. A posição é recalculada ao girar ou editar os controles.
- Com espaço insuficiente para nove casas de 28px, controles no centro ou tela em retrato, preserva o HUD elevado para não sobrepor os controles. A área segura inferior é respeitada. Computador não muda.

## Teste manual pendente
1. Em um celular em paisagem, conferir hotbar próxima da borda, centralizada e tocável; selecionar as nove casas, com itens e quantidades.
2. Verificar vida, fome e fôlego, também debaixo d'água; experimentar chat, pausa e inventário.
3. Testar destro/canhoto e escalas dos botões, inclusive posições personalizadas, e girar o aparelho. Em telas estreitas confirmar fallback elevado sem esconder controles.
4. Conferir notch e barra de gestos em aparelho real. A imagem `tools/hotbar-celular.html` é ilustrativa, não é captura de tela.
