# MELHORIA: o dedo é a mira (toque no mundo)

- **Data:** 05/11/2026 (depois do [sol no menu](MELHORIA-20261105-sol-no-menu.md))
- **Status:** implementado
- **Arquivos:** `world-touch-controls.js`, `game.js`, `index.html`, `styles.css`,
  `tests/touch-controls.test.mjs`, `service-worker.js`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

Os controles de toque já existiam e funcionavam: joystick, arrastar para olhar e
seis botões. Só que jogar no celular continuava esquisito por um motivo que não
era bug de nenhum botão: **a mira era uma cruz fixa no meio da tela**. Para
colocar um bloco ou cavar, o jogador precisava arrastar até a cruz cair no bloco
certo e só então apertar `Cavar` ou `Usar` — três gestos para algo que no
Minecraft de celular é um toque no próprio bloco.

Este PR faz o **dedo virar a mira**, sem mexer no que já funcionava no desktop.

## 1. Um dedo, três gestos

O mesmo `pointerdown` na tela podia ser três coisas diferentes e antes só podia
ser uma (olhar). Agora a decisão vem de `touchGesture()` — função pura, sem DOM,
em `world-touch-controls.js`:

| gesto | quando | o que faz |
| --- | --- | --- |
| **olhar** | o dedo andou ≥ 12 px (`TOUCH_LOOK_SLOP`) | gira a câmera, como o mouse |
| **toque curto** | soltou antes de 240 ms (`TOUCH_HOLD_MS`) e sem andar | usa/coloca no bloco sob o dedo |
| **segurar** | ficou parado 240 ms | cava o bloco sob o dedo, e deslizar cava a fileira |

A ordem importa: **quem arrastou nunca vira toque**. Tremer o dedo dentro da
folga não cancela nada — a folga existe justamente para separar tremor de
arrasto, e é o mesmo raciocínio da zona morta do joystick.

O relógio do "segurar" não pode depender de `pointermove`: **um dedo parado não
gera evento nenhum**, e sem um `setTimeout` segurar nunca viraria cavar. Soltar
(ou `pointercancel`, ou pausar, ou morrer) sempre limpa o timer.

## 2. A mira é uma direção, não um bloco congelado

`ndcFromPoint()` converte o ponto do dedo em coordenadas normalizadas da câmera
(-1..1, y para cima) e o `Raycaster` do `three` entrega a direção. A partir daí,
`updateTarget()` troca a fonte da mira:

```js
if (touchAim.on) currentHit = raycastVoxels(camera.position, touchAim.dir, …);
else             currentHit = raycastVoxels(camera.position, dirDaCâmera, …);
```

Recalcular **todo quadro** e não guardar o bloco do `pointerdown` evita um bug
silencioso: ao quebrar o bloco, a mira ficaria apontando para o buraco que ficou
no lugar (e o jogo tentaria minerar ar para sempre). Do mesmo jeito, o golpe no
Mofim passou a usar `touchAim.dir`, senão o bicho apanhava sem estar na frente do
dedo.

O contorno de mira do jogo (`targetMesh`) continua sendo o retorno visual: ele
aparece **no bloco que o dedo escolheu**, o que já ensina o gesto sem texto.

## 3. Nada disso atrapalha o mouse

- `pointerdown` com `pointerType === 'mouse'` sai antes de tudo (o mouse continua
  com o *pointer lock* e a mira do centro);
- abrir espaço para o dedo exigiu uma linha de CSS: a faixa do HUD agora é
  `pointer-events: none` (só as casas da hotbar recebem o dedo). Antes ela
  engolia todo toque na parte de baixo da tela, e metade do mundo não respondia;
- a dica do topo passou a dizer os três gestos: *"Arraste para olhar · toque no
  bloco para usar · segure para cavar"*.

## 4. Botões só de ícone

Com o dedo virando a mira, o texto dentro dos botões virou peso: seis palavras
ocupando a tela de um celular. Os botões agora são **quadrados de 64 px com um
símbolo** (46 px no par de cima, 54 px em paisagem baixa), no mesmo cinza,
borda 2 px e canto reto do `.classic-btn` do menu.

| botão | ícone |
| --- | --- |
| Pular | seta para cima |
| Agachar | seta para baixo (alterna) |
| Cavar | picareta |
| Usar | mão aberta |
| Mochila | mochila com fecho |
| Pausar | duas barras |

Os ícones são **SVG escrito à mão dentro do `index.html`** — nenhum arquivo de
imagem para baixar, então o jogo continua funcionando offline (o service worker
não tem nada novo para guardar) e não há ícone "faltando" no cache.

Sem texto na tela, o nome de cada botão foi para o `aria-label` (`Pular`,
`Cavar`, …), e o desenho leva `aria-hidden="true"` — quem usa leitor de tela
ouve o nome, não a descrição do desenho. O teste confere que **todo botão do
módulo** existe no HTML, tem ícone, **não tem texto solto** e tem `aria-label`
igual ao rótulo do módulo: assim HTML, CSS e jogo não podem discordar.

## Decisões de escopo

- **Não** virou configuração (esquerda/destra, tamanho dos botões, sensibilidade
  na tela de Opções) — isso é outro tema;
- **não** entrou vibração (`navigator.vibrate`), que também tem PR próprio;
- o botão `Cavar` **continua existindo**: o gesto novo é um atalho, não uma
  troca. Quem preferir mirar pela cruz e apertar o botão continua igual;
- `TOUCH_HOLD_MS` e `TOUCH_LOOK_SLOP` são constantes exportadas, não números
  soltos no `game.js`: ajustar o "segurar" é mexer em uma linha testada.

## O que ficou coberto por teste (`npm test`, 661)

- `touchGesture()`: `wait` → `tap`, `hold`, `look`; a folga conta como **raio**
  (diagonal), soltar depois de segurar não vira toque curto, e número estranho
  (NaN, `undefined`, `Infinity`, folga 0) não inventa gesto;
- `ndcFromPoint()`: centro, cantos, metade, fora da tela travado na borda e tela
  sem tamanho sem virar NaN;
- fiação no `game.js`: o raio sai do ponto tocado, o alvo é **recalculado** a
  cada quadro pela direção do dedo, o golpe no Mofim usa a direção do dedo, o
  timer do "segurar" existe, soltar desliga a escavação e devolve a mira para a
  câmera, e `resetInputFlags()` encerra o gesto e apaga o "apertado" dos botões;
- HTML/CSS: um botão por entrada de `TOUCH_BUTTONS`, só ícone dentro, sem texto
  solto, `aria-label` batendo com o módulo e nenhum `<img>`.

O que **não** dá para testar sem navegador (e por isso está no
[roteiro](TESTE-EM-NAVEGADOR.md) §13): o gesto debaixo do dedo de verdade, o
tempo do "segurar" no aparelho real e se os ícones ficam legíveis no sol.
