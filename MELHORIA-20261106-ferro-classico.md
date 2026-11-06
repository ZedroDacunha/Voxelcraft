# MELHORIA: o ferro ganha veio próprio (opção A · clássico)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/iron-texture.test.mjs`

## O problema

Carvão (PR #103) e cobre (PR #107) já tinham veio desenhado à mão; o ferro — e o
ouro e o diamante — continuavam no **veio genérico**: cinco losangos miúdos com
listras de 1 px, iguais para todo minério.

## A escolha (feita antes de codar)

Cinco formas desenhadas sobre a **pedra de verdade**, no comparador
(`preview/ferro.html`), cada uma num bloco e em quatro blocos juntos:

| Opção | Ideia | Cobertura |
| --- | --- | --- |
| **A · Clássico** ✅ | cinco pedaços médios e arredondados | **35%** |
| B · Grumos | muitos grumos pequenos e irregulares | 28% |
| C · Placas | pedaços chatos empilhados | 32% |
| D · Filão | poucos pedaços grandes e densos | 53% |
| E · Cristais | losangos angulosos com quina viva | 37% |

**Escolhida: A.** O ferro é o minério “do meio” da progressão — nem raro como o
ouro, nem banal como o carvão. A forma neutra combina: a cor pêssego já separa o
ferro do carvão (cinza) e do cobre (laranja).

## Como ficou

Mais uma entrada no mapa `VEIOS_ARTE` (`tile → arte`), que já existia desde o
cobre — o desenho é o de sempre: máscara 16×16 blocos (cada bloco = 2×2 px),
relevo automático (cima/esquerda acende, baixo/direita escurece), miolo sorteado
por bloco e fundo de **pedra de verdade**.

Paleta pêssego (múltiplos de 8, como o atlas arredonda):

| escuro | corpo | meio | claro | brilho |
| --- | --- | --- | --- | --- |
| `80,56,44` | `152,104,76` | `184,132,96` | `216,176,136` | `248,224,192` |

O ferro é **mais claro e menos saturado** que o cobre — é o que separa os dois
“laranjas” na parede. É também o primeiro par de minérios que precisa ser
distinguido por *matiz + claridade*, e o teste garante isso.

## Provas

- **1019** testes na suíte (9 novos em `tests/iron-texture.test.mjs`):
  - máscara 16×16 só com pedra e veio, cobertura 30–45%;
  - seis pedaços médios (maior com 20 blocos, pelo menos cinco com 11+);
  - blocos de 2×2 px uniformes dentro do veio;
  - relevo claro em cima/esquerda, escuro embaixo/direita, com 4+ tons;
  - **é pêssego**: R > G > B, R−B > 40, e o veio é colorido (saturação > 40)
    enquanto a pedra é cinza (saturação < 10);
  - **ferro × cobre**: mais claro (brilho + 15) e menos saturado que o cobre;
  - as três máscaras (carvão, cobre, ferro) são diferentes entre si;
  - determinístico, canais em 0–255, sem listra de 1 px dentro do veio.
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| ferro volta ao veio genérico | 8 |
| máscara do ferro vira a do carvão | 5 |
| paleta do ferro vira a do carvão | 2 |
| paleta do ferro vira a do cobre | 1 |
| relevo invertido no bloco | 1 |

## Próximo passo

Ouro e diamante — mesma receita: opções A–E sobre a pedra, escolha, máscara e
paleta próprias, e uma entrada nova em `VEIOS_ARTE`.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 45.
