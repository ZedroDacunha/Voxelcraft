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
| `a`…`d` | cabo de madeira, do escuro ao claro |

Cada símbolo tem **uma** cor por material. Se um símbolo precisa de duas cores, a
grade está errada — e o teste pega.

## 3. As seis regras da família

1. **Silhueta reconhecível — e não copiada.** O teste compara o perfil linha a
   linha com as silhuetas de referência. A conta é **por ferramenta**:
   - **picareta**: silhueta própria, **66 px** (ver §8);
   - **machado**: silhueta própria, **64 px** (ver §9);
   - **pá**: 2 linhas diferentes, **55 px**;
   - **tesoura**: silhueta própria, **79 px** (ver §7).

   O clássico é **referência de leitura, não molde**: a peça tem que ser
   reconhecida de longe como picareta, machado, pá ou tesoura — e não como a
   arte do jogo. Na **pá** os 2 px são sempre um no topo da peça e outro na ponta,
   e nenhuma linha pode ser cópia exata de ponta a ponta. Na **tesoura** (§7), na
   **picareta** (§8) e no **machado** (§9) a diferença já é de estrutura: 2 px não
   afastava o suficiente, e o usuário pediu explicitamente que a forma se afastasse
   "suavemente" do original.
2. **Contorno tingido.** O `O` nunca é preto puro e muda com o material: pedra
   puxa azul, ouro puxa verde-escuro, diamante puxa ciano-escuro. É sempre a cor
   mais escura da paleta.
3. **Quatro tons, e só.** `1`…`4` do escuro ao claro, com o `2` no meio. Nada de
   cor fora da rampa do material: o **acento** amarelo que existia até 07/11/2026
   saiu de todas as ferramentas — era um ponto de luz nas pontas e chamava mais
   atenção do que a própria peça. A identidade agora é a **cor do material** e a
   forma, não um pixel assinatura.
4. **Cabo comum.** `a`…`d` são os mesmos nas três ferramentas: as peças parecem
   saídas da mesma oficina.
5. **Cabo de madeira = as tábuas do jogo.** `CABO_PALETA` é literalmente o tile
   `PLANKS`: `[123,91,51]` no veio (`b`), `[151,116,67]` na sombra (`c`),
   `[202,166,106]` no claro (`d`) e `[86,62,34]` na sombra do cabo (`a`). A
   ferramenta na mão precisa parecer feita do mesmo material do chão — e, nas
   ferramentas de madeira, cabeça e cabo são quase a mesma peça.
   Um teste trava os quatro tons.
6. **Sem couro.** Nenhuma ferramenta tem faixa costurada (`g`/`s` saíram do
   alfabeto em 07/11/2026). A faixa do #122 era a assinatura que mais pesava na
   leitura: o cabo é madeira lisa, do encaixe ao punho.

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
- nada de pixel destacado: quem marca o topo é o `4`.

## 6. Ordem de trabalho

**Uma ferramenta por vez**, forma separada: picareta → machado → pá → tesoura.
Cada uma é uma rodada própria, com comparador ampliado antes de fechar e PR
próprio. Não mexer na paleta comum sem revisar as três.

## 7. A tesoura

A tesoura é ferramenta, mas não tem cabo comprido: são **duas lâminas cruzadas**
com o punho curto embaixo. Ela usa o mesmo alfabeto das outras, com uma divisão
própria:

- **lâminas** — o metal do material (`O` no fio, `2`…`4` na face);
- **punho** — madeira (`a`…`d`), a mesma tábua do cabo das ferramentas.

### A silhueta tem que ser nossa

A primeira versão da tesoura era o sprite clássico com **2 px** trocados. O olho
reconhecia a arte do jogo: 2 px não é diferença, é a mesma figura. Em 07/11/2026 a
tesoura ganhou a passada **autoral**, com quatro mudanças de estrutura (e a régua
dos testes passou a guardá-las):

1. **ponta mais alta e afiada** — a lâmina sobe uma fileira e afina em
   `(9,1)`…`(12,1)`; o desenho muda de cima para baixo;
2. **cabo afinado** — de 3 para 2 px a partir de `(6,7)`, afinando na direção das
   lâminas;
3. **costura aberta** — 1 px a mais no vão entre as duas lâminas, em `(8,6)`;
4. **ponta da mandíbula em contorno** — `(13,7)` vira `O`: o punho não escorre
   para dentro da lâmina.

Resultado: **79 px numa peça só**, lâminas na rampa do ferro, punho na tábua do
cabo, sem acento e sem couro.

A regra vale para o resto da família: **o clássico serve de referência de leitura,
não de molde**. Mexer em 2–3 px não afasta a arte de ninguém — o que afasta é
proporção, silhueta e paleta próprias.

## 8. A picareta

A picareta foi a primeira ferramenta da família e a segunda a receber a passada
autoral. O que mudou foi a **cabeça**, não os contornos:

1. **fundo da cabeça mais fino** — as quatro fileiras de baixo da cabeça
   (`(6,4)`…`(9,4)`) saíram: a cabeça fica com **2 fileiras** no miolo em vez de
   3, e o fio aparece;
2. **ponta esquerda em bico** — o `1` em `(3,3)` estica o braço esquerdo, que
   deixa de terminar reto;
3. **colar no encaixe** — `(10,4)` sai e `(10,5)` vira `1`: a cabeça e o cabo se
   encontram num degrau, como peça montada.

Resultado: **66 px**, uma peça só, perfil
`[0,0,6,11,3,4,6,6,6,6,6,4,3,3,2,0]` — 3 linhas fora da silhueta clássica. O
desenho continua lido como picareta de longe, mas não é mais a figura do jogo.

## 9. O machado

O machado é a ferramenta mais difícil de afastar sem perder a leitura: a cabeça é
uma **mancha só**, e qualquer corte grande vira outra ferramenta (o "D" descolado
do cabo foi reprovado no #120). O que dá para mexer é a **borda** e o **contra-fio**:

1. **contra-fio curto** — a pontinha de trás da cabeça (`(13,6)` e `(13,7)`) sai:
   sobra a lâmina e um toco de encaixe, sem o rabo do clássico;
2. **fio reto** — `(6,3)` entra e `(7,3)` vira `4`: a borda de corte fica
   **vertical em três fileiras**, com o tom claro correndo pelo fio, em vez de
   degrau;
3. **topo sem degrau** — `(11,1)` sai;
4. **barba** — `(6,6)` vira `4` e `(5,6)`, `(6,7)` e `(5,7)` viram `O`: a lâmina
   **desce na direção do cabo**, como machado de barba.

Resultado: **64 px**, uma peça só, perfil
`[0,2,4,6,7,7,8,7,6,3,3,3,3,3,2,0]` — 4 linhas fora da silhueta clássica.

## 10. O que ainda é herdado

Blocos, minérios, lingotes e itens de minério já foram desenhados aqui (com
paletas escolhidas a dedo, nas rodadas de #104 a #118). Nenhuma ferramenta está
fora da régua desde 07/11/2026.

Das quatro ferramentas, **tesoura** (§7), **picareta** (§8) e **machado** (§9) já
passaram pela passada autoral. Só a **pá** continua na base fiel com 2 px de
diferença — é a última da fila.

## 11. Aviso de boa-fé

O Voxelcraft é um jogo próprio, inspirado no gênero voxel — **não é um produto
oficial** e não tem vínculo com a Mojang ou a Microsoft. Ver o aviso no
[`README.md`](README.md).
