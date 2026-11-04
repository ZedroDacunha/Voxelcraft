# MELHORIA: o Mofim se assusta (T1)

- **Data:** 04/11/2026 (item 13 da [análise de 31/10](ANALISE-20261031-melhorias.md), tema 1 de criaturas)
- **Status:** implementado
- **Arquivos:** `world-creature.js` (novo), `game.js`, `tests/creature-fear.test.mjs` (novo)

## Por que

O Mofim existia desde o começo e não reagia a nada: vagava sorteando alvos a cada
2–5 s, e o jogador podia passar por cima, bater, gritar. Era **cenário animado**,
não criatura — e o modelo (asas translúcidas e um cubinho de luz) sugeria um
vaga-lume que nunca virou comportamento.

Medo é o que transforma presença em jogo, e custa pouco: reaproveita o que já
existia (spawn, passeio, animação de asas) e muda só a decisão de para onde ele
anda e quão rápido.

## As regras

Foram definidas assim, e agora estão fixadas por teste:

1. **Chegou perto andando ou correndo → foge.** Raio de 7 blocos e velocidade
   horizontal do jogador de pelo menos 2,2 m/s.
2. **Chegou agachado → não percebe.** Agachar é o modo furtivo de verdade: a
   regra olha o estado real de agachar e ignora a proximidade.
3. **Levou um golpe → foge na hora**, de qualquer distância, postura e velocidade.

O limiar de 2,2 m/s fica **entre o passo agachado (1,3) e o caminhada (4,3)** — de
propósito:

| Como o jogador chega | Velocidade | Assusta? |
| --- | --- | --- |
| agachado | 1,3 | não |
| andando | 4,3 | sim |
| correndo (sprint) | 5,6 | sim |

Uma consequência aceita: como a velocidade já barra o passo agachado, a regra do
agachar é redundante hoje — mas ela está explícita porque é uma decisão de jogo
("agachar esconde"), não um efeito colateral da matemática. Se depois o passo
agachado ficar mais rápido, a regra continua valendo.

## Como o medo funciona

- O susto tem **duração de 4,5 s** (`SCARE_DURATION`). Enquanto o jogador estiver
  por perto ameaçando, ele se renova — parar de perseguir faz o bicho acalmar.
- Fugindo, ele anda a **3,1 blocos/s** (contra 0,72 vagando) e o alvo é
  recalculado a cada quadro **para longe do jogador**, não o alvo do passeio (que
  ficaria para trás e o faria "fugir" para o lado errado).
- Se bater numa encosta fugindo, ele **desvia em diagonal** em vez de ficar
  parado encarando o obstáculo até o medo passar (era o que o passeio fazia).
- As asas batem mais rápido (22 contra 8) e a flutuação diminui — dá para ler o
  estado dele de longe, sem nenhuma arte nova.

## O golpe

Antes o clique só existia para blocos: a mira é um raycast de voxels, então a
criatura era literalmente inalcançável. Agora existe `strikeCreature()` no laço
principal:

- alcance curto (**3,5 blocos**) e abertura de ~44° a partir da mira;
- entre dois Mofins na mira, acerta **o mais próximo**;
- **cooldown de 0,35 s**: segurar o botão assusta uma vez, não a cada quadro;
- enquanto a mira está no bicho, **o bloco atrás dele não é minerado** — senão o
  golpe viraria uma mineração silenciosa do cenário;
- o braço dá o golpe (`startPunch`), para o clique não parecer vazio.

Vale para mouse **e** toque, porque os dois caminhos usam o mesmo `leftHeld`.

## Testes

`tests/creature-fear.test.mjs` — 17 testes, sem navegador:

- **regra pura** (`shouldFlee`): correndo perto assusta; agachado nunca; andar
  devagar não; longe não; parado não; o limite do raio é exato;
- **golpe** (`creatureInReach`): acerta o da frente dentro do alcance, ignora o de
  trás, o distante e o que está acima da cabeça, e escolhe o mais próximo;
- **comportamento** (classe com Three real, mundo plano falso e relógio injetado):
  nasce no capim entre 9 e 24 blocos, no máximo 3 por vez, em cima da grama e
  dentro da cena; correndo perto ele foge **e a distância aumenta**; agachado ele
  não fica assustado; golpe assusta na hora e respeita o cooldown; golpe no vazio
  não assusta ninguém; o susto expira; longe demais ele sai da lista **e da cena**;
  pausado (menu/inventário) nada nasce nem se move.

O relógio é injetado (`now` no factory), então nada depende de esperar de verdade —
a suíte inteira roda em milissegundos.

## O que mudou de estrutura

A classe estava dentro do `game.js` (110 linhas de IA inalcançável por teste). Saiu
para `world-creature.js` como `createCreatureSystemClass({ THREE, ID, CHUNK_SIZE,
floorDiv, hash2, now })` — mesmo padrão de `world-water.js` e `world-terrain.js`. O
`game.js` só conecta as peças (`new CreatureSystem(world)`), então continua havendo
uma única instância e nenhum outro ponto de chamada mudou.

Efeito: `game.js` 3.871 → **3.776** linhas, com ~110 linhas de IA agora **testáveis**
fora dele (`world-creature.js` tem 287, contando o modelo e os comentários).

## O que não entrou (próximos passos)

- **Som**: o Mofim continua mudo. Chilreio ao fugir/levar golpe é o próximo passo
  natural, e a infraestrutura híbrida de áudio já existe.
- **Pular degrau**: ele ainda desiste de desnível maior que 1 bloco (agora desvia,
  mas não sobe). Isso pede uma decisão de física, não de medo.
- **Drop/recurso** (T2): o golpe assusta, não machuca — ele não tem vida ainda.
- **Luz de verdade** (T3): o "glow" segue sendo um cubinho amarelo, não ilumina.

## Validação

```bash
npm test        # 438 testes (17 novos)
npm run check   # sintaxe 114/114 + importmap em dia
```

**Validação manual pendente no aparelho do usuário**: aproximar andando (ele deve
fugir), aproximar agachado (deve continuar passeando), dar um golpe (deve fugir na
hora) e conferir que o bloco atrás dele não é minerado.
