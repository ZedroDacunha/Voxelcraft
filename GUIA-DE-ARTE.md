# GUIA DE ARTE — Voxelcraft

As regras que fazem a arte do jogo ser **nossa**. Valem para todo ícone novo:
ferramentas, itens, minérios, blocos do inventário.

> Origem: em 06/11/2026 as ferramentas tinham sido **transcritas pixel a pixel**
> do sprite clássico (256/256 iguais). Funcionava — e era cópia. Este guia é o que
> passou a valer no lugar disso, começando pelo redesenho da picareta, do machado
> e da pá ([`MELHORIA-20261106-arte-autoral-ferramentas.md`](MELHORIA-20261106-arte-autoral-ferramentas.md)).
>
> **Revisão de 07/11/2026 — base fiel com ajustes.** Depois de ver as três
> ferramentas prontas, a direção mudou: a **pirâmide de intensidade** caiu para
> *"parecida com a do jogo, com ajustes pequenos e nossos"*. A **picareta** e o
> **machado** voltaram à **base fiel** do sprite clássico e receberam só alguns
> pixels de forma, paleta suave e veios de metal
> ([`MELHORIA-20261107-picareta-ajustes.md`](MELHORIA-20261107-picareta-ajustes.md),
> [`MELHORIA-20261107-machado-ajustes.md`](MELHORIA-20261107-machado-ajustes.md)).
> A **pá** ainda é o desenho autoral do #122 — é a próxima.
> Regra prática: **a forma pode ser próxima; a cor e o detalhe são nossos.**

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
| `5` | **acento** — o amarelo-palha da casa |
| `a`…`d` | cabo de madeira, do escuro ao claro |
| `g` | couro da empunhadura |
| `s` | costura do couro |

Cada símbolo tem **uma** cor por material. Se um símbolo precisa de duas cores, a
grade está errada — e o teste pega.

## 3. As seis regras da família

1. **Silhueta reconhecível — e não copiada.** O teste compara o perfil linha a
   linha com as silhuetas de referência. A conta é **por ferramenta**:
   - picareta e machado (base fiel): **2 linhas** diferentes — **70** e **62 px**
     cheios —, porque a forma é quase a clássica de propósito e quem carrega a
     identidade é a cor;
   - pá (autoral, por enquanto): **pelo menos 8 linhas** diferentes e a contagem
     de pixels fora da faixa clássica.

   Nenhuma linha pode ser cópia exata de ponta a ponta: mesmo na base fiel, cada
   ferramenta tem um pixel de assinatura.
2. **Contorno tingido.** O `O` nunca é preto puro e muda com o material: pedra
   puxa azul, ouro puxa verde-escuro, diamante puxa ciano-escuro. É sempre a cor
   mais escura da paleta.
3. **Quatro tons + um acento.** `1`…`4` do escuro ao claro, com o `2` no meio; o
   `5` é detalhe — **no máximo 2 pixels**, sempre o mesmo amarelo-palha
   (`#ead69e`), em qualquer material. É a assinatura mais reconhecível.
   Ele é **claro, não aceso**: foi cítrico (`#fdf0a8`) até 07/11/2026, quando
   virava um ponto de luz nas pontas. A régua é o salto de luminância contra os
   vizinhos — hoje **≤ +170**, contra +194 do cítrico.
4. **Cabo comum.** `a`…`d` são os mesmos nas três ferramentas: as peças parecem
   saídas da mesma oficina.
5. **Cabo de madeira = as tábuas do jogo.** `CABO_PALETA` é literalmente o tile
   `PLANKS`: `[123,91,51]` no veio (`b`), `[151,116,67]` na sombra (`c`),
   `[202,166,106]` no claro (`d`) e `[86,62,34]` na sombra do cabo (`a`). A
   ferramenta na mão precisa parecer feita do mesmo material do chão — e, nas
   ferramentas de madeira, cabeça e cabo são quase a mesma peça.
   Um teste trava os quatro tons.
6. **Faixa de couro costurada — só na pá.** `g`/`s` na metade de baixo do cabo
   (onde a mão pega): uma faixa logo abaixo do encaixe e outra no punho. A
   **picareta** e o **machado** voltaram à base fiel **sem couro**: a faixa era a
   assinatura que mais pesava na leitura. Quando a pá voltar à base fiel, deve
   seguir o mesmo caminho.

## 4. Materiais

Seis: `wood`, `stone`, `copper`, `iron`, `gold`, `diamond`. As paletas de
material são **uma só** para a família (`PICARETA_PALETAS`), e o cobre é do nosso
jogo — não existe no sprite clássico.

As rampas puxam o matiz, não só o brilho: sombra fria no ferro e na pedra,
sombra quente no cobre e na madeira. É isso que dá o ar de "forjado" em vez de
"cinza com brilho".

**O desvio é mais visível no metal.** Na rodada de 07/11/2026 o pedido foi
explícito: a madeira fica discreta (é tábua), o metal é que se mexe. O teste mede
contra a paleta clássica, tom a tom:

| material | eixo medido | o que espera |
| --- | --- | --- |
| ferro | `b − r` | **todos** os tons azulados (≥ 8) |
| ouro | `r − b` | média mais quente que o clássico |
| diamante | `b − r` | média mais azulada que o clássico |

O eixo `r − b` sozinho **não serve para tudo**: o ouro clássico já é muito quente,
então "mais ouro" não é "mais vermelho" — é mais saturação no mesmo matiz.

## 5. Luz

A luz vem de cima e da esquerda. Na prática:

- aresta de cima e lado esquerdo com os tons claros (`3`, `4`);
- corpo com `2`;
- aresta de baixo e lado direito com `1`;
- o `5` no ponto mais alto da peça.

## 6. Ordem de trabalho

**Uma ferramenta por vez**, forma separada: picareta → machado → pá → tesoura.
Cada uma é uma rodada própria, com comparador ampliado antes de fechar e PR
próprio. Não mexer na paleta comum sem revisar as três.

## 7. O que ainda é herdado

Blocos, minérios, lingotes e itens de minério já foram desenhados aqui (com
paletas escolhidas a dedo, nas rodadas de #104 a #118). A **tesoura** é a última
ferramenta que falta e já nasce debaixo deste guia.

## 8. Aviso de boa-fé

O Voxelcraft é um jogo próprio, inspirado no gênero voxel — **não é um produto
oficial** e não tem vínculo com a Mojang ou a Microsoft. Ver o aviso no
[`README.md`](README.md).
