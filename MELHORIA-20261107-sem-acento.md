# MELHORIA: o acento amarelo sai de todas as ferramentas

- **Data:** 07/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js`, `tests/tool-art.test.mjs`, `tests/art-style.test.mjs`, `GUIA-DE-ARTE.md`

## O problema

Desde o [#122](MELHORIA-20261106-arte-autoral-ferramentas.md) cada ferramenta
levava **um pixel de acento** amarelo, como assinatura da casa. Ele nasceu
cítrico (`#fdf0a8`), foi suavizado para palha (`#ead69e`) na rodada da picareta
([`MELHORIA-20261107-picareta-ajustes.md`](MELHORIA-20261107-picareta-ajustes.md))
— e mesmo assim continuava sendo o pixel mais claro da peça, um ponto aceso nas
pontas.

Decisão de 07/11/2026: **tirar de todas**.

## A mudança

- O símbolo `5` **saiu do alfabeto** — o teste de símbolos recusa qualquer `5`
  numa grade.
- `ACENTO` foi **removido** do módulo, junto com o `5` da paleta completa.
- Nas três grades o pixel do acento voltou a ser o tom do material que estava
  embaixo: `(6,3)` da picareta vira `4`, `(8,2)` do machado vira `1`, e os dois
  pixels da pá viram `4`.

A identidade da família agora é **a cor do material + a forma**, não um pixel
assinatura.

## O que fica travado no teste

- `tests/tool-art.test.mjs`: `SIMBOLOS` não lista mais `5`; o teste "as
  ferramentas são base fiel com ajustes: sem couro e sem acento" confere que
  nenhuma grade tem `5`.
- `tests/art-style.test.mjs`: saiu o teste do acento da casa e entrou **"as
  ferramentas não têm acento"**, que varre os pixels e recusa tanto o palha
  `(234,214,158)` quanto o cítrico antigo `(253,240,168)`.
