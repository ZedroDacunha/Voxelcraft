# MELHORIA: o diamante ganha veio próprio (opção B · estilhaços)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/diamond-texture.test.mjs`

## O problema

Era o último minério no **veio genérico** — os losangos miúdos com listras de 1 px
que todo minério tinha antes do carvão (#103), do cobre (#107), do ferro (#108) e
do ouro (#109). Justo o mais raro do jogo, o que mais precisa se anunciar quando
o jogador abre a caverna.

## A escolha (feita antes de codar)

Cinco formas desenhadas sobre a **pedra de verdade**, no comparador
(`preview/diamante.html`), cada uma num bloco e em quatro blocos juntos:

| Opção | Ideia | Cobertura |
| --- | --- | --- |
| A · Clássico | cinco pedaços médios, como no ferro e no ouro | 37% |
| **B · Estilhaços** ✅ | doze lascas pequenas e irregulares espalhadas | **26%** |
| C · Veio fino | fenda fina na diagonal, que se abre num ramo | 25% |
| D · Filão | poucos pedaços grandes e densos | 53% |
| E · Facetado | losangos grandes com quina viva | 38% |

**Escolhida: B (estilhaços).** O diamante fecha a progressão: o carvão é filão
gordo, o ferro é mancha, o ouro é pontilhado e o diamante é **lasca solta** —
formas diferentes em cada degrau, então a silhueta já diz qual minério é mesmo
antes da cor.

## Como ficou

Mais uma entrada no mapa `VEIOS_ARTE` (`tile → arte`), que já existia desde o
cobre — o desenho é o de sempre: máscara 16×16 blocos (cada bloco = 2×2 px),
relevo automático (cima/esquerda acende, baixo/direita escurece), miolo sorteado
por bloco e fundo de **pedra de verdade**.

Paleta ciano-gelo (múltiplos de 8, como o atlas arredonda):

| escuro | corpo | meio | claro | brilho |
| --- | --- | --- | --- | --- |
| `24,88,112` | `48,152,176` | `80,196,216` | `136,232,240` | `216,253,255` |

Com os cinco veios desenhados à mão, o `createMineralOrePixel` não tem mais
nenhum minério caindo no veio genérico — o caminho antigo só fica como reserva
para um tile futuro que ainda não tenha arte.

## Cores medidas (média só dos blocos do veio)

| Minério | RGB | brilho | B−R | saturação |
| --- | --- | --- | --- | --- |
| carvão | `58,60,69` | 60 | 10 | 15% |
| cobre | `165,99,67` | 115 | −98 | 59% |
| ferro | `173,133,101` | 141 | −71 | 41% |
| ouro | `218,181,72` | 180 | −146 | 67% |
| **diamante** | **`109,199,211`** | **173** | **101** | **48%** |
| pedra | `124,125,126` | 125 | 2 | 2% |

O diamante é o **único frio** da parede: todos os outros têm B abaixo de R (ou,
no carvão, praticamente cinza). Quem separa o diamante da pedra é o azul; quem
separa dos outros minérios é o sinal de B−R.

## Provas

- **1037** testes na suíte (9 novos em `tests/diamond-texture.test.mjs`):
  - máscara 16×16 só com pedra e veio, cobertura 22–32% (ficou em 26%);
  - **são estilhaços**: 10 a 16 lascas, a maior com no máximo 12 blocos, nenhuma
    com 1–2 blocos e pelo menos quatro com 5+;
  - blocos de 2×2 px uniformes dentro do veio;
  - relevo claro em cima/esquerda, escuro embaixo/direita, com 4+ tons;
  - **é ciano**: B > G > R, saturação > 90 e B−R > 80, contra a pedra cinza
    (saturação < 10);
  - **é o único frio**: B−R pelo menos 60 acima do carvão, do cobre, do ferro e
    do ouro, e brilho > 140 (não vira borrão escuro);
  - as cinco máscaras (carvão, cobre, ferro, ouro, diamante) são diferentes;
  - determinístico, canais em 0–255, sem listra de 1 px dentro do veio.
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| diamante volta ao veio genérico | 8 |
| máscara do diamante vira a do carvão | 3 |
| paleta do diamante vira a do carvão | 2 |
| paleta do diamante vira a do ouro | 2 |
| relevo invertido no bloco | 2 |

## Estado da rodada

Carvão (#103), cobre (#107), ferro (#108), ouro (#109) e diamante (este PR):
**a rodada dos minérios está completa** — todos os cinco têm máscara e paleta
próprias, todas sobre a pedra de verdade, cada uma distinguível das outras por
forma e por cor.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 47.
