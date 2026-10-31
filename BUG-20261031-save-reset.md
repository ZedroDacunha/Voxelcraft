# BUG: save apagava ao reentrar no mundo com `?reset` na URL

**Data:** 31/10/2026  
**Status:** corrigido  
**Arquivos principais:** `world-save-reset.js`, `world-save-loader.js`, `game.js`

## Sintoma

Depois de abrir o jogo com `?reset`, voltar ao menu e entrar novamente no mesmo
mundo apagava o progresso outra vez. O jogador perdia blocos colocados,
inventário e estado do mundo sem pedir um novo reset.

## Causa

`game.js` lia `new URLSearchParams(location.search).has('reset')` a cada
`loadGame()`. O menu volta ao jogo com `location.reload()`, preservando a query
string. Assim, o mesmo `?reset` era reaplicado em toda entrada.

## Correção

- `world-save-reset.js` concentra a política de reset:
  - remove o parâmetro `reset` da URL antes de apagar qualquer coisa;
  - preserva os demais parâmetros e o fragmento;
  - exige confirmação explícita com nome e seed do mundo;
  - bloqueia o reset se não conseguir limpar a URL ou se a confirmação falhar.
- `world-save-loader.js` avalia essa política uma única vez por carregamento de
  página e entrega ao `saveManager` apenas um booleano já confirmado.
- `game.js` deixou de ler `?reset` diretamente e passou a usar o loader modular.

## Regressão coberta

`tests/save-reset.test.mjs` cobre:

- ausência de `reset`;
- confirmação e cancelamento;
- preservação de outras queries e do fragmento;
- falha ao limpar a URL;
- falha no diálogo de confirmação;
- segunda entrada no mundo sem novo reset;
- `reset` reintroduzido na mesma página sem novo efeito;
- integração estática de `game.js` com o loader.

## Validação

```bash
node --test tests/*.test.mjs
node tools/stamp-importmap.mjs --check
git diff --check
```

Resultado: 74 testes aprovados.
