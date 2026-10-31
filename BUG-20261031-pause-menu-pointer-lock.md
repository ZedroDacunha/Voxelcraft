# BUG: fechar o inventário podia deixar a tela sem menu de pausa

- **Data:** 31/10/2026
- **Status:** corrigido
- **Arquivos principais:** `game-pause-menu.js`, `game-pointer-lock.js`, `game.js`

## Sintoma

Ao fechar o inventário tentando recuperar o pointer lock, o menu de pausa era
escondido antes de o navegador confirmar o lock. Se o navegador recusasse o
pedido — por exemplo, durante o cooldown depois de `Esc` — o jogo ficava sem
inventário, sem menu de pausa e sem orientação visível.

## Causa

`closeInventory(true)` fazia:

```js
menu.style.display = 'none';
requestLock();
```

Além disso, `PointerLockControls` dispara os eventos `lock`/`unlock` antes de
atualizar `controls.isLocked`. Sincronizar o menu lendo apenas `isLocked` dentro
desses eventos produzia o estado invertido por um instante.

## Correção

- `game-pause-menu.js` define a política pura: o menu só fica oculto quando o
  jogo está capturado, o inventário está aberto ou a tela de morte está ativa.
- `game-pointer-lock.js` pede pointer lock com fallback, confirma sucesso por
  promessa/evento e resolve `false` em falha, ausência da API ou timeout.
- `game.js` sincroniza o menu por estado explícito, sem esconder a UI antes da
  confirmação do lock.
- Os eventos `lock`/`unlock` informam o estado correto explicitamente, evitando
  depender da ordem interna de atualização do `PointerLockControls`.
- Pedidos concorrentes de lock compartilham a mesma promessa.
- O respawn não usa mais `setTimeout` otimista para decidir se o menu aparece.

## Validação

```bash
node --test tests/*.test.mjs
node tools/stamp-importmap.mjs --check
git diff --check
```

Resultado: 97 testes aprovados.

Verificação em navegador headless, com `requestPointerLock()` simulando
`SecurityError`:

| Estado | Menu | Inventário | Pointer lock |
| --- | --- | --- | --- |
| inventário aberto | oculto | visível | não |
| relock recusado | visível e acionável | oculto | não |
| nova tentativa ainda bloqueada | visível | oculto | não |
| relock bem-sucedido | oculto | oculto | sim |
| unlock normal | visível | oculto | não |

Os avisos de `SecurityError` registrados durante o teste eram esperados porque a
falha de pointer lock foi simulada. Nenhum erro inesperado de página ocorreu.
