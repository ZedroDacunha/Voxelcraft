---
type: bug-report
status: resolvido
component:
  - "[[Texturas de grama]]"
  - "[[Cache de assets]]"
tags:
  - bug
  - grama
  - cache
  - assets
---

# Textura de grama não atualizava após trocar os PNGs

## 📌 Contexto e Sintomas

As imagens das texturas de grama foram substituídas no projeto, mas o navegador continuava mostrando a versão anterior mesmo depois de atualizar a página.

## 🔍 Causa Raiz

Os PNGs mantiveram os mesmos caminhos e a versão de cache das URLs continuava em `20261029-4`. Assim, o navegador podia reutilizar respostas antigas. O módulo do jogo também é carregado com `import()` dinâmico, que pode permanecer na memória da aba.

## 🛠️ Solução Aplicada (Antes e Depois)

**Antes:** a entrada do menu, o módulo do jogo e as texturas de grama usavam `20261029-4`.

**Depois:** avancei as versões da entrada do menu, do módulo do jogo e das URLs dos PNGs para `20261029-5`, forçando o navegador a buscar os recursos atualizados.

## 🤖 Regra de Evolução para a IA

> Sempre que substituir um asset mantendo seu caminho, avance a versão de cache em todas as referências relevantes, incluindo a entrada HTML, imports dinâmicos de módulos e URL do próprio asset.
