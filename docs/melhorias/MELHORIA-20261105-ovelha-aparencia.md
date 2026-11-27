# MELHORIA: a aparência da ovelha (parte 2)

- **Data:** 05/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-sheep.js`, `tests/sheep.test.mjs`

## A escolha

Antes de codar, as três candidatas foram desenhadas em isométrico a partir do
**mesmo formato de peças do jogo** (caixa com centro e tamanho, em blocos), cada
uma nas três lãs — branca, cinza e preta. Escolhida a **B**, com os dois detalhes
extras: **casco escuro** e **brilho no olho**.

| Opção | O que era | Veredito |
| --- | --- | --- |
| A — lisa | corpo de um bloco, 3 tufos no lombo, patas sem casco | fiel ao Minecraft, mas a silhueta é a de um porco de caixa |
| **B — fofinha** | miolo de lã com **9 tufos** em volta, topete, casco escuro, brilho no olho | **escolhida** |
| C — alta | lã em três camadas horizontais, pernas longas | parece tosquiada em faixas, não é o que a ovelha é |

## Antes

Treze caixas: corpo liso de um bloco só (0,58 × 0,52 × 0,86), cabeça, focinho,
dois olhos, duas orelhas retangulares, quatro patas de caixa e um rabo. De longe,
lia como um bloco de lã com pernas — sem casco, sem brilho no olho, sem a
irregularidade que faz "ovelha" em vez de "animal de caixa".

As patas também eram caixas soltas girando **no próprio centro**: o passo existia,
mas o pé patinava no lugar em vez de dar passo.

## Depois

- **Lã de tufos**: um miolo (0,54 × 0,46 × 0,78) com **nove tufos** de tamanhos
  diferentes em volta — laterais, flancos e lombo (`SHEEP_TUFTS`). A silhueta
  fica irregular, que é o que a lê como fofinha a vinte blocos.
- **Topete** entre as orelhas e **rabo** de lã no lugar.
- **Cara**: focinho claro, dois olhos escuros e um **brilho branco** no canto de
  cima de cada olho (só se vê de perto, mas é o que faz a cara parecer viva).
- **Orelhas** mais largas (0,28) e caídas (0,34 rad para baixo, de cada lado).
- **Casco escuro** (0x4a4038) nas quatro patas, um dedo mais largo que a canela.
- **Pata que dá passo de verdade**: cada pata é um **grupo com pivô no quadril**
  (`y = 0,4`), com canela e casco pendurados dentro. Ao girar no passo, o casco
  vai junto — antes a caixa girava no meio e o pé ficava plantado.
- A pata entra um dedo dentro da lã (barriga em 0,39, pata de 0,4): sem essa
  sobra aparecia uma fresta entre perna e corpo, e a ovelha parecia flutuar.
- Altura total ~1,05 bloco (o jogador tem 1,8): dá para ver por cima dela.

Custo: **28 malhas** por ovelha (era 13 caixas). Com o limite de quatro ovelhas
vivas, são 112 malhas — o mesmo tipo de conta que o Mofim já faz com as peças
dele (asas, antena, luz e pés).

## Validação

```bash
npm test        # 863 testes (27 do módulo da ovelha, 2 novos nesta parte)
npm run check   # sintaxe (155 arquivos) + importmap em dia
npm run stamp   # index.html recarimbado
```

**Prova de força** — cada quebra proposital derruba o teste que a defende:

| Quebra proposital | Teste que reprova |
| --- | --- |
| orelha em pé (sem inclinação) | "as orelhas são caídas…" |
| casco removido | "o corpo é de caixas…", "as orelhas são caídas…" e "a ovelha pisa no chão" |
| brilho do olho removido | "o corpo é de caixas…" |
| lã de um bloco só (sem tufos) | "o corpo é de caixas…" |
| pata girando no meio (pivô no chão) | "a ovelha pisa no chão…" |

Os desenhos de conferência ficaram **fora do repositório**, como os da porta:
`/home/user/sheep-render.mjs` (renderizador isométrico),
`/home/user/sheep-model-preview.mjs` (desenha o modelo **do jogo**, pelo próprio
`createModel`) e `/home/user/ovelha-no-jogo.png`.

## O que ainda **não** existe (de propósito)

- pastar (cabeça baixa, grama virando terra) — **P3**;
- lã e tesoura — **P4**; balido — **P5**; rebanho e susto — **P6**;
- mexer na lã ao levar golpe (só faz sentido junto com a tosquia, no P4).
