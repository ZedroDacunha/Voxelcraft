# MELHORIA: acessibilidade do inventário e da HUD

- **Data:** 02/11/2026 (item 11 da [análise de 31/10](ANALISE-20261031-melhorias.md))
- **Status:** implementado
- **Arquivos principais:** `inventory-a11y.js` (novo), `game.js`, `index.html`,
  `inventory.css`, `styles.css`, `tests/inventory-a11y.test.mjs`

## Antes

O menu inicial já era razoavelmente semântico, mas a interface de jogo não era:

| Medida no inventário | Antes |
| --- | --- |
| slots | 76 |
| slots com nome acessível | 0 |
| slots focáveis | 0 |
| `role`/`aria-label` da barra de vida | nenhum |

Os slots eram `div` operáveis só com `mousedown`: quem não usa mouse **não
conseguia** pegar, mover ou dividir item, nem sabia o que havia em cada slot. As
barras de vida, fome e fôlego eram apenas ícones desenhados por CSS, sem valor
em texto. E a tela de morte aparecia sem receber foco, então o leitor de tela
continuava lendo o jogo atrás dela.

## O que mudou

### Inventário operável por teclado

- Cada slot é `role="gridcell"` com `aria-label` em texto
  (`"Vazio"`, `"Maçã, 3 unidades"`, `"Picareta de pedra, 62% de durabilidade"`).
- Cada grade (`inv-main`, `inv-hotbar`, `inv-craft`, `inv-out`, `inv-chest` e as
  três do forno) é `role="grid"` com rótulo e `data-columns` para as setas
  saberem o que é "linha".
- **Roving tabindex**: só um slot de cada grade fica no `Tab`; os outros são
  alcançados com as setas. São 6 paradas de `Tab` em vez de 76.
- A grade de criação atualiza as colunas ao abrir bancada 3×3, então as setas
  nunca caem nos slots escondidos do 2×2.
- O painel é `role="dialog"` rotulado pelo título que já muda sozinho
  (Inventário / Forno / Baú / Bancada de criação 3×3).

| Tecla | Ação |
| --- | --- |
| `Tab` / `Shift+Tab` | próxima grade / grade anterior |
| Setas, `Home`, `End` | andar entre slots (para na borda, sem "pular" de linha) |
| `Enter` | clique esquerdo (pega/cola a pilha) |
| `Espaço` | clique direito (pega/cola um item, divide a pilha) |
| `Shift+Enter` / `Shift+Espaço` | movimento rápido para o outro lado |
| `Esc` | fecha o inventário (comportamento que já existia) |

O foco de teclado tem contorno próprio (`.islot:focus-visible`, `#f3d58a`), e a
pilha segurada/o tooltip aparecem ao lado do slot focado — o mesmo feedback que
o mouse tinha, sem precisar de mouse. `Enter`/`Espaço` passam pelo mesmo
`activateSlot()` que o clique, então não há dois caminhos de regra para manter.

### Barras de status com valor em texto

`Vida: 14 de 20`, `Fome: 6 de 20 (fome baixa)`, `Fome: 0 de 20 (fome zerada, você
está perdendo vida)`, `Fôlego: 12 de 20`. As mesmas faixas de fome da regra de
sobrevivência (`hungerStage`) alimentam o texto, então o aviso visual e o aviso
acessível não podem divergir. Os avisos do `#toast` agora são uma região viva
(`role="status" aria-live="polite"`) e a hotbar ganhou rótulo por casinha
(`"3: Tocha, 8 unidades (selecionado)"`).

### Foco na tela de morte

`#death` é `role="alertdialog"` (rotulado por `death-cause`/`death-info`) e
recebe o foco ao aparecer. Quando o mundo termina de carregar e o botão vira
`Renascer`, ele recebe o foco — mas só se o jogador ainda estiver na tela de
morte, para não roubar o foco de quem já navegou para outro lugar.

### Menos animação

Com `prefers-reduced-motion: reduce` a barra de fome já não pulsava; agora o slot
ativo da hotbar também não dá o "pulinho" (`transform: none`). A borda branca
continua marcando a seleção.

## Módulo puro

`inventory-a11y.js` concentra o que dá para decidir sem DOM, o que permite
testar com `node --test`:

- `slotLabel(stack, items?)` — nome acessível de um slot.
- `nextSlotIndex({ index, total, columns, key })` — próxima posição de foco ou
  `null` na borda.
- `keyToSlotAction(key, { shiftKey })` — tecla → botão de mouse equivalente.
- `statusLabels({ health, hunger, breath, max* })` — textos das três barras.

## Validação

```bash
npm test        # 142 testes (27 novos em tests/inventory-a11y.test.mjs)
npm run check   # sintaxe 74/74 + importmap em dia
```

Os testes cobrem rótulos (vazio, pilha, durabilidade presa em 0–100%, item
desconhecido, catálogo real), navegação (bordas, `Home`/`End`, grades 2×2/3×3/1,
posições inválidas), mapeamento de teclas e o texto das barras nas faixas de
fome. Também verificam no código que o HTML marca os elementos e que o foco é
visível, para a ligação não se perder num refactor futuro.

## Limitações conhecidas

- **Não foi testado com leitor de tela real** (NVDA/VoiceOver): o sandbox não
  tem navegador disponível (falta `libnss3`). A validação foi por testes de
  módulo + inspeção do HTML/CSS gerado.
- A hotbar da HUD continua **sem foco** de propósito: o mouse está travado no
  jogo e o alvo de teclado ali é a própria jogabilidade (1–9 trocam o slot). Ela
  é exposta como `role="img"` com nome, não como grade.
- O canvas 3D do jogo não é acessível a leitor de tela — não há como descrever o
  mundo em texto de forma útil; o escopo aqui é a interface.
- Áudio, controles de toque, PWA e mais conteúdo continuam no item 13 da análise.
