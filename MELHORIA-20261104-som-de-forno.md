# MELHORIA: som de forno (acender, apagar e peça pronta)

- **Data:** 04/11/2026 (item 13 da [análise de 31/10](ANALISE-20261031-melhorias.md), oitavo recorte — áudio)
- **Status:** implementado
- **Arquivos principais:** `world-furnace-sounds.js` (novo), `world-audio.js`,
  `world-furnace-rules.js`, `game.js`, `assets/sounds/LEIA-ME.md`,
  `tests/furnace-sounds.test.mjs` (novo)

## Por que

O forno é a única estação de trabalho com **estado** visível a distância: tem
chama, fumaça e luz. Tudo mudo. O jogador que enche o forno e vira as costas não
tem como saber que a peça saiu sem abrir a interface.

## Como

### O gatilho já existia

`stepFurnace()` devolvia `{ changed, litChanged }`. `litChanged` cobre acender e
apagar; para o item pronto faltava um aviso, e **comparar a pilha de saída
antes/depois do passo** seria frágil (o jogador pode esvaziar o slot no meio).
Então o passo passou a reportar o evento explícito:

```js
const { changed, litChanged, smelted } = stepFurnace(f, dt);
```

`smelted` é `true` no passo em que uma peça sai — e só nesse passo.

### Sem laço enquanto queima

Forno queimando em loop é um zumbido que cansa em dois minutos e briga com todos
os outros sons. Mesma decisão da água: **só a transição soa**.

| Evento | Som | Timbre |
| --- | --- | --- |
| acendeu | `furnace-light` | ruído 2400→700 Hz, 0,5 s + corpo grave 130→85 Hz |
| apagou | `furnace-out` | sopro de cinza 900→260 Hz, 0,4 s |
| peça pronta | `furnace-done` | triângulo 1180→880 Hz, 0,12 s |

O "pronto" tem precedência abaixo da chama: os dois não acontecem no mesmo passo
(`stepFurnace` só avança o preparo com o forno já aceso), mas se acontecerem, o
evento de chama é o que importa ouvir.

### Distância vira volume

O áudio do jogo é mono (ganho, sem espacialização), e o forno é simulado em
**todo chunk carregado** — então um forno esquecido a 60 blocos pode acender
sozinho ao carregar o chunk. Sem atenuação, ele soaria ao lado do jogador:

| Distância | Ganho |
| --- | --- |
| até 3 blocos | 1,0 |
| 8 blocos | ~0,63 |
| 20 blocos ou mais | 0 (nem pede som) |

A queda é ao quadrado — a diferença entre 3 e 6 blocos é pequena, entre 15 e 18 é
quase nada. Distância inválida (`NaN`, negativa) vale 0: som é enfeite, na dúvida
é melhor silêncio do que crepitar fantasma.

A distância só é calculada **quando há evento**. Quebrar a chave `"x,y,z"` de
todos os fornos a cada quadro é justamente o custo que `furnaceChunk()` evita com
o cache de chunk.

## Validação

```bash
npm test        # 313 testes (9 novos + 1 em furnace-rules)
npm run check   # sintaxe 98/98 + importmap em dia
```

- acender, apagar e "pronto" com sons distintos; forno queimando em silêncio;
- ganho cai com a distância, zera em 20 e não explode com `NaN`;
- distância medida do centro do forno até o corpo do jogador;
- `stepFurnace` reporta `smelted` só no passo em que a peça sai;
- no `game.js`: o som só é pedido dentro de `if (litChanged || smelted)`, com
  `lit: f.burn > 0` lido do estado real.

## Limitações conhecidas

- Sem som de forno **aberto** (arrastar item, interface) — a interface já tem
  clique próprio.
- Não há crepitar contínuo enquanto queima, por decisão de escopo; se um dia
  houver, precisa ser um laço com volume pela distância, não um som por quadro.
- Timbre sintético: `assets/sounds/furnace-light.ogg` e companhia substituem sem
  tocar em código.
