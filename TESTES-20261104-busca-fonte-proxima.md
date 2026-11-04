# TESTES: busca de fonte próxima na água (`hasNearbySource`)

- **Data:** 04/11/2026 (dívida de testes apontada na [análise de 31/10](ANALISE-20261031-melhorias.md), item 12)
- **Status:** implementado
- **Arquivos:** `tests/water-nearby-source.test.mjs` (novo, 12 testes)

## Por que

`hasNearbySource()` decide se uma célula de água de fluxo **continua existindo ou
evapora**. Se ela erra dizendo "não tem fonte", a água some na frente do jogador;
se erra dizendo "tem fonte", aparece água infinita — o bug de 02/11
([BUG-20261102](BUG-20261102-agua-fonte-infinita.md)) foi exatamente desse time.

A função estava coberta só de lado: os testes de fluxo verificavam se a célula
evaporava ou não, mas ninguém exercitava a busca em si — o limite de passos, o
caminho em curva, a queda vertical.

## A regra que os testes fixam

A busca é um **BFS sobre água**, com um custo incomum:

- só água conta como caminho (`render: 'liquid'`): ar e bloco sólido cortam;
- mover na **horizontal custa 1 passo**; mover na **vertical custa 0**;
- para de expandir ao atingir `maxSteps` (padrão 7), mas o bloco onde parou ainda
  é testado;
- `y < 0` e `y >= WORLD_HEIGHT` nunca são visitados.

O custo vertical zero é o ponto menos óbvio: uma cachoeira de 40 blocos continua
ligada à fonte lá em cima sem gastar nenhum dos 7 passos. É o que faz a água cair
de uma nascente e continuar existindo até o chão.

## Casos cobertos

| Caso | Resultado esperado |
| --- | --- |
| a própria célula é fonte | sim |
| fonte encostada | sim |
| fonte a 7 passos / a 8 passos | sim / **não** (limite exato) |
| caminho em "L" (curva) | sim — não é busca em linha reta |
| buraco de ar no meio da água | não |
| bloco sólido no lugar da água | não |
| cachoeira de 40 blocos até a fonte | sim |
| queda longa **sem** fonte em cima | não |
| fonte em `y = -1` ou `y = WORLD_HEIGHT` | ignorada |
| quadrado de água em ciclo, sem fonte | não (e termina) |
| orçamento de passos menor que a distância | não |
| orçamento 0 | só a própria célula (nem o vizinho de cima é visitado) |

## Custo medido

O último teste monta um lago de 41×41 por 10 de altura, todo de água de fluxo e
**sem fonte**, e conta as leituras de `getBlock`: **2.429 leituras, ~5 ms** para
responder "não". O teto do teste é 5.000 — folgado de propósito, para pegar uma
regressão grosseira (varrer o mundo) sem quebrar por causa de um ajuste fino.

Vale registrar o motivo do número não ser pequeno: como descer não custa passo, o
pior caso é uma coluna — cerca de 15×15 posições na horizontal × a altura do
mundo. `updateFlow()` chama a busca para cada célula de fluxo processada, então
num lago fundo isso acontece até 8 vezes por passada (0,18 s). Funciona (é o
comportamento atual, medido aqui), mas é o tipo de custo que um cache por passada
resolveria — fica anotado como otimização possível, não como bug.

## Validação

```bash
npm test        # 404 testes (12 novos)
npm run check   # sintaxe 110/110 + importmap em dia
```
