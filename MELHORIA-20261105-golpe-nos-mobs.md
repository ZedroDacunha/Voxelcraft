# MELHORIA: o golpe nos bichos (vida, impacto e morte)

- **Data:** 05/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-sheep.js`, `world-creature.js`, `world-break-particles.js`,
  `world-catalog.js`, `world-textures.js`, `world-audio.js`, `game.js`

## As escolhas (feitas antes de codar)

| Pergunta | Resposta |
| --- | --- |
| O que o golpe faz | **Vida e morte** em todos os bichos (o Mofim já tinha; a ovelha ganhou) |
| Quantos golpes | **Depende do bicho**: Mofim 3, ovelha 4 |
| O que a ovelha solta | **Carne sempre** (com ou sem lã) e **lã só se ainda tiver velo** |
| Como o impacto aparece | **Clarão + empurrão + som + lascas** no ponto do golpe |

## Antes

O Mofim já levava dano desde a primeira versão (3 de vida, clarão laranja de
0,22 s, empurrão e, no fim, morte com pó luminoso). A **ovelha não**: clicar nela
só a fazia correr — nada de vida, nada de clarão, nada de som. E, no jogo, o
golpe parecia simplesmente "não fazer nada":

- o clique em bicho era limitado pela distância do **bloco na mira**; mirando no
  lombo, a linha do olhar encontra o chão logo **atrás** do bicho, então o bloco
  "na frente" comia o clique;
- o corpo do alvo era procurado sempre a **0,45** do chão (a altura do Mofim),
  o que serve para um bicho baixinho e não para a ovelha de lombo alto;
- e não havia **som** de impacto — só o do bloco quebrando.

## Depois

### Vida

| Bicho | Vida | Golpes |
| --- | --- | --- |
| Mofim | 3 (`MOFIM_HEALTH`) | 3 |
| Ovelha | 4 (`SHEEP_HEALTH`) | 4 |

O golpe tira 1 de vida, acende o corpo, empurra e faz o bicho fugir (a ovelha
leva o bando). No golpe que zera a vida ele sai do mundo e solta o que tinha.

### O impacto, nas quatro camadas

1. **Clarão** — a conta virou uma regra só (`hurtFlashFor`, em
   `world-creature.js`): 1 no instante do golpe, 0 quando acaba. O Mofim põe no
   `emissive` do corpo; a ovelha, na **lã dela**.
2. **Empurrão** — o corpo recua `SHEEP_KNOCKBACK` (0,35 bloco) na direção
   contrária ao golpe. É o que dá peso à batida.
3. **Som** — receita nova `mob-hit`: baque curto e abafado, com gravidade
   embaixo. Na morte o **mesmo** som toca mais grave e mais comprido (via
   `rate`), em vez de uma receita nova.
4. **Lascas** — o sistema de partículas de quebra passou a aceitar **cor e
   quantidade** (`breakParticles.spawn(x, y, z, null, { color, count, spread,
   speed })`). A cor sai do próprio bicho: a lã da ovelha ou o pó do Mofim.

### A mira que "não fazia nada"

- O corpo de cada bicho agora declara a altura do **próprio centro** em
  `bodyOffset` (Mofim 0,45; ovelha 0,6). `creatureInReach` usa esse valor.
- O limite do bloco na mira ganhou uma folga de `MOB_HIT_BLOCK_SLACK` (0,75
  bloco): continua não dando para bater em quem está atrás de uma parede, mas o
  chão logo atrás do bicho não rouba mais o clique.

### O que a ovelha deixa

- **Lã**: de 1 a 3 fardos **da cor dela** — só se ainda tiver velo. Tosquiar
  antes de matar rende a lã na mão; matar uma tosquiada não rende lã.
- **Carne de ovelha**: 1 a 2, **sempre**. Item novo do catálogo
  (`ID.MUTTON = 100`), com ícone de carne crua no atlas, stack de 64 e
  `food: { hunger: 3, sat: 1.6 }` — alimenta um pouco menos que a maçã (4/2,4).

## Validação

```bash
npm test        # 914 testes (11 novos em tests/mob-hit.test.mjs)
npm run check   # sintaxe + importmap em dia
npm run stamp   # index.html recarimbado
```

**Prova de força** — cada quebra proposital derruba o teste que a defende:

| Quebra proposital | Teste que reprova |
| --- | --- |
| ovelha com 1 de vida | "a ovelha tem quatro golpes de vida…" (3 testes) |
| tirar o clarão do `update` | "cada golpe acende o corpo…" e "o clarão é só dela" |
| usar o material de lã compartilhado | "o clarão é só dela: o resto do rebanho não pisca" |
| soltar lã mesmo tosquiada | "morta, ela solta lã (se tinha velo) e carne (sempre)" |
| ignorar `bodyOffset` na mira | "a mira acerta o lombo…" |
| não avisar a morte (`onDeath`) | "o jogo recebe o que ela soltou…" |
| tirar a folga do bloco na mira (`game.js`) | "game.js bate nos dois bichos…" |
| lascas sem cor | "as lascas do golpe usam a cor do bicho…" |

## Limites conhecidos

- Sem barra de vida no bicho: a única leitura é o clarão e o número de golpes.
  O Mofim continua 3 e a ovelha 4, sempre.
- O golpe não tem força diferente por ferramenta: qualquer mão bate 1 (a
  tesoura, aliás, **tosquia** em vez de bater).
- A carne é crua: não há versão assada (o forno ainda não fuma comida).
- Matar a ovelha não assusta o bando de propósito: o contágio do P6 vale para o
  susto e a fuga, não para a morte.
