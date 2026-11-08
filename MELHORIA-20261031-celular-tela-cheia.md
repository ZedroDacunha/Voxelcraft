# Jogo no celular: tela cheia e orientação horizontal

- Ao iniciar/retomar por toque, pedir tela cheia diretamente no gesto e tentar bloquear em paisagem. Ao pausar, manter o modo; ao sair do mundo, liberar apenas o que o jogo ativou.
- Se a tela cheia ou o bloqueio for recusado/ausente, continuar jogando; em retrato, avisar para girar o aparelho manualmente. iPhone Safari e incorporação em iframe podem não permitir as APIs.
- Reposicionar controles, HUD e chat para as áreas seguras; respeitar layout canhoto. Reaplicar e limitar a posição visual de botões personalizados ao girar sem apagar a posição salva.
- Resolução fixa continua com buffer fixo e recalcula a área visível; tela cheia iniciada pela resolução é transferida ao controle de toque.

## Teste manual em aparelho real
1. Abrir o jogo em retrato, entrar num mundo e tocar em Jogar. Conferir tela cheia e rotação onde disponíveis; se não, girar manualmente.
2. Conferir joystick, botões, hotbar e chat nos dois lados, com notch e barra de gesto, e no layout canhoto. Testar controles personalizados e girar a tela.
3. Pausar e voltar; testar resolução nativa/fixa, inventário, morte/renascimento e saída do mundo. Conferir também sair da tela cheia pelo navegador.
4. Repetir em Android Chrome e iPhone Safari, no navegador e no app instalado, quando disponíveis. Não é possível garantir a orientação nem tela cheia em todos os navegadores.

A imagem em `tools/celular-tela-cheia.html` é esquemática, não é captura da gameplay. Validação em dispositivos reais pendente.
