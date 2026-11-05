# MELHORIA: o rastro de pó luminoso do Mofim

- **Data:** 04/11/2026 (depois da [luz do Mofim](MELHORIA-20261104-luz-do-mofim.md))
- **Status:** implementado
- **Arquivos:** `world-creature-dust.js` (novo), `world-creature.js`, `game.js`,
  `tests/creature-dust.test.mjs` (novo), `tests/creature.test.mjs`,
  `service-worker.js`, `README.md`, `TESTE-EM-NAVEGADOR.md`

## Por que

Fechada a luz (PR #68), sobrou a última peça do pacote do bicho: **o que fica
para trás**. Até aqui, quem via o Mofim passar via um ponto cruzar o escuro — e
o caminho sumia assim que ele saía do quadro. Ele iluminava o chão onde estava,
não o lugar de onde vinha.

Era a opção **4** da lista de iluminação, adiada de propósito: não é luz, é
**sistema de partículas**, e por isso ganhou PR próprio.

## 1. O pó sai do movimento, não do relógio

A quantidade nasce da **distância andada no quadro** (`dustStep`):

```
sobra += distância × 8 partículas/bloco × escala do modo gráfico
nascem min(2, ⌊sobra⌋) — o resto fica para o próximo quadro
```

Três consequências, todas de graça:

- **parado, nada** — o bicho pode ficar meia hora no capim que não levanta pó;
- **o ritmo não depende da taxa de quadros**: a 60 fps ele anda 1,9 cm por
  quadro, muito menos que uma partícula; sem o acumulador o rastro sairia
  picotado em máquinas lentas e denso demais nas rápidas;
- **voar rende mais que andar** porque voar percorre mais — a cauda do rasante
  sai sozinha, sem regra especial.

| situação | velocidade | partículas/s | rastro |
| --- | --- | --- | --- |
| passeio | ~1,1 bloco/s | ~9 | ~13 no ar, 1,5 bloco de comprimento |
| fuga (assustado) | ~3,4 | ~27 | cheio, ~4 blocos |
| travessia (voando) | 6,5 | ~39 | poça cheia do pool, ~6 blocos |

## 2. O que cada partícula faz

Cubinho de `0,08` (`MeshBasicMaterial`, mesma linguagem dos fragmentos de bloco),
cor `#ffe0a0` — a da luzinha da antena, um tom acima para não virar barro no
escuro.

- **nasce** nos pés (no chão junto aos pés; no ar, aberto `0,26`);
- **sobe** `0,45` bloco/s e **deriva** para os lados, freando (`e^-1,8t`) —
  o pó vai ficando para trás enquanto sobe;
- **desbota em 1,5 s**, encolhendo de 1× para 0,35× enquanto perde opacidade.

São dois sinais do mesmo desaparecimento (tamanho e transparência), e é o que
faz o rastro ler como fumaça e não como confete.

## 3. Barato de propósito

- **Pool fixo de 40 vagas**, criado no primeiro pó e **nunca descartado**.
  Partícula é reaproveitada em roda: o pó mais antigo cede o lugar quando o
  rastro enche. Nada de criar/remover malha por partícula, nada de alocar no
  laço do jogo.
- **Quatro materiais no total**, um por degrau de transparência — não um por
  partícula. Trocar de degrau é trocar uma referência: o programa do shader é o
  mesmo, nada recompila.
- Uma passada de envelhecimento **por quadro**, não por bicho: três Mofins
  custam o mesmo que um.

## 4. Pouso

Quando ele **volta ao chão depois de estar no ar** (voo curto, travessia ou
planeio), sobe uma nuvem de 6 partículas no ponto do pouso — mais aberta e mais
rápida que o pó do passo. É o "ploft" que o pouso pedia.

Pular um degrau (o pulinho de `hopHeightAt`) **não** conta: seria uma nuvem a
cada degrau de escada.

## 5. Portão na qualidade gráfica

`dustScaleFor`:

| modo | rastro |
| --- | --- |
| `auto`, Máxima, 1 | cheio |
| 0,75 (Média) | metade |
| 0,5 (Baixa) | **nenhum** |

Em Baixa, além de não nascer nada, a **sobra acumulada é zerada**: voltar para a
qualidade alta não pode despejar de uma vez um punhado de partículas atrasadas.

## 6. O que **não** deixa rastro

- **Ao amanhecer** ele sobe e some sem pó — a saída é pacífica, não é abate. O
  ramo da partida continua antes do trecho que solta pó, então isso é garantido
  pela ordem do código, não por um `if`.
- **Morto** já soltava outra coisa: o pó-item (`MOFIM_DUST`) que o jogador pega.

## Testes

`tests/creature-dust.test.mjs` (novo, 12): escala por modo, ritmo (`dustStep`:
parado, teto por quadro, acúmulo de passos pequenos, escala zero), desbotamento
(`dustFade`) e o pool (nasce/sobe/some, teto de vagas, transparência e tamanho
caindo, ≤ 4 materiais, `clear()`, e sem cena não quebra).

`tests/creature.test.mjs` (+6): parado não solta pó e andando solta; o rastro
apaga sozinho; Baixa não solta nada; a partida ao amanhecer não deixa pó; o pouso
levanta a nuvem; e **descer um degrau não levanta nuvem** (planeio curto não é
voo).

Suíte: **605 → 623 testes**.

## Ainda de fora

- **rajada de pó no chilreio**: o pulso de luz já marca o som; mais partícula
  aqui viraria fogos de artifício;
- ~~**pó reagindo ao vento**~~: feito depois, em dois PRs — o
  [vento no capim](MELHORIA-20261105-vento-no-capim.md) e o
  [pó ao vento](MELHORIA-20261105-po-ao-vento.md).

## Como conferir no jogo

Item **9** novo em `TESTE-EM-NAVEGADOR.md`.
