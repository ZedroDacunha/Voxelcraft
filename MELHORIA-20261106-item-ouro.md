# MELHORIA: o item de ouro bruto ganha arte própria (opção B · pepitas)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/gold-item-texture.test.mjs`

## O problema

Carvão (#104), cobre bruto (#111) e ferro bruto (#112) já tinham arte de item
desenhada à mão; o **ouro bruto** era o último no sprite automático de “minério
bruto” — três bolhas redondas com contorno. Justo o minério mais raro da
progressão, e o único item da família que ainda parecia genérico.

## A escolha (feita antes de codar)

Cinco formas desenhadas à mão, mostradas no comparador (`preview/ouro-item.html`)
**na casa do inventário**:

| Opção | Ideia | Cobertura |
| --- | --- | --- |
| A · Punhado | três pedaços iguais, como o carvão | 34% |
| **B · Pepitas** ✅ | oito pepitas miúdas espalhadas | **29%** |
| C · Lascas | pedaços compridos na diagonal | 27% |
| D · Pedra grande | um pedaço gordo e dois cacos | 40% |
| E · Grumos | quatro grumos, a forma do cobre e do ferro | 31% |

**Escolhida: B (pepitas).** É a mesma ideia do **veio do ouro no bloco**, que já é
pontilhado de pepitas: o item e o bloco passam a contar a mesma história. E a
silhueta fica própria — nem o punhado do carvão, nem os grumos do cobre e do ferro.

## Como ficou

Arte de **item**: 16×16 px, fundo transparente, 1 px por célula da máscara,
relevo do `pintarItem` (cima/esquerda acende, baixo/direita escurece).

| escuro | corpo | meio | claro |
| --- | --- | --- | --- |
| `152,104,24` | `200,144,24` | `232,184,40` | `248,216,96` |

A paleta é o amarelo quente do veio do bloco. `ARTES_ITEM_BRUTO` fechou a
família dos brutos: `copper`, `iron`, `gold`.

## Os três brutos, lado a lado

| Item | RGB médio | brilho | R−B | saturação |
| --- | --- | --- | --- | --- |
| cobre bruto | `188,115,78` | 133 | 110 | 110 |
| ferro bruto | `178,144,110` | 150 | 68 | 68 |
| **ouro bruto** | **`218,178,66`** | **178** | **152** | **152** |

O ouro é o mais claro e o mais amarelo; a forma (pepitas) é a terceira coisa que
separa — cor, claridade e silhueta.

## Provas

- **1061** testes na suíte (8 novos em `tests/gold-item-texture.test.mjs`):
  - máscara 16×16 só com vazio e ouro, cobertura 27–32% (ficou em 29%);
  - **são pepitas**: 6 a 10 pedaços, nenhum com menos de 6 px, o maior com no
    máximo 14, e tamanhos diferentes entre si;
  - a arte é 1 px por célula: ouro onde a máscara manda, transparente no resto;
  - **relevo**: exatamente os quatro tons da paleta, claro em cima/esquerda e
    escuro embaixo/direita;
  - **é ouro**: R > G > B, G > 150, R−B > 100 e brilho > 150;
  - **não confunde com cobre nem com ferro**: máscaras diferentes, mais claro e
    bem mais amarelo (R−B + 30) que os dois;
  - **as quatro artes de item** (carvão, cobre, ferro, ouro) têm máscaras
    distintas — nenhuma repetida;
  - determinístico, cores em 0–255.
- **Prova de força** (4 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| ouro volta ao sprite genérico | 7 |
| máscara do ouro vira a do cobre | 4 |
| paleta do ouro vira a do ferro | 3 |
| relevo invertido no item | 2 |

Os testes do cobre e do ferro foram ajustados: eles afirmavam que o ouro **ainda**
estava no sprite genérico — agora afirmam que o ouro tem arte própria, diferente
da de cada um.

## Próximo passo

O diamante (o item se chama só “Diamante”, é gema e não minério bruto) e depois
os **lingotes** de cobre, ferro e ouro, que continuam no sprite automático.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 50.
