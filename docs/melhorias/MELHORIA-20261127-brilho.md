# MELHORIA: Brilho — gama de 50% a 200% no próprio shader

- **Data:** 27/11/2026 (depois dos [efeitos ligáveis](MELHORIA-20261127-opcoes-de-efeitos.md))
- **Status:** implementado
- **Arquivos:** `world-brightness.js` (novo), `world-game-settings.js`,
  `world-options-view.js`, `index.html`, `game.js`, `world-sky.js`,
  `world-clouds.js`, `world-falling-leaves.js`, `tests/brightness.test.mjs`
  (novo), `tests/game-settings.test.mjs`, `tests/options-categories.test.mjs`,
  `service-worker.js`, `README.md`, `TESTE-EM-NAVEGADOR.md`

## Por que

Caverna sem tocha é para ouvir, não para ver — e o mesmo vale para noite em
celular com brilho de tela baixo. Todo mundo que joga voxel acaba pedindo a
mesma coisa: **um Brilho**. O problema é que "um brilho" mal feito estraga a
imagem: um ganho linear escala tudo junto (o sol estoura antes de a caverna
ficar legível) e um passe de pós-processamento cobra um render inteiro
extra — exatamente o tipo de coisa que este jogo, que corta até o antialias,
não quer.

A saída foi usar o ponto de extensão que o próprio three r160 oferece
(`CustomToneMapping`) e colocar ali uma **gama**: escuros sobem, altas luzes
quase não se mexem, e o custo é um `pow` dentro do fragment shader que já
rodaria. Zero passe extra, zero uniform novo.

## Antes

A tela de opções não tinha nenhuma linha de brilho, e o renderer nascia com
`NoToneMapping` — a cor que sai do shader é a que aparece, do jeito que está.

## Depois

```
Gráficos
[ Gráficos: Automática ]        ← qualidade (como estava)
[ Brilho: 100% ]                ← NOVO: barra de 50% a 200%
[ Resolução: Janela (nativa) ]
[ Campo de visão: 75° ]
…
```

O campo `brightness` (0,5 a 2, passo 0,1, padrão 1) vira expoente de gama:

```
saída = pow(entrada, 1 / brilho)
```

- **100% → expoente 1 → identidade**: o jogo nasce pixel a pixel igual ao de
  sempre (nenhum jogador existente vê mudança sem mexer na barra);
- **200% → raiz quadrada**: 0,02 linear (caverna) vira 0,14 — dá para ver;
  0,9 (céu claro) vira 0,94 — praticamente não muda;
- **50% → quadrado**: escurece de propósito, para atmosfera.

Como o expoente viaja no uniform `toneMappingExposure`, que o renderer **já**
manda a todos os materiais a cada troca de material, trocar o valor ao vivo no
ESC é uma atribuição de JavaScript — sem uniform novo, sem recompilar nada, sem
passe de render.

O que precisa entrar na gama e não entraria sozinho:

- **céu e nuvens** são `ShaderMaterial` próprio: ganharam o
  `#include <tonemapping_fragment>` antes do `colorspace_fragment`, a mesma
  ordem dos materiais do three (gama em espaço linear, depois a conversão de
  cor);
- **chama da tocha e folhas caindo** estavam com opt-out de tone mapping
  (sobra de uma experimentação, sem efeito hoje): o opt-out saiu, porque com
  o Brilho mudando elas tinham de acompanhar — a 100% a gama é identidade,
  então a cor de antes não muda.

## Validação

- `npm test` — **1454 testes, 0 falhas** (7 novos em `tests/brightness.test.mjs`:
  schema e passos do campo, conta do expoente, instalação no chunk do three
  **contra o vendor** — se o three atualizar o texto do stub, o teste cai antes
  do brilho virar ajuste que não faz nada —, a linha no index.html, a ligação
  no `game.js`, a ordem gama→cor no céu e nas nuvens, e a ausência do opt-out);
  `game-settings` (save com os 18 campos) e `options-categories` (lista de
  Gráficos com `brightness`) atualizados de propósito.
- `npm run check` — sintaxe em dia, importmap carimbado (`npm run stamp`).
- No navegador: seção 76 do `TESTE-EM-NAVEGADOR.md` (barra, 150%, 200% na
  caverna, sol intacto, chama e folhas acompanhando, HUD fora).

## Limitações conhecidas

- **O panorama do título não muda**: ele tem renderer próprio, sempre com tone
  mapping desligado — o brilho é uma preferência do mundo, e o menu é arte
  enquadradada (o título tem de ficar legível). Se um dia quiserem, é uma
  linha por lá.
- **HUD e flash de dano não mudam**: são DOM acima do canvas — interface não
  escurece nem clareia junto (é o comportamento desejável, e a seção 76 do
  roteiro confere).
- A gama é **uniforme no tempo todo**: noite a 200% fica visível de propósito
  (é o que pedem quem joga no escuro) — quem quer noite escura baixa para
  100% ou menos. Não há recorte por hora do dia, como não há em outros jogos
  com essa barra.
- Custo: um `pow` por fragmento no shader que já existe — mensurável só em
  microbenchmark; nenhum passe, nenhuma leitura de textura a mais. Foi a
  razão de não usar `filter: brightness()` no CSS (passa a imagem inteira por
  um compositor a mais) nem pós-processamento (um render a mais).
