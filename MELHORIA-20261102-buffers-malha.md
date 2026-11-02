# MELHORIA: mesher reaproveita buffers em vez de alocar por chunk

- **Data:** 02/11/2026 (item 9 da [análise de 31/10](ANALISE-20261031-melhorias.md), segundo recorte)
- **Status:** implementado
- **Arquivos principais:** `world-mesh-buffers.js` (novo), `game.js`,
  `tests/mesh-buffers.test.mjs`

## Antes

Cada chamada de `meshChunk()` alocava **nove arrays tipados novos** para montar a
geometria do chunk:

```js
const initialVertexCapacity = CS * CS * 8;   // 2048 vértices
let positions = new Float32Array(initialVertexCapacity * 3);
// ... normals, uvs, colors, torchInfluence, furnaceFlame
let indices = new Uint32Array(CS * CS * 12);
// ... cutoutIndices, waterIndices
```

Isso dava ~140 KB de arrays por malha, descartados logo depois — lixo para o
coletor a cada chunk remontado. Pior: a geometria recebia
`positions.subarray(0, vertexCount * 3)`, uma **view** do array grande, então cada
chunk mantinha o buffer inteiro vivo enquanto existisse. Com ~150 chunks
carregados, isso é da ordem de 20 MB só de folga não usada.

## Depois

- **`world-mesh-buffers.js`** guarda o rascunho em `world.meshScratch`:

  | Função | Papel |
  | --- | --- |
  | `acquireMeshScratch(scratch, vértices, índices)` | devolve as arrays, criando só o que falta/cresceu |
  | `storeMeshScratch(scratch, arrays)` | devolve as arrays finais (podem ter crescido) e nunca encolhe |
  | `exactMeshBuffer(array, length)` | cópia do tamanho exato para a geometria |
  | `meshVertexBufferLength(key, capacity)` | tamanho por atributo (posição/normal/cor = 3×, uv = 2×, escalares = 1×) |

- `meshChunk()` passou a usar o rascunho: as mesmas arrays voltam para o próximo
  chunk, e `growTypedArray` continua existindo para o caso raro de um chunk
  precisar de mais capacidade — a versão maior fica guardada para as próximas.
- A geometria agora recebe `exactMeshBuffer(...)` (**cópia**), não `subarray()`.
  Dois efeitos: o atributo fica do tamanho que precisa (sem os ~20 MB de folga) e
  a próxima malha não pode sobrescrever a geometria anterior.
- A malha vazia (`vertexCount === 0`) também devolve o rascunho antes de sair.

### Custo por chunk remontado

| | Antes | Agora |
| --- | --- | --- |
| arrays alocados por malha | 9 (~140 KB de lixo) | 0 (reuso) + 6 cópias exatas |
| memória retida por geometria | buffer de 2048 vértices inteiro | só os vértices usados |
| crescimento ao passar de 2048 vértices | novo array a cada malha | uma vez, e fica para as próximas |

## Validação

```bash
npm test        # 181 testes (11 novos em tests/mesh-buffers.test.mjs)
npm run check   # sintaxe 79/79 + importmap em dia
```

Os testes cobrem: tamanho de cada atributo, criação na primeira aquisição, reuso
(mesma instância) na segunda, pedido maior realocando e pedido menor mantendo,
array crescido voltando ao rascunho, rascunho que nunca encolhe, entrada vazia,
capacidade inválida e a garantia de que `exactMeshBuffer` devolve **buffer
próprio** (mexer no rascunho não altera a geometria). Um teste de ligação confere
que o `game.js` usa as três funções e que as alocações antigas sumiram.

## Limitações conhecidas

- **Sem validação visual em navegador** (o sandbox não tem browser: falta
  `libnss3`) e sem medição de quadro. O ganho é estrutural e verificável por
  código: zero alocação de rascunho por malha e atributos com o tamanho exato.
- A malha continua rodando na **thread principal**. Mover para um worker com
  buffers transferíveis é o próximo passo do item 9 (mudança bem maior, envolve
  transferir dados de bloco, luz e decorações).
- As cópias exatas custam uma passada de memcpy por atributo e por malha; é o
  preço para não compartilhar buffer com o rascunho — antes esse custo existia de
  outra forma, no `growTypedArray` e no GC.
