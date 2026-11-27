---
type: bug-report
status: resolvido
component:
  - "[[world-graphics-quality.js]]"
  - "[[Qualidade gráfica]]"
tags:
  - bug
  - fps
  - gráficos
  - desempenho
---

# Qualidade automática restaurava a escala máxima após queda de FPS

## 📌 Contexto e Sintomas

O modo automático podia voltar à escala máxima mesmo com FPS baixo, aumentando o custo da GPU e a sensação de atraso nos controles.

## 🔍 Causa Raiz

Depois de três reduções de escala sem ganho de FPS, a lógica desligava o modo automático e chamava `setScale(state.max)`. Isso descartava a escala mais baixa encontrada e podia piorar a fluidez.

## 🛠️ Solução Aplicada (Antes e Depois)

**Antes:** após três comparações sem ganho, o modo automático era desligado e a escala máxima era restaurada. A redução inicial também exigia três amostras consecutivas de FPS baixo.

**Depois:** o modo automático mantém a escala alcançada quando conclui que reduzir resolução não trouxe ganho, e começa a reduzir após duas amostras consecutivas de FPS baixo.

## 🤖 Regra de Evolução para a IA

> Ao adaptar qualidade gráfica, nunca restaure a escala máxima após detectar que a GPU não ganhou FPS com mudanças de resolução; preserve a configuração mais fluida já alcançada.
