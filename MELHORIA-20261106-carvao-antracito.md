# MELHORIA: o carvão vira antracito (opção D)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-mineral-textures.js`, `tests/coal-texture.test.mjs`

## A escolha (feita antes de codar)

Cinco opções desenhadas sobre a pedra de verdade, no comparador
(`preview/carvao.html`):

| Opção | Ideia | Cobertura |
| --- | --- | --- |
| A · Clássico | cinco pedaços graúdos, quina quebrada | ~25% |
| B · Veios | fenda fina ramificada | ~21% |
| C · Nódulos | pedacinhos pequenos espalhados | ~18% |
| **D · Antracito** ✅ | poucos pedaços, grandes e densos | **~46%** |
| E · Contorno | pedaços chapados com contorno escuro | ~26% |

**Escolhida: D.** O carvão é o primeiro minério que o jogador encontra e o único
que precisa ser lido **de longe**, no escuro da caverna: pedaço grande e denso
salta da parede antes de ele chegar perto.

## Como ficou

O veio deixou de ser "losangos miúdos listrados" (o veio genérico que servia para
todos os minérios) e virou **pixel art desenhada**: uma máscara de 16×16 blocos,
cada bloco valendo 2×2 pixels, mais um **relevo automático**.

| Peça | O que faz |
| --- | --- |
| máscara 16×16 | só diz **onde** tem carvão; 4 pedaços grandes (o maior com 34 blocos) |
| bloco de 2×2 px | é o que dá o traço chunky: pedaço de 3–4 blocos fica com 6–8 px |
| relevo | beirada de cima/esquerda acende, a de baixo/direita escurece |
| miolo | 2 tons + lasca de brilho (sorteio fixo por bloco) |
| bloco sozinho | fica chapado (sem beirada), senão vira um "+" claro na pedra |
| paleta | `escuro 21,21,26` · `corpo 39,39,46` · `meio 52,52,60` · `claro 82,86,98` · `brilho 118,122,134` |

O fundo continua sendo a **pedra** (do PR anterior): o carvão é pedra com veio, não
outro material.

A conta do relevo (`pintarVeio`) é a mesma que os próximos minérios vão usar — cada
um só precisa da sua máscara e da sua paleta.

## Provas

- **984** testes na suíte (7 novos em `tests/coal-texture.test.mjs`).
  - a máscara é 16×16, só com pedra e veio, e cobre 35–60% do bloco (antracito é
    denso, mas não toma o tile);
  - são **poucos pedaços** (3–7) e os maiores são graúdos (≥ 8 blocos, pelo menos
    dois com 6+);
  - dentro do veio, cada bloco de 2×2 px é de uma cor só (traço chunky);
  - o relevo: beirada de cima/esquerda clara, de baixo/direita escura;
  - carvão escuro: média < 65 e nenhum pixel passa de 130 (a pedra atrás é > 100);
  - tudo determinístico, nada fora de 0–255, e sem listra de 1 px sobrando.
- **Prova de força** (5 mutações, todas derrubam teste):

| Mutação | Testes que caem |
| --- | --- |
| o carvão volta ao veio genérico | 3 |
| relevo invertido (luz embaixo/direita) | 2 |
| pedaços miúdos (bloco de 1 px) | 3 |
| paleta clara (carvão virando pedra) | 2 |
| sem relevo (tudo chapado) | 2 |

## Próximo passo

O próximo minério (cobre, ferro, ouro, diamante) — mesma receita: opções A–E
desenhadas sobre a pedra, escolha, máscara e paleta próprias.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 40.
