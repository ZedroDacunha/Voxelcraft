---
type: bug-report
status: resolvido
component:
  - "[[Texturas de grama]]"
  - "[[Carregamento de recursos]]"
tags:
  - bug-report
  - cache
  - threejs
  - texturas
---

# Jogo continuava exibindo textura antiga da grama

## 📌 Contexto e Sintomas

Os PNGs da grama foram substituídos no projeto, mas a imagem no jogo parecia não mudar.

## 🔍 Causa Raiz

O menu carrega `game.js` por `import()` dinâmico, que o navegador mantém carregado uma única vez por aba. Criar outro mundo na mesma sessão não executava novamente a versão atualizada do módulo. Além disso, substituir PNG mantendo os mesmos nomes não distinguia inequivocamente os novos assets de arquivos já armazenados.

## 🛠️ Solução Aplicada (Antes e Depois)

**Antes:** a versão estava nas URLs dos módulos e das texturas, mas as imagens continuavam com os caminhos originais.

**Depois:** renomeei os três arquivos para `tall-grass-*-v2.png`, atualizei os caminhos em `game.js` e versionei a entrada do menu, o `import()` do jogo e as URLs das imagens (`v=20261029-4`). A validação confirmou os três PNGs com alpha transparente. É necessário recarregar a página para descarregar o módulo antigo que já esteja na memória da aba.

Verificação realizada: sintaxe do código, `git diff --check`, dimensões dos assets e alpha transparente. A atualização visual ainda precisa ser confirmada no navegador após recarregar e abrir um mundo.

## 🤖 Regra de Evolução para a IA

> Quando atualizar código carregado por `import()` dinâmico e assets, invalide o cache da entrada, do módulo e das imagens — use nomes novos para os arquivos; criar outro mundo na mesma aba não recarrega módulos JavaScript.
