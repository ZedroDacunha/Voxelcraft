# MELHORIA: a vida parada da ovelha — respiração, cauda, orelha e o espiar

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-sheep.js`, `tests/sheep.test.mjs`

## As escolhas (feitas antes de codar)

O pacote **D** do menu de movimentação: com a ovelha **parada**, dar sinal de vida.

| Peça | Como se mexe | Constante |
| --- | --- | --- |
| **respiração** | a lã sobe e desce **1,2 cm**, um ciclo a cada ~2,4 s | `SHEEP_BREATH_LIFT`, `SHEEP_BREATH_RATE` |
| **cauda** | vai e vem de ±8° num ritmo mais rápido que a respiração | `SHEEP_TAIL_SWAY`, `SHEEP_TAIL_RATE` |
| **orelha** | **uma** orelha treme por 0,32 s a cada 3–6,5 s | `SHEEP_EAR_TWITCH`, `SHEEP_EAR_TWITCH_TIME` |
| **espiar** | a cada 5–9 s a cabeça vira ~23° para um lado, segura e volta | `SHEEP_IDLE_LOOK` |

E o detalhe que amarra tudo: **cada ovelha tem a sua fase**, sorteada do `id`.
Sem isso o bando respira, balança a cauda e espia em uníssono — pior do que
estátuas.

## Antes

Parada — pastando ou esperando — a ovelha era **imóvel**, exceto pela cabeça do
pasto. Os tufos de lã, a cauda e as orelhas ficavam congelados na pose de
nascimento. De perto, o bicho parecia um enfeite.

## Depois

Tudo numa função pura, `idlePoseFor(at, id, { pasto })`, que devolve os números
prontos para o modelo:

```js
{ breath, tail, ear, earSide, look }
```

| Campo | Conta |
| --- | --- |
| `breath` | `SHEEP_BREATH_LIFT · sin(t · 0,42 · 2π + fase)` |
| `tail` | `SHEEP_TAIL_SWAY · sin(t · 2,1 + fase·0,7)` |
| `ear` | janela de 0,32 s a cada 3–6,5 s, com envelope de meio seno, **num lado só** |
| `look` | envelope de 12% subindo, 28% segurando, 12% voltando; lado sorteado por ciclo |

O `look` é multiplicado por `1 − pasto`: com o focinho na grama a cabeça está
ocupada, e o espiar fica para quando ela levanta. No susto, o `1 − lookAmount`
do olhar existente manda mais — a ovelha encara o jogador, não espia.

### O que se move no modelo

- o **miolo da lã** (`body`) e **os nove tufos** sobem juntos com a respiração;
- o **rabo** sobe um pouco menos (60% do respiro) e gira em `rotation.y`;
- as **orelhas** somam o tremor em cima da pose de repouso guardada em
  `userData.baseZ` — a orelha continua caída, só treme;
- a **cabeça** soma o espiar em `rotation.y`.

As **patas não se movem**: a respiração é da lã, não um flutuar do bicho inteiro
(a caixa do corpo sobe contra as pernas, que é o que se vê num animal de verdade).

## Provas

- 86 testes em `tests/sheep.test.mjs` (943 na suíte).
- Dois novos:
  - **"a vida parada: respira, balança a cauda, treme a orelha e espia"** — faixas
    de amplitude, mudança com o tempo, fase própria por ovelha, orelha quieta >8×
    mais tempo do que tremendo, cabeça reta na maior parte do tempo e **zero
    espiar** com `pasto = 1`;
  - **"parada, ela respira e mexe a cauda sem tirar as patas do chão"** — 6 s de
    jogo: a lã sobe e desce (> 1 cm e ≤ 2 × a amplitude), a cauda balança, as
    patas ficam **exatamente** onde estavam, ela não anda e a cabeça espia —
    com **uma** orelha de cada vez.
- **Prova de força** (8 mutações, todas derrubam teste):

| Mutação | Testes que quebram |
| --- | --- |
| sem respiração | 85, 86 |
| sem cauda | 85, 86 |
| sem tremor de orelha | 85 |
| sem espiar | 85, 86 |
| espiar com a cabeça na grama | 85 |
| todas na mesma fase | 85 |
| respiração movendo as patas | 27, 86 |
| tremor nas duas orelhas | 86 |

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 34.
