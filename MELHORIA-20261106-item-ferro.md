# MELHORIA: o item de ferro bruto ganha arte própria (opção E · grumos espelhada)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/iron-item-texture.test.mjs`

## O problema

O cobre bruto saiu do sprite automático no #111; o **ferro bruto** continuava no
“minério bruto” genérico — três bolhas redondas com contorno, a mesma arte do
ouro bruto. Na barra, ferro e ouro só se separavam pela cor.

## A escolha (feita antes de codar)

Cinco formas desenhadas à mão, mostradas no comparador (`preview/ferro-item.html`)
**na casa do inventário**:

| Opção | Ideia | Cobertura |
| --- | --- | --- |
| A · Punhado | três pedaços iguais, como o carvão | 34% |
| B · Pepitas | cinco pepitas pequenas | 29% |
| C · Lascas | pedaços compridos na diagonal | 27% |
| D · Pedra grande | um pedaço gordo e dois cacos | 37% |
| **E · Grumos** ✅ | quatro grumos — a mesma família do cobre | **31%** |

**Escolhida: E (grumos)**, a família de forma do cobre. Para não repetir o
problema que esta rodada existe para resolver (dois itens com o mesmo desenho),
a máscara do ferro é **espelhada** e com outros tamanhos: no cobre o grumo grande
está em cima à esquerda, no ferro em cima à direita; os de baixo trocam de lugar
e de tamanho. A cor faz o resto: pêssego claro contra laranja.

## Como ficou

Arte de **item**: 16×16 px, fundo transparente, 1 px por célula da máscara,
relevo do `pintarItem` (cima/esquerda acende, baixo/direita escurece).

| escuro | corpo | meio | claro |
| --- | --- | --- | --- |
| `88,64,48` | `160,112,80` | `192,152,112` | `224,192,152` |

A paleta é a do veio do bloco (pêssego), a mesma família que separa o ferro do
cobre na parede. O `ARTES_ITEM_BRUTO` ganhou a entrada `iron`, então
`createMineralSpritePixels('raw', 'iron')` já devolve a arte nova — o item na
barra, na mão e no chão usa a mesma fonte.

## Provas

- **1053** testes na suíte (8 novos em `tests/iron-item-texture.test.mjs`):
  - máscara 16×16 só com vazio e ferro, cobertura 27–35% (ficou em 31%);
  - **são grumos**: 4 a 6 pedaços, todos com 8+ px, o maior com no máximo 22, e
    tamanhos diferentes entre si;
  - a arte é 1 px por célula: ferro onde a máscara manda, transparente no resto;
  - **relevo**: exatamente os quatro tons da paleta, claro em cima/esquerda e
    escuro embaixo/direita;
  - **é ferro**: R > G > B, média quente (R−B > 55) e clara (R > 150);
  - **não confunde com o cobre**: máscaras diferentes, mais claro e menos
    saturado que ele, e o sprite difere em pelo menos 12 px;
  - **o ouro segue no genérico** (`rawItemMaskFor('gold')` é `null`), com sprite
    próprio, diferente do ferro;
  - determinístico, cores em 0–255.
- **Prova de força** (4 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| ferro volta ao sprite genérico | 6 |
| máscara do ferro vira a do cobre | 1 |
| paleta do ferro vira a do cobre | 2 |
| relevo invertido no item | 2 |

O teste do cobre também foi ajustado: ele afirmava que **só** o cobre tinha arte
desenhada — agora afirma que cada minério tem a sua e que o ouro é o que falta.

## Próximo passo

Ouro bruto — mesma receita: opções A–E na casa do inventário, escolha, máscara e
paleta próprias, e mais uma entrada em `ARTES_ITEM_BRUTO`.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 49.
