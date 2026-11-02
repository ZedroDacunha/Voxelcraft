# TESTES: concorrência e erro no save (lock + save manager)

- **Data:** 02/11/2026 (item 12 da [análise de 31/10](ANALISE-20261031-melhorias.md))
- **Status:** implementado (recorte de save/concorrência)
- **Arquivos:** `tests/save-concurrency.test.mjs` (novo)

## Por que

Entre os fluxos críticos sem teste apontados na análise, o mais perigoso é o
**save entre abas**: `world-save-lock.js` decide quem pode gravar e
`world-save-manager.js` decide quando gravar. Um erro aí não aparece como bug
visual — aparece como **progresso perdido**. Os dois estavam cobertos só
indiretamente.

## Como testar sem navegador

`createWorldSaveLock()` já recebe `openDatabase` por parâmetro; o teste injeta um
**IndexedDB de mentira** com o mínimo que o código usa:

- transação `readwrite` + `objectStore()`;
- `get` / `put` / `delete` devolvendo requests;
- `onsuccess` disparado de forma assíncrona (`queueMicrotask`), respeitando a
  ordem — inclusive quando um `onsuccess` cria outro request (o `preservePrevious`
  faz exatamente isso);
- `oncomplete` só depois de a fila de requests drenar, e `abort` disparando
  `onabort`.

Para o `createWorldSaveManager` o teste também injeta `storeRequest` e um stub de
`window` (o manager registra `pagehide` na criação).

## O que passou a ser verificado

### Lock (`world-save-lock.js`)

| Cenário | Garantia |
| --- | --- |
| duas abas | a segunda não rouba o lease e não recebe aviso de perda |
| lease expirado (ou sem `heartbeat` válido) | pode ser assumido por outra aba |
| `write()` com posse | grava o save e **renova o lease** na mesma transação |
| `write({ preservePrevious })` | o save anterior vai para o backup |
| `write({ deleteKey })` | consome a cópia importada |
| `write()` sem posse | **não grava nada**, marca perda e chama `onLost` uma vez |
| `write()` antes de `acquire()` | devolve `false` sem tocar no banco |
| `release()` | apaga o lease e libera a próxima aba; sem posse devolve `false` |
| `openDatabase` falhando | `acquire()` rejeita em vez de fingir posse |
| heartbeat | renova o lease e **detecta** quando outra aba assume |

### Save manager (`world-save-manager.js`)

| Cenário | Garantia |
| --- | --- |
| outra aba é dona do lease | `load()` não bloqueia a aba errada, `saveNow()` não grava por cima, a UI recebe `blocked` e o jogador é avisado |
| aba dona do lease | `saveNow()` grava, emite `saved` e entrega o save em `onSaved` (é o que alimenta a data do meta, #17) |
| `requestSave(true)` | fica `pending`, não grava antes do debounce e grava quando ele vence (timers simulados) |

## Validação

```bash
npm test        # 206 testes (16 novos em tests/save-concurrency.test.mjs)
npm run check   # sintaxe 81/81 + importmap em dia
```

## Limitações conhecidas

- **Não substitui teste de navegador**: o IndexedDB falso não reproduz
  serialização real, quota nem bloqueio entre abas de verdade. Os testes cobrem a
  *lógica* de decisão; a integração real (duas abas abertas) continua manual.
- `QuotaExceededError` e o agendamento de novas tentativas
  (`scheduleSaveRetry`) ainda não têm teste: exigem injetar falha dentro da
  transação do lock, o que pede um fake mais elaborado.
- Os itens restantes do item 12 continuam abertos: recuperação/importação com
  dados corrompidos, pointer lock falhando, iluminação entre chunks,
  responsividade e qualidade gráfica automática.
