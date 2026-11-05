# MELHORIA: o título do menu

- **Data:** 05/11/2026 (depois da [resolução do jogo](MELHORIA-20261105-resolucao-do-jogo.md))
- **Status:** implementado
- **Arquivos:** `index.html`, `styles.css`, `tests/menu-title.test.mjs` (novo),
  `service-worker.js`, `TESTE-EM-NAVEGADOR.md`

## O que mudou

O título da tela inicial era **texto em fonte do sistema**: `Impact` com
`-webkit-text-stroke`, um `text-shadow` em camadas para fingir profundidade e um
splash amarelo em `cursive`. Dependia da fonte instalada em cada aparelho, o
"3D" era um borrão de sombra e o splash encostava na borda em telas estreitas.

Agora o título é um **desenho**: um SVG inline com as palavras **VOXEL** e
**SANDBOX** montadas em blocos de pedra, com extrusão na diagonal, contorno
escuro e inclinação de −3°, no espírito dos menus clássicos de jogos voxel.

Escolhas do jogador, feitas antes do código (três variantes foram mockadas em
cima do panorama real, com os botões do jogo):

- **duas linhas** — `VOXEL` grande em cima, `SANDBOX` menor embaixo (variante A);
- **com profundidade** — blocos extrudados, não o chapado com contorno (variante B);
- **sem splash** — a frase `um mundo de blocos!` saiu do título.

## 1. Como o desenho é feito

Cada letra é uma matriz de blocos 5×7 desenhada à mão. O gerador transforma a
matriz em `path` SVG fundindo blocos vizinhos na vertical, o que reduz o markup
de ~18 KB para ~6 KB:

```
M0 0h16v64h-16z        bloco de 16×64 (a haste do V)
M112 0h48v16h-48z      a barra do E
```

Cada palavra tem **quatro camadas**, nesta ordem (a ordem é o que faz a borda
sair limpa):

1. `#2f2b22` — a extrusão funda, o mesmo `path` deslocado 8 px (6 px no subtítulo);
2. `#4a4130` — um degrau intermediário a 58 % da profundidade, que dá o relevo;
3. `#241f18` — o contorno, desenhado **antes** da face: a metade interna do
   traço fica coberta pela face e sobra só a borda externa, sem as linhas
   internas que apareceriam se o contorno fosse desenhado por cima;
4. `url(#title-stone)` — a face, preenchida com um `<pattern>` de pedra
   (`#f7f2e0` → `#cec4a3`), que dá o granulado sem imagem nenhuma.

A inclinação é aplicada **uma vez**, no grupo das duas palavras, girando em
torno do centro do desenho — girar cada palavra em torno do próprio canto
deixava as letras em leque.

Nada de `<image>` nem de `href`: o desenho é todo inline, então continua
aparecendo mesmo servido de `file://` ou dentro do preview, e não soma um
arquivo novo ao cache do service worker.

## 2. Tamanho: de 360 px a 4K

O `viewBox` é `0 0 506.7 265.4` (proporção 1,909). A largura do container é

```css
width: min(86vw, 620px, calc(46vh * 1.909));
```

ou seja, **o menor** entre 86 % da tela, 620 px e a largura que cabe em 46 % da
altura. Como o SVG escala junto (`width: 100%; height: auto`), a única coisa que
muda de um aparelho para o outro é o tamanho — a borda nunca serrilha, porque
tudo é vetor.

- **390×844 (celular em pé):** 335 px de largura, 176 px de altura;
- **1366×768 (notebook):** 620 px de largura, 325 px de altura — o teto;
- **3840×2160:** continua em 620 px, alinhado com os botões e o rodapé, que
  também são de tamanho fixo;
- **tela baixa (`max-height: 540px`, celular deitado):** cai para
  `min(70vw, 420px, calc(33vh * 1.909))` para os botões não saírem da tela.

## 3. Acessibilidade

O desenho é decorativo (`aria-hidden="true"`), mas o nome não se perdeu: o
container continua sendo o `#title-screen-logo` e agora tem
`role="img" aria-label="Voxel Sandbox"`. O `<main id="title-screen">` segue
apontando para ele com `aria-labelledby`, então o leitor de tela anuncia
"Voxel Sandbox" ao abrir o menu — o mesmo nome de antes, sem depender do texto
que estava escrito nas letras.

## 4. O que saiu

- `.title-logo-main`, `.title-logo-sub` e `.title-logo-splash` (HTML e CSS);
- a fonte `Impact`/`Haettenschweiler` e o `text-shadow` em camadas;
- o splash `um mundo de blocos!`.

## 5. Testes

`tests/menu-title.test.mjs` (5 testes) trava as decisões acima: SVG inline sem
`<image>`/`href`/URL, `role`+`aria-label` no container com o `<main>` apontando
para ele, duas faces + dois contornos + duas extrusões (uma por palavra), uma
inclinação só, o splash eliminado, e a receita de largura (`min()`) com o
degrau de tela baixa.

## 6. Pendências

- Validar no navegador de verdade (ver `TESTE-EM-NAVEGADOR.md` §20): a
  proporção do desenho foi conferida em mock renderizado, mas o encaixe com os
  botões em telas muito baixas merece um olhar humano.
