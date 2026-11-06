# MELHORIA: o item de lingote de ferro

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/iron-ingot-item-texture.test.mjs`

## O que muda

O lingote de ferro sai do retângulo genérico e passa a usar **a mesma forma do
lingote de cobre** — a barra clássica, tombada na diagonal, com face de cima na
luz e contorno escuro. Nada de redesenhar: `LINGOTE_GRADE` é uma só para todos os
metais; o que muda é a **paleta**.

## A escolha da cor (feita antes de codar)

Cinco opções foram mostradas na casa do inventário, com o lingote de cobre e o
minério bruto ao lado:

| Opção | Ideia |
| --- | --- |
| A · Aço frio | o cinza-azulado que o lingote já tinha no sprite antigo |
| **B · Ferro forjado** ✅ | mesmo cinza-azulado, **contraste alto**: contorno quase preto, face bem clara |
| C · Ferro polido | prata claro com reflexo branco puro |
| D · Ferro fundido | grafite, cinza neutro sem azul |
| E · Ferro com ferrugem | cinza com a sombra puxando para o laranja |

**Escolhida: B (ferro forjado).** É a que lê de longe — o contorno quase preto
fecha a silhueta da barra — e ainda fica bem distante do cobre na barra, sem
disputar a atenção nem se confundir com ele.

## A paleta

| tom | cor | onde |
| --- | --- | --- |
| 0 | `38,42,46` | contorno e sombra funda |
| 1 | `98,106,114` | corpo em sombra |
| 2 | `112,120,128` | grão do sombreado |
| 3 | `192,202,208` | face de cima na luz |
| 4 | `232,240,246` | reflexo |

Ferro é **frio**: azul acima do vermelho (B−R 14 na média), enquanto o cobre é o
contrário (R−B 81). Os dois lingotes ficam lado a lado na barra e se distinguem na
hora.

## Provas

- **1086** testes na suíte (8 novos em `tests/iron-ingot-item-texture.test.mjs`):
  - o ferro usa **exatamente a forma do cobre** (`deepEqual` com o `LINGOTE_GRADE`
    do cobre) — se alguém mexer na forma, os dois testes avisam;
  - a silhueta é a barra de **135 px**, uma peça só, linha a linha;
  - 1 px por célula, transparente fora, e **cada pixel usa o tom escrito**;
  - **ferro é frio**: B > G > R na média, e o cobre continua quente do lado;
  - **contraste alto**: contorno com luminância < 60, face > 180, diferença > 140;
  - o tom 0 é o mais escuro e o 4 o mais claro da paleta;
  - **o ouro continua genérico** (retângulo de 80 px) — a arte não vazou;
  - determinístico, cores em 0–255.
- O teste do cobre foi ajustado: antes ele exigia que **ferro** e ouro fossem
  genéricos; agora só o ouro é, e o ferro é conferido como "mesma forma, outra
  cor".
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| ferro volta ao retângulo genérico | 5 |
| ferro com a paleta do cobre | 4 |
| tons do ferro invertidos (contorno claro) | 1 |
| ferro com forma própria (retângulo) | 6 |
| ferro morno, sem azul | 2 |

## Próximo passo

O **lingote de ouro** — o último da família. Só precisa de paleta, como este.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 53.
