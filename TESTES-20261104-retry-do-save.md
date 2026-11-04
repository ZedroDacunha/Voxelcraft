# TESTES: retry do save e falhas de armazenamento

- **Data:** 04/11/2026 (item 12 da [análise de 31/10](ANALISE-20261031-melhorias.md), dívida de testes)
- **Status:** implementado
- **Arquivos:** `tests/save-retry.test.mjs` (novo, 9 testes)

## Por que

O save entre abas já tinha teste desde 02/11. Faltava o outro lado do problema:
**quando a gravação falha**. `scheduleSaveRetry()` decide se o jogador vai perder
progresso — e nunca tinha sido executado por um teste. O comportamento era o que
o código *pretendia*, não o que ele faz.

## O que ficou coberto

| Situação | O que o teste exige |
| --- | --- |
| falha transitória | mensagem "tentará novamente", **um** aviso (não um por tentativa), nova tentativa em 2 s |
| retry bem-sucedido | mundo gravado, estado `saved` e o aviso "Salvamento retomado" |
| disco cheio (`QuotaExceededError`) | mensagem pedindo exportar cópia e **nenhum** retry em 5 minutos |
| `SecurityError` / `NotAllowedError` / códigos `22` e `1014` | mesma regra de falha permanente |
| escada de espera | 2 s → 5 s → 12 s → 30 s → 30 s (teto), com "não tentou antes" e "tentou depois" |
| sucesso zera a escada | depois de um save bom, a próxima falha volta a esperar 2 s |
| duas falhas seguidas | **um** retry, não dois disparados pelo mesmo timer |
| sem mundo / outra aba dona | não grava, não agenda retry, avisa `blocked` |
| sair do jogo | o flush grava e o retry pendente é cancelado |

## Como a falha é injetada

O detalhe que fez diferença: **onde** falhar. A primeira tentativa foi fazer o
`storeRequest` do manager lançar erro — não testava nada, porque o `storeRequest`
só é usado no `load()`; a gravação passa por `world-save-lock.js`, que abre a
transação por conta própria.

A injeção certa é no `store.put` da chave do save, e com o desfecho que o jogo
vê: pedido falho + transação abortada → `lock.write` **rejeita** → o manager cai
no `catch`, mostra a mensagem e agenda o retry. Só o lease e o backup continuam
funcionando, para o teste medir exatamente o caminho do save.

Timers falsos (`node:test` MockTimers) permitem percorrer a escada inteira de
espera em milissegundos, comparando "não tentou antes de X" com "tentou em X".

## Achado durante os testes (não corrigido aqui)

Com `preservePrevious: true`, `world-save-lock.js` grava dentro do callback
`previous.onsuccess`:

```js
previous.onsuccess = () => {
    if (previous.result !== undefined) store.put(previous.result, backupKey);
    store.put(data, saveKey);   // se isto lançar, a exceção sai do handler
    ...
};
```

Se esse `put` lançar, a exceção escapa do handler de evento — o `transact()` não a
captura e o desfecho depende do navegador (a transação pode commitar sem gravar,
e o manager registraria o save como bem-sucedido). É raro — os saves do jogo são
objetos simples, e `QuotaExceededError` chega por `onerror`, não por exceção —,
mas a defesa é pequena: embrulhar o callback e abortar a transação no erro.

Fica registrado como próximo recorte, para não misturar correção de comportamento
com o PR de testes.

## Validação

```bash
npm test        # 390 testes (9 novos)
npm run check   # sintaxe 109/109 + importmap em dia
```
