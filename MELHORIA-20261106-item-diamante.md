# MELHORIA: o item de diamante ganha arte própria (opção C · lasca)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/diamond-item-texture.test.mjs`

## O problema

O diamante era o último item de minério/gema no sprite automático: um losango
redondo com contorno, gerado por conta no código (`kind: 'gem'`), igual para
qualquer gema. Depois do carvão (#104), do cobre bruto (#111), do ferro bruto
(#112) e do ouro bruto (#113), ele ficou sendo o único “adesivo” da barra.

## A escolha (feita antes de codar)

O diamante não é minério bruto: é **gema**. Então as opções foram formas de
cristal, não punhados de pedra — mostradas no comparador
(`preview/diamante-item.html`), na casa do inventário:

| Opção | Ideia | Cobertura |
| --- | --- | --- |
| A · Octaedro | losango clássico, pontudo em cima e embaixo | 37% |
| B · Cristal em pé | cristal comprido, ponta em cima | 26% |
| **C · Lasca** ✅ | uma lasca grande na diagonal | **20%** |
| D · Lapidada | gema lapidada, mesa reta e bico embaixo | 28% |
| E · Dois cristais | um cristal grande e um pequeno ao lado | 23% |

**Escolhida: C (lasca).** É a mesma ideia dos **estilhaços do veio** no bloco —
item e bloco contam a mesma história — e a diagonal diferencia de tudo o que já
existe na barra (punhado do carvão, grumos do cobre e do ferro, pepitas do ouro).

## O brilho: um tom a mais

O diamante ganhou o único pixel de **brilho** do jogo. Na máscara, `*` é um pixel
de luz; a paleta tem cinco tons (os quatro do relevo + o branco-gelo):

| escuro | corpo | meio | claro | brilho |
| --- | --- | --- | --- | --- |
| `24,88,112` | `48,152,176` | `80,196,216` | `136,232,240` | `216,253,255` |

O `pintarItem` passou a entender o `*` — e, para o relevo, ele conta como sólido
(senão a beirada em volta da estrela acenderia à toa). As outras artes continuam
com quatro tons: quem não usa `*` nem define `brilho` não muda em nada.

## Como ficou no código

`createMineralSpritePixels('gem', material)` passou a consultar um mapa
**`ARTES_ITEM_GEMA`** (`material → arte`), do mesmo jeito que o `raw` consulta o
`ARTES_ITEM_BRUTO`. Quem não está no mapa continua no losango automático. Para o
teste, o acesso é `gemItemMaskFor('diamond')`.

## Provas

- **1069** testes na suíte (8 novos em `tests/diamond-item-texture.test.mjs`):
  - máscara 16×16 só com vazio, diamante e brilho, cobertura 17–24% (ficou em 20%);
  - **é uma lasca só**: uma peça de 40 a 60 px, e de 1 a 2 px de brilho;
  - a arte é 1 px por célula: diamante e brilho onde a máscara manda,
    transparente no resto;
  - **relevo**: usa os cinco tons, claro em cima/esquerda, escuro embaixo/direita,
    e todo `*` virou o branco do brilho (mais claro que qualquer tom da pedra);
  - **é ciano**: B > G > R e B−R > 90 na média;
  - **é o único item frio**: cobre, ferro e ouro têm R acima de B; o azul do
    diamante fica 80 pontos acima do azul deles;
  - a arte vive no **mapa das gemas** (não no dos brutos), e as cinco máscaras de
    item (carvão, cobre, ferro, ouro, diamante) são todas diferentes;
  - determinístico, cores em 0–255.
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| diamante volta ao losango genérico | 6 |
| máscara do diamante vira a do ouro bruto | 4 |
| paleta do diamante vira a da gema genérica (sem brilho) | 2 |
| `*` deixa de ser brilho | 1 |
| relevo invertido no item | 1 |

## Próximo passo

Os **lingotes** de cobre, ferro e ouro (`kind: 'ingot'`) — últimos itens da
família de minérios ainda no sprite automático.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 51.
