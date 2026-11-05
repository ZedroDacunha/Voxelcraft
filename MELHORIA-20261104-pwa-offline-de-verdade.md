# MELHORIA: PWA leva 2 — offline de verdade (o jogo inteiro, não só o menu)

- **Data:** 04/11/2026 (segunda leva do PWA; a primeira foi [instalar + abrir offline](MELHORIA-20261104-pwa.md))
- **Status:** implementado
- **Arquivos:** `service-worker.js` (reescrito), `world-pwa.js` (a lista saiu de lá),
  `tests/pwa.test.mjs`, `tests/service-worker-runtime.test.mjs`, `README.md`

## O problema

A primeira leva prometia "abrir e chegar ao **menu** sem rede" — e cumpria só
isso. A casca guardada na instalação tinha 15 arquivos, e os módulos do jogo
entravam no cache **no primeiro uso**: quem abrisse o jogo offline depois de só
ter visto o menu batia num 504 em `game.js`.

Tinha um segundo furo, mais silencioso: a casca guardava `./styles.css` e
`./vendor/three/three.module.js` **sem** a versão, mas o navegador pede
`styles.css?v=<hash>`. `cache.match` compara a URL inteira — então essas
entradas nunca eram encontradas. O cache da casca era, na prática, só o
`index.html`.

## A virada: a lista sai do próprio `index.html`

O `index.html` já sabe tudo o que a página vai pedir:

- o **importmap** lista **todos** os módulos locais e os dois arquivos de
  `vendor/three`, cada um com o `?v=<sha256>` do conteúdo (é o que o stamp faz);
- os `src`/`href` do HTML listam o script de entrada, os dois CSS, o manifest e
  os ícones.

Na instalação o worker busca a página e lê essas duas coisas. **Não existe segunda
lista para envelhecer em silêncio** — que era exatamente o defeito anterior (o
teste que comparava as duas listas existia porque elas divergiam).

Resultado: ~2 MB (o `three` vendorizado é 1,2 MB disso) entram no cache na
instalação, e **o jogo inteiro abre sem rede depois da primeira visita** — menu,
mundo, texturas, céu, áudio.

Se a página não puder ser lida (rede caindo no meio da instalação), fica uma
casca mínima escrita no worker e o resto se completa no primeiro uso online.

## As outras duas mudanças

**1. Imagem não é código.** O jogo pedia as texturas de capim com uma versão
escrita à mão (`?v=20261029-5`, em `game.js`), que o worker não tinha como
adivinhar; a chave do cache para `assets/` ignorava o `?v=` e a atualização em
segundo plano trocava o arquivo se ele mudasse. Módulo e CSS sempre ficaram com
a URL inteira na chave — neles o hash é justamente o que impede servir código de
outra versão.

> ⚠️ **Isto mudou em 05/11.** Ignorar o `?v=` na chave da imagem foi o que
> deixou o capim com a arte antiga: a versão à mão não subia junto com o PNG e a
> cópia velha era servida para sempre. Hoje a versão da imagem é o hash do
> próprio arquivo (carimbado em `asset-versions.js`) e ela **entra** na chave.
> Ver `BUG-20261105-textura-da-grama.md`.

**2. Faxina na ativação.** Antes, ao sair uma versão, as entradas velhas de
módulo ficavam no cache para sempre. Agora a ativação compara o cache com a
lista de hoje (lida da página guardada) e apaga módulo de versão que ninguém mais
pede. O que não é arquivo do jogo — som, imagem, qualquer coisa de `assets/` —
fica.

`CACHE_VERSION` subiu para **`v2`**: mudou a casca e a estratégia, então a
ativação apaga o cache antigo inteiro.

## Testes

- `tests/service-worker-runtime.test.mjs` roda o worker de verdade (VM com
  dublês de `caches`/`fetch`) e agora entrega **o `index.html` real** para ele:
  - instalação guarda **todo módulo do importmap**, o CSS com a versão que a
    página pede, o manifest, os ícones e as imagens;
  - sem a página, instalação não trava: entra o mínimo;
  - um 404 não impede a instalação (agora com a URL versionada);
  - imagem pedida com `?v=` é servida **do cache** com a rede desligada;
  - na ativação, módulo de versão antiga sai e o que não é arquivo do jogo fica;
  - os casos de antes (documento, 504, o que não é do jogo) seguem cobertos.
- `tests/pwa.test.mjs`:
  - o worker lê o importmap e os `src`/`href` da página, guarda a resposta que
    já baixou e não derruba a instalação se a página vier ilegível;
  - a lista de imagens do worker **bate com os `./assets/*.png` do `game.js`**
    (duas verdades divergindo em silêncio é o que o teste impede);
  - a faxina só mexe em URL versionada que é arquivo do jogo.

## Validação

```bash
npm test        # 533 testes
npm run check   # sintaxe 114/114 + importmap em dia
```

**Conferir no aparelho** (o sandbox não tem navegador): abrir o jogo, jogar
alguns segundos, fechar a aba, entrar em modo avião e abrir de novo — o mundo
carrega e dá para jogar. Depois de um deploy novo, a segunda abertura já traz a
versão nova.

## O que sobrou do PWA

- **Revisão dos ícones** (o maskable, o favicon e o desenho);
- ~~Doc de teste em navegador real~~ — feito em
  [TESTE-EM-NAVEGADOR.md](TESTE-EM-NAVEGADOR.md).
