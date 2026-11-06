# MELHORIA: o item de machado, transcrito do desenho clássico

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js`, `world-textures.js`, `tests/axe-item-texture.test.mjs`

## O problema

O machado era o mais "montado por código" dos três: copiava o cabo do graveto e
desenhava a cabeça como um polígono de degraus, com contorno calculado e
"encaixe" na mão. O resultado não batia com o desenho clássico: o gume não tinha
o formato certo e a cabeça não tinha a sombra do original.

## A transcrição

Mesma receita da picareta (#119): a arte foi **copiada pixel a pixel** do sprite
16×16, virando uma grade de papéis.

- `O` contorno
- `1`…`5` a cabeça, do escuro ao reflexo — **cinco** tons, um a mais que a
  picareta (o machado tem mais área de cabeça, e o original usa mais degradê);
- `a`…`d` o cabo de madeira, o mesmo da picareta.

```
................
.........11.....
........1551....
.......15341....
......15333bc...
......O54323a...
.......OOb323O..
........bca33O..
.......bda.OO...
......bca.......
.....bca........
....bda.........
...bca..........
..bda...........
..aa............
................
```

São **60 px**: o gume largo em cima à esquerda, a cabeça afunilando para o
encaixe à direita, e o cabo na diagonal até a quina de baixo. O gume tem cinco
pixels de reflexo (tom `5`), que é o que dá o fio brilhando.

## Fidelidade conferida com bytes

| material | pixels idênticos |
| --- | --- |
| madeira | **256/256** |
| pedra | **256/256** |
| ferro | **256/256** |
| ouro | **256/256** |
| diamante | **256/256** |

Nenhum símbolo da grade tem mais de uma cor em nenhum material. O **cobre** é do
nosso jogo: paleta derivada do cobre fundido dos lingotes, no mesmo degradê de
cinco tons.

## Como ficou no código

- `world-tool-textures.js` ganhou `MACHADO_GRADE`, `MACHADO_PALETAS`,
  `createAxeSpritePixels(mat)`, `axeGradeFor` e `axePaletteFor`, no mesmo molde da
  picareta;
- `world-textures.js`: o galho `axe` usa a arte nova e **cai no desenho antigo**
  para material fora da arte.

## Provas

- **1114** testes na suíte (10 novos em `tests/axe-item-texture.test.mjs`):
  - grade 16×16 só com os símbolos do desenho;
  - **silhueta linha a linha** (`0,2,4,5,7,7,7,6,5,3,3,3,3,3,2,0`), 60 px, uma peça só;
  - 1 px por célula nos seis materiais;
  - **cada símbolo tem um tom** e os cinco tons de cabeça aparecem;
  - topo é cabeça, cabo é a diagonal, e o reflexo aparece **exatamente** nos cinco
    pixels do gume;
  - tons crescendo do escuro ao claro; contorno o mais escuro;
  - os seis materiais distinguíveis pela cor da cabeça, e nenhum par igual;
  - **machado ≠ picareta** (60 px contra 68), com paletas independentes;
  - material desconhecido devolve `null`; determinístico e sem sprite compartilhado.
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| machado volta ao desenho antigo | 7 |
| a grade vira um retângulo | 4 |
| todos os materiais com a paleta do ferro | 2 |
| tons da cabeça invertidos | 7 |
| cabo pintado com a cor da cabeça | 1 |

## Próximo passo

A **pá** — a última ferramenta ainda no desenho antigo.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 56.
