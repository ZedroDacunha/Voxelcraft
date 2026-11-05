# MELHORIA: posição livre dos controles de toque

- **Data:** 05/11/2026 (depois da [vibração no toque](MELHORIA-20261105-vibracao-no-toque.md))
- **Status:** implementado
- **Arquivos:** `world-touch-positions.js` (novo), `game.js`,
  `world-options-view.js`, `index.html`, `styles.css`,
  `tests/touch-positions.test.mjs` (novo), `service-worker.js`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

Cada celular tem um polegar diferente e cada jogo agarra o aparelho de um jeito.
Até aqui o layout tinha duas escolhas — destro/canhoto e 80–140% — e a posição era
sempre a mesma: joystick num canto, os seis botões no outro. Quem joga com o
celular apoiado, com a mão pequena ou com o polegar curto continuava esticando o
dedo (ou pior: soltando o aparelho para alcançar `Pular`).

A posição livre resolve isso deixando **cada peça** ir para onde o dedo alcança,
sem virar um editor de layout genérico.

## 1. Deslocamento, não coordenada

A decisão central: o storage **não** guarda onde a peça está, guarda **o quanto
ela saiu do lugar natural**.

```
jump: { x: -22.5, y: 14.25 }   // % da tela a partir do canto natural
```

Isso é o que faz o resto continuar funcionando sem caso especial:

| recurso | o que acontece |
| --- | --- |
| grade de fábrica | continua sendo a do CSS; peça sem deslocamento fica onde sempre ficou |
| Destro/Canhoto | espelha a base; o deslocamento soma por cima |
| Tamanho 80–140% | cresce em volta do lugar (o `translate` não afeta o layout) |
| paisagem baixa | a grade muda de degrau; o deslocamento continua válido |
| girar o aparelho | a % é reaplicada em px no `resize`, então a peça fica no mesmo lugar **relativo** |

Se fosse coordenada absoluta, o `game.js` teria de repetir no JS toda a geometria
da grade (e do destro/canhoto, e do tamanho) — duas verdades sobre a mesma tela,
que é exatamente o tipo de coisa que quebra em silêncio.

## 2. O mecanismo: uma variável por peça

O jogo escreve duas variáveis CSS em cada peça:

```js
el.style.setProperty('--touch-dx', `${offset.x.toFixed(1)}px`);
el.style.setProperty('--touch-dy', `${offset.y.toFixed(1)}px`);
```

e o CSS soma ao `transform`:

```css
#touch-ui .touch-btn { transform: translate(var(--touch-dx, 0px), var(--touch-dy, 0px)); }
#touch-ui .touch-btn.pressed, #touch-ui .touch-btn:active {
    transform: translate(var(--touch-dx, 0px), var(--touch-dy, 0px)) translateY(1px); }
```

O seletor **com `#touch-ui`** não é enfeite: `.classic-btn:active:not(:disabled)`
do menu também mexe em `transform` e ganharia do `.touch-btn` sozinho — o botão
arrastado voltaria ao lugar no instante do toque. Idem para `#touch-stick`, que
tem regra própria.

Como `transform` não participa do layout, arrastar um botão **não empurra** os
outros da grade: cada peça se move sozinha.

## 3. O modo de edição

A edição acontece **no jogo**, não numa miniatura: é o único lugar onde os botões
têm o tamanho real e ficam embaixo do dedo de verdade.

```
ESC → Opções → Configurações de toque → Editar posições
```

O que acontece ao entrar:

- o diálogo fecha e o cartão de pausa some (`body.touch-editing .pause-card`),
  então o mundo continua **borrado** atrás — a mesma pausa de sempre;
- o `#menu` (que cobre a tela com desfoque e captura o dedo) vira transparente e
  `pointer-events: none`; a UI de toque sobe para `z-index: 11` e ganha um véu
  escuro;
- cada peça ganha **contorno tracejado** (cheio enquanto arrasta) e a barra
  `Restaurar` / `Pronto` aparece no topo;
- a dica de jogar some, o joystick não move o jogador, os botões não agem e o
  fundo não usa/cava: **o dedo só arrasta**.

`Pronto` volta para o menu de pausa (não retoma o jogo — quem pausou decide
quando voltar). `Restaurar` devolve tudo ao lugar na hora, sem sair da edição,
para o jogador comparar.

## 4. O clamp: a peça não sai da tela

