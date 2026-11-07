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

- Receita: **3 fardos de lã branca em cima + 3 tábuas embaixo** → 1 cama (a
  mesma silhueta da receita clássica).
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

## O que fica para a próxima parte

- **Três camas, uma por cor de lã** (branca, cinza, preta): a geometria é a
  mesma, muda a tabela de tile por cor.
- **A cama 3D equipada na mão**, em primeira pessoa.
- Fora do escopo: as 16 tinturas (o jogo não tem corantes) e a cama cair quando
  o chão é cavado.
