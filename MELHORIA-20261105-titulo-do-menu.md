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

Agora o título é um **desenho**: um SVG inline com **VOXELCRAFT** — uma palavra
só, numa linha — em letras de pedra sobre uma laje escura extrudada na
diagonal, no estilo do logo clássico dos jogos voxel.

Escolhas do jogador, feitas antes do código:

- **duas linhas** (VOXEL / SANDBOX) na primeira versão, depois **uma linha**;
- **sem splash** — a frase `um mundo de blocos!` saiu do título;
- **VOXELCRAFT** no lugar de VOXEL SANDBOX;
- depois de ver as versões anteriores: **mais fiel ao Minecraft**, que é a versão
  que está aqui (letras mais grossas e lascadas, textura de pedra em blocos,
  laje escura mais funda e sombra clara embaixo).

## 1. De onde vêm as letras

As formas saem de um **tipo pesado de verdade**, rasterizado pequeno e
reconstruído em blocos:

1. `DejaVu Sans Bold` em 26 px — a palavra inteira numa linha;
2. o bitmap vira uma matriz de blocos e é comprimido 0,95× na horizontal, com
   **uma célula de espaço** entre as letras (elas quase se tocam, como no logo);
3. a matriz é **lascada**: 1 % das células de borda somem, o que tira o ar de
   fonte de computador e dá o contorno irregular da pedra;
4. as células viram retângulos fundidos na vertical e os retângulos viram um
   `path` — a palavra inteira em ~7 KB.

## 2. A pedra é um mosaico, não uma textura

Cada célula da face recebe um tom de uma paleta de três (`#dcdad5`, `#cbc9c4`,
`#a3a19c`), sorteado em **blocos de 2×2 células** — daí as manchas grandes, e
não o granulado fino que parecia chuvisco. As células de cada tom viram um
`path` próprio, e os três são desenhados nesta ordem sobre a laje.

Sobre eles vem um **véu vertical**: branco a 30 % no topo, transparente no
meio, sombra a 26 % na base — o brilho de cima do logo original.

## 3. As camadas da laje

A palavra é declarada **uma vez** (`<path id="title-word">`) e reaparece por
`<use>` em cada camada, de trás para a frente:

1. `stroke="#151413"` no deslocamento máximo — o contorno preto da laje inteira;
2. `#bcbab4` no mesmo deslocamento — o **fundo claro**: a faixa iluminada que
   aparece embaixo das letras, como a face inferior de uma laje de pedra;
3. `#333230` **nove vezes**, do deslocamento maior para o menor — a massa escura
   da profundidade, em passos que se sobrepõem até virar sólido;
4. `stroke="#151413"` sem deslocamento — o contorno fino da face;
5. os três tons da pedra;
6. o véu vertical.

A ordem importa em dois pontos: o contorno da face vem **antes** do preenchimento
(as camadas de tom são `<use>` de caminhos já preenchidos, então a metade
interna do traço fica coberta e sobra só a borda externa) e a massa escura é
empilhada **depois** do fundo claro (senão cobriria a faixa iluminada).

A inclinação de −2° é aplicada **uma vez**, no grupo.

## 4. Tamanho: de 360 px a 4K

O `viewBox` é `0 0 1261.5 235.1` (proporção 5,3658). A largura do container é

```css
width: min(90vw, 860px, calc(46vh * 5.3658));
```

ou seja, **o menor** entre 90 % da tela, 860 px e a largura que cabe em 46 % da
altura. Como o SVG escala junto (`width: 100%; height: auto`), a única coisa que
muda de um aparelho para o outro é o tamanho — a borda nunca serrilha, porque
tudo é vetor.

- **390×844 (celular em pé):** 351×65 px;
- **1366×768 (notebook):** 860×160 px — o teto, ocupando 63 % da largura, como
  o logo do Minecraft ocupa a tela dele;
- **3840×2160:** continua em 860 px, alinhado com os botões e o rodapé, que
  também são de tamanho fixo;
- **tela baixa (`max-height: 540px`, celular deitado):** cai para
  `min(76vw, 560px, calc(28vh * 5.3658))` para os botões não saírem da tela.

## 5. Acessibilidade

O desenho é decorativo (`aria-hidden="true"`), mas o nome não se perdeu: o
container continua sendo o `#title-screen-logo` e tem
`role="img" aria-label="Voxelcraft"`. O `<main id="title-screen">` segue
apontando para ele com `aria-labelledby`, então o leitor de tela anuncia
"Voxelcraft" ao abrir o menu.

## 6. O que saiu

- `.title-logo-main`, `.title-logo-sub` e `.title-logo-splash` (HTML e CSS);
- a fonte `Impact`/`Haettenschweiler` e o `text-shadow` em camadas;
- o splash `um mundo de blocos!` e a segunda linha `SANDBOX`.

## 7. Testes

`tests/menu-title.test.mjs` (8 testes) trava as decisões acima: SVG inline sem
`<image>`/URL/arquivo externo, `role`+`aria-label` no container com o `<main>`
apontando para ele, uma única palavra (sem `title-word-1`, sem `SANDBOX`), os
dois contornos, o fundo claro, a massa escura empilhada em 8+ passos, os três
tons de pedra com blocos suficientes, o gradiente vertical, o splash eliminado e
a receita de largura (`min()`) com o degrau de tela baixa.

## 8. Pendências

- **Nome do jogo**: o desenho agora diz `VOXELCRAFT`, mas o rodapé do menu, o
  `<title>` da página e o README ainda dizem "Voxel Sandbox". Trocar tudo é um
  tema à parte, se você quiser.
- Validar no navegador de verdade (ver `TESTE-EM-NAVEGADOR.md` §20).
- Ajustes finos, se precisar: **profundidade da laje** (`depth`), **tamanho das
  letras** (o `size` da fonte e a `cell` no gerador) e o **teto de 860 px** no CSS.
