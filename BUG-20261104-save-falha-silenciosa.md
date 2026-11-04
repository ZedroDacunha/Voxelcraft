# BUG: falha de gravação dentro do `onsuccess` sumia calada

- **Data:** 04/11/2026 (achado nos testes do retry do save, [TESTES-20261104](TESTES-20261104-retry-do-save.md))
- **Status:** corrigido
- **Arquivos:** `world-save-lock.js`, `tests/save-concurrency.test.mjs`, `tests/helpers/fake-indexeddb.mjs`

## Sintoma

O save podia *parecer* gravado e não ir para o disco. Sem erro visível, sem aviso
de "não foi possível salvar", sem retry — e, no próximo carregamento, o mundo
voltava para uma versão anterior.

## Causa

`write()` com `preservePrevious: true` grava dentro do callback `previous.onsuccess`:

```js
previous.onsuccess = () => {
    if (previous.result !== undefined) store.put(previous.result, backupKey);
    store.put(data, saveKey);   // ← se isto lançar…
    ...
};
```

`transact()` já protegia a `action` com `try/catch`, mas **não esse caminho
assíncrono**: a gravação acontece depois, quando o navegador resolve o `get`.

E o navegador não aborta a transação por causa de uma exceção que escapa de um
handler de evento — ele apenas reporta o erro no `window.onerror` e segue. Como a
transação continuava viva, ela commitava **sem o `put` do save**, o
`transact()` resolvia `true` e o `world-save-manager.js` marcava o save como
concluído (`saved`, `primarySaveKnownGood = true`). Resultado: nenhuma falha
reportada e progresso perdido.

Como o `put` pode lançar de verdade: `DataCloneError` (valor que não dá para
clonar) sai como exceção síncrona. Cotas cheias normalmente chegam por `onerror`,
mas navegadores e extensões variam.

## Correção

`transact()` agora expõe um `fail(error)` para a `action` — e é ele que o callback
do `preservePrevious` usa:

```js
const fail = (error) => {
    if (failed) return;
    failed = true;
    try { tx.abort(); } catch {}
    try { db.close(); } catch {}
    reject(error);
};
```

`fail` protege contra dupla resolução (o `tx.onerror`/`onabort` que dispara depois
do `abort()` não faz nada) e unifica os três caminhos de erro: `action` síncrona,
`request.onerror` do lease e o callback diferido. O efeito prático: a gravação
falhada vira `write()` rejeitada → o manager entra no caminho de falha que já
existia (aviso + retry com escada). Falha que antes era silenciosa agora aparece
e se recupera.

O lease **não** é perdido numa falha de gravação (`transact` rejeita antes do
`.then` que chama `loseOwnership`), que é o que o retry precisa.

## Teste de regressão

Dois testes novos em `tests/save-concurrency.test.mjs` (18 no arquivo, 392 na
suíte):

- `put` do save lançando **dentro do `onsuccess`** → `write()` rejeita, o save
  anterior continua intacto, o lease é mantido e a tentativa seguinte grava;
- o mesmo erro sem `preservePrevious` (caminho síncrono) também rejeita.

O dublê de IndexedDB passou a modelar o comportamento do navegador: exceção que
escapa de um handler é engolida e a transação commita. Sem isso o teste não
reproduziria o bug — e, de fato, com o `world-save-lock.js` antigo o teste falha
com "Missing expected rejection", que é exatamente a falha silenciosa.

> Nota de método: a primeira versão da correção esqueceu de passar `fail` como
> parâmetro da `action` em `write()`. O teste pegou na hora (o `ReferenceError`
> caía no mesmo buraco). Foi o teste que encontrou o erro da correção.

## Validação

```bash
npm test        # 392 testes (2 novos)
npm run check   # sintaxe 109/109 + importmap em dia
```
