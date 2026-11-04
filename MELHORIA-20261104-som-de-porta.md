# MELHORIA: som de porta abrindo e fechando

- **Data:** 04/11/2026 (item 13 da [análise de 31/10](ANALISE-20261031-melhorias.md), quinto recorte — áudio)
- **Status:** implementado
- **Arquivos principais:** `world-audio.js`, `game.js`,
  `assets/sounds/LEIA-ME.md`, `tests/door-sounds.test.mjs` (novo)

## Por que

A porta é a única interação do jogo com **dois estados** e era muda: abrir e
fechar aconteciam com o mesmo silêncio de antes, mesmo agora que o braço anima e
os blocos soam. É o som que informa "algo mudou" sem o jogador precisar olhar.

## Como

### Dois sons, não um com variação

Abrir e fechar são gestos diferentes, então soam diferentes:

| | Abrir | Fechar |
| --- | --- | --- |
| rangido | 0,26 s, corte 1100→420 Hz, Q 3,2 | 0,14 s, corte 900→380 Hz, Q 2,4 |
| baque (batente) | 170→105 Hz, ganho 0,07 | 210→115 Hz, ganho 0,12 |
| entrada | ataque 20 ms (dobradiça girando) | ataque 4 ms (golpe seco) |
| volume | menor | maior — é o impacto |

O Q alto (2,4–3,2) é o que faz o ruído soar como **madeira rangendo** em vez de
chiado, e não há baque em nenhum outro som de interação tão longo quanto o de
abrir.

### Só soa quando a porta muda de estado

`toggleWoodDoor()` tem duas recusas antes de aplicar a mudança: o bloco não é
porta, ou o jogador está onde o painel vai ficar. O som fica **depois** do laço
que grava as duas metades — quem tenta fechar a porta de dentro do vão continua
ouvindo só o aviso ("Saia do vão da porta para fechá-la"), sem som de porta
fechando por cima.

O tom varia 0,9–1,1 (`stepPitch()`), então duas portas seguidas não soam
idênticas — importante em corredores com várias portas.

## Validação

```bash
npm test        # 292 testes (3 novos)
npm run check   # sintaxe 92/92 + importmap em dia
```

- as duas receitas existem, ressoam (Q > 2) e têm baque de madeira descendo;
- abrir dura mais, entra mais devagar e é mais baixo que fechar;
- no `game.js`: **toda** recusa (`return false`) acontece antes do som, e o som
  vem depois de `world.setBlock()` das duas metades.

## Limitações conhecidas

- Não há som do "trinco" separado do batente: são a mesma camada de baque.
- A porta é sempre de madeira; se aparecer porta de outro material, a receita
  precisa de variante (ou aceitar a mesma, já que o catálogo só tem carvalho).
- Timbre sintético: `assets/sounds/door-open.ogg` substitui sem tocar em código.
