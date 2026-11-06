# GUIA DE ARTE — Voxelcraft

As regras que fazem a arte do jogo ser **nossa**. Valem para todo ícone novo:
ferramentas, itens, minérios, blocos do inventário.

> Origem: em 06/11/2026 as ferramentas tinham sido **transcritas pixel a pixel**
> do sprite clássico (256/256 iguais). Funcionava — e era cópia. Este guia é o que
> passou a valer no lugar disso, começando pelo redesenho da picareta, do machado
> e da pá ([`MELHORIA-20261106-arte-autoral-ferramentas.md`](MELHORIA-20261106-arte-autoral-ferramentas.md)).

## 1. A grade

- **16×16**, 1 pixel por célula, fundo transparente.
- Um desenho por ferramenta, **para todos os materiais**: o que muda é a paleta.
- Nada de antialiasing nem de meio pixel: ou a célula é cheia, ou é vazia.

## 2. O alfabeto do ícone

| símbolo | papel |
| --- | --- |
| `.` | vazio (transparente) |
| `O` | contorno, **tingido** com a sombra do material |
| `1`…`4` | corpo, do escuro ao claro |
| `5` | **acento** — o amarelo-cítrico da casa |
| `a`…`d` | cabo de madeira, do escuro ao claro |
| `g` | couro da empunhadura |
| `s` | costura do couro |

Cada símbolo tem **uma** cor por material. Se um símbolo precisa de duas cores, a
grade está errada — e o teste pega.

## 3. As cinco regras da família

1. **Silhueta própria.** Nenhuma ferramenta repete o perfil do sprite clássico.
   O teste compara linha a linha com as silhuetas de referência e exige pelo menos
   **8 linhas** diferentes.
2. **Contorno tingido.** O `O` nunca é preto puro e muda com o material: pedra
   puxa azul, ouro puxa verde-escuro, diamante puxa ciano-escuro. É sempre a cor
   mais escura da paleta.
3. **Quatro tons + um acento.** `1`…`4` do escuro ao claro, com o `2` no meio; o
   `5` é detalhe — **no máximo 2 pixels**, sempre o mesmo amarelo-cítrico
   (`#fdf0a8`), em qualquer material. É a assinatura mais reconhecível.
4. **Cabo comum.** `a`…`d` são os mesmos nas três ferramentas: as peças parecem
   saídas da mesma oficina.
5. **Faixa de couro costurada.** Toda ferramenta tem `g`/`s` no cabo, na metade
   de baixo (onde a mão pega). Uma faixa logo abaixo do encaixe e outra no punho.

## 4. Materiais

Seis: `wood`, `stone`, `copper`, `iron`, `gold`, `diamond`. As paletas de
material são **uma só** para a família (`PICARETA_PALETAS`), e o cobre é do nosso
jogo — não existe no sprite clássico.

As rampas puxam o matiz, não só o brilho: sombra fria no ferro e na pedra,
sombra quente no cobre e na madeira. É isso que dá o ar de "forjado" em vez de
"cinza com brilho".

## 5. Luz

A luz vem de cima e da esquerda. Na prática:

- aresta de cima e lado esquerdo com os tons claros (`3`, `4`);
- corpo com `2`;
- aresta de baixo e lado direito com `1`;
- o `5` no ponto mais alto da peça.

## 6. O que ainda é herdado

Blocos, minérios, lingotes e itens de minério já foram desenhados aqui (com
paletas escolhidas a dedo, nas rodadas de #104 a #118). A **tesoura** é a última
ferramenta que falta e já nasce debaixo deste guia.

## 7. Aviso de boa-fé

O Voxelcraft é um jogo próprio, inspirado no gênero voxel — **não é um produto
oficial** e não tem vínculo com a Mojang ou a Microsoft. Ver o aviso no
[`README.md`](README.md).
