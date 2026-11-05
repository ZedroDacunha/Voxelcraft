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

Agora o título é um **desenho**: um SVG inline com **VOXEL** e **SANDBOX** como
lajes de pedra, com a profundidade extrudada na diagonal e uma inclinação de
−3°, no espírito do logo clássico dos jogos voxel.

Escolhas do jogador, feitas antes do código:

- **duas linhas** — `VOXEL` grande em cima, `SANDBOX` menor embaixo;
- **sem splash** — a frase `um mundo de blocos!` saiu do título;
- depois de ver a primeira versão: **mais fiel ao Minecraft**, que é a versão
  que está aqui (letras mais largas e pesadas, laje escura maciça em vez de uma
  sombra chapada, pedra cinza com trinca e brilho em cima).

## 1. De onde vêm as letras

As formas não são uma tabela de pixels desenhada à mão (a primeira tentativa
era magra e parecia fonte de relógio). Elas saem de um **tipo pesado de verdade**,
rasterizado pequeno e depois reconstruído em blocos:

1. `DejaVu Sans Bold` em 17 px (a palavra de cima) e 14 px (a de baixo);
2. o bitmap de cada letra vira uma matriz de `#`/`.` e é **esticado 1,28×** na
   horizontal — é isso que deixa as letras quase quadradas, como no original,
   em vez do formato estreito da fonte;
3. as letras são montadas com espaçamento zero (elas se tocam, como no logo);
4. as células viram retângulos fundindo as colunas vizinhas na vertical, e os
   retângulos viram um `path` (uma palavra inteira em ~1 KB).

O resultado é uma letra grossa com degraus de bloco nas bordas — a "pedra
lascada" do original — sem depender de nenhuma fonte instalada.

## 2. As camadas da laje

Cada palavra é declarada **uma vez** (`<path id="title-word-0">`) e reaparece
por `<use>` em cada camada, de trás para a frente:

1. `stroke="#12110f"` no deslocamento máximo — o contorno preto da laje inteira;
2. `#aeaca1` no mesmo deslocamento — o **fundo claro**: aquela faixa iluminada
   que aparece embaixo das letras, como a face inferior de uma laje de pedra;
3. `url(#title-slab)` **sete vezes**, do deslocamento maior para o menor — a
   massa escura da profundidade, em passos que se sobrepõem até virar sólido;
4. `stroke="#141310"` sem deslocamento — o contorno fino da face;
5. `url(#title-stone)` — a face de pedra;
6. `url(#title-shade)` — um gradiente vertical de branco (topo) para sombra
   (base), que dá o brilho de cima do logo original.

A ordem importa em dois pontos: o contorno da face vem **antes** do preenchimento
(assim a metade interna do traço é coberta e sobra só a borda externa, sem
linhas entre os blocos) e a massa escura é empilhada **depois** do fundo claro
(senão ela cobriria a faixa iluminada).

A pedra é um `<pattern>` de manchas irregulares (`#e7e4da`, `#cfccc2`, `#c2bfb5`,
`#a8a59d`, `#949189`) com uma trinca fina — nada de imagem, nada de ruído
gerado em tempo de execução.

A inclinação é aplicada **uma vez**, no grupo das duas palavras, girando em
torno do centro do desenho.

## 3. Tamanho: de 360 px a 4K

O `viewBox` é `0 0 766.7 312.9` (proporção 2,4505). A largura do container é

```css
width: min(86vw, 620px, calc(46vh * 2.4505));
```

ou seja, **o menor** entre 86 % da tela, 620 px e a largura que cabe em 46 % da
altura. Como o SVG escala junto (`width: 100%; height: auto`), a única coisa que
muda de um aparelho para o outro é o tamanho — a borda nunca serrilha, porque
tudo é vetor.

- **390×844 (celular em pé):** 335×137 px;
- **1366×768 (notebook):** 620×253 px — o teto;
- **3840×2160:** continua em 620 px, alinhado com os botões e o rodapé, que
  também são de tamanho fixo;
- **tela baixa (`max-height: 540px`, celular deitado):** cai para
  `min(70vw, 420px, calc(33vh * 2.4505))` para os botões não saírem da tela.

## 4. Acessibilidade

O desenho é decorativo (`aria-hidden="true"`), mas o nome não se perdeu: o
container continua sendo o `#title-screen-logo` e tem
`role="img" aria-label="Voxel Sandbox"`. O `<main id="title-screen">` segue
apontando para ele com `aria-labelledby`, então o leitor de tela anuncia
"Voxel Sandbox" ao abrir o menu — o mesmo nome de antes, sem depender do texto
que está desenhado nas letras.

## 5. O que saiu

- `.title-logo-main`, `.title-logo-sub` e `.title-logo-splash` (HTML e CSS);
- a fonte `Impact`/`Haettenschweiler` e o `text-shadow` em camadas;
- o splash `um mundo de blocos!`.

## 6. Testes

`tests/menu-title.test.mjs` (8 testes) trava as decisões acima: SVG inline sem
`<image>`/URL/arquivo externo, `role`+`aria-label` no container com o `<main>`
apontando para ele, as duas palavras com o mesmo número de camadas, face +
véu + contorno de face + contorno de laje + fundo claro (dois de cada), a massa
escura empilhada em 12+ passos, a textura de pedra com 10+ manchas, o gradiente
vertical da face, o splash eliminado e a receita de largura (`min()`) com o
degrau de tela baixa.

## 7. Pendências

- Validar no navegador de verdade (ver `TESTE-EM-NAVEGADOR.md` §20). O desenho
  foi conferido lado a lado com a referência do Minecraft e em mock de 1366×768
  e 390×844, mas o encaixe com os botões em telas muito baixas merece um olhar
  humano.
- Se quiser o logo mais alto/mais largo, é uma constante: `depth` (profundidade
  da laje) e `620px` (teto) no CSS.
