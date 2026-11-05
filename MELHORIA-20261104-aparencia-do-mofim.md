# MELHORIA: aparência do Mofim (anatomia + olhos acesos)

- **Data:** 04/11/2026 (depois da [chegada ao anoitecer](MELHORIA-20261104-chegada-ao-anoitecer.md))
- **Status:** implementado
- **Arquivos:** `world-creature.js`, `tests/creature.test.mjs`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

O Mofim era **oito caixas**: corpo, barriga, cabeça, dois olhos, duas asas e uma
luzinha. De perto lia como uma caixa verde com dois pontos; de longe, como uma
caixa verde. E como ele só existe de noite, o que mais importava — ser visto no
escuro — era justamente o que não acontecia: os olhos eram `0,045 × 0,06` de um
verde-escuro sem brilho próprio.

O desenho das alternativas foi feito **com a geometria real do modelo**, em
isométrico, antes de escolher o caminho (o antes/depois está em
`mofim-antes-depois.png`, fora do repositório). A escolha foi o pacote **A + C**:

- **A · anatomia** — silhueta de bicho;
- **C · olhos e tom** — olhos acesos e cada bicho com seu tom.

## 1. Anatomia: a silhueta deixa de ser um bloco

| Peça | Onde | Para quê |
| --- | --- | --- |
| **orelhas** (2) | `±0,10 · 0,58 · 0,09`, inclinadas 0,22 rad | quebram o topo reto: de longe já se lê "bicho" |
| **focinho** | `0 · 0,395 · 0,245` (claro) | separa a cara da parede do corpo |
| **nariz** | `0 · 0,405 · 0,275` | ponto escuro que amarra o focinho |
| **pés** (2) | `±0,13 · 0,06 · 0,07` | **encostam no chão**: antes o corpo flutuava 0,07 |
| **cauda** | `0 · 0,30 · −0,31`, inclinada −0,3 | fecha a silhueta por trás |
| **antena** | `0 · 0,60 · 0,06` | a luzinha passa a ter onde estar presa |

A luzinha era o caso mais estranho: ela ficava em `y = 0,62`, e o topo da cabeça
é `0,57` — ou seja, boiava **acima** do bicho, como uma caixinha de chapéu. Agora
é a ponta da antena (`y = 0,665`, logo acima do topo da antena em `0,65`).

## 2. Olhos: o que faz o bicho existir no escuro

O material dos olhos passou a ser **por criatura** (`eyeMaterial`), como o do
corpo já era, e ganhou `emissive` animado pela noite:

```js
const luz = Math.min(1, glow / 0.16);            // 0 de dia, 1 no escuro
e.eyeMaterial.emissive.setRGB(0.95 * luz, 0.68 * luz, 0.26 * luz);
```

De dia são dois pontos escuros; à noite, duas luzinhas âmbar. No crepúsculo já
estão acesos, mas fracos — é o mesmo relógio do brilho do corpo.

**Piscada**: a cada 3,2–7,5 s sorteados os dois fecham juntos por 0,12 s
(`BLINK_SHUT` = 15% da altura). É animação de graça, mas é o que separa
"escultura" de bicho — com os olhos parados ele parece um enfeite que anda.

**Amanhecer**: ao ir embora, os olhos apagam e a luzinha encolhe junto com o
corpo. Antes, a luz ficava acesa até o bicho sumir — dava um ponto de luz
flutuando no nada.

## 3. Cor: os três da noite não são clones

`createModel(tone)` desloca o matiz, a saturação e a luminosidade do corpo por
`(tone − 0,5) · 0,07`, com `tone` vindo do hash do nascimento. São três Mofins,
não três cópias.

## 4. Respiração

O torso cresce e encolhe 3% num ciclo de ~3 s (`sin(at · 2,1 + phase)`), sempre
no mesmo lugar. Não mexe no chão porque só o torso escala — os pés continuam
pousados.

## 5. Testes (5 novos, 594 no total)

| Teste | O que garante |
| --- | --- |
| anatomia | duas orelhas, dois pés, focinho, cauda, antena e dois olhos existem; o ponto mais baixo do desenho é o chão; a luz fica na ponta da antena |
| olhos acesos | emissivo alto de noite, fraco no crepúsculo, zero quando ele vai embora — e material próprio (um olho aceso não acende os outros) |
| piscada | fecha na hora marcada, volta a abrir depois de `BLINK_DURATION`, e remarca a próxima |
| respiração | o torso varia mais de 0,01 e nunca "infla como balão" |
| tons diferentes | os três da noite têm cores distintas |

Um teste antigo continuou valendo: o emissivo do corpo (clarão do golpe + brilho
da noite) não mudou de comportamento.

## 6. O que sobra (de propósito)

- **asas de mariposa** (asa em duas peças, borda escura, antena dupla): é o
  caminho **B**, que ficou para um PR separado — muda o bater de asa e não a
  anatomia;
- **olhos maiores / caricatura**: não. Ele é bicho de cenário; olho grande puxa
  o visual para desenho animado;
- **validar no navegador**: o item 7 do
  [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md) cobre o que olhar (silhueta de
  perto, olhos acesos e piscada à noite, tons diferentes nos três).
