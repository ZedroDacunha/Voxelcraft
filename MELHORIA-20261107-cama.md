# MELHORIA: a cama — um bloco de dois voxels

- **Data:** 07/11/2026
- **Status:** implementado (parte 1: o bloco, a arte e o item; dormir fica para a próxima)
- **Arquivos principais:** `world-bed.js` (novo), `world-catalog.js`, `world-textures.js`, `world-block-icons.js`, `game.js`, `player-physics.js`, `world-save-codec.js`, `world-block-materials.js`, `tests/bed.test.mjs` (novo)

## O problema

Até aqui o jogo só sabia desenhar duas formas que não são cubo:

- a **tocha** — uma caixa fina, uma tile por tipo de face (`TORCH_PARTS`);
- a **porta** — um painel fino, também uma tile por tipo de face (`world-door.js`).

A cama não cabia em nenhuma das duas. Ela é **um móvel de dois voxels** com
**quatro materiais** ao mesmo tempo (pernas e travessa de madeira, colchão
vermelho, travesseiro branco) e **nove caixas** por metade. Fazer dela um cubo
com uma textura pintada em cima seria a mesma coisa que não fazer.

## A mudança

### 1. O modelo, em caixas puras

`world-bed.js` descreve a cama em **dezesseis-avos de bloco**, exatamente como
o desenho original é medido — sem THREE, sem DOM, testável:

```
pernas .......... 0 → 2     (duas por metade, nas quinas de fora)
travessa ........ 2 → 4     (1/16 para dentro, some debaixo do colchão)
colchão ......... 4 → 8     (vai até a borda do voxel e **sobra** na madeira)
aba do colchão .. 8 → 9     (recua 1/16: é o chanfro do topo)
travesseiro 9 → 12          (duas caixas, a de cima 1/16 menor em volta)
```

Duas decisões de silhueta, tiradas das imagens de referência:

- **o colchão é mais largo que a estrutura.** É a beirada vermelha por cima da
  tábua que dá volume à cama; com o colchão recuado ela virava uma caixa em cima
  de uma tábua.
- **o travesseiro é chanfrado em duas caixas.** Uma caixa só lia como um segundo
  colchãozinho branco. Ele ocupa 13/16 de largura por 6/16 de comprimento — o
  usuário pediu duas vezes para aumentar, e o tamanho atual é o que lê como
  travesseiro de perto, sem encostar na beirada da aba.

A metade dos pés não tem travesseiro; a da cabeceira tem. As duas se encontram
**sem degrau** na emenda (o colchão do pé vai até 16, o da cabeceira começa em
0), e a face interna não é desenhada (`solid()` devolve `true` só entre cama e
cama, como já era com a porta).

### 2. Mais de uma caixa no mesher

O laço de formas do mesher já existia para a tocha (`shapeCount`), mas só a
tocha podia ter mais de uma. Agora ele recebe uma **lista** de caixas
(`bedShapes(metade, direção)`) e cada caixa traz as suas próprias tiles — topo,
lateral e fundo. A cama entra no passe de recorte junto com a tocha e a porta.

### 3. A direção

A cama **gira inteira** nas quatro direções, mas não tem face frontal. Isso
quebrou três lugares que usavam `tiles.front !== undefined` como sinônimo de
"bloco que guarda direção":

- `setBlock` — sem isso as duas metades voltavam para o sul ao serem colocadas;
- o save (`parseBlockFacings`) — a cama voltava virada depois de recarregar;
- o mesher, para ler `facing` mesmo sem face frontal.

### 4. Colocar e quebrar

- A célula clicada vira os **pés**; a cabeceira vai para o lado **oposto ao
  jogador**. Se lá estiver ocupado, a cama vira (a cabeceira passa para o lado
  do jogador). Se nenhum dos dois couber, aparece um aviso e nada é colocado.
- As duas células precisam de **apoio sólido** embaixo.
- Quebrar **qualquer** metade derruba a outra e solta **uma** cama.

### 5. Colisão de 9/16

A cama ocupa o voxel inteiro no plano, mas só **9/16 na altura** — o topo do
colchão, o mesmo número da cama original. A física (`player-physics.js`) passou
a testar a caixa em Y também, então:

- de pé no chão, a cama **barra**;
- em cima do colchão dá para **ficar de pé** (e o pé encontra apoio nela).

