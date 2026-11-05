# MELHORIA: configurações de toque (mão e tamanho)

- **Data:** 05/11/2026 (depois do [toque no mundo](MELHORIA-20261105-toque-no-mundo.md))
- **Status:** implementado
- **Arquivos:** `world-touch-layout.js` (novo), `world-options-view.js`,
  `world-game-settings.js`, `game.js`, `index.html`, `styles.css`,
  `tests/touch-layout.test.mjs` (novo), `tests/game-settings.test.mjs`,
  `tests/pause-options.test.mjs`, `tests/touch-controls.test.mjs`,
  `service-worker.js`, `README.md`, `TESTE-EM-NAVEGADOR.md`

## Por que

Depois do [toque no mundo](MELHORIA-20261105-toque-no-mundo.md) os controles
ficaram bons para quem é destro com dedo médio: joystick à esquerda, botões à
direita, tudo de um tamanho só. Duas coisas faltavam e nenhuma delas é detalhe:

- **canhoto** não conseguia jogar: o joystick ficava do lado da mão que ele usa
  para mirar e cavar;
- **tamanho** não tinha escolha: 64 px é bom num tablet e apertado num celular
  pequeno (ou o contrário, para quem tem dedo grande ou pouca sensibilidade).

Em vez de espalhar mais duas linhas na grade de Opções, as duas viraram uma
**sub-tela "Configurações de toque"**, aberta por um botão na própria grade — a
mesma janela, sem empilhar diálogos (é a regra do menu desde o #59).

## 1. Uma sub-tela, não uma segunda janela

O diálogo de Opções é **um só** para o menu e para o ESC (PR #62). A sub-tela é
uma segunda grade dentro dele:

```
Opções                                  Opções de toque
[ Sensibilidade do mouse: 100% ]        [ Mão: Destro ]
[ Campo de visão: 75° ]                 [ Tamanho dos botões: 100% ]
[ Distância de render: 4 chunks ]
[ Volume: 70% ]                         (a lista "Controles" de teclado sai
[ Gráficos: Automática ]                 da frente)
[ Configurações de toque: Destro · 100% ]
```

- clicar em **Configurações de toque** esconde a grade principal, a lista de
  teclas e mostra a grade de toque; o título vira "Opções de toque";
- **Voltar** devolve tudo e o foco;
- **fechar e reabrir** as opções sempre cai na grade principal — quem abriu no
  ESC para mexer no volume não quer cair na tela de toque;
- o botão de entrada mostra um **resumo** (`Destro · 100%`), então dá para saber
  como estão os controles sem abrir a tela. O resumo usa a classe
  `.option-summary`, não `.option-value`: continua valendo "um `.option-value`
  por linha de barra", que é o que o teste do menu confere.

## 2. Mão: destro ou canhoto

`touchLayout` é uma lista de dois modos (`right`/`left`) e, como Gráficos, muda
por **clique** — arrastar numa lista de dois não faria sentido.

Canhoto espelha quatro coisas:

| o quê | destro | canhoto |
| --- | --- | --- |
| joystick | esquerda | direita |
| botões de ação | direita | esquerda |
| Mochila/Pausar | canto superior direito | canto superior esquerdo |
| dica do topo | alinhada à esquerda | alinhada à direita |

E uma quinta que não é só posição: **a ordem das colunas dos botões inverte**
(`direction: rtl`). Sem isso, no canhoto o polegar esbarraria em `Agachar` e
`Cavar` e `Pular` ficaria no canto mais longe — o espelho seria bonito e pior de
jogar. Com a inversão, `Pular` e `Cavar` ficam do lado do polegar nos dois modos.

## 3. Tamanho: 80% a 140%, tudo junto

`touchButtonSize` é uma barra (arrasta, como as outras do Minecraft) de **0,8 a
1,4**, passo de 0,1, padrão 1.

O valor não vira pixels no `game.js`: vira a variável CSS `--touch-scale` no
`body`, e o CSS deriva tudo dela — botão, ícone, joystick, botão do joystick, o
par de cima e **a altura que a hotbar sobe**. Assim não existe aquele bug de
"aumentei os botões e a hotbar ficou embaixo deles". A conta da hotbar deixou de
ser um número fixo (`152px`) e passou a ser
`14px + 2 × altura do botão + vão`.

**A trava de largura.** Os testes pegaram um problema antes do navegador: com
140% num celular de 320 px, joystick (185 px) e botões (207 px) somam mais que a
tela e se encostam. Cada medida é então `min(medida × escala, N vw)` — o slider
continua indo a 140%, mas o controle para de crescer quando passaria a atrapalhar:

```css
--touch-btn-size:   min(calc(64px  * var(--touch-scale, 1)), 17vw);
--touch-stick-size: min(calc(132px * var(--touch-scale, 1)), 34vw);
```

Em 320 px, 34vw + 2×17vw + margens fica bem abaixo de 100vw; em 390 px ou mais
a trava nem age no tamanho de fábrica.

O **raio do joystick** acompanha o tamanho: `touchStickRadius(escala)` é o raio em
que empurrar já conta como "fundo" (corrida). Sem isso, um joystick grande
precisaria de um dedo mais comprido para correr. O raio é lido a cada movimento,
então mudar o tamanho no ESC vale na hora, com o dedo já no joystick.

## 4. Onde o valor é aplicado

`applyGameSettings()` (que já roda no começo e a cada mudança de opção) passou a
chamar `applyTouchLayout()`:

```js
touchScale = state.size;                                  // joystick
document.body.classList.toggle('touch-left', state.lefty); // CSS espelha
document.body.style.setProperty('--touch-scale', String(state.size));
```

Como as opções avisam por `onGameSettingsChange`, mexer em **Mão** ou **Tamanho**
no ESC muda o layout **na hora**, sem recarregar o mundo. No menu, antes de
entrar, quem aplica é o próprio `game.js` ao carregar (ele lê as preferências).

## Decisões de escopo

- as duas opções aparecem **sempre** na tela de Opções (inclusive no desktop):
  a sub-tela é o lugar delas, e um notebook com tela de toque também é desktop
  até o dedo encostar;
- **não** entrou vibração, nem posição livre dos botões (arrastar para onde
  quiser): são temas próprios;
- **não** mexeu em `?touch=1` nem no híbrido: os dois continuam iguais;
- a escala mora numa variável CSS, não em `style` por elemento: um lugar só para
  mudar, e o teste confere que cada medida de `TOUCH_METRICS` aparece no CSS
  multiplicada por ela.

## O que ficou coberto por teste (`npm test`, 676)

- preferências: padrões (`Destro`, `100%`), `formatSetting` (`Canhoto`, `120%`) e
  lixo no storage (modo desconhecido volta ao destro, tamanho fora da faixa é
  preso em 0,8/1,4 e arredondado no passo);
- `touchLayoutState()` e `clampTouchScale()`: `undefined`, texto, `NaN` e
  número fora da faixa nunca viram `NaN`;
- `touchStickRadius()`: cresce com a escala, respeita a trava e cai no padrão;
- tela: a sub-tela mora na **mesma** `<dialog>` e começa escondida, o "Voltar" é
  `type="button"` (senão fecharia o diálogo) e nasce escondido, o `.options-grid
  [hidden]` tem regra própria (senão o `display: grid` ganharia do navegador);
- fiação: `applyTouchLayout` chamado dentro de `applyGameSettings`, ligado a
  `onGameSettingsChange`, classe `touch-left` no `body`, `--touch-scale` setado e
  o raio do joystick vindo de `touchStickRadius(touchScale)`;
- CSS: espelho do canhoto (joystick, ações, topo, dica), inversão das colunas, e
  cada medida de `TOUCH_METRICS` escalando junto;
- **trava de largura**: as duas fatias em `vw` e a conta de que os controles
  cabem lado a lado num celular de 320 px.

O que só o aparelho mostra está no [roteiro](TESTE-EM-NAVEGADOR.md) §14: se o
polegar alcança os botões no canhoto, se 140% fica confortável e se a hotbar
continua acima dos botões nos dois tamanhos.
