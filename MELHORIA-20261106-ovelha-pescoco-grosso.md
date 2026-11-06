# MELHORIA: o pescoço da ovelha — mais grosso e com gola

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-sheep.js`, `tests/sheep.test.mjs`

## As escolhas (feitas antes de codar)

Comparador no navegador com três desenhos do pescoço (mesma ovelha, em pé,
pastando e olhando de lado):

| Variante | Desenho | Resultado |
| --- | --- | --- |
| A · discreto | um bloco, 0,26 de lado | sem peça nova, mas ainda com cara de cano |
| B · afinado | dois blocos, 0,34 → 0,24 | anatômico, mas o pescoço de ovelha não afina |
| **C · gordo com gola** | **bloco de 0,32 × 0,30 + gola de lã no ombro** | **escolhida** |

## Antes

O pescoço que resolveu o "cabeça desgrudada" tinha **0,2 × 0,22** — feito para
fechar o vão, não para ser visto. Pastando, ele esticava 36 cm e aparecia como
um **cano fino** saindo de baixo da lã: fino demais para o crânio (0,36 de lado)
e, atravessando o corpo liso, deixava à mostra uma **costura reta** onde entrava
no ombro.

## Depois

### Mais grosso

`SHEEP_NECK_WIDTH` **0,2 → 0,32** e `SHEEP_NECK_DEPTH` **0,22 → 0,30**: 60% mais
largo e 36% mais fundo. Continua cabendo embaixo da cabeça — é 0,04 mais estreito
que o crânio e 0,02 mais raso —, então não estoura nas laterais do focinho.

### A gola

Três peças de lã em volta do ombro (`SHEEP_RUFF_PARTS`), paradas no corpo:

| Peça | Centro (x, y, z) | Tamanho |
| --- | --- | --- |
| peito | (0; 0,78; 0,34) | 0,46 × 0,18 × 0,20 |
| lado esquerdo | (−0,25; 0,74; 0,31) | 0,14 × 0,18 × 0,18 |
| lado direito | (0,25; 0,74; 0,31) | 0,14 × 0,18 × 0,18 |

A gola é **0,46 de largura** contra 0,32 do pescoço: cobre a junta e dá volume ao
peito, que na caixa do corpo era uma parede reta. Ela **não** segue a cabeça —
fica no ombro de propósito, para o pescoço parecer sair de dentro da lã.

O efeito é o que se queria ver:

- **em pé** o pescoço (8 cm) fica inteiro **dentro** da gola e não aparece;
- **pastando** ele estica e **sai por baixo** dela, com 10 cm de folga — a gola
  continua no ombro, como um colarinho;
- de perto, o encaixe corpo → gola → pescoço → cabeça não tem costura à vista.

Nada disso mudou a cabeça: `headPoseFor` continua mandando, o pescoço só a
acompanha (`neckPoseFor`), e as medidas do focinho e o alcance da mordida
seguem iguais.

## Provas

- 78 testes em `tests/sheep.test.mjs`. Dois novos:
  - **"o pescoço é grosso e assenta numa gola de lã no ombro"** — largura e
    profundidade mínimas, mais estreito que o crânio, três peças de gola, gola
    mais larga que o pescoço, centrada no ombro e da mesma lã do corpo;
  - **"em pé o pescoço some na gola; pastando ele sai por baixo dela"** — mede a
    ponta do pescoço contra a base da gola nas duas poses e confere que a gola
    não se mexe com a cabeça.
- **Prova de força** (mutações, todas derrubam teste):

| Mutação | Testes que quebram |
| --- | --- |
| pescoço fino de novo (0,20 × 0,22) | 77 |
| sem gola | 77, 78 |
| gola mais estreita que o pescoço | 77 |
| gola fora do ombro | 77, 78 |
| gola que segue a cabeça | 10, 14, 15, … (o modelo quebra) |

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 32.