### 6. A arte

Quatro tiles novas, todas em `world-textures.js`:

| tile | o que é |
| --- | --- |
| `BED_TOP` | cobertor vermelho — mancha macia interpolada (em blocos de 6 px lia como xadrez) + pelo curto |
| `BED_SIDE` | lateral: clara nas 3 primeiras linhas (a aba vira), escura embaixo, na sombra da beirada |
| `BED_PILLOW_TOP` | travesseiro branco com borda de 2 px mais escura |
| `BED_PILLOW_SIDE` | lateral do travesseiro, com sombra no pé |

Os tons saíram das imagens de referência (vermelho do topo em ~156,44,36), mas o
desenho é nosso: a trama é de lã curta, não uma cópia pixel a pixel.

### 7. O ícone

O ícone da barra **não** é uma segunda arte: `createModelIconPixels()`
(`world-block-icons.js`) lança um raio por pixel em projeção ortográfica contra
as caixas do próprio modelo. São 32×32, o tamanho da célula do atlas — o mesmo
caminho do ícone 3D dos blocos. Se o modelo mudar, o ícone muda junto.

### 8. O pisca-pisca ao girar a câmera

A primeira versão das caixas era **empilhada no seco**: a travessa terminava
exatamente onde o colchão começava, o colchão onde a aba começava, e assim por
diante. Duas faces no mesmo plano brigam pelo mesmo pixel — e o passe de recorte
desenha **os dois lados** da face (`DoubleSide`), então até as faces internas
entravam na briga. Resultado: a cama piscava ao girar a câmera.

A correção tem três partes:

- **encaixe de 1/2 dezesseis-avos** (`ENCAIXE`): cada peça entra na de baixo, e a
  face que sobra fica *dentro* da peça de cima em vez de no plano dela. A
  silhueta não muda — só o que estava escondido;
- **folga de 3 milésimos de bloco** (`FOLGA`) nas faces que encostam no mundo (o
  pé no chão, a lateral do colchão no bloco vizinho): o vizinho desenha a face
  dele no mesmo plano, porque a cama não é opaca;
- **as pernas 1/2 para dentro** da travessa, pelo mesmo motivo, e o travesseiro
  1/2 antes da beirada da aba.

O teste `nenhuma caixa tem face no mesmo plano de outra` cobra isso de qualquer
mudança futura, com uma única exceção: o plano da **emenda** entre as metades,
onde as faces são descartadas pelo mesher (é o que mantém a cama contínua).

De quebra, as faces que o encaixe deixou **dentro** de outra caixa saem do
desenho (`enterrarFaces`): o mesher agora pula uma face declarada como `null`.
Uma face vista por dentro é preta — era ela que aparecia quando a ordem de
desenho escorregava. Sem ela no modelo, o pior que pode acontecer é ver o que
está atrás, nunca um buraco preto.

## O que o jogador vê

- Receita: **3 blocos de lã branca em cima + 3 tábuas embaixo** → 1 cama (a
  mesma silhueta da receita clássica). Até a parte 6 eram 3 fardos soltos; ver
  "A cama se costura com bloco de lã", no fim.
- Colocar, deitar a cabeceira para o lado certo, subir nela e quebrar (levando
  as duas metades) — tudo uma peça só.
- Som de lã no passo, na quebra e na colocação.

---

# Parte 2 — dormir e renascer nela

A cama da parte 1 era um móvel: dava para subir nela e nada mais. A parte 2 é o
que ela faz — **deitar de noite, a noite passar e o jogador acordar em pé em cima
do colchão**, com a cama passando a ser o ponto de renascimento.

As contas ficaram em `world-sleep.js`, um módulo puro (sem THREE, sem DOM), pelo
mesmo motivo da geometria: dá para testar a hora, o tempo e o lugar do corpo sem
abrir navegador. O `game.js` só liga os fios — câmera, tela preta, relógio,
save.

## A hora de dormir

`noite = 1 - worldSky.day` é a conta que o resto do jogo já usava para dizer que
anoiteceu (o Mofim aparece com `dia < 0,35`). A cama usa o **mesmo ponto**:
`canSleepAt(noite)` exige `noite >= 0,65`. Com o sol ainda no horizonte o céu
está claro demais: o aviso é *"Só dá para dormir à noite"*, na mesma `showToast`
das outras recusas.

