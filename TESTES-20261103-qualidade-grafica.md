# TESTES: qualidade gráfica automática

- **Data:** 03/11/2026 (item 12 da [análise de 31/10](ANALISE-20261031-melhorias.md))
- **Status:** implementado (último recorte do item 12)
- **Arquivos:** `tests/graphics-quality.test.mjs` (novo)

## Por que

A escala de render automática é a rede de segurança de desempenho: quando o FPS
cai, o jogo reduz a resolução interna para continuar jogável, e quando sobra
folga ele volta a subir. É um laço com histerese (duas leituras para descer,
oito para subir), um critério de "é GPU ou CPU?" e uma saída de emergência para
não brigar para sempre com uma máquina limitada por CPU. Nada disso tinha teste:
uma mudança de limiar podia deixar o jogo borrado para sempre ou travado em
`0.5` sem ninguém perceber.

## O que passou a ser verificado

| Cenário | Garantia |
| --- | --- |
| estado inicial | `auto = true`, escala na máxima, nada pendente para o renderer |
| `max` abaixo de `min` | a escala inicial é elevada ao mínimo, nunca abaixo dele |
| FPS baixo e CPU ociosa (limitado pela GPU) | a escala cai 0,15 a cada **duas** leituras |
| FPS baixo e CPU ocupada | a resolução **não** muda (baixar não adianta) |
| FPS alto | sobe 0,1 só depois de **oito** leituras boas |
| FPS na faixa neutra (55–58) | as duas contagens são zeradas |
| aba escondida / modo manual / leitura `NaN` | `adapt` não faz nada |
| FPS não melhora após baixar a resolução | depois de três tentativas o automático **se desliga** e avisa "FPS não melhorou" |
| `cycle()` (F4) | percorre `auto → max → 100% → 75% → 50% → auto`, aplicando o mínimo e avisando na HUD |
| `consumePending()` | devolve a nova escala **uma vez** e depois `null` |
| integração | `game.js` aplica `consumePending()`, chama `gfx.adapt(perf.fps, perf.avg, document.hidden)`, usa `renderer.setPixelRatio(gfx.scale)` e liga o F4 em `gfx.cycle()` |

## Como

O módulo é puro e recebe `notify` por parâmetro, então o teste injeta um coletor
de avisos e dirige o laço chamando `adapt(fps, cpuMs, escondida)` — sem
`requestAnimationFrame`, sem renderer, sem `performance.now()`. As duas
constantes do teste traduzem o critério do módulo:

- `GPU_BOUND = { fps: 30, cpu: 5 }` → `cpu < 0,6 * 1000 / fps`, descer ajuda;
- `CPU_BOUND = { fps: 30, cpu: 60 }` → CPU é o gargalo, descer não ajuda.

O teste de subida desce a escala em passos com FPS **melhorando** (30 → 34 → 38)
de propósito: com FPS constante o módulo desliga o automático pelo critério de
"sem ganho", que é justamente o que outro teste verifica.

## Validação

```bash
npm test        # 234 testes (12 novos neste recorte)
npm run check   # sintaxe 83/83 + importmap em dia
```

## Limitações conhecidas

- A escala real que chega ao `renderer.setPixelRatio` só pode ser conferida em
  navegador de verdade (o sandbox não tem Chromium); aqui se valida a **decisão**
  do adaptador, não o ganho de FPS.
- O item 12 fica coberto nos módulos puros; continuam fora do alcance dos testes
  os fluxos que dependem de DOM real (pointer lock concedido pelo navegador,
  eventos de duas abas ao mesmo tempo).
