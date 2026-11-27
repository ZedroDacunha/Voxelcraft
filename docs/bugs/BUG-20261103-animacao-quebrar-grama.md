# BUG: quebrar a grama não mexia o braço

- **Data:** 03/11/2026 (relatado pelo jogador: "quando quebramos a grama
  instantaneamente, o braço não faz a animação de quebrar/bater")
- **Status:** corrigido
- **Arquivos:** `world-hand-animation.js` (novo), `game.js`,
  `tests/mining-animation.test.mjs` (novo)

## Sintoma

Mirar na grama alta e clicar com o botão esquerdo apagava o bloco na hora, sem
nenhum movimento do braço. Parecia que o clique não tinha registrado.

## Causa

O braço tinha **duas** fontes de movimento, e a quebra instantânea não acionava
nenhuma delas:

1. **Laço de mineração** (`handAnim.mining`), que só é alimentado enquanto
   `leftHeld && currentHit`. A grama alta sai pelo caminho antecipado de
   `updateMining()`: quebra no **primeiro quadro** e, em seguida, fazia
   `leftHeld = false` — o laço morria antes de mover um pixel (a suavização de
   `12 * dt` não chega a subir em um quadro só).
2. **Golpe** (`handAnim.punch`), que já existia e era disparado ao colocar bloco
   e ao abrir porta — mas **não** ao quebrar.

Resultado: bloco desaparece, braço parado.

## Correção

- `breakBlock()` dispara `startPunch(handAnim)`. Como **toda** quebra passa por
  ele (grama alta e quebra normal), o golpe agora é consequência de quebrar, não
  de um caminho específico.
- A grama alta deixou de soltar o botão: usa `mining.cooldown = 0.2`, o mesmo
  intervalo de uma quebra normal. Segurando o botão a grama cai no **ritmo do
  braço**, e varrer a mira por um campo corta uma por vez — antes era preciso um
  clique por pé de grama.
- A animação saiu do `game.js` para `world-hand-animation.js` (módulo puro):
  `createHandAnimation()`, `advanceHandAnimation(hand, dt, { mining })`,
  `handSwingAmount(hand)` e `startPunch(hand)`. O `updateHand()` só aplica o
  resultado na mão.
- Ajuste de precisão: sem golpe em andamento, a contribuição do `punch` é **0**
  de verdade (antes `Math.sin(Math.PI)` deixava ~1e-16, um tremor sub-pixel
  inofensivo mas sujo).

## Antes e depois

| Ação | Antes | Agora |
| --- | --- | --- |
| clicar na grama alta | bloco some, braço parado | bloco some, braço dá o golpe |
| segurar o botão na grama | só a primeira (botão era solto) | corta a cada 0,2 s, com o braço batendo |
| quebrar bloco comum (0,9 s) | laço de mineração | laço + golpe no fim, sem corte seco |
| colocar bloco / abrir porta | golpe | golpe (inalterado, agora via `startPunch`) |

## Validação

```bash
npm test        # 265 testes (8 novos)
npm run check   # sintaxe 87/87 + importmap em dia
```

Os testes simulam quadros a 60 fps: o golpe precisa chegar a mais de 90% do
movimento, durar vários quadros e voltar ao repouso; o laço de mineração precisa
oscilar (senão a mão fica tremendo no alto) e parar quando o botão é solto.
Também há asserção no código garantindo que **toda** quebra dispara o golpe e
que o caminho da grama não volta a soltar o botão.

## Limitações

- A conferência visual depende de navegador: os testes validam os valores que
  movem a mão, não o desenho final.
- Blocos de dureza minúscula mas não zero (nenhum hoje) também se beneficiam do
  golpe, já que a correção está em `breakBlock()`.