## A dormida em três tempos

`sleepPhaseAt(segundos)` devolve a fase, o quanto a tela está preta e se a noite
já virou:

| fase    | duração | o que acontece                                              |
| ------- | ------- | ----------------------------------------------------------- |
| `lie`   | 1,1 s   | a câmera desce do olho até o travesseiro, a tela escurece    |
| `sleep` | 0,85 s  | tela preta; **aqui** o relógio pula para o amanhecer         |
| `wake`  | 0,9 s   | a tela clareia com o jogador já em pé na cama                |

A virada (`changed`) acontece no **começo do preto**, não no fim: assim o corpo
aparece em pé na cama enquanto nada se vê, e o clarear já mostra a manhã. O
teste `a noite passa no começo do escuro, não no fim` protege essa ordem, e
`a dormida nunca anda para trás` garante que nenhum quadro pule de fase.

## Onde o corpo aparece

`bedRespawnPoint(célula)` = **centro da célula + 9/16 de altura** — a mesma
altura da colisão da cama. O jogador acorda *apoiado* no colchão: nem dentro
dele, nem flutuando.

A célula guardada é sempre a dos **pés**, mesmo que ele clique na cabeceira:
dormir pelas duas metades tem de registrar a mesma cama. E o ponto de
renascimento é checado **toda vez**: `bedSpawnStanding()` pergunta ao mundo se o
bloco ainda está lá. Cama quebrada não puxa ninguém.

## O que muda no jogo

- **Clique direito na cama** = dormir. A cama entra na fila de intenções do
  `world-interaction-rules.js` entre a porta e a comida (`station > door > bed >
  eat > place`): mirando na cama, o clique é para deitar, não para mastigar o
  que está na mão. Agachado, o clique continua sendo do item na mão.
- **Morrer** leva o corpo para `respawnOrigin()`: a cama do último sonho, se ela
  ainda existe, ou o ponto de partida do mundo.
- **Quebrar a cama** que era o ponto de renascimento devolve o ponto ao início
  do mundo e avisa (*"Seu ponto de renascimento voltou ao início do mundo"*).
- **O save** guarda a célula (`bedSpawn`), e o `world-save-codec.js` a valida
  como endereço (inteiro, dentro do mundo); lixo no arquivo vira `null` sem
  derrubar o save.
- **A tela preta** é o `#sleep` no `index.html`/`styles.css`: cobre o mundo, não
  bloqueia clique e fica **abaixo** do aviso (`z-index: 5`, o `toast` é 6). O
  `Zzz…` só aparece com a tela já fechada.
- **Dormindo, o corpo para**: a física não roda (quem manda na câmera é a
  dormida), a mineração e o comer param, a mão em primeira pessoa some, e usar
  um item não faz nada. Morrer dormindo (um bicho pode chegar) corta a dormida
  antes da tela de morte — nunca se morre com a tela preta.

---

# Parte 3 — três camas, uma por cor de lã

A cama da parte 1 era **vermelha**, a cor das imagens de referência. Só que o
jogo não tem lã vermelha: a receita sempre foi 3 lãs **brancas** + 3 tábuas, e o
colchão vermelho saía de uma lã que não era vermelha. A parte 3 conserta isso
com o que o jogo já tem — a ovelha dá **lã branca, cinza e preta**, e cada uma
agora faz a cama da sua cor.

| cama | receita | colchão |
| --- | --- | --- |
| **Cama** (a de sempre) | 3 blocos de lã branca + 3 tábuas | creme `209,204,192` |
| **Cama cinza** | 3 blocos de lã cinza + 3 tábuas | cinza `150,150,145` |
| **Cama preta** | 3 blocos de lã preta + 3 tábuas | preta `58,58,62` |

(Bloco de lã, não fardo solto: a troca foi na parte 6, no fim do documento. Na
época da parte 3 a receita ainda pedia fardos.)

O **travesseiro é branco nas três** e a madeira é a mesma peça: o que muda é só
o colchão. Misturar lãs não vira cama nenhuma — não há corante no jogo, e a
receita não empresta cor.

## Uma decisão de arte: a branca não é branco puro

Com branco puro o colchão e o travesseiro ficavam **exatamente** da mesma cor e
o travesseiro desaparecia dentro da cama. O colchão da branca é um creme de
`209,204,192` — 25 níveis mais escuro que o travesseiro. Continua lendo como cama
branca, e o travesseiro volta a existir.

