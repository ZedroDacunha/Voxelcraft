# MELHORIA: passos por material, com cadência por distância

- **Data:** 04/11/2026 (item 13 da [análise de 31/10](ANALISE-20261031-melhorias.md), segundo recorte — áudio)
- **Status:** implementado
- **Arquivos principais:** `world-step-sounds.js` (novo), `world-audio.js`,
  `game.js`, `assets/sounds/LEIA-ME.md`, `tests/step-sounds.test.mjs` (novo)

## Por que

Depois do som de interface (#26), o jogo ainda era mudo enquanto se anda — e
andar é a ação mais frequente de todas. É o som que mais muda a sensação de
"estar dentro" do mundo, porque dá peso ao chão e ritmo ao corpo.

## Como

### Cada material tem seu timbre

Cinco famílias, todas sintetizadas como **ruído filtrado** (não tom):

| Material | Blocos | Timbre |
| --- | --- | --- |
| grama | grama, grama alta, folhas | abafado e curto (1900→800 Hz, 90 ms) |
| terra | terra | grave e seco (1150→520 Hz, 100 ms) |
| pedra | pedra, pedregulho, minérios, forno | brilhante e curto (3200→1500 Hz, 70 ms) |
| madeira | madeira, tábuas, baixada, baú, portas | oco, com ressonância (Q 2.4) |
| areia | areia | ruído puro, mais longo (120 ms) |

O filtro desce durante o passo (o "tapa" do pé), e o envelope começa e termina
no silêncio para não estalar.

### A cadência é por distância, não por tempo

`advanceStepTracker()` acumula os metros andados e devolve um passo a cada
**1,7 m**:

- andar devagar espaça os passos, correr dá mais passos por segundo (mesma
  passada, mais metros) — o som acompanha o corpo em vez de brigar com ele;
- um quadro engasgado não vira rajada: no máximo **dois** passos por quadro, e o
  excedente é descartado para o som não sair atrasado depois de um congelamento.

### O que *não* é passo

- **No ar** (pulando, caindo) e **na água** (tem som próprio de natação).
- **Empurrando uma parede**: a distância vem do **deslocamento real** da posição,
  não da velocidade. A velocidade continua alta contra uma parede, então medir
  velocidade daria passos falsos e a mão/câmera balançando paradas.
- **Teleporte** (respawn, carregamento): deslocamentos acima de 2 m no quadro são
  descartados.

### Detalhes de mixagem

- Ganho base ~0,09 (contra 0,22 do clique): passos são fundo, não protagonista.
- `stepPitch()` varia o tom entre 0,9 e 1,1 a cada passo — sem isso a repetição
  soa mecânica. A variação mexe no `playbackRate` do ruído **e** no corte do
  filtro, então timbre e altura mudam juntos.
- Correndo o passo fica um pouco mais alto (1,15×); agachado, mais baixo (0,6×).
- Um único buffer de ruído por contexto é reaproveitado por todos os passos.

### Um único AudioContext

`getSharedAudio()` passou a ser o dono do sistema: o menu cria (com o volume
salvo nas opções) e o `game.js` reaproveita. Antes cada módulo que precisasse de
som abriria o próprio contexto.

## Validação

```bash
npm test        # 279 testes (11 novos de passo + 3 de síntese por ruído)
npm run check   # sintaxe 89/89 + importmap em dia
```

Destaques dos testes:

- **todo bloco não líquido do catálogo tem som de passo** — bloco novo esquecido
  aparece como falha de teste em vez de silêncio no jogo;
- cadência: meio passo não soa, o resto acumula entre quadros, correr dá mais
  passos que andar sem exagerar na proporção, quadro longo não vira rajada;
- guardas: no ar, na água, parado, abaixo da velocidade mínima, teleporte e
  empurrão de parede não produzem passo;
- síntese: ruído criado uma vez e reaproveitado, passa-baixa com corte que desce,
  `rate` muda tom e filtro sem criar buffer novo.

## Limitações conhecidas

- O timbre é sintético: dá para substituir qualquer passo por gravação própria em
  `assets/sounds/step-<material>.ogg` (ou `.wav`), sem tocar em código.
- Não há som de passo em escada/bloco meio (o jogo não tem esses blocos) nem
  variação por velocidade além da cadência.
- Sem navegador no sandbox: a validação cobre a decisão de tocar o quê e quando,
  não o timbre final.
