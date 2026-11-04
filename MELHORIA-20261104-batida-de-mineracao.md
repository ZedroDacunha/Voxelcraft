# MELHORIA: batida de cada golpe ao minerar

- **Data:** 04/11/2026 (item 13 da [análise de 31/10](ANALISE-20261031-melhorias.md), quarto recorte — áudio)
- **Status:** implementado
- **Arquivos principais:** `world-hand-animation.js`, `world-audio.js`,
  `game.js`, `assets/sounds/LEIA-ME.md`, `tests/mining-animation.test.mjs`,
  `tests/block-sounds.test.mjs`

## Por que

Quebrar bloco já soava (#29), mas só **no instante em que o bloco caía**. Um
bloco de pedra leva ~2 segundos: durante todo esse tempo o braço batia sem som
nenhum — o jogador via o movimento e não ouvia o esforço. Era a lacuna mais
audível que sobrou no gesto principal do jogo.

## Como

### O som segue a animação, não um cronômetro

O laço de mineração já tem uma fase que avança em radianos
(`handAnim.phase`), e o braço chega ao fim de cada golpe em **π/2 + kπ**.
`countStrikes(from, to)` conta quantas dessas passagens aconteceram no quadro:

```js
advanceHandAnimation(handAnim, dt, { mining: miningNow });
playMiningHits(countStrikes(phaseBefore, handAnim.phase));
```

Assim o som **não pode dessincronizar** do braço: mudar a velocidade do laço
muda a batida junto. Se fosse um `setInterval` paralelo, qualquer ajuste na
animação deixaria os dois brigando.

O contador também segura dois abusos: quadro engasgado não vira rajada (máximo
2 batidas) e fase que não avança (ou volta) não soa.

### Percussão, não impacto

`hit-<material>` reaproveita as cinco famílias de `world-block-materials.js`,
mas com papel diferente do quebrar:

| | Batida | Quebra |
| --- | --- | --- |
| duração | 0,04–0,06 s | 0,11–0,18 s |
| ganho | 0,07–0,085 | 0,14–0,18 |
| baque grave | quase nenhum (só pedra/madeira, 0,025–0,03) | protagonista (0,07–0,13) |

O grave fica reservado ao impacto final: se cada batida tivesse baque, o
"tom" da quebra perderia o peso. A batida é ruído curto com corte mais alto que
o do passo — a percussão que segura o ritmo, não o evento.

### Exceção: grama alta

Ela cai no primeiro quadro, então a batida só atrapalharia o som de quebra (que
já toca a cada 0,2 s). `playMiningHits()` sai antes de tocar.

## Validação

```bash
npm test        # 289 testes (2 de fase/batida + 2 de receita e ligação)
npm run check   # sintaxe 91/91 + importmap em dia
```

Destaques:

- picos em π/2 + kπ: primeiro golpe no primeiro pico, nada entre picos, máximo 2
  por quadro, `NaN` e fase parada não soam;
- simulação de 1 s de mineração a 60 fps: 2–3 batidas, coerente com 9 rad/s ÷ π
  (≈ 2,86/s) — o teste falha se alguém acelerar a animação e esquecer o som;
- toda batida é mais curta e mais discreta que a quebra do mesmo material, e o
  baque da batida é mínimo.

## Limitações conhecidas

- A batida sai sempre, mesmo no último golpe antes do bloco cair: em blocos
  muito rápidos (tocha, folhas) ela pode encostar no som de quebra. Ainda não
  incomoda porque as durações são curtas.
- Timbre sintético: `assets/sounds/hit-stone.ogg` (ou `.wav`) substitui sem tocar
  em código.
- Sem navegador no sandbox: valida-se a cadência e a escolha do som, não o
  timbre final.
