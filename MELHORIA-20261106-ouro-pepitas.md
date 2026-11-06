# MELHORIA: o ouro ganha veio próprio (opção B · pepitas)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/gold-texture.test.mjs`

## O problema

Carvão (PR #103), cobre (PR #107) e ferro (PR #108) já tinham veio desenhado à
mão; o **ouro** — e o diamante — continuavam no **veio genérico**: losangos
miúdos com listras de 1 px, iguais para todo minério. Pior: o ouro era o minério
que menos se anunciava, mesmo sendo o mais raro da progressão.

## A escolha (feita antes de codar)

Cinco formas desenhadas sobre a **pedra de verdade**, no comparador
(`preview/ouro.html`), cada uma num bloco e em quatro blocos juntos:

| Opção | Ideia | Cobertura |
| --- | --- | --- |
| A · Clássico | cinco pedaços médios, do tamanho dos do ferro | 35% |
| **B · Pepitas** ✅ | treze pepitas miúdas espalhadas pelo bloco | **28%** |
| C · Veio fino | uma fenda ramificada atravessando o bloco | 25% |
| D · Filão | poucos pedaços grandes e densos | 53% |
| E · Cristais | losangos angulosos com quina viva | 37% |

**Escolhida: B (pepitas)** — a pedido do jogador, depois de ver a C (veio fino):
pepitas soltas fazem o brilho piscar pelo bloco inteiro e ficam mais bonitas de
perto. De quebra, a forma é o oposto da do ferro (poucos pedaços médios), então
os dois nunca se confundem por silhueta: ferro é “manchas”, ouro é “pontilhado”.

## Como ficou

Mais uma entrada no mapa `VEIOS_ARTE` (`tile → arte`), que já existia desde o
cobre — o desenho é o de sempre: máscara 16×16 blocos (cada bloco = 2×2 px),
relevo automático (cima/esquerda acende, baixo/direita escurece), miolo sorteado
por bloco e fundo de **pedra de verdade**.

Paleta amarelo-ouro (múltiplos de 8, como o atlas arredonda):

| escuro | corpo | meio | claro | brilho |
| --- | --- | --- | --- | --- |
| `152,104,24` | `200,144,24` | `232,184,40` | `248,216,96` | `248,248,184` |

A sombra do ouro é **mais clara** que a do ferro e a do cobre de propósito: como
o ouro é o mais raro, o veio tem de brilhar até na beirada escura.

## Cores medidas (média só dos blocos do veio)

| Minério | RGB | brilho | R−B | saturação |
| --- | --- | --- | --- | --- |
| carvão | `58,60,69` | 60 | −10 | 15% |
| cobre | `165,99,67` | 115 | 98 | 59% |
| ferro | `173,133,101` | 141 | 71 | 41% |
| **ouro** | **`218,181,72`** | **180** | **146** | **67%** |

Ou seja: o ouro é o mais claro, o mais claro-amarelo (G alto) e o mais saturado
dos quatro. É o que o teste trava — não basta “parecer dourado”, tem de ser
distinguível do ferro e do cobre por número.

## Provas

- **1028** testes na suíte (9 novos em `tests/gold-texture.test.mjs`):
  - máscara 16×16 só com pedra e veio, cobertura 24–34% (ficou em 28%);
  - **são pepitas**: 10 a 16 pedaços, o maior com no máximo 10 blocos, nenhum
    com 1–2 blocos (senão vira sujeira) e pelo menos quatro com 5+;
  - blocos de 2×2 px uniformes dentro do veio;
  - relevo claro em cima/esquerda, escuro embaixo/direita, com 4+ tons;
  - **é amarelo**: R > G > B, saturação > 90, G > 150 e brilho > 120, contra a
    pedra cinza (saturação < 10);
  - **ouro × ferro × cobre**: brilho + 20 sobre os dois, R−B + 40 sobre os dois e
    G + 40 sobre o cobre;
  - as quatro máscaras (carvão, cobre, ferro, ouro) são diferentes entre si;
  - determinístico, canais em 0–255, sem listra de 1 px dentro do veio.
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| ouro volta ao veio genérico | 8 |
| máscara do ouro vira a do carvão | 4 |
| paleta do ouro vira a do ferro | 2 |
| paleta do ouro vira a do cobre | 2 |
| relevo invertido no bloco | 3 |

## Próximo passo

Diamante — mesma receita: opções A–E sobre a pedra, escolha, máscara e paleta
próprias, e uma entrada nova em `VEIOS_ARTE`.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 46.
