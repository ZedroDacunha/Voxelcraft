---
type: bug-report
status: resolvido
component:
  - "[[Texturas de grama]]"
  - "[[Cache de assets]]"
tags:
  - bug
  - grama
  - cache
  - geometria
  - assets
---

# O capim continuava desenhando a arte antiga (e saía achatado)

## 📌 Contexto e Sintomas

O capim alto (`TALL_GRASS`) é o único objeto do mundo que não usa o atlas: ele
tem três PNGs próprios em `assets/`. A arte desejada estava lá — e mesmo assim o
jogo mostrava outro capim, mesmo depois de recarregar, mesmo com os arquivos
trocados e commitados.

Analisando o desenho de perto apareceram mais dois defeitos, que ficavam
escondidos atrás do primeiro:

1. o tufo saía **mais largo e baixo** que a arte;
2. de longe o capim **cintilava**, e as folhas finas sumiam enquanto o jogador
   andava.

## 🔍 Causa Raiz

### 1. A versão da imagem era escrita à mão

`game.js` montava a URL como `assets/tall-grass-*.png?v=20261029-5`. Esse
`20261029-5` foi escrito em 29/10 e nunca mais mudou. Enquanto o caminho do
arquivo for o mesmo, a URL é a mesma — e aí **duas camadas de cache** devolvem a
arte velha:

- o cache HTTP do navegador, que não vê motivo para revalidar uma URL que já
  conhece;
- o service worker, que guardava a imagem com uma chave **sem o `?v=`** (era o
  comportamento antigo: "imagem não é código, guarda sem versão"). Ele servia a
  cópia antiga na hora e só tentava atualizar por trás — com a mesma URL velha,
  buscando a mesma cópia velha do cache HTTP.

O `BUG-20261029-textura-grama-cache.md` já tinha trocado a versão à mão uma vez.
O problema é que a regra dependia de alguém lembrar de subir o número a cada PNG
trocado, e nada no projeto verificava isso.

### 2. A placa diagonal era 41% mais larga que o desenho

O tufo são duas placas cruzadas. Cada placa ia de `(-h,-h)` a `(+h,+h)`, com
`h = altura × proporção / 2` — mas a diagonal desse quadrado mede `2h√2`. O UV
`0…1` esticava o sprite ao longo da diagonal inteira: o capim aparecia **1,41×
mais largo** que o PNG, achatado.

### 3. `Nearest` na minificação, sem mipmap

O sprite tem 299–386 px de largura e é desenhado com 20–60 px de altura na tela
— minificação de ~6:1. Com `minFilter = NearestFilter` e
`generateMipmaps = false`, o navegador lê um texel por pixel: folhas finas
desaparecem e o contorno do tufo muda de forma a cada quadro (cintilação).

## 🛠️ Correção

**Versão da imagem virou hash do arquivo** (`tools/stamp-importmap.mjs`):

- o mesmo carimbo que já punha hash nos módulos agora gera `asset-versions.js`
  com o sha256 (10 caracteres) de cada PNG de `assets/`;
- `world-tall-grass.js` monta a URL com `?v=<hash>`;
- o service worker passou a guardar a imagem **com a versão na chave**: arquivo
  trocado → URL nova → chave nova → resposta do servidor. As versões antigas do
  mesmo arquivo saem do cache (uma cópia por imagem) e, sem rede, uma versão
  anterior da imagem ainda serve de rede de segurança — só para `assets/`,
  código velho nunca é servido;
- a instalação do worker busca os arquivos com `cache: 'reload'`, para não
  guardar a cópia velha do cache HTTP;
- `CACHE_VERSION` foi para `v22` (mudou a estratégia de chave).

**Geometria** (`world-tall-grass.js`, novo módulo):

- a meia-largura da diagonal é dividida por `√2` (`reach = halfWidth / √2`), e a
  placa passa a desenhar exatamente `altura × proporção` de largura;
- raiz com `uv.y = 0` e ponta com `uv.y = 1` em todas as placas (o vento de
  `world-wind.js` verga a partir do chão).

**Textura:**

- `magFilter = Nearest` (de perto continua pixel art), `minFilter =
  NearestMipmapLinear` com mipmap (de longe para de cintilar) e anisotropia até
  8;
- `alphaTest` de 0,35 para 0,30: o alfa do mipmap é média, e o corte alto comia
  as folhas finas do fundo do tufo;
- no WebGL 1 (sem textura potência de dois para mipmap) fica o filtro linear,
  porque o three redimensionaria os PNGs NPOT e deformaria o tufo de novo.

## ✅ Validação

- `tests/tall-grass.test.mjs` (9 casos): proporção de cada variante conferida
  contra o PNG de verdade, largura/altura da placa, as duas diagonais
  perpendiculares (não coplanares), `uv.y` da raiz à ponta, contagem de
  índices, variante inválida caindo no médio, filtros e `alphaTest` do material;
- `tests/cache-versioning.test.mjs`: `asset-versions.js` carimbado, hash de cada
  imagem, "trocar um byte do PNG muda a URL" e o `game.js` sem versão à mão;
- `tests/service-worker-runtime.test.mjs`: imagem trocada chega na hora, só uma
  cópia por imagem no cache, fallback offline e código velho nunca servido;
- `tests/pwa.test.mjs`: a lista `IMAGES` do worker bate com os PNGs de
  `world-tall-grass.js`;
- `npm run check` e `npm test` — **774/774**.

## 🤖 Regra de Evolução para a IA

> Asset binário que o jogo pede por URL **não** leva versão escrita à mão: o
> carimbo (`npm run stamp`) gera `asset-versions.js` a partir do hash do
> arquivo, e a versão mora na URL e na chave do cache do service worker. Versionar
> na mão já falhou duas vezes neste projeto.

## ⚠️ Limitações

- os **sons** (`assets/sounds/`) ainda são pedidos sem versão na URL; trocar um
  `.ogg` mantendo o nome continua dependendo do cache. Entra no carimbo quando
  alguém precisar trocar um som;
- o cintilar diminui muito, mas não desaparece em ângulo muito rasante: isso
  pede cartão de profundidade com *alpha to coverage*, que é outro assunto.