## Como está montado

- `world-catalog.js` › **`BED_VARIANTS`** é a tabela única: para cada cor, a lã da
  receita, o item, os dois blocos (cabeceira e pés) e os tiles do colchão. Os
  seis blocos e as três receitas nascem dessa tabela num laço — acrescentar uma
  quarta cor é acrescentar **uma linha**.
- Cada bloco carrega `bed: { part, color }`. É daí que saem as perguntas do resto
  do jogo: `bedPart(tipo)` e `bedColor(tipo)` (antes eram uma cadeia de `if`s
  sobre IDs fixos).
- O **mesher** desenha `bedShapes(bedPart(t), facing, bedColor(t))`; o **ícone da
  barra** é `spritePixels('bed', cor)`, que monta o mesmo modelo naquela cor.
- **Colocar** pega a cor do item: `placeBed(..., footType)` acha a cabeceira do
  mesmo par, então uma cama preta nunca vira branca ao ser posta no chão.
- **Quebrar** devolve o item da cor do bloco (`BLOCKS[tipo].drop`), e o som
  continua sendo de lã nas três (`world-block-materials.js` deriva a lista dos
  `BED_VARIANTS`).
- **O save** não mudou de formato: o ID do bloco já diz a cor. A cama antiga (ID
  117) é a branca — save velho abre com a cama na cor nova.

---

# Parte 4 — a cama na mão

A cama aparecia na mão como **ícone extrudado**: a figura chata que as
ferramentas usam, com um dedo de profundidade. Dá para reconhecer a cama, mas ela
não é 3D — e o ícone é uma *pintura* do modelo, não o modelo.

Agora a mão recebe a peça de verdade: pernas, travessa, colchão, aba e
travesseiro, na cor da lã que o jogador está segurando.

## Como a peça é montada

`world-bed-hand.js` transforma `bedModelBoxes(cor)` em **arrays puros** —
posição, normal, UV e índice —, sem THREE. O `game.js` só embrulha isso num
`BufferGeometry` e usa o material do mundo (o mesmo mapa do atlas, o mesmo que o
bloco na mão já usava). Três consequências boas:

- **A cor vem do tile**, não de um material novo: o colchão preto é preto porque
  amostra o tile do colchão preto — o mesmo do bloco no mundo;
- **As faces enterradas continuam fora** (`enterrarFaces`): a face que mora
  dentro de outra caixa não é desenhada, exatamente como no mesher;
- **Dá para testar sem navegador**: `tests/bed-hand.test.mjs` cobra a contagem de
  faces, a UV de cada face, o centro do modelo e a escala.

## Centrar é o que faz girar certo

O modelo tem duas células de comprimento, então o meio está em `z = 1`, não em
`z = 0,5`. Centrar no meio (`0,5, 0,5, 1`) é o que faz a peça girar em volta de
si mesma na mão — com a origem numa quina, ela orbitaria o próprio canto a cada
giro do braço.

## O ajuste da mão

`HELD_BED` guarda escala e giro: `0,26` de escala (a cama é móvel, não
ferramenta — fica do tamanho de um bloco grande na mão), giro de `0,30` em X
(mostra o topo do colchão), `0,55` em Y (a peça atravessa a tela na diagonal) e
`0,20` em Z (descola da horizontal, para não ler como um cartão). O travesseiro
fica do lado de perto, que é o que identifica a cama de relance.

## A tabela de faces saiu do `game.js`

O mesher, as nuvens e agora a cama na mão desenham a mesma caixa, e todos
precisavam dos mesmos seis cantos com as mesmas UVs. A tabela morava no
`game.js` e quem desenhasse uma caixa fora dele copiava os cantos à mão — cópia
que envelhece calada. Ela virou `world-faces.js`, um módulo puro.

## O escopo que ficou de fora

- **As 16 tinturas**: o jogo não tem corantes, então são três cores (a lã da
  ovelha), não dezesseis.
- ~~**A cama cair quando o chão é cavado**~~: virou a parte 5, abaixo.

# Correção — a face do travesseiro que o mesher comia

Depois da parte 4 o jogador voltou com o mesmo print: de frente para o pé da
cama, com a câmera quase na altura do colchão, havia uma **faixa escura embaixo
do travesseiro**. Não era a mão nem o modelo: era o mesher do mundo.

