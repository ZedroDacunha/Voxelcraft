# MELHORIA: o cobre vira escamas na pedra (opção E)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/copper-texture.test.mjs`

## O problema

O carvão já tinha veio desenhado à mão (PR #103), mas o cobre — e todos os outros
minérios — continuavam no **veio genérico**: cinco losangos miúdos com listras de
1 px, iguais para todo minério. O cobre só se distinguia pela cor.

## A escolha (feita antes de codar)

Cinco formas desenhadas sobre a **pedra de verdade**, no comparador
(`preview/cobre.html`), cada uma mostrada num bloco e em quatro blocos juntos:

| Opção | Ideia | Cobertura |
| --- | --- | --- |
| A · Clássico | cinco pedaços médios espalhados | 36% |
| B · Veio fino | fenda ramificada atravessando o bloco | 21% |
| C · Nódulos | pepitas pequenas e irregulares | 29% |
| D · Filão | poucos pedaços grandes e densos | 52% |
| **E · Escamas** ✅ | pedaços alongados na diagonal | **34%** |

**Escolhida: E.** A cor laranja já separa o cobre do carvão; o que faltava era uma
forma própria. As escamas dão “metal preso na pedra” — e não um bloco laranja
chapado, que é o que o filão (D) fazia.

## Como ficou

Mesma receita do carvão, agora com o veio do cobre:

| Peça | O que faz |
| --- | --- |
| `COBRE` | paleta laranja + máscara 16×16 (cada célula = **2×2 px** do tile) |
| `VEIOS_ARTE` | mapa `tile → arte`; hoje carvão e cobre, cada novo minério entra aqui |
| `VEIOS` | derivado do mapa: `pintarVeio(mascara, paleta)` para cada arte |
| relevo | beirada de cima/esquerda acende, a de baixo/direita escurece |
| miolo | `meio`/`corpo` sorteados por bloco + uma lasca de `brilho` |
| fundo | a **pedra de verdade** (`stonePixel`), como no carvão |

Paleta (múltiplos de 8, como o atlas arredonda):

| escuro | corpo | meio | claro | brilho |
| --- | --- | --- | --- | --- |
| `56,32,24` | `120,64,40` | `160,88,56` | `208,128,88` | `248,176,120` |

`oreMaskFor(tile)` passou a ler do mesmo mapa, então o teste confere a máscara de
qualquer minério desenhado.

## Provas

- **1010** testes na suíte (8 novos em `tests/copper-texture.test.mjs`):
  - máscara 16×16 só com pedra e veio, cobertura 25–45%;
  - **seis escamas graúdas** (a maior com 16 blocos, pelo menos quatro com 12+);
  - dentro do veio, cada bloco de 2×2 px é de uma cor só (traço chunky);
  - relevo: beirada de cima/esquerda clara, de baixo/direita escura, com 4+ tons;
  - **é laranja**: R > G > B no veio inteiro, R−B > 60, e destoa da pedra cinza;
  - **não repete o carvão**: máscaras diferentes, cobre quente (R−B > 60) e carvão
    neutro (R−B < 15);
  - determinístico, canais em 0–255, sem listra de 1 px no meio do veio.
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| cobre volta ao veio genérico | 7 |
| máscara do cobre vira a do carvão | 3 |
| paleta inteira do cobre vira a do carvão | 2 |
| cobre esverdeado (matiz errado) | 2 |
| relevo invertido no bloco | 1 |

- Também **consertado um teste morto**: o “sem listra de 1 px” do carvão comparava
  o pixel com ele mesmo (`cor(x, y - 1 < 0 ? 0 : y)`), então nunca pegava nada.
  Agora ele olha só dentro do veio e compara com o pixel vizinho de verdade.

## Próximo passo

Ferro, ouro e diamante — mesma receita: opções A–E sobre a pedra, escolha, máscara
e paleta próprias, e uma entrada nova em `VEIOS_ARTE`.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 44.
