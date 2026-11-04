# MELHORIA: som de água (entrar, sair, mergulhar e braçada)

- **Data:** 04/11/2026 (item 13 da [análise de 31/10](ANALISE-20261031-melhorias.md), sexto recorte — áudio)
- **Status:** implementado
- **Arquivos principais:** `world-water-sounds.js` (novo), `world-audio.js`,
  `game.js`, `assets/sounds/LEIA-ME.md`, `tests/water-sounds.test.mjs` (novo)

## Por que

A água é o único elemento do jogo que **muda a física** do jogador (velocidade
pela metade, gravidade fraca, natação) e era muda: cair num lago, sair dele e
nadar aconteciam no mesmo silêncio de sempre.

## Como

### Só a transição soa

Água corrente em laço cansa em dois minutos e briga com todos os outros sons.
O que informa é a **mudança de estado**, então `waterSoundFor()` devolve um som
só quando o estado do corpo muda:

| Transição | Som | Ganho |
| --- | --- | --- |
| seco → na água | `water-splash` | 0,7 a 1,5 conforme a queda |
| na água → seco | `water-exit` | 1 |
| cabeça fora → dentro | `water-dive` | 1 |

A ordem evita sons empilhados: cair de cabeça num lago profundo toca **um**
splash (não splash + mergulho), e mergulhar depois de já estar nadando toca só
o abafado.

### O splash tem tamanho

`splashGain(fallSpeed)` cresce de 0,7 (entrar andando num lago raso) até 1,5
(queda de 12 m/s ou mais, saturado). A velocidade é `player.vel.y` no quadro da
entrada, antes de a água frear o corpo.

Detalhe que o teste pegou: velocidade inválida (`NaN`) produzia ganho `NaN` —
agora cai para 0,7 em vez de virar um som silencioso e um valor inválido no grafo
de áudio.

### Timbre

| Som | Ruído filtrado | Papel |
| --- | --- | --- |
| splash | 2600→500 Hz, 0,22 s + corpo grave 150→70 Hz | impacto na superfície |
| saída | 1500→800 Hz, 0,16 s | curto, escorrendo |
| mergulho | 700→260 Hz, 0,30 s, ataque 30 ms | abafado, embaixo d'água |
| braçada | 1200→620 Hz, 0,16 s | leve, marca o ritmo de nadar |

### Braçada no mesmo gancho da natação

A braçada toca nos dois pontos em que `swimStrokeLocked` vira `true` (empurrar a
água na superfície e submerso) — a mesma trava que já controlava o impulso, então
som e movimento continuam presos um ao outro, sem cronômetro paralelo.

## Validação

```bash
npm test        # 298 testes (6 novos)
npm run check   # sintaxe 94/94 + importmap em dia
```

- transições: seco → água → seco, sem repetir enquanto o estado não muda;
- cair de cabeça toca só splash; mergulhar depois toca só o abafado; voltar a
  respirar não é "sair da água";
- ganho do splash cresce com a queda, satura em 1,5 e trata `NaN`;
- receitas: banda de água, curtas, sem dominar a mixagem; mergulho mais abafado
  que splash; braçada sem corpo grave;
- `game.js`: a transição vem da física (`updateSubmersion` + `vel.y`) e a braçada
  está nos dois caminhos de natação.

## Limitações conhecidas

- Não há som de água **caindo** (cachoeira) nem de fluxo corrente: seria laço
  contínuo, com custo de mixagem e fadiga auditiva.
- Danificar-se ao bater no fundo d'água continua silencioso (o som de dano é o
  próximo recorte).
- Sem navegador no sandbox: valida-se quando toca e com que intensidade, não o
  timbre final.
