# MELHORIA: o Mofim ganha medo, chilreio e pulo de degrau (T1)

- **Data:** 04/11/2026 (item 13 da [análise de 31/10](ANALISE-20261031-melhorias.md), tema 1 de criaturas)
- **Status:** implementado
- **Arquivos:** `world-creature.js` (novo), `game.js`, `world-audio.js`, `tests/creature.test.mjs` (novo), `tests/audio-ui.test.mjs`

## Por que

O Mofim existia desde o começo e não reagia a nada: vagava sorteando alvos a cada
2–5 s, e o jogador podia passar por cima, bater, gritar. Era **cenário animado**,
não criatura — e o modelo (asas translúcidas e um cubinho de luz) sugeria um
vaga-lume que nunca virou comportamento.

Este recorte dá três coisas a ele: **medo** (a decisão), **voz** (o chilreio) e
**agilidade** (o pulo de degrau). Tudo reaproveita o que já existia — spawn,
passeio e animação de asas.

## 1. Medo

As regras, fixadas por teste:

1. **Chegou perto andando ou correndo → foge.** Raio de 7 blocos e velocidade
   horizontal do jogador de pelo menos 2,2 m/s.
2. **Chegou agachado → não percebe.** Agachar é o modo furtivo: a regra olha o
   estado real de agachar e ignora a proximidade.
3. **Levou um golpe → foge na hora**, de qualquer distância e postura.

| Como o jogador chega | Velocidade | Assusta? |
| --- | --- | --- |
| agachado | 1,3 | não |
| andando | 4,3 | sim |
| correndo (sprint) | 5,6 | sim |

O limiar de 2,2 m/s fica **entre o passo agachado (1,3) e o caminhada (4,3)**. A
regra do agachar é redundante com a velocidade hoje, mas está explícita porque é
decisão de jogo ("agachar esconde"), não efeito colateral da matemática.

Comportamento: o susto dura **4,5 s** e se renova enquanto o jogador ameaça;
fugindo, ele anda a **3,1 blocos/s** (vagando: 0,72) com o alvo recalculado a cada
quadro **para longe do jogador**; se bater numa encosta, **desvia em diagonal** em
vez de ficar parado encarando o obstáculo.

## 2. Chilreio

Som sintetizado `mofim-chirp`: dois trinados curtos (< 55 ms cada) e agudos
(1850→2450 Hz), separados por 85 ms — um oscilador só faz "bip", não "tsi-tsi".
Para isso o sintetizador ganhou `repeat`/`gap` na receita, sem mudar nenhum som
existente.

Quem decide quando chia é `chirpFor()`, com três motivos:

| Motivo | Quando | Tom |
| --- | --- | --- |
| `startle` | levou golpe ou viu o jogador | mais agudo (rate 1,22) |
| `panic` | enquanto foge | um pouco agudo (1,1) |
| `idle` | passeando, a cada 7–15 s sorteados | neutro e mais baixo (ganho 55%) |

Silêncio é o padrão: alcance de **16 blocos**, espera de **1,2 s** entre chamados
do mesmo bicho, e o volume cai com a distância. Três Mofins chilreando sem parada
viraria zumbido — a ideia é o jogador ouvir o bicho antes de vê-lo.

O grito não fica guardado: se o Mofim está longe demais para ser ouvido, o susto
não toca depois quando o jogador se aproxima.

## 3. Pulo de degrau

Ele **já atravessava degrau de 1 bloco**, mas o corpo subia instantaneamente
(teleporte) — o famoso "deslizar para cima". Agora:

- subir até **1 bloco** é permitido e desenhado como **pulo**: o corpo acompanha um
  arco que sobe acima do destino e desce até pousar (`hopHeightAt`), em 0,26 s;
- a rampa linear + seno que eu tentei primeiro levantava só ~9 cm e ficava
  invisível — por isso o arco tem duas fases (sobe até `destino + 0,42`, desce até
  o destino), que é o que um salto parece;
- **degrau de 2 blocos continua barrado**: ele desvia (fugindo) ou sorteia outro
  alvo (passeando). Subir 2 seria outra decisão de jogo, não um ajuste.

O `y` lógico é atualizado na hora (é ele que anda); só o desenho faz o arco. Assim
nenhuma regra de terreno muda por causa da animação.

## O golpe

Antes o clique só existia para blocos: a mira é um raycast de voxels, então a
criatura era **literalmente inalcançável**. Agora `strikeCreature()`, no laço
principal:

- alcance de **3,5 blocos** e abertura de ~44° a partir da mira;
- entre dois na mira, acerta **o mais próximo**;
- **cooldown de 0,35 s** — segurar o botão assusta uma vez, não a cada quadro;
- enquanto a mira está no bicho, **o bloco atrás não é minerado**;
- o braço dá o golpe (`startPunch`), para o clique não parecer vazio.

Vale para mouse **e** toque, porque os dois caminhos usam o mesmo `leftHeld`.

## Testes

`tests/creature.test.mjs` — **22 testes**, sem navegador:

- **medo (puro):** correndo perto assusta; agachado nunca; andar devagar não; longe
  não; parado não; o limite do raio é exato;
- **golpe (puro):** acerta o da frente, ignora atrás/longe/acima, escolhe o mais próximo;
- **chilreio (puro):** alcance, espera entre chamados, os três motivos e a hora
  sorteada do chamado de passeio;
- **comportamento** (Three real, mundo falso e relógio injetado): nasce no capim a
  9–24 blocos (máx. 3, em cima da grama, dentro da cena); correndo perto a
  distância **aumenta**; agachado não fica assustado; golpe assusta na hora e
  respeita o cooldown; golpe faz **gritar** (`startle`) e o chilreio tem espera
  própria; longe não chia e o grito não fica guardado; susto expira; despawn sai
  da lista **e da cena**; pausado nada se move; **degrau de 1 sobe com arco
  visível** e **degrau de 2 continua barrado**.

Em `tests/audio-ui.test.mjs`, +1 teste para o trinado (duas notas, com o intervalo
da receita) e a lista de nomes atualizada.

O relógio é injetado (`now` no factory), então nada depende de esperar de verdade.

## O que mudou de estrutura

A classe estava dentro do `game.js` (110 linhas de IA inalcançável por teste). Saiu
para `world-creature.js` como `createCreatureSystemClass({ THREE, ID, CHUNK_SIZE,
floorDiv, hash2, now, onChirp })` — mesmo padrão de `world-water.js`. O `game.js` só
conecta as peças e decide o volume/tom do chilreio (o módulo não conhece áudio).

`game.js`: 3.871 → **3.778** linhas, com a IA agora testável.

## O que não entrou (próximos passos)

- **Drop/recurso** (T2): o golpe assusta, não machuca — ele ainda não tem vida.
- **Luz de verdade** (T3): o "glow" continua sendo um cubinho amarelo.
- **Degrau de 2 blocos**: hoje ele desvia. Subir exigiria decidir se o Mofim escala
  encostas, o que muda o passeio dele no mundo inteiro.

## Validação

```bash
npm test        # 444 testes (22 de criatura + 1 de áudio neste recorte)
npm run check   # sintaxe 114/114 + importmap em dia
```

**Validação manual pendente no aparelho do usuário**: aproximar andando (foge e
chia), aproximar agachado (continua passeando, sem chilreio de susto), dar um golpe
(grita e foge, sem minerar o bloco atrás) e ver o pulo ao subir um degrau de terra.