## O que estava acontecendo

O mesher descarta a face de um bloco quando o vizinho "tapa" aquele lado. Para
cama e porta a regra era grosseira:

```js
// antes
if (currentRender === 'bed') return neighborRender === 'bed';
```

Ou seja: se a cela vizinha naquela direção é a outra metade da cama, **todas** as
faces daquele lado somem. Vale para o cubo, não vale para a cama — ela é feita
de caixas que param no meio da célula:

```
travesseiro .... 8,5 → 12  (o corpo para em 14,5/16 no comprimento)
colchão ........ 4 → 8     (é o único que vai até a borda)
```

A face do travesseiro virada para o meio da cama está em `z = 8,5/16`, muito
longe do plano da emenda (`z = 0` da célula da cabeceira). Ela é visível — e era
justamente ela que sumia. O material do mundo é `DoubleSide`, então o buraco não
aparecia como céu: aparecia como a **face de dentro**, escura. Daí a faixa preta
sob o travesseiro.

Com a câmera quase rente ao colchão o defeito ficava óbvio: era a única coisa
que se via do travesseiro de frente.

## A correção

A regra passou a olhar **onde a face está**, não só quem é o vizinho:

```js
// depois
if (currentRender === 'door' || currentRender === 'bed') {
    return neighborRender === currentRender && faceNaBordaDaCelula(shape, dir);
}
```

`faceNaBordaDaCelula(shape, dir)` (em `world-faces.js`) responde "esta face
encosta em 0 ou em 1 na direção dela?". Só a face que está no **plano da
emenda** é descartada — que era o motivo original da regra (dois planos iguais
brigando pelo mesmo pixel, o pisca-pisca ao girar a câmera). A tolerância de
0,01 existe por causa da folga de 0,06/16 que a cama aplica nas faces de fora.

O `solid` do mesher ganhou o parâmetro da forma, e o mesher passa a caixa que
está desenhando. Efeito colateral bom: as **pernas** da cabeceira também
perdiam a face virada para o meio da cama (4,5/16 para dentro) — voltaram, e as
da porta também, pela mesma regra.

## Como isso foi encontrado

Um renderizador de mesa (`preview/cama-mundo-mesher.mjs`, fora do repositório)
monta a cama **pelo caminho do mesher**: duas células, `bedShapes` por metade e a
regra de recusa. Rodando com `REGRA=antiga` a faixa preta aparece; com
`REGRA=nova` ela some, e 6 faces (12 triângulos) voltam a ser desenhadas.

`tests/shape-culling.test.mjs` guarda a regra: a face do travesseiro virada para
o meio da cama tem de estar entre as desenhadas, a face do colchão na emenda não
pode voltar, e o `game.js` tem de continuar chamando a regra nova.

# Parte 5 — a cama precisa de chão (e leva o renascimento com ela)

A última dívida do tema, e ela era de **mundo**, não de desenho. Dois defeitos
que o jogador via juntos:

1. **Cavava o chão embaixo da cama e ela ficava no ar** — dava até para dormir
   flutuando, o que é pior que feio.
2. **Quebrar a cama não esquecia o renascimento**, calado. O aviso "seu ponto de
   renascimento voltou ao início do mundo" só aparecia quebrando a metade dos
   pés.

## Por que o renascimento escapava

A célula salva é sempre a dos **pés** (`trySleep` guarda os pés de propósito, para
a cama não mudar de lugar se o jogador dormir pela outra metade). E o
`breakBlock` fazia, nesta ordem:

```
1. derruba a outra metade          ← se quebrou a cabeceira, são os pés
2. pergunta "a cama ainda está de pé?"
3. se sim, confere se era o renascimento e apaga
```

O passo 2 olhava o mundo **depois** de já ter mexido nele: a célula salva tinha
virado ar no passo 1, então a resposta era "não" e o passo 3 nunca rodava. O
ponto continuava no save, apontando para uma cama que não existia mais — o
jogador só descobria ao morrer e nascer no início do mundo, sem entender.

Agora a conferência vem **antes** da derrubada, e ela não olha o mundo: compara a
célula salva com as duas células da cama que está sendo quebrada
(`bedHoldsCell`). Quebrar qualquer metade apaga o renascimento, com aviso.

