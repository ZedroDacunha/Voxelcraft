---
type: bug-report
status: resolvido
component:
  - "[[Grama alta]]"
  - "[[Renderização de chunks]]"
tags:
  - bug-report
  - voxel
  - threejs
  - grama
---

# Grama alta suspensa e com contorno escuro

## 📌 Contexto e Sintomas

Algumas instâncias continuaram parecendo suspensas mesmo após a primeira checagem de suporte. A textura também tinha um contorno quase preto que contrastava com o topo verde do terreno e acentuava a impressão de que o tufo estava separado do chão.

## 🔍 Causa Raiz

As instâncias usam a altura da célula `TALL_GRASS` como origem. A validação anterior não corrigia posições persistidas até dois blocos acima do piso. O atlas exigia recortes UV e margens diferentes para cada silhueta, e os PNGs recebidos tinham o quadriculado gravado nos pixels em vez de alpha transparente.

## 🛠️ Solução Aplicada (Antes e Depois)

**Antes:** as três alturas compartilhavam um atlas com recortes UV e margens diferentes; o quadriculado dos arquivos de origem era RGB opaco.

**Depois:** cada altura usa seu próprio PNG transparente, aparado com margem de quatro pixels, mantendo os pixels do tufo intactos. A geometria usa a proporção do arquivo correspondente. O código também procura um bloco sólido até dois voxels abaixo e move gramas antigas para logo acima do piso; sem suporte próximo, remove a planta. A base entra levemente no chão para evitar frestas.

Verificação realizada: `node --check game.js` e `git diff --check` passaram.

## 🤖 Regra de Evolução para a IA

> Ao corrigir vegetação que parece suspensa, confira a posição do voxel e os limites alfa do sprite separadamente; use arquivos individuais com fundo realmente transparente, reancore células antigas no piso sólido e nunca trate um quadriculado RGB como transparência real.
