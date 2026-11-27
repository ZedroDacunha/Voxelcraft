# BUG: HUD e inventário cortavam em telas pequenas

- **Data:** 31/10/2026
- **Status:** corrigido
- **Arquivos principais:** `styles.css`, `inventory.css`, `inventory-layout.js`, `game.js`

## Sintoma

Em viewport de 390×844, a página chegava a medir `innerWidth=433` por overflow,
a hotbar tinha 476 px de largura e começava em `left=-43`. O diálogo de criar
mundo também ficava mais largo que a viewport útil. O inventário usava 9 colunas
fixas de 44 px, sem caber confortavelmente em telas estreitas.

## Correção

- Variáveis CSS responsivas para slot da HUD, slot do inventário, gaps e ícones
  de vida/fome/fôlego.
- Hotbar e grades do inventário deixaram de usar largura fixa de 48/44 px.
- `inventory-layout.js` gera o template da grade de criação usando a variável
  responsiva de slot.
- Painel do inventário usa altura máxima em `dvh` e rolagem vertical.
- Diálogos de mundo usam `border-box`, largura limitada pela viewport e ações
  com quebra de linha.
- A HUD inferior fica oculta enquanto a tela inicial ou a seleção de mundos
  está ativa.

Esta correção trata apenas do layout. Controles de toque/joystick não fazem
parte deste módulo.

## Validação

```bash
node --test tests/*.test.mjs
node tools/stamp-importmap.mjs --check
git diff --check
```

Resultado: 110 testes aprovados.

Verificação em navegador headless:

| Viewport | `scrollWidth` / `clientWidth` | Hotbar | Diálogo criar mundo | Painel inventário |
| --- | --- | --- | --- | --- |
| 360×844 | 360 / 360 | 344 px, dentro da tela | 328 px, dentro da tela | `scrollWidth=clientWidth=330` |
| 390×844 | 390 / 390 | 374 px, dentro da tela | 358 px, dentro da tela | `scrollWidth=clientWidth=360` |
| 768×844 | 768 / 768 | 476 px, dentro da tela | 420 px, dentro da tela | `scrollWidth=clientWidth=554` |

Botões essenciais de título, diálogo, pausa e inventário permaneceram visíveis
e dentro da viewport. Nenhum erro de página foi registrado.
