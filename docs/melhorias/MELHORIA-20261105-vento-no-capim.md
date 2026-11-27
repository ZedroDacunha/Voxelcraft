# MELHORIA: o vento no capim

- **Data:** 05/11/2026 (depois do [rastro de pó](MELHORIA-20261104-rastro-de-po.md))
- **Status:** implementado
- **Arquivos:** `world-wind.js` (novo), `game.js`, `tests/wind.test.mjs` (novo),
  `service-worker.js`, `README.md`, `TESTE-EM-NAVEGADOR.md`

## Por que

O vento existia **só no áudio**. `world-ambient-sounds.js` já sorteava fases de
vento (15–32 s), mais fortes no cume que no vale — mas o capim era uma **placa
estática**. O jogo dizia "está ventando" e nada se mexia: metade da informação
chegava por um canal só.

Esta é a **primeira metade** do tema combinado ("o pó reagindo ao vento do
capim"): primeiro o vento precisa existir para alguém ver. O pó entra no PR
seguinte, bebendo da mesma direção e da mesma intensidade.

## 1. Uma direção por mundo

`windDirectionFor(seed)` sorteia um ângulo da semente do mundo e devolve um vetor
unitário no plano XZ. Ele **não muda** durante o jogo, e isso é de propósito:

> vento que troca de lado a cada rajada não parece vento — parece tremor.

Mundos diferentes ventam para lados diferentes; o mesmo mundo venta sempre para o
mesmo lado.

## 2. A intensidade é a do áudio

Quem está jogando **ouve** a fase do ambiente. Agora ele vê também:

| fase do ambiente | vento no capim |
| --- | --- |
| silêncio | só o respirinho (5%) |
| grilos | só o respirinho (5%) |
| vento | cheio, conforme a altitude |
| os dois | cheio, conforme a altitude |

O nível vem do próprio `ambientAvailability` (0,5 no nível do mar → 0,85 no alto),
ou seja: **cume venta, vale quase não** — a mesma regra que já valia para o som.

### A rampa é o que salva a troca de fase

As fases trocam de uma vez (é assim que o áudio funciona, com fade). No visual,
parar de um quadro para o outro é um solavanco que o olho pega na hora. Então:

| | tempo |
| --- | --- |
| subir (o vento chega) | **1,6 s** |
| assentar (o ar baixa) | **2,6 s** |

Sair de cena é mais lento que entrar — o ar não para quando a rajada acaba.

## 3. O balanço no shader

Mesmo caminho do tremular da tocha (`world-lighting-effects.js`): `onBeforeCompile`
no `MeshLambertMaterial` do capim, sem trocar material nenhum.

Duas decisões que não são óbvias:

- **raiz presa, ponta solta.** O deslocamento cresce com `uv.y²` (a placa de capim
  tem uv 0 na base e 1 no topo) e com a altura do próprio tufo. Sem isso o tufo
  **desliza** pelo chão em vez de vergar.
- **vento em espaço de mundo.** Cada tufo é uma instância girada para um lado
  aleatório. Empurrar em `transformed.x` faria cada um ir para uma direção
  diferente e o vento pareceria aleatório. Por isso a direção do mundo é
  projetada nos eixos locais **daquela** instância:
  `dot(instanceMatrix[0].xyz, windWorld)` e `dot(instanceMatrix[2].xyz, windWorld)`.

A forma do balanço, por tufo:

```
push    = 0,75 + 0,25·sin(t·1,15 + fase)      // sempre no mesmo sentido
flutter = 0,16·sin(t·3,6 + fase·2,1)          // tremelizinho curto
bend    = uv.y² · (0,35 + altura) · (push + flutter) · amplitude
```

O `push` nunca fica negativo: o capim **verga para um lado e volta**, não oscila
em torno do eixo como um pêndulo. O `flutter` dá o farfalhar. A fase vem da
posição da instância (`instanceMatrix[3].xz`), então dois tufos vizinhos não
batem asa no mesmo compasso.

## 4. Nunca zero

Com o vento calado a amplitude não vai a zero: fica em **5%** (`WIND_SWAY_IDLE`).
Capim completamente parado parece papel de cenário — e o ar, mesmo em silêncio,
não está imóvel.

## 5. Pausa congela, não zera

`updateGrassWind` só roda com o jogo ativo: em pausa, menu ou aba escondida o
tempo do shader **para**. Se ele zerasse, o capim deitaria quando o jogador
abrisse o menu e voltaria a levantar depois — um soluço visível atrás do desfoque.

## 6. O que não mudou

- **O tufo na mão** do jogador usa o mesmo material, mas não é instância: o
  `#ifdef USE_INSTANCING` deixa ele parado, como sempre foi.
- **Blocos** não recebem o shader — só as três variantes de capim.
- Nada de textura, arquivo ou asset novo.

## Testes

`tests/wind.test.mjs` (novo, 10):

- direção unitária, fixa por semente e diferente entre mundos;
- intensidade vinda das fases (silêncio e grilos = 0, vento e "os dois" = nível),
  com recorte em 0..1;
- rampa: chega em 1,6 s, assenta em 2,6 s, nunca passa do alvo, um quadro move um
  fio, `dt` inválido não muda nada;
- amplitude nunca zero;
- shader: uniforms criados, `uv.y²` presente, fase por instância, `USE_INSTANCING`
  guardando o tufo da mão, include original preservado, material nulo não quebra;
- e a **ligação com o jogo** (lendo `game.js`, como os outros testes de som já
  fazem): o capim recebe o shader, a intensidade segue `ambientApplied` e a
  atualização é chamada no laço.

Suíte: **623 → 633 testes**.

## Próximo passo (PR próprio)

**O pó do Mofim soprado por este mesmo vento** — feito no PR seguinte, em
[pó ao vento](MELHORIA-20261105-po-ao-vento.md). A frase fechou: o rastro do bicho
vai para onde o capim está indo.

## Como conferir no jogo

Item **10** novo em `TESTE-EM-NAVEGADOR.md`. Movimento não se vê em imagem
parada — este é um dos que só o jogo mostra.
