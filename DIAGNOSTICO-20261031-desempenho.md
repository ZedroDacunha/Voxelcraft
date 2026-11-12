# Diagnóstico de desempenho: primeiro passo

Este PR não promete ganho de FPS: adiciona uma amostra ao painel F3 existente para orientar melhorias posteriores. Não envia nem salva dados. No computador, use F3 ou Opções → Gráficos → Diagnóstico; no celular, use a opção de diagnóstico depois de entrar no mundo. A amostra só é coletada com painel aberto, mundo rodando e aba visível. Desligar e ligar o diagnóstico reinicia a amostra; pausas e retornos da aba não entram como engasgos.

## Como comparar

1. Use a mesma versão, aparelho, navegador, mundo, posição, horário e configurações gráficas. Anote também resolução/escala manual ou automática e se o aparelho está carregando ou quente. Evite outros aplicativos pesados.
2. Entre no mundo, aguarde o carregamento, ligue o diagnóstico, desligue e ligue novamente para reiniciar. Espere até 600 quadros; anote o tempo da amostra e seus valores. Amostras curtas são menos confiáveis.
3. Faça três repetições de cada cenário: parado olhando na mesma direção; andando pelo mesmo caminho para carregar chunks; quebrando e colocando os mesmos blocos; abrindo/fechando inventário ou salvando. Para comparar, desligue e ligue o diagnóstico antes de cada trecho. Inventário/pausa não são medidos enquanto o mundo estiver parado: observe-os separadamente.
4. Registre FPS médio, p95 (intervalo de quadro em ms abaixo do qual ficam 95% dos quadros; menor é melhor), quantidade de intervalos acima de 50 ms, tempo da amostra, filas de geração/malha, CPU/quadro, malha/luz, último save e desenho. Anote situações de travamento e se a escala automática mudou.
5. Compare apenas cenários e amostras semelhantes. FPS médio sozinho esconde engasgos; >50 ms é um limite de referência, não diagnóstico da causa. O tempo entre quadros inclui espera e agendamento, não é medição direta de GPU; CPU/quadro é tempo medido na execução do quadro, não uso total de CPU. Um último save não significa que todo o tempo dele travou a tela.
6. No celular, pause, entre em Opções → Gráficos e ligue Diagnóstico; volte ao jogo para começar a coleta. O resumo compacto omite alguns dados do painel completo no computador. Testar aparelhos reais continua necessário.

A janela é dos últimos 600 intervalos válidos, portanto sua duração varia com FPS; não compara sessões inteiras nem garante reprodução exata. Os valores mostrados são exemplos fictícios. Nenhuma medição real ou melhoria de desempenho foi comprovada neste PR.
