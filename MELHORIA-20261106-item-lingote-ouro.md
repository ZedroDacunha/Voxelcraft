# MELHORIA: o item de lingote de ouro — a família dos lingotes fecha

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/gold-ingot-item-texture.test.mjs`

## O que muda

O lingote de ouro sai do retângulo genérico e passa a usar **a mesma forma do
lingote de cobre e do de ferro**. Como já era de esperar, a mudança é **só de
paleta**: `LINGOTE_GRADE` continua sendo uma só para todos os metais.

Com isso, os **três lingotes** (cobre, ferro e ouro) estão prontos — e nenhum
item de minério/gema/Lingote do jogo ficou no sprite automático. O retângulo
genérico continua no código, mas agora só serve de rede para um metal fora da
arte.

## A escolha da cor (feita antes de codar)

Cinco opções na casa do inventário, na barra ao lado do cobre, do ferro e do ouro
bruto:

| Opção | Ideia |
| --- | --- |
| A · Ouro clássico | o dourado que o lingote já tinha no sprite antigo |
| **B · Ouro brilhante** ✅ | o mesmo dourado com **contraste alto**, como o ferro: contorno quase preto, face quente, reflexo quase branco |
| C · Ouro velho | mais escuro e fosco |
| D · Ouro pálido | amarelo quase creme (perde a identidade em 48 px) |
| E · Ouro fundido | puxa para o laranja e **encosta no cobre** |

**Escolhida: B (ouro brilhante)** — fecha a família com o mesmo desenho de
contraste do ferro (contorno escuro + face clara), e é a que mais lê de longe.

## A paleta

| tom | cor | onde |
| --- | --- | --- |
| 0 | `70,48,12` | contorno e sombra funda |
| 1 | `186,138,32` | corpo em sombra |
| 2 | `204,158,42` | grão do sombreado |
| 3 | `252,216,86` | face de cima na luz |
| 4 | `255,246,178` | reflexo |

O ouro é o **mais amarelo** dos três: verde e vermelho bem acima do azul (G−B 93
na média), contra o cobre laranja (R−G 54, G−B 27) e o ferro frio (azul acima de
tudo). Na barra, os três não se confundem.

## Provas

- **1095** testes na suíte (9 novos em `tests/gold-ingot-item-texture.test.mjs`):
  - **mesma forma** do cobre e do ferro (`deepEqual` com os dois);
  - a barra de **135 px**, linha a linha;
  - 1 px por célula, transparente fora, e **cada pixel com o tom do desenho**;
  - **é ouro**: verde e vermelho acima do azul (G−B > 70), e vermelho/verde perto
    (`|R−G| < 60`) — o que separa o amarelo do laranja do cobre;
  - **os três se distinguem pela cor**: o ouro é o mais amarelo, o cobre o mais
    laranja, o ferro o único frio; a face do ouro é a mais clara;
  - **contraste alto**: contorno < 60 de luminância, face > 190, diferença > 150;
  - **a família fecha**: cobre, ferro e ouro têm arte de 135 px, e um metal fora
    da arte (`tin`) continua caindo no retângulo genérico de 80 px;
  - determinístico, cores em 0–255.
- Os testes do cobre e do ferro foram ajustados: eles exigiam que o **ouro**
  continuasse genérico. Agora conferem o ouro como "mesma forma, outra cor", e a
  rede do genérico passou a ser testada com um metal que não existe na arte.
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| ouro volta ao retângulo genérico | 7 |
| ouro com a paleta do ferro | 4 |
| tons do ouro invertidos (contorno claro) | 1 |
| ouro esverdeado (lima) | 1 |
| ouro sem contraste (contorno claro) | 1 |

## Fim da rodada dos minérios

Com esta PR, **todos** os itens de minério têm arte de item desenhada:

- **blocos e veios**: cobre, ferro, ouro, diamante;
- **itens brutos**: carvão, cobre, ferro, ouro;
- **gemas**: diamante;
- **lingotes**: cobre, ferro, ouro.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 54.
