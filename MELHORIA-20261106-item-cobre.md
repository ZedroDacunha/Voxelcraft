# MELHORIA: o item de cobre bruto ganha arte própria (opção E · grumos)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/copper-item-texture.test.mjs`

## O problema

O bloco de cobre já tinha veio de escamas (#107), mas o **item** — o “Cobre
bruto” da barra e do inventário — continuava no sprite automático de minério
bruto: três bolhas redondas com contorno, geradas por conta no código. O
problema não era a forma em si, era ser **a mesma arte para cobre, ferro e
ouro**, só trocando a paleta: dava para trocar os itens de lugar na barra sem
ninguém notar.

O carvão já tinha saído desse sprite no #104, com arte desenhada à mão (três
pedaços). O cobre é o segundo, na mesma receita.

## A escolha (feita antes de codar)

Cinco formas desenhadas à mão, mostradas no comparador (`preview/cobre-item.html`)
**na casa do inventário**, que é como o jogador vê o ícone:

| Opção | Ideia | Cobertura |
| --- | --- | --- |
| A · Punhado | três pedaços, no mesmo lugar do item de carvão | 34% |
| B · Pepitas | cinco pepitas pequenas e soltas | 29% |
| C · Lascas | três lascas na diagonal, como as escamas do bloco | 24% |
| D · Pedra grande | um pedaço grande e dois cacos | 38% |
| **E · Grumos** ✅ | quatro grumos de tamanhos diferentes | **30%** |

**Escolhida: E (grumos).** Um punhado apertado, sem a simetria do carvão: o
grumo grande em cima e três embaixo faz o item parecer colhido à mão, e ainda
diferencia a **silhueta** do carvão (três pedaços iguais), não só a cor.

## Como ficou

Arte de **item**: 16×16 pixels com fundo transparente, cada célula da máscara
valendo **um** pixel do ícone (no bloco, valia 2×2). O relevo é o mesmo
`pintarItem` do carvão: beirada de cima/esquerda clara, de baixo/direita escura,
miolo sorteado entre corpo e meio.

Paleta laranja queimado, a mesma família do veio do bloco:

| escuro | corpo | meio | claro |
| --- | --- | --- | --- |
| `104,56,40` | `168,88,56` | `200,120,80` | `232,152,104` |

O `createMineralSpritePixels('raw', material)` passou a consultar um mapa
`ARTES_ITEM_BRUTO` (`material → arte`), como o `VEIOS_ARTE` faz para os blocos.
Quem ainda não tem arte desenhada (ferro e ouro brutos) continua no sprite
automático — o mapa é a porta para os próximos itens da rodada.

## Provas

- **1045** testes na suíte (8 novos em `tests/copper-item-texture.test.mjs`):
  - máscara 16×16 só com vazio e cobre, cobertura 27–33% (ficou em 30%);
  - **são grumos**: 4 a 6 pedaços, todos com 8+ px, o maior com no máximo 22, e
    tamanhos diferentes entre si;
  - a arte é 1 px por célula: cobre onde a máscara manda, transparente no resto;
  - **relevo**: usa exatamente os quatro tons da paleta, claro em cima/esquerda e
    escuro embaixo/direita;
  - **é cobre**: R > G > B, média quente (R−B > 90) e clara (R > 150);
  - **não confunde com o carvão**: máscaras diferentes, R−B do cobre pelo menos
    80 acima do carvão e brilho bem maior;
  - só o cobre tem arte desenhada — `rawItemMaskFor('iron')` e `('gold')` são
    `null`, e o ferro continua com o sprite automático;
  - determinístico, cores em 0–255.
- **Prova de força** (4 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| cobre volta ao sprite genérico | 5 |
| máscara do cobre vira a do carvão | 3 |
| paleta do cobre vira a do carvão | 3 |
| relevo invertido no item | 2 |

## Próximo passo

Ferro e ouro brutos (e depois o diamante e os lingotes) — mesma receita: opções
A–E na casa do inventário, escolha, máscara e paleta próprias, e uma entrada nova
em `ARTES_ITEM_BRUTO`.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 48.
