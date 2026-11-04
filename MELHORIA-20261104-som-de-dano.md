# MELHORIA: som de dano e de morte

- **Data:** 04/11/2026 (item 13 da [análise de 31/10](ANALISE-20261031-melhorias.md), sétimo recorte — áudio)
- **Status:** implementado
- **Arquivos principais:** `world-damage-sounds.js` (novo), `world-audio.js`,
  `game.js`, `assets/sounds/LEIA-ME.md`, `tests/damage-sounds.test.mjs` (novo)

## Por que

Levar dano já tinha resposta visual (flash vermelho, barra de vida, tremor) e
continuava muda. Em um jogo de sobrevivência, é o feedback que informa "algo te
acertou" antes de o jogador conseguir olhar para a barra de vida.

## Como

### Um ponto de chamada para todo dano

`takeDamage()` já é o funil único — queda, fome, afogamento, criatura, `dbg.kill`
— então a decisão do som mora numa função só:

```js
const sound = damageSoundFor({ damage: amount, dead: health <= 0 });
if (sound) audio.play(sound.name, { gainScale: sound.gainScale, rate: stepPitch() });
if (health <= 0) die(source);
```

Dano bloqueado por invulnerabilidade (`invuln > 0`) e dano zero saem **antes**,
sem som: não se ouve nada quando nada aconteceu.

### Dois sons, intensidade variável

| | Ferimento (`hurt`) | Morte (`death`) |
| --- | --- | --- |
| ruído | 900→300 Hz, 0,18 s | 700→180 Hz, 0,6 s |
| gemido (seno) | 220→110 Hz | 180→55 Hz |
| ganho | 0,15 (+ baque 0,14) | 0,18 (+ baque 0,16) |
| intensidade | 0,7 a 1,4 conforme o dano | fixa |

`hurtGain()` cresce com o tamanho do golpe e satura em 1,4 a partir de 6 de
dano — cair de 6 blocos e levar 1 de fome não soam igual. O tom varia 0,9–1,1
(`stepPitch()`), então golpes repetidos não soam mecânicos.

A morte é a **mesma ideia esticada**: o ruído se prolonga e o gemido desce até
55 Hz (quase um "corpo caindo"), com 0,6 s — o único som do jogo autorizado a
passar de meio segundo, porque é um evento final e não uma resposta.

## Validação

```bash
npm test        # 303 testes (5 novos)
npm run check   # sintaxe 96/96 + importmap em dia
```

- dano comum → `hurt`, dano fatal → `death`, sem dano → silêncio (inclusive
  `NaN` e valor negativo);
- ganho cresce com o dano, satura em 1,4 e não vira `NaN` com entrada inválida;
- morte dura mais que o dobro do ferimento, desce mais fundo e ainda é curta;
- no `game.js`: **toda** recusa de `takeDamage` acontece antes do som, e o som
  sai antes de `die()` trocar a tela.

## Limitações conhecidas

- O som não muda com a **causa** do dano (queda, fome e afogamento soam igual) —
  diferenciar seria um recorte próprio.
- Não há som da criatura que ataca (o mob continua mudo; é conteúdo, não áudio).
- Timbre sintético: `assets/sounds/hurt.ogg` e `death.wav` substituem sem tocar
  em código.
