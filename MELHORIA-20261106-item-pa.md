# MELHORIA: o item de pá, transcrito do desenho clássico

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js`, `world-textures.js`, `tests/shovel-item-texture.test.mjs`

## O problema

A pá era o desenho mais **improvisado** das três ferramentas: copiava o cabo do
graveto e desenhava a cabeça como uma "pá" chata, de quatro linhas, com contorno
por fora. Não lembrava o original: a lâmina clássica é **redonda**, encaixada no
cabo pela esquerda, e o cabo desce na diagonal até a quina de baixo.

## A transcrição

Mesma receita da picareta (#119) e do machado (#120): a arte foi **copiada pixel
a pixel** do sprite 16×16, virando uma grade de papéis.

- `O` contorno
- `1`…`4` a lâmina, do escuro ao reflexo — **quatro** tons, como a picareta (o
  machado é que tem cinco);
- `a`…`d` o cabo de madeira, o mesmo das outras duas ferramentas.

```
................
................
...........11O..
..........1442O.
.........14324O.
........143234O.
.........b234O..
........bda4O...
.......bda.O....
......bca.......
.....bda........
....bca.........
..bbda..........
..bda...........
...aa...........
................
```

São **53 px** — a ferramenta mais enxuta das três (picareta 68, machado 60). A
lâmina ocupa o bloco de cima à direita (colunas 8–13, linhas 2–8), com o arco
iluminado no alto e o contorno escuro por fora; o cabo sai do encaixe em
`(9,6)` e desce na diagonal até a ponta em `(3,14)`, afinando em duas linhas
curtas no tom mais escuro.

O reflexo (tom `4`) são **oito** pixels, todos no arco de cima da lâmina:
`(11,3) (12,3) (10,4) (13,4) (9,5) (13,5) (12,6) (11,7)`.

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
quatro tons.

## Como ficou no código

- `world-tool-textures.js` ganhou `PA_GRADE`, `PA_PALETAS`,
  `createShovelSpritePixels(mat)`, `shovelGradeFor` e `shovelPaletteFor`, no mesmo
  molde da picareta e do machado;
- `world-textures.js`: o galho `shovel` usa a arte nova e **cai no desenho antigo**
  para material fora da arte.

## Provas

- **1127** testes na suíte (13 novos em `tests/shovel-item-texture.test.mjs`):
  - grade 16×16 só com os símbolos do desenho;
  - **silhueta linha a linha** (`0,0,3,5,6,7,5,5,4,3,3,3,4,3,2,0`), 53 px, uma peça só;
  - 1 px por célula nos seis materiais;
  - **cada símbolo tem um tom** e os quatro tons de lâmina aparecem;
  - a lâmina é o bloco de cima à direita, o cabo é a diagonal até a quina, e o
    reflexo aparece **exatamente** nos oito pixels do arco;
  - **a ponta do cabo** afina e usa o tom mais escuro;
  - **as paletas batem tom por tom** com o desenho clássico (hex a hex);
  - tons crescendo do escuro ao claro; contorno o mais escuro;
  - os seis materiais distinguíveis pela cor da lâmina, e nenhum par igual;
  - o cabo é o **mesmo** das outras ferramentas;
  - **pá ≠ picareta ≠ machado** (53 contra 68 e 60), com paletas independentes;
  - material desconhecido devolve `null`; determinístico e sem sprite compartilhado.
- **Prova de força** (6 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| reflexo da lâmina vira tom 3 | 1 |
| a ponta do cabo troca de tom | 1 |
| a última linha do cabo some | 1 |
| tom mais claro do ferro escurece | 2 |
| o cobre perde a paleta | 9 |
| a lâmina do diamante vira roxa | 1 |

## Próximo passo

A **tesoura** — a última ferramenta ainda no desenho antigo.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 57.
