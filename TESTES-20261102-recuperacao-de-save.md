# TESTES: recuperação e importação de save com dados corrompidos

- **Data:** 02/11/2026 (item 12 da [análise de 31/10](ANALISE-20261031-melhorias.md))
- **Status:** implementado (recorte de recuperação de save)
- **Arquivos:** `tests/save-recovery.test.mjs` (novo),
  `tests/helpers/fake-indexeddb.mjs` (novo), `tests/save-concurrency.test.mjs`
  (passou a usar o helper)

## Por que

O caminho de recuperação existe justamente para o dia em que algo dá errado — e
é o menos exercitado. Se ele estiver quebrado, o jogador descobre no pior
momento: quando o save já corrompeu. A análise listava "recuperação/importação de
save com dados corrompidos" como fluxo crítico sem teste.

## O que passou a ser verificado

### Arquivo escolhido pelo jogador (`parseSaveCopy`)

| Entrada | Resultado esperado |
| --- | --- |
| cópia válida | devolve o save |
| JSON quebrado | "não contém um JSON válido" |
| arquivo vazio | "o arquivo selecionado está vazio" |
| acima de 64 MB / sem tamanho / `text()` falhando | recusa com mensagem própria |
| `format` de outro jogo, `kind` desconhecido, seed de outro mundo, versão diferente, `save.seed` diferente | "não é uma cópia compatível" |
| edições de terreno com valores fora de 0–65535 | "edições de terreno inválidas" |
| edições válidas | o save volta com `Uint16Array` de verdade |

### Cópias guardadas no banco

- `stageImportedSaveCopy` grava a cópia importada **sem tocar no save principal**
  e recusa quando o mundo está aberto em outra aba (lease fresco).
- `preserveRejectedSave` guarda o save rejeitado e **não sobrescreve** o primeiro
  arquivo guardado.
- `restoreSaveCopy` recusa cópia inválida e mundo aberto em outra aba **sem
  alterar** o save atual.

### Carregamento do jogo (`createWorldSaveManager().load()`)

| Cenário | Garantia |
| --- | --- |
| save válido | carrega e não aciona recuperação (backup intocado) |
| save inválido + backup válido | save quebrado vai para `-rejected`, backup é promovido a principal, jogador é avisado |
| cópia importada válida | é promovida a principal e a chave `-imported` é consumida |
| save inválido sem cópia | devolve `null` **sem apagar nada** e avisa o jogador |
| `load({ reset: true })` | apaga save, backup, rejeitado e cópia importada |
| leitura falhando | `load()` devolve `null` e `saveNow()` **se recusa a gravar** por cima de um save que não conseguiu ler |

## Como

`tests/helpers/fake-indexeddb.mjs` concentra o IndexedDB falso que já existia
dentro do teste de concorrência (transação `readwrite`, requests com `onsuccess`
assíncrono, `oncomplete` depois de drenar a fila, `onabort`), o adaptador
`storeRequest`, o stub de `window` (o manager registra `pagehide`) e um
`fakeFile()` no formato que `parseSaveCopy` consome (`size` + `text()`).
O teste de concorrência passou a importar o helper em vez de duplicar o código.

## Validação

```bash
npm test        # 222 testes (16 novos neste recorte)
npm run check   # sintaxe 82/82 + importmap em dia
```

## Limitações conhecidas

- O IndexedDB falso não reproduz serialização real nem quota; ele valida a
  **decisão** de cada caminho, não o comportamento do navegador.
- `QuotaExceededError` e o agendamento de novas tentativas (`scheduleSaveRetry`)
  continuam sem teste.
- Restante do item 12 segue aberto: pointer lock falhando, iluminação entre
  chunks, responsividade da HUD e qualidade gráfica automática.
