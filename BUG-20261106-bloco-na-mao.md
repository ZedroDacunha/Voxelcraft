# BUG: o bloco na mão apareceu cortado e esticado (depois do ícone 3D)

- **Data:** 06/11/2026
- **Status:** corrigido
- **Arquivos:** `world-block-icons.js`, `game.js`, `tests/block-icon.test.mjs`

## O que aconteceu

Depois do ícone 3D no inventário (PR #105), o bloco **na mão do jogador** e o item
**caído no chão** apareceram como um bloco gigante, torto e sem as faces certas.

## Por que

O item de bloco não tinha `sprite`: o jogo decidia "é bloco → desenho o cubo 3D
de verdade" justamente pela **ausência** do sprite. O ícone novo deu um sprite a
todo bloco (`{ kind: 'block' }`), e aí três pontos do `game.js` passaram a tratar
bloco como se fosse **arte plana**:

| Onde | O que fazia |
| --- | --- |
| `refreshHeldItem` | pegava o caminho do sprite e montava a arte na mão |
| `getItemGeometry` | montava a geometria do item caído como sprite |
| `spawnItemEntity` | escolhia o material de sprite (cor por vértice) para o item caído |

Só que `buildSpriteGeo` era escrito para **16×16** (o tamanho dos outros itens):
percorria `0..15`, usava `cx − 8` e `15 − cy`. Com uma arte de 32×32, ele mostrava
**só o canto superior esquerdo** do cubo do ícone, com o dobro do tamanho — o
bloco enorme e cortado da captura.

## A correção

1. **A decisão virou uma função só**, em `world-block-icons.js`:

   ```js
   isBlockIcon(sprite)   // sprite?.kind === 'block'
   itemRenderMode(item)  // 'cube' | 'sprite'
   ```

   Bloco com ícone 3D → `'cube'` (o cubo de verdade, como era antes). Tudo o que é
   arte plana continua `'sprite'` — inclusive a **tocha**, que é bloco mas desenha
   graveto + chama.

   Os três pontos do `game.js` passaram a usar `itemRenderMode`.

2. **`buildSpriteGeo` deixou de ter 16 fixo**: o lado agora vem de `pix.length`.
   Com 16 o resultado é idêntico ao de antes; com 32 ele não corta mais nada. É a
   rede de segurança para o caso de outra arte grande aparecer.

## Provas

- **1002** testes na suíte — 1 novo em `tests/block-icon.test.mjs`:
  - todo bloco com ícone 3D responde `'cube'`, e o caminho do sprite nunca é
    escolhido para ele;
  - graveto, maçã, carvão vegetal, tesoura, carvão mineral e carne continuam
    `'sprite'`;
  - a tocha (bloco com arte de item) responde `'sprite'`.
- **Prova de força** (2 mutações, as duas derrubam o teste):

| Mutação | Resultado |
| --- | --- |
| `itemRenderMode` sempre `'sprite'` (o bug de volta) | teste cai |
| `isBlockIcon` sempre `false` | teste cai |

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 43.