No começo do arrasto mede-se o retângulo **natural** (o retângulo real menos o
deslocamento atual) e, a cada movimento, `clampOffsetPx()` prende o deslocamento
entre a margem e a borda oposta:

```js
minX = margem - naturalLeft;
maxX = larguraDaTela - margem - naturalLeft - larguraDaPeça;
```

A margem de 6 px existe porque peça encostada na borda é peça que o dedo não
pega. Peça maior que a tela (joystick em 140% num aparelho minúsculo) cola no
mínimo em vez de gerar intervalo invertido.

## 5. Quem entra e quem atende

O jogo e a tela de opções são módulos separados (`game.js` só existe dentro do
mundo; as opções vivem no `world-menu.js`). Em vez de import cruzado, eles se
falam por **evento no documento**:

| evento | quem dispara | quem atende |
| --- | --- | --- |
| `touch-edit-positions` | botão “Editar posições” | `game.js` → `setTouchEditing(true)` |
| `touch-positions-reset` | “Restaurar padrões” | `game.js` → relê e reaplica |

O botão **só aparece quando há mundo e modo toque** (`body.touch-mode`, marcado
pelo `game.js`): no menu do título ele fica escondido, porque não há controles na
tela para arrastar.

“Restaurar padrões” limpa o storage **no próprio módulo** (funciona mesmo sem o
jogo carregado) e depois avisa o jogo para reaplicar na hora.

## 6. Storage separado, de propósito

`voxel-sandbox/touch-positions/v1`, e não `game-settings`: as preferências são
números numa faixa ou listas de modos, e um mapa de sete peças obrigaria a
inventar um tipo novo no `sanitizeGameSettings`. Um módulo próprio
(`world-touch-positions.js`, puro) deixa a validação clara:

- peça desconhecida é **descartada** (não vira lixo acumulado);
- valor não numérico vira **zero**;
- valor fora da trava (±120%) é preso no limite — a trava é só anti-adulteração,
  porque o limite real é o clamp com o tamanho da peça;
- JSON inválido, storage bloqueado ou `null` devolvem as sete peças em zero.

120% e não 45% porque uma peça pode **atravessar** a tela: do canto direito ao
esquerdo dá quase −90% da largura. (A primeira versão usava 45% e o teste de ida e
volta pegou o erro.)

## Decisões de escopo

- **não** é um editor livre de verdade: não dá para mudar o tamanho de uma peça
  só, criar botão novo, nem esconder peça;
- **não** tem "voltar ao padrão" por peça, só o geral (Restaurar);
- a edição **não** acontece com o jogo rodando: entrar enquanto se joga é
  bloqueado, porque deixaria o mundo correndo atrás de peças arrastáveis;
- **não** mexe no posicionamento da hotbar (ela continua subindo pela altura dos
  botões).

## O que ficou coberto por teste (`npm test`, 701)

- storage: padrão tudo zero, gravar/ler o que foi arrastado, peça desconhecida
  descartada, valor fora da trava preso, JSON inválido e storage bloqueado sem
  lançar, `resetTouchPositions()` apagando;
- conversão: `%`↔pixel ida e volta, mesma % em tela maior, tela sem tamanho e
  `NaN` sem virar `NaN`;
- clamp: preso na margem dos quatro lados, arrasto dentro da tela respeitado,
  peça maior que a tela sem intervalo invertido;
- tela: a linha “Editar posições” é botão (sem trilho/valor), só aparece com
  `body.touch-mode`, fecha o diálogo e dispara o evento; “Restaurar padrões”
  limpa e avisa;
- jogo: aplicação em `--touch-dx/--touch-dy`, `resize`, `beginPieceDrag` medindo o
  retângulo natural, `movePieceDrag` com clamp e gravação em %, `endPieceDrag`
  salvando, `setTouchEditing` pausando e escondendo a barra, e os três
  `if (touchEditing) return` que impedem o dedo de jogar durante a edição;
- CSS: transform somado nas peças (inclusive no `:active`), menu transparente e
  sem ponteiro, véu escuro, contorno tracejado e barra escondida fora da edição.

O que só o aparelho mostra está no [roteiro](TESTE-EM-NAVEGADOR.md) §16 — em
especial se a folga de 6 px na borda é confortável com o polegar e se, depois de
arrastar tudo, os botões continuam cômodos ao mudar o tamanho para 140%.
