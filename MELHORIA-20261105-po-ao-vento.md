# MELHORIA: o pó do Mofim ao vento

- **Data:** 05/11/2026 (depois do [vento no capim](MELHORIA-20261105-vento-no-capim.md))
- **Status:** implementado
- **Arquivos:** `world-wind.js`, `world-creature-dust.js`, `world-creature.js`,
  `game.js`, `tests/wind.test.mjs`, `tests/creature-dust.test.mjs`,
  `tests/creature.test.mjs`, `service-worker.js`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

O PR anterior fez o **vento existir** (o capim verga com as fases do áudio). Ficou
faltando o que motivou o assunto: o **rastro do Mofim**. Até aqui o pó subia reto
e caía para trás do bicho — um sistema com vida própria, indiferente ao mundo em
volta.

Agora ele é soprado pelo **mesmo** vento: mesma direção, mesma intensidade, mesma
batida de rajada. É isso que fecha a frase combinada — "o pó reagindo ao vento
**do capim**": os dois obedecem à mesma fonte.

## 1. O que o pó recebe do vento

O jogo entrega, por quadro, um pacote simples:

```js
{ x, z, level, time }
```

- `x, z` — a direção do mundo (`windDirectionFor(seed)`, a mesma do capim);
- `level` — a intensidade já com rampa (`windState.level`, a mesma do capim);
- `time` — o relógio do vento (o mesmo que anima o shader do capim).

O sistema de pó **não** sabe o que é uma fase de ambiente, nem de onde vem a
direção: só recebe um empurrão. Isso mantém `world-creature-dust.js` testável sem
áudio, sem cena e sem jogo.

## 2. A rajada é a mesma, por construção

O capim verga por:

```
push = 0,75 + 0,25·sin(tempo·1,15 + fase)
```

Esses três números (`WIND_GUST_BASE`, `WIND_GUST_SWING`, `WIND_GUST_SPEED`) são
**interpolados na string do shader** a partir das constantes do módulo. Não há
como o capim e o pó saírem do compasso: se alguém mexer na rajada, mexe para os
dois. Um teste verifica que o shader gerado contém exatamente esses valores.

Cada partícula nasce com a **sua** fase — o pó não sobe em bloco, ele farfalha.

## 3. A velocidade escala junto com o capim

| | capim | pó |
| --- | --- | --- |
| silêncio / grilos | 25% da amplitude | 25% da velocidade (**0,29 bloco/s**) |
| vento cheio | 100% | 100% (**1,15 bloco/s**) |

É a mesma fração de propósito (`WIND_DUST_IDLE`): o que faz dois movimentos
parecerem **o mesmo vento** não é a direção, é a proporção. Um teste garante que
as duas frações são iguais.

Com a rajada média (0,75), o rastro de 1,5 s de vida deriva cerca de **0,9 bloco**
com vento cheio e gira a favor do vento — o pó deixa de ser "para trás" e passa a
ser "para trás **e para o lado que o capim verga**".

## 4. O detalhe que evita o bug

O vento entra como **deslocamento**, separado do arrasto da partícula:

```js
mesh.position.x += (slot.vx + dirX * push * gust) * dt;
```

Se ele entrasse em `slot.vx`, o arrasto (`e^-1,8t`) frearia o vento — o pó
levantado pelo bicho pararia no ar enquanto a poeira "andando sozinha" pareceria
bug. Um teste garante que duas metades de vida, com o mesmo vento, andam o mesmo
tanto.

## 5. O que continua igual

- **Sem vento** (sistema sem provedor, ou `level` 0 sem direção) o pó sobe reto,
  como antes;
- a nuvem do **pouso** também é levada — é o mesmo sistema;
- o pó continua sem colidir com blocos: ele é fumaça, não areia. Atravessa a
  parede e desbota em 1,5 s (os fragmentos de bloco também não colidem);
- nada de partícula nova, material novo ou luz nova: **zero custo** além de duas
  multiplicações por partícula viva.

## Testes

**633 → 645.**

- `tests/wind.test.mjs` (+5): a rajada nunca sopra ao contrário (fica em 0,5–1,0),
  fases diferentes desencontram vizinhos, o pó acelera na mesma proporção do
  capim, o shader usa as constantes da rajada, e o **mesmo vento chega ao pó**
  (lendo `world-creature.js`, `world-creature-dust.js` e `game.js`);
- `tests/creature-dust.test.mjs` (+5): sem vento o pó só sobe; com vento ele vai
  para onde o vento sopra (nos dois eixos); vento calado empurra menos da metade;
  o arrasto não freia o vento; e a rajada muda o empurrão no tempo;
- `tests/creature.test.mjs` (+2): o vento do mundo chega ao pó do bicho (o
  provedor é consultado e o rastro inteiro anda a favor do vento); sem vento ele
  fica onde foi solto.

Para o teste conseguir olhar o rastro, o sistema ganhou `livePositions()` —
leitura pura das partículas vivas, útil também para depurar no console.

## Como conferir no jogo

Item **11** novo em `TESTE-EM-NAVEGADOR.md`. O teste de ouro: **olhar o capim e o
rastro ao mesmo tempo** numa fase de vento — os dois têm de ir para o mesmo lado e
acelerar na mesma hora.
