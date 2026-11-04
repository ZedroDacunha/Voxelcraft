# MELHORIA: som ao quebrar e ao colocar bloco

- **Data:** 04/11/2026 (item 13 da [análise de 31/10](ANALISE-20261031-melhorias.md), terceiro recorte — áudio)
- **Status:** implementado
- **Arquivos principais:** `world-block-materials.js` (novo), `world-audio.js`,
  `game.js`, `world-step-sounds.js`, `assets/sounds/LEIA-ME.md`,
  `tests/block-sounds.test.mjs` (novo)

## Por que

Quebrar bloco é a ação mais repetida do jogo depois de andar, e era a única
parte da base de áudio (#26, #28) que ainda faltava no gesto mais importante:
bater e ver o bloco cair — agora com o braço animado (#27) e sem som nenhum.

## Como

### Uma família de material para os três sons

A tabela bloco → material saiu de `world-step-sounds.js` para
`world-block-materials.js`. Passo, quebra e colocação passam a usar a **mesma**
família — um bloco novo no mapa ganha os três sons de uma vez (e o teste falha
se a receita não existir).

### Duas camadas: ruído + baque

Ruído filtrado sozinho não tem impacto: soa como "chiado". Cada som de bloco
soma um **baque grave** (seno curto descendo de frequência) por baixo do ruído,
que é o que dá corpo ao golpe. Por material:

| Material | Quebrar (ruído + baque) | Colocar |
| --- | --- | --- |
| pedra | corte 3600 Hz, 0,11 s, baque 210→110 Hz | 3400 Hz, 0,05 s, baque 260→190 Hz |
| madeira | 1700 Hz com ressonância (Q 2,6) | 1500 Hz, Q 2,4 |
| terra | 1000 Hz, 0,15 s, abafado | 900 Hz, 0,07 s |
| grama | 1500 Hz, 0,16 s | 1300 Hz, 0,07 s |
| areia | 2400 Hz sem ressonância (Q 0,4), 0,18 s | 2500 Hz, 0,08 s |

Regras que valem para todos: **quebrar é mais longo, mais alto e mais grave** que
colocar (o impacto precisa de peso; o assentamento é um "tok" curto), e material
duro tem corte mais brilhante e duração menor que material macio.

### No lugar certo

- `breakBlock()` toca o som do bloco que caiu — cobre também a grama alta, que
  quebra em um único quadro.
- O som de colocar só sai **depois** que `world.setBlock()` aceitou o bloco:
  tentar colocar no ar, dentro do jogador ou sem apoio continua silencioso.
- Tom varia 0,9–1,1 a cada golpe (`stepPitch()`, a mesma faixa dos passos), então
  dois blocos iguais seguidos não soam como um clique repetido. A variação mexe
  no ruído **e** no baque.

## Validação

```bash
npm test        # 285 testes (5 novos de bloco + 1 de síntese com baque)
npm run check   # sintaxe 91/91 + importmap em dia
```

Destaques:

- **todo bloco não líquido do catálogo tem som de quebrar e de colocar** — bloco
  novo esquecido vira falha de teste, não silêncio no jogo;
- quebrar > colocar em duração e ganho; o baque desce de frequência e é mais
  grave que o corte do filtro;
- pedra mais brilhante e seca que terra; areia sem ressonância, madeira com Q
  alto;
- `game.js`: quebra toca pelo tipo real e a colocação só depois de `placed`.

## Limitações conhecidas

- Não há som de "batida" a cada golpe durante a mineração de um bloco duro (só no
  instante em que ele cai). É o próximo refinamento natural.
- Timbre sintético: dá para substituir qualquer som por gravação própria em
  `assets/sounds/break-<material>.ogg` ou `place-<material>.wav`.
- Sem navegador no sandbox: valida-se o que toca e quando, não o timbre final.