## Por que a cama ficava no ar

Nada no jogo perguntava "quem estava em cima disso?". A areia desce porque tem
uma fila própria (`queueFallingSand`), mas ela só olha para areia. A cama ficava
onde foi colocada, com o chão furado embaixo.

A correção aproveita o ponto por onde **toda** remoção passa, o `setBlock` do
`World`:

```js
// quando a célula vira ar (ou algo não sólido) e tem cama logo acima
this.queueFallingSand(x, y + 1, z);                 // areia: cai
const acima = this.getBlock(x, y + 1, z);
if (isBedBlock(acima)) this.unsupportedBeds.push({ x, y: y + 1, z, type: acima });
```

A fila é drenada no laço do jogo, na camada que tem som, item e ponto de
renascimento à mão. A cama **desaba**: some com as duas metades, cai **uma** cama
no chão (o item das duas metades é o mesmo), sai o som de lã e as partículas — e,
se era ela que guardava o renascimento, o ponto se perde com aviso.

Como o gancho é o `setBlock`, o desabamento vale para **qualquer** caminho que
tire o chão: a picareta do jogador, areia caindo e até água correndo para dentro
do buraco — não só para a quebra na mão.

## A regra do apoio, num lugar só

`supportsBed(tipoDeBaixo)` (em `world-bed.js`) é a mesma resposta para três
perguntas:

| pergunta | quem faz |
| --- | --- |
| "posso colocar a cama aqui?" | `bedCellFree`, na colocação |
| "esta cama ainda tem chão?" | `setBlock`, que enfileira |
| "esta cama salva ainda está de pé?" | `bedSpawnStanding`, no carregamento |

Chão é bloco sólido: ar, água e tocha não seguram cama; cama em cima de cama
segura (é sólida).

## O que fica de fora, ainda

- **As 16 tinturas** seguem fora: o jogo não tem corantes.

# Parte 6 — a cama se costura com **bloco** de lã

A receita pedia três **fardos** de lã — o item solto que a ovelha derruba. Mas o
fardo já tinha um uso próprio na bancada: quatro deles viram **um bloco de lã**.
Pedir o fardo cru na cama era pedir o material **antes** do passo que o
transforma em peça de construção, e a receita ficava diferente da clássica, que
costura a cama de lã em bloco.

Agora a bancada pede o bloco:

```
antes                          agora
[ fardo  fardo  fardo ]        [ bloco  bloco  bloco ]
[ tábua  tábua  tábua ]        [ tábua  tábua  tábua ]
```

O caminho do jogador virou o do jogo original, em dois passos, os dois na
bancada:

1. **4 fardos da mesma cor** (2×2) → **1 bloco de lã** daquela cor;
2. **3 blocos de lã + 3 tábuas** → **1 cama** daquela cor.

## O que mudou no código

`BED_VARIANTS` tinha um campo `wool` (o fardo) que só a receita lia. Ele virou
`woolBlock` (o bloco), e o laço das receitas passou a usá-lo:

```js
for (const bed of BED_VARIANTS) {
    defRecipe([[bed.woolBlock, bed.woolBlock, bed.woolBlock], [ID.PLANKS, ID.PLANKS, ID.PLANKS]], bed.item);
}
```

Nada mais mudou de tabela: a cor continua vindo do catálogo, o bloco de cada cor
já existia, e a receita de bloco (2×2) continua onde estava — é ela que abastece
a cama. Misturar cores continua não valendo: três blocos de cores diferentes não
formam cama nenhuma.

## O custo, dito com franqueza

Um bloco custa quatro fardos, então uma cama passou a custar **12 fardos** (antes
eram 3), e uma ovelha tosquiada solta de **1 a 3**. São de quatro a doze ovelhas
por cama, contra uma a três antes — o dobro de passos e bem mais lã.

É o preço de pedir a peça de construção em vez do material cru, como no original.
Se a conta parecer cara demais no jogo, há dois caminhos de conserto, os dois
pequenos:

- **a ovelha soltar bloco** em vez de fardo (aí a cama custa 3 tosquias, como
  antes, e o fardo como item some do jogo); ou
- **2 fardos por bloco** (a cama custaria 6 fardos).

Nenhum dos dois foi feito: os dois mudam o que a ovelha derruba, e isso é outro
assunto.
