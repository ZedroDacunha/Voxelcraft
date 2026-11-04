# MELHORIA: controles de toque (celular e tablet)

- **Data:** 04/11/2026 (item "toque" da [análise de 31/10](ANALISE-20261031-melhorias.md))
- **Status:** implementado
- **Arquivos principais:** `world-touch-controls.js` (novo), `game.js`,
  `index.html`, `styles.css`, `tests/touch-controls.test.mjs` (novo)

## Por que

O jogo só começava de um jeito: **pointer lock**. Sem ele, a física, o relógio do
mundo, a mineração e o salvamento automático ficavam todos parados — e
`requestPointerLock` simplesmente não existe em celular e tablet. Na prática, o
jogo era injogável no toque, não por falta de controles, mas porque *não havia
como entrar*.

## Como

### Um `playing()` em vez de "o mouse está travado?"

A decisão "estou jogando?" estava espalhada em doze lugares como
`controls.isLocked`. Agora existe uma função só:

```js
function playing() {
    return Boolean(controls?.isLocked) || touchActive;
}
```

Tudo que dependia do lock passou a depender dela: física, relógio, fornos,
nuvens, ambiente, salvamento periódico, abrir inventário e a visibilidade do
menu de pausa. Onde o lock continua sendo o certo — olhar com mouse, teclado,
roda e clique na tela — o `controls.isLocked` ficou intacto.

### Entrada: `startPlay()`

Botão Jogar, clique na tela e botão Renascer entram todos por `startPlay()`. Se
o aparelho tem dedo, ele liga `touchActive` e não chama lock nenhum; se o lock
falhar mesmo num aparelho de toque, ele cai no toque em vez de travar no menu.

**Notebook com tela de toque:** o último tipo de ponteiro decide. Se o jogador
clicou com o mouse, o jogo pede lock normalmente; se tocou com o dedo, vira
toque. Sem isso, um notebook com tela de toque perderia o mouse.

### Joystick

- o **centro é onde o dedo encostou**, não o meio do disco: um toque no meio do
  joystick não anda;
- o vetor é normalizado pelo raio e **saturado em 1**, então arrastar além da
  borda não acelera mais (e "empurrar fundo" quer dizer a mesma coisa em
  qualquer tamanho de tela);
- a **zona morta é por eixo** (0,3), não pelo módulo: na diagonal as duas
  direções precisam andar, mas o tremor de um dedo parado não anda em nenhuma;
- **correr** é o fim do curso do joystick (0,88+) — o Shift do teclado;
- o joystick alimenta os **mesmos botões lógicos** do WASD
  (`moveForward`/`moveBackward`/`moveLeft`/`moveRight`/`isSprinting`), então a
  física não mudou uma linha.

### Olhar

Arrastar em qualquer ponto livre da tela: `lookAfterDrag()` aplica a **mesma
convenção do mouse** (arrastar para a direita gira para a direita) e respeita o
limite vertical. A sensibilidade das opções multiplica o arrasto, então quem
ajustou a câmera no desktop não precisa reajustar no toque.

### Botões

`Cavar` e `Pular` são de segurar; `Usar`, `Agachar` (alterna), `Mochila` e
`Pausar` são de um toque. A lista vive em `TOUCH_BUTTONS`, e o teste confere que
cada botão existe no HTML **e** é tratado no jogo.

`Usar` chama a **mesma** `useHeldItem()` do botão direito do mouse — extraída do
handler de `mousedown` justamente para não haver duas versões de "colocar bloco /
abrir forno / comer / abrir porta".

A hotbar virou botões (não existe roda do mouse no toque) e o HUD sobe 152 px
para não ficar embaixo do joystick.

### O que cala junto

Pausar, morrer e abrir inventário chamam `resetInputFlags()`: nenhum dedo que
saiu da tela deixa o jogador andando sozinho. A UI de toque esconde sozinha
quando o inventário, a morte ou o menu estão na frente, e mostra uma dica curta
que desaparece em 7 s.

## Validação

```bash
npm test        # 345 testes (15 novos)
npm run check   # sintaxe 102/102 + importmap em dia
```

- vetor do joystick (centro, metade, além da borda, diagonal, entrada inválida);
- zona morta por eixo, corrida no fim do curso, joystick → botões do WASD;
- olhar: direção, limite vertical, sensibilidade, entrada inválida;
- detecção de aparelho de toque (inclusive caneta e navegador antigo);
- todo `TOUCH_BUTTONS` existe no HTML e é tratado no `game.js`;
- botões usam `.classic-btn`, `touch-action: none` no canvas e a UI só recebe o
  dedo nos controles;
- `playing()` cobre física, relógio, fornos, nuvens, salvamento e menu;
- morrer desliga o toque (`touchActive = false`) e limpa os botões.

## Limitações conhecidas

- **Não testei em aparelho real nem em navegador headless** (o sandbox não tem
  Chromium): a validação é de lógica e de estrutura. O que pode precisar de
  ajuste fino é o tamanho dos botões em tela pequena e a sensibilidade do
  arrasto.
- Sem gesto de pinça/zoom, sem botão de "trocar de mão", sem layout para tablet
  grande com controles maiores.
- O inventário continua sendo uma grade pensada para mouse: dá para usar por
  toque (o navegador converte o toque em clique), mas arrastar item entre slots
  no dedo não é um gesto natural — resolver isso é um recorte próprio.
- Não há vibração (haptics) no toque ao quebrar bloco.
