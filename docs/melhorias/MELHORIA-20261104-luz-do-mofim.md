# MELHORIA: a luz que o Mofim emite

- **Data:** 04/11/2026 (depois das [asas de mariposa](MELHORIA-20261104-asas-de-mariposa.md))
- **Status:** implementado
- **Arquivos:** `world-point-lights.js`, `world-creature.js`, `game.js`,
  `tests/point-lights.test.mjs`, `tests/creature.test.mjs`, `service-worker.js`,
  `README.md`, `TESTE-EM-NAVEGADOR.md`

## Por que

A luzinha do Mofim sempre foi **só desenho**: um cubinho de material emissivo na
ponta da antena. Bonito de perto, mas **não iluminava nada** — a grama em volta
continuava preta. Numa criatura cujo nome é de bicho-noturno e que acende os
olhos ao anoitecer, isso é o que menos entrega.

A cena já tinha um pool de luzes de verdade, criado para tochas e fornalhas.
Duas escolhas possíveis:

| caminho | custo |
| --- | --- |
| **pool própria para o bicho** (3 luzes sempre na cena) | o Three recompila **todos** os materiais quando muda a quantidade de `PointLight` — engasgo garantido, para uma luz que fica a maior parte do tempo longe |
| **entrar no pool que já existe** | zero luz nova; o bicho **disputa** as duas vagas com tochas e fornalhas |

Ficou o segundo. É o caminho barato e, de quebra, mais justo: se o jogador está
perto do bicho, a luz dele interessa mais do que a tocha que ficou para trás.

## 1. Ele é candidato, não dono

`creatureEmitterCandidates()` entrega o bicho no mesmo formato dos blocos
emissores, e `pickEmitters()` escolhe as duas vagas **por distância**, sem saber
quem é quem. Consequências:

- perto do bicho e longe da tocha → a vaga é dele;
- tocha do lado → a tocha ganha, e ele fica só com o brilho próprio;
- **duas** fontes no total, sempre. Nada novo na cena.

## 2. A luz fica onde ele está — a cada quadro

Bloco ilumina do **centro** (`x+0,5 · y+0,6 · z+0,5`) — é onde a chama fica. O
bicho anda em posição contínua, e arredondar para o bloco faria a poça de luz
pular de bloco em bloco enquanto ele caminha. Então o candidato carrega
`exact: true` e a posição vai como está, na altura da antena (`visualY + 0,66`).

E a posição é **recalculada em todo quadro**, não só a cada 250 ms: no voo de
travessia (6,5 blocos/s) a luz ficaria 1,6 bloco atrás do bicho. Bloco não se
mexe, então para eles a varredura basta; criatura se mexe.

## 3. Fraca de propósito

| | nível | cor |
| --- | --- | --- |
| tocha | 14 | `#ffb45b` |
| lanterna | 13 | `#ffdc9a` |
| **Mofim** | **10** | **`#ffdc9a`** |
| fornalha | 11 | `#ffa050` |

Ele não é lampião, é bicho: a poça de luz é um convite, não um poste. A cor é a
mesma da luzinha da antena, para o desenho e a luz contarem a mesma história.

## 4. O pulso do chilreio

O chiado já existia. Agora ele **acende** — e é isso que amarra som e luz: quem
ouve o assobio vê de onde ele veio.

- duração: **0,45 s** (`CHIRP_PULSE_DURATION`), caindo em linha reta até zero;
- no pico o nível vai de 10 para **18** → a intensidade vai de `0,75·k` para
  `1,20·k`, ou seja **1,6×** (`MOFIM_PULSE_GAIN = 0,8`, com o teto em 1,2);
- `k = (1 − d/13)²`: o pulso some junto com a luz, com a distância.

O detalhe que importa: **o pulso é aplicado no quadro**, em `updateEmitterLights`,
e não no nível que vai para a varredura. A varredura roda a 4 Hz — se o pulso
entrasse nela, a luz subiria em degraus de 250 ms e voltaria a apagar aos saltos.
O candidato leva o nível de repouso e o `entity`; o jogo lê `lightPulse` a cada
quadro e recalcula a intensidade.

E o pulso aparece **também no desenho**, para som e brilho não se separarem: o
emissivo do corpo sobe `+0,30 / +0,24 / +0,10`, os olhos `+0,60 / +0,45 / +0,20`
e a luzinha da antena cresce 1,1×.

## 5. Portão na qualidade gráfica

Em **Gráficos → Baixa** (escala 0,5, a máquina já no limite) o bicho **não entra
na disputa**: as duas vagas ficam com as tochas e ele fica só com o emissivo.
Nenhum outro modo muda — `auto`, Máxima, 1 e 0,75 continuam com a luz real.

Quando ele vai embora ao amanhecer (`leaving`), o candidato sai da lista no
próximo quadro e a luz apaga com ele — não fica poça acesa no ar.

## Testes

- `tests/point-lights.test.mjs`: posição exata (sem arredondar), altura da
  antena, nível e cor, `leaving`/posição inválida fora, portão do 0,5, pulso
  **não** entrando no nível, e o bicho perto ganhando a vaga de uma tocha longe;
- `tests/creature.test.mjs`: `chirpPulse` (0 → 0, cheio → 1, meio → 0,5) e o
  chiado acendendo `lightPulse` e crescendo a luzinha, apagando depois;
- `creatureLightPoint()`: a luz usa a altura **desenhada** (`visualY`) e não a do
  chão — no voo curto o bicho sobe 1,5 bloco e a poça sobe junto.

Suíte: **605 testes**.

## O que ficou de fora (de propósito)

- **rastro de pó luminoso**: é sistema de partículas, não luz — feito depois, em
  [próprio PR](MELHORIA-20261104-rastro-de-po.md);
- **pool própria** para o bicho: cara e sempre ligada;
- **halo falso** (plano aditivo): não ilumina o cenário, só engana de perto.

## Como conferir no jogo

Itens novos em `TESTE-EM-NAVEGADOR.md` (§8): poça de luz no chão, pulso junto com
o chiado, revezamento com a tocha, apagar ao amanhecer, portão do Baixa e queda
com a distância.
