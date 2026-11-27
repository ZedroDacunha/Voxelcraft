---
type: bug-report
status: resolvido
component:
  - "[[index.html]]"
  - "[[Cache do navegador]]"
  - "[[Módulos ES]]"
tags:
  - bug-report
  - cache
  - esm
  - importmap
  - deploy
---

# Módulos ES misturando versões depois do deploy

## 📌 Contexto e Sintomas

Só a entrada (`world-menu.js?v=...`) e o `game.js?v=...` tinham versão na URL.
Todos os outros `import './world-*.js'` iam **sem query string**, então depois de
um deploy o navegador podia reusar um módulo antigo do cache junto com um novo.
Esse é exatamente o mecanismo de [[BUG-20261029-textura-grama-cache]]: o HTML
apontava para código novo, mas `world-textures.js` vinha do cache.

Com a mudança de IDs da porta (65-69 → 86-90) esse risco deixaria de ser
cosmético: `game.js` novo conversando com `world-catalog.js` antigo quebraria o
jogo de forma silenciosa.

## 🔍 Causa Raiz

O projeto é servido como arquivos estáticos (sem bundler e sem controle de
`Cache-Control`). Semanas de cache heurístico do navegador valem por caminho de
arquivo, e o caminho era sempre o mesmo. Versionar apenas a entrada não resolve:
o grafo de imports continua com URLs fixas.

## 🛠️ Solução Aplicada (Antes e Depois)

**Antes:** uma versão escrita à mão (`?v=20261031-1`) na tag de entrada e no
`import()` do `game.js`; todo o resto do grafo sem versão.

**Depois:** `tools/stamp-importmap.mjs` gera, a partir do **sha256 do conteúdo**
de cada arquivo, um importmap com uma entrada por módulo:

```json
"./world-catalog.js": "./world-catalog.js?v=b04345583e",
"./game.js": "./game.js?v=3e0fbf8e08",
"three": "./vendor/three/three.module.js?v=76dea8151b"
```

Como o mapa também aceita chaves relativas (`./arquivo.js`), **os módulos não
precisam de `?v=` escrito à mão** — o navegador resolve `import './world-catalog.js'`
para a URL carimbada. O mesmo script carimba o `<script type="module">` de
entrada e os `<link rel="stylesheet">` (que não passam pelo importmap).

- Módulo alterado → hash novo → URL nova → cache ignorado.
- Módulo intacto → mesma URL → continua em cache (o `three.js` de 1,3 MB só é
  rebaixado quando muda).
- Grafo inteiro sempre coerente: é impossível misturar versões.

Fluxo de manutenção:

```bash
node tools/stamp-importmap.mjs          # depois de editar qualquer .js/.css
node tools/stamp-importmap.mjs --check  # falha se o index.html estiver velho
node --test tests/*.test.mjs            # inclui a checagem acima
```

O `?v=` manual saiu do `world-menu.js` e da tag de entrada; se alguém voltar a
escrever `?v=` numa importação, o teste `cache-versioning` reprova.

## 🤖 Regra de Evolução para a IA

> Em projeto estático sem bundler, versione **todo** o grafo de módulos, não só
> a entrada. Prefira hash de conteúdo em um importmap (uma linha por módulo,
> gerada por script) a `?v=` manual espalhado — e deixe um teste que reprova
> quando o mapa fica desatualizado. Sempre que criar ou renomear um `.js`,
> rode `node tools/stamp-importmap.mjs` antes de commitar.
