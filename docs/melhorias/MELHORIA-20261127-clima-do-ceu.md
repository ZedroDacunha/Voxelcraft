# MELHORIA: Clima do céu — a iluminação acompanha a cor do dia

- **Data:** 27/11/2026 (depois do [Brilho](MELHORIA-20261127-brilho.md))
- **Status:** implementado
- **Arquivos:** `world-sky.js`, `tests/sky-climate.test.mjs` (novo),
  `index.html` (carimbo de importmap)

## Por que

O ciclo dia/noite já existia — sol quente no pôr do sol, lua azulada,
estrelas — mas a **luz que banhava o mundo** era sempre a mesma: a
hemisférica branca e neutra do começo ao fim. Resultado: o pôr do sol
esquenta o sol no céu, mas o chão continua branco-acinzentado, e a noite
fica "cinza claro" em vez de azul-frio. A iluminação e o céu viviam em
climas diferentes.

## Antes

- A luz difusa era `HemisphereLight(0xffffff, 0x444444)`: céu branco e
  chão neutro, **fixed**, independente da hora do dia;
- A névoa e o fundo da cena sempre copiavam a cor do horizonte do céu —
  e debaixo d'água também, ou seja, o nevoeiro submerso ficava com a cor
  do horizonte do céu, que no jogo é clara.

## Depois

A luz difusa leva a **mesma tinta do clima** do céu, em três passos de
curva suave que já existiam (`day` e `twilight`, os mesmos que definem
o gradiente do céu):

- **Meio-dia** → branco neutro e chão `0x444444`, **exatamente os valores
  de sempre** (no `day = 1` e `twilight = 0` a tinta volta ao padrão, então
  o jogo não muda no dia de sempre);
- **Crepúsculo** → tinta quente (`0xffb070` no céu, `0x6a4a35` no chão),
  para o mundo aquecer junto com o pôr do sol;
- **Noite** → azul-frio (`0x2a3d66` no céu, `0x161f33` no chão), e a luz
  já caía para o mínimo da curva existente — agora a noite fica escura
  **e azul**, não cinza.

A intensidade da luz difusa **não mudou**: continua `0.22 + 0.58 * day`,
a mesma curva de antes.

A **luz de ambiente da mão** (primeira pessoa) recebe a mesma tinta do
clima, para o item segurado não ficar branco de sempre no pôr do sol ou na
noite.

**Mergulhado**: a água absorve a luz quente, então a névoa e o fundo da
cena saem do horizonte e viram azul profundo da água (`0x0d2e46`), e a
luz difusa vira azul-ciano. A névoa volta ao horizonte ao emergir.

## Custo

Zero. São três `lerp` de cor por quadro no `update()` do céu — a mesma
função que já corria a cada quadro, sem uniform novo, sem shader novo,
sem passe de render. O shader do chunk, das nuvens e de todo o resto
não mexeu.

## Validação

- `npm test` — **1458 testes, 0 falhas** (4 novos em
  `tests/sky-climate.test.mjs`: o dia neutro de sempre, o crepúsculo
  quente/noite azul-frio, a intensidade inalterada, e o nevoeiro/fundo
  submerso);
- `npm run check` — sintaxe em dia, importmap carimbado (`npm run stamp`);
- No navegador: seção 77 do `TESTE-EM-NAVEGADOR.md` (meio-dia inalterado,
  pôr do sol quente no mundo, noite azul e escura, mergulho azul).

## Limitações conhecidas

- O **panorama do título** recebe a tinta do clima como o mundo todo — e
  como ele já é um pôr do sol enquadrado (`MENU_SUN_TIME ≈ 0`, sol no
  horizonte), ele ganha a tinta **quente do crepúsculo**, combinando com o
  céu que já exibe. Não há opt-out: a tinta é parte da iluminação do
  sistema do céu, e o menu já compartilha esse sistema;
- A tinta é **uniforme no espaço** (não há bounce de cor por região):
  é a iluminação difusa do céu, que, por definição, incide de toda
  parte do céu — o que está no escopo desta melhoria;
- O azul da noite é um **compromisso de arte**: muito escuro e a noite
  fica sem leitura; muito claro e perde a atmosfera. Os valores
  escolhidos (`0x2a3d66`) são o ponto do qual parte o ajuste futuro,
  sem custo de execução para mudar.
