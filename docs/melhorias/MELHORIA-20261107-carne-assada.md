# MELHORIA: a carne assa na fornalha (e a próxima também)

- **Data:** 07/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-meats.js` (novo), `world-catalog.js`, `world-textures.js`, `world-chat-commands.js`, `tests/meat.test.mjs` (novo)

## O problema

A carne de ovelha era comestível e só isso: crua, 3 de fome. A fornalha já
assava pedregulho, madeira e minério, mas não sabia o que fazer com bicho — e a
próxima criatura que soltasse carne ia esbarrar na mesma parede, com o risco de
cada uma inventar seu próprio jeito de assar.

## A mudança

Uma **tabela só** para todas as carnes, em `world-meats.js`:

```js
{
  key: 'mutton',
  raw:    { idKey: 'MUTTON',        id: 100, name: 'Carne de ovelha',        food: { hunger: 3, sat: 1.6 }, sprite: { kind: 'mutton', mat: 'meat' } },
  cooked: { idKey: 'COOKED_MUTTON', id: 101, name: 'Carne de ovelha assada', food: { hunger: 6, sat: 4 },   sprite: { kind: 'mutton', mat: 'cooked' } },
  time: 10,
}
```

Dela saem, sem repetir nada:

- os **ids** (`MEAT_IDS` entra no `ID` do catálogo — faixa reservada **100–116**,
  oito bichos × crua + assada);
- os **itens** (`ITEMS` do catálogo, com `food`, sprite e `iconTile`);
- a **receita de forno** (`MEAT_SMELTING` → `SMELT`), que por tabela já aparece
  no livro de receitas e libera o slot de entrada da fornalha;
- a **arte**: o sprite é desenhado uma vez e recebe a paleta `raw` ou `cooked`
  de `MEAT_SPRITE_CORES`.

**Bicho novo que solta carne = uma entrada nessa tabela.** O teste
`o contrato para o próximo bicho que solta carne` cobra as condições: par
crua/assada, ids na faixa, comida válida, cores no `MEAT_SPRITE_CORES` e receita
no forno.

## O que o jogador vê

- **Carne de ovelha assada** (6 de fome, 4 de saturação) contra 3/1,6 da crua.
- Na fornalha: naco cru no slot de cima, combustível no de baixo, **10 s** e sai
  a assada — o mesmo relógio dos minérios. O livro de receitas ganha a linha
  "Carne de ovelha → 1× Carne de ovelha assada · Fornalha · 10s".
- A assada **não** volta para o forno (não tem receita) e o forno nem acende por
  ela.
- `/give carne assada`, `/give assada` e `/give cooked_mutton` acham o item.

## A arte

O naco é **o mesmo desenho** nas duas: a silhueta não muda, porque o olho tem
que reconhecer que é o mesmo pedaço. O que muda é a paleta — rosado → tostado,
gordura mais âmbar, osso mais amarelado — e **dois riscos de grelha** na
diagonal, que só a assada tem. O teste compara a máscara de pixels das duas e
exige que sejam idênticas, com cores disjuntas.

De quebra, a **ponta do osso** deixou de flutuar solta no canto (ela era um
quadradinho separado do naco na barra de itens); agora encosta no corpo.

## O que fica travado nos testes

`tests/meat.test.mjs` (novo, 7 testes):

- a crua continua com o id 100, o mesmo nome e os mesmos 3/1,6 — **save antigo
  abre igual**;
- a assada é item próprio (101), 6/4, com tile próprio no atlas;
- o forno assa de verdade: `stepFurnace` consome um naco, entrega `COOKED_MUTTON`
  e avisa `smelted` (é o som);
- a assada não tem receita e não acende o forno;
- silhueta igual, paleta outra, marca de grelha só na assada;
- `/give` acha as duas por nome, apelido e nome em inglês;
- o contrato do próximo bicho (a razão de existir a tabela).

## Pendência

A ovelha continua soltando **1–2 nacos crus** ao morrer; nada mudou no drop.
