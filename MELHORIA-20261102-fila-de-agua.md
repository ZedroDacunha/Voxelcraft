# MELHORIA: fila do fluxo de água sem `shift()` e com limites explícitos

- **Data:** 02/11/2026 (item 9 da [análise de 31/10](ANALISE-20261031-melhorias.md), terceiro recorte — água)
- **Status:** implementado
- **Arquivos principais:** `world-water.js`, `tests/water-flow-queue.test.mjs`

## Antes

A simulação de fluxo guardava as células pendentes num array e consumia com
`Array.prototype.shift()`:

```js
for (let step = 0; step < 8 && this.flowQueue.length; step++) {
    const cell = this.flowQueue.shift();   // O(fila) por célula
```

Com a fila chegando ao limite de 4096 células, cada `shift()` desloca até 4096
referências — 8 vezes por passada (a cada 0,18 s). Custo evitável e invisível no
comportamento.

Os números da simulação também estavam soltos no meio do código (`0.18`, `8`,
`4096`), o que dificultava testar e ajustar.

## Depois

- A fila é consumida por um **cursor** (`flowHead`):

  | Antes | Agora |
  | --- | --- |
  | `flowQueue.shift()` → O(fila) por célula | `flowQueue[flowHead++]` → O(1) amortizado |
  | `flowQueue.length` = pendentes | `pendingFlow()` = `length - flowHead` |
  | — | `flowQueue` é compactado quando metade já foi consumida (folga ≤ metade da fila) |

- `dequeueFlow()` também remove a célula de `queuedCells`, então a marcação de
  "já está na fila" acompanha a fila sem depender de quem chamou.
- Os limites viraram constantes exportadas, usadas pelo código e pelos testes:
  `WATER_FLOW_INTERVAL` (0,18 s), `WATER_FLOW_CELLS_PER_TICK` (8),
  `WATER_FLOW_QUEUE_LIMIT` (4096) e `WATER_FLOW_QUEUE_COMPACT_MIN` (64).
- O limite da fila passou a contar **células pendentes** (`pendingFlow()`), não o
  tamanho do array — que agora pode guardar também as já consumidas.

Nada muda no que o jogador vê: mesmas regras de nível, queda e evaporação, no
mesmo ritmo.

## Validação

```bash
npm test        # 179 testes (9 novos em tests/water-flow-queue.test.mjs)
npm run check   # sintaxe 78/78 + importmap em dia
```

Os testes novos cobrem: ordem FIFO, deduplicação (e reenfileiramento depois de
consumida), teto de células por passada, intervalo mínimo entre passadas, limite
contando só pendentes, compactação (a folga e o tamanho do array ficam limitados),
água escorrendo de verdade por 120 passadas com uma fonte (a fonte não se
multiplica e a água chega a 3 blocos), evaporação de fluxo isolado e a garantia de
que `shift()` não voltou. Os 5 testes de água que já existiam continuam passando.

## Limitações conhecidas

- **Sem medição de quadro em navegador** (o sandbox não tem browser: falta
  `libnss3`). O ganho é de complexidade: sai um O(fila) por célula da fila.
- O custo dominante da água continua sendo o **BFS de `hasNearbySource()`** (raio
  7 por célula desenfileirada). Cachear o resultado é tentador, mas a passada
  altera o mundo (`setBlock`) entre consultas, e um cache otimista poderia fazer
  água evaporar ou persistir errado. Fica para um recorte próprio, com cache por
  corpo d'água e invalidação explícita.
- As nuvens e a malha em worker seguem abertas no item 9.
