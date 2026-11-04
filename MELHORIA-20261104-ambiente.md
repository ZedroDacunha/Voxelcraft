# MELHORIA: ambiente (vento e grilos, em fases)

- **Data:** 04/11/2026 (item 13 da [análise de 31/10](ANALISE-20261031-melhorias.md), nono e último recorte — áudio)
- **Status:** implementado
- **Arquivos principais:** `world-ambient-sounds.js` (novo), `world-audio.js`,
  `game.js`, `assets/sounds/LEIA-ME.md`, `tests/ambient-sounds.test.mjs` (novo)

## Por que

Todos os sons do jogo até aqui são **eventos**: algo acontece, dispara um som
curto. O mundo, porém, é mudo quando nada acontece — e silêncio absoluto ao
nascer do sol num campo aberto não parece calmo, parece inacabado.

Ambiente é o único som **contínuo**, e é o mais fácil de estragar: ligado o tempo
todo vira ruído de fundo que o jogador aprende a ignorar.

## Como

### Escasso de propósito

A decisão central veio de um pedido explícito: **não tocar toda hora, não tocar
sempre as duas camadas ao mesmo tempo, com espaço entre elas e, de vez em quando,
as duas juntas.** Isso é um escalonador de fases:

| Fase | Duração | Peso no sorteio |
| --- | --- | --- |
| silêncio | 10–22 s | 0,34 |
| vento | 15–32 s | 0,34 |
| grilos | 12–26 s | 0,20 |
| os dois | 6–12 s | 0,12 |

Duas regras fazem o resto:

1. **nunca a mesma fase duas vezes seguidas** — silêncio atrás de silêncio soa
   como áudio morto, vento atrás de vento parece laço. Toda pausa é seguida de
   alguma camada.
2. **fase impossível troca na hora** — amanheceu no meio dos grilos? A fase é
   cortada no quadro seguinte, não espera os 20 s.

Exemplo real (noite, nível do mar, 4 minutos):

```
  0-8s silêncio →  8-32s vento → 32-48s grilos → 48-60s silêncio
→ 60-69s os dois → 69-88s vento → 88-108s silêncio → 108-117s os dois
→ 117-130s silêncio → 130-150s vento → 150-170s silêncio → 170-194s grilos …
```

Nada toca por mais de ~30 s, nada fica em silêncio por mais de ~22 s, e "os dois"
aparece por 9 s de vez em quando.

### O que existe depende do lugar e da hora

`ambientAvailability()`:

- **vento**: existe em todo lugar, mais forte no alto (0,5 no nível do mar → 0,85
  em cima da montanha) e um pouco mais de noite;
- **grilos**: só de noite e perto do nível do mar — cume e caverna funda não têm
  grilo, e de dia o grilo nem entra no sorteio.

### Duas camadas de áudio, criadas uma vez

Um laço por camada para a página inteira: buffer em `loop = true` → filtro
passa-baixa → ganho → master. O jogo só diz "vento 0,55, grilos 0", e o fade é
`setTargetAtTime` com 0,3 s de constante — entrar e sair de fase nunca é degrau
(degrau estala).

Os buffers são gerados em JS na primeira vez que tocam:

- **vento**: ruído branco passado por um passa-baixa de um polo, com o corte
  variando devagar (rajada) — 3 s de laço;
- **grilos**: pulsos agudos de ~55 ms em ritmo irregular (8 chamados em 4 s).
  Ruído filtrado soaria como chiado, não como inseto.

Como o grafo só é criado quando há camada para tocar, **nenhum `AudioContext`
nasce antes de um gesto do jogador** — e o menu não ganha vento.

### Silêncio nos lugares certos

`updateAmbient()` zera as camadas quando o ponteiro está solto (menu/pausa), na
morte e com a aba escondida. A fase **congela** nesse intervalo, então voltar não
recomeça o sorteio do zero.

Também não se reescreve o grafo a cada quadro: o nível aplicado só muda quando
difere do anterior em mais de 0,01.

## Validação

```bash
npm test        # 330 testes (17 novos)
npm run check   # sintaxe 100/100 + importmap em dia
```

- disponibilidade por hora/altura (dia sem grilo, cume sem grilo, caverna sem
  grilo, vento sempre existe);
- fases impossíveis fora do sorteio; nunca repete a fase anterior;
- começa em silêncio, troca no fim do tempo, corta fase impossível na hora;
- `dt` inválido não anda o relógio;
- **teste de distribuição com gerador determinístico** (10 min de jogo): todas as
  fases aparecem, silêncio entre 15% e 55% do tempo, "os dois" < 20% e nenhuma
  fase dura menos de 6 s. A primeira versão usava `Math.random` e já falhou por
  azar em 60 s — teste que às vezes passa é pior que teste nenhum;
- áudio: um nó por camada (não um por quadro), `loop` ligado, fade via
  `setTargetAtTime`, silêncio pedido antes de existir som não cria contexto,
  nível inválido não estoura o ganho;
- `game.js`: ambiente calado fora do jogo e só reaplicado quando o nível muda.

## Limitações conhecidas

- As camadas **não aceitam arquivo do jogador** (ao contrário dos efeitos): laço
  precisa repetir sem emenda, e um `.ogg` curto emenda com clique — trocar por
  arquivo exigiria um laço já masterizado.
- Sem distinção de bioma (deserto, floresta, caverna) nem som de cachoeira.
- Grilos só existem de noite; não há "pássaros" de dia — o dia fica com o vento.
- A camada de grilos é um único timbre: um coral de insetos reais pediria várias
  vozes com atrasos diferentes.
