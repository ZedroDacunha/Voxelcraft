# Postura de braço meio levantado ao segurar item nas visões externas

Quando o jogador segurava um item, o braço direito ficava esticado para baixo
em repouso nas câmeras de terceira pessoa (costas e frente) e o personagem na
janela do inventário não exibia o item equipado, diferindo da postura natural
meio levantada dos estudos 3D.

Agora todas as visões externas usam a mesma postura sem alterar a primeira
pessoa:

- **Pose compartilhada em 3ª pessoa (`player-held-item.js`, `game.js`)**:
  `applyThirdPersonHeldArmPose` mantém ombro (`-0,28 rad`) e cotovelo
  (`-0,36 rad`) meio levantados à frente sempre que há item na mão nas vistas
  de 3ª pessoa (costas e frente), amortecendo o balanço traseiro na caminhada e
  na corrida e retornando ao repouso reto quando a mão está vazia.
- **Prévia 3D no inventário (`inventory-player-preview.js`, `game.js`)**:
  `#inv-player` passa a exibir o item ativo da hotbar com a mesma postura de
  braço meio levantado, atualizando quando o slot selecionado muda.
- **Compensação da maçã 3D e previews (`player-eat-animation.js`, `tools/`)**:
  ajusta `THIRD_PERSON_APPLE_GRIP` para manter a maçã em pé na mão flexionada
  e unifica `applyThirdPersonHeldArmPose` nos previews de animação.

Testes automatizados: `tests/player-held-item.test.mjs` e
`tests/inventory-player-preview.test.mjs`. Importmap recarimbado com
`node tools/stamp-importmap.mjs`.
