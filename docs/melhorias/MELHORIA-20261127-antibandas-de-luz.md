# MELHORIA: Anti-bandas da luz de bloco

- **Data:** 27/11/2026 (depois do [clima do céu](MELHORIA-20261127-clima-do-ceu.md))
- **Status:** implementado
- **Arquivos:** `world-lighting-effects.js`, `tests/light-dither.test.mjs` (novo),
  `index.html` (carimbo de importmap)

## Por que

A luz de tocha (e de qualquer fonte) é propagada no mundo em **16 níveis**
inteiros: um bloco recebe luz de nível 5, o vizinho de 4, e a transição
entre os níveis é um **degrau visível** na face do bloco — especialmente
em penumbra, onde a gradiente da tocha deveria ser contínuo. O smooth
lighting suaviza os cantos das células, mas não apaga o degrau da
quantização de 16 níveis.

## Antes

A propagação e a cota são as mesmas de sempre (16 níveis inteiros). O
degrau entre níveis aparecia como bandas lisas nas faces — de longe,
quando a tocha está acesa, o gradiente de luz "escada".

## Depois

O patch do shader do chunk (o mesmo que já injeta o **tremor da tocha** e
o **pulo da fornalha**, em `configureTorchFlicker`) adiciona um **dither
de posição** ao final do fragmento:

```glsl
float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
diffuseColor.rgb += (dither - 0.5) * 0.06;
```

- O ruído é um **hash per-pixel da posição da tela** (não da geometria),
  então a banda entre dois níveis de luz recebe um ruído que varia por
  pixel — o degrau vira uma transição contínua;
- A **amplitude (0,06) é metade do salto de um nível** de luz (um
  nível é 1/16 = 0,0625): o suficiente para mascarar o degrau sem
  inventar ruído visível em áreas de luz constante;
- É **aditivo ao final** do fragmento, depois do tremor da tocha e do
  pulo da fornalha — não altera o Brilho, a chama, nem o flicker;
- A chave de cache do shader (`customProgramCacheKey`) foi aumentada
  (v4), para o shader antigo não continuar valendo.

## Custo

Uma linha extra no fragment shader do chunk, que já existe — um `sin`,
um `dot` e um `fract` por fragmento, sem passe de render, sem texture
nova, sem uniform novo. O shader é compilado uma vez por material.

## Validação

- `npm test` — **1461 testes, 0 falhas** (3 novos em
  `tests/light-dither.test.mjs`: o dither existe no shader e é um hash
  de posição com a amplitude correta; ele vem **depois** do flicker e
  da chama, sem substituir nada; e a chave de cache cresceu);
- `npm run check` — sintaxe em dia, importmap carimbado;
- No navegador: seção 78 do `TESTE-EM-NAVEGADOR.md` (gradiente da tocha
  sem degrau visível).

## Limitações conhecidas

- O dither **não aumenta a precisão da luz** — ele só mascara o
  degrau. A propagação continua em 16 níveis inteiros (como sempre);
- Em dispositivos muito lentos, o custo extra é por fragmento, no
  mesmo shader do flicker — mensurável apenas em perfil de desempenho;
  o jogo não oferece opt-out (o custo é pequeno e o benefício é de
  qualidade de imagem, não de jogabilidade).
