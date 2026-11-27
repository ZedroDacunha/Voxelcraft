# MELHORIA: o ícone do jogo

- **Data:** 05/11/2026 (depois do [título do menu](MELHORIA-20261105-titulo-do-menu.md))
- **Status:** implementado
- **Arquivos:** `tools/grass-block.png` (novo, a arte), `tools/make-icons.mjs`
  (desenho trocado por reamostragem), `icons/` (5 PNGs regerados),
  `service-worker.js`, `README.md`, `TESTE-EM-NAVEGADOR.md`

## O que mudou

O ícone do app era **desenhado em código**: `tools/make-icons.mjs` calculava os
polígonos do bloco, a faixa de grama e o ruído de pixel, e escrevia o PNG. Saía
limpo e coerente, mas era um bloco genérico — sem a textura que o jogo tem.

Agora o ícone é a **arte do bloco de grama** que você mandou (isométrico, pixel
art, com a grama caindo pelas laterais), guardada em `tools/grass-block.png`.

## O que foi feito com a imagem original

Veio em JPEG 2048×2048 com o **xadrez de transparência desenhado nos pixels**
(JPEG não tem canal alfa). O tratamento, feito uma vez e fora do repositório:

1. **flood fill pelas bordas** marcando cinza-claro neutro (`máximo ≥ 170` e
   `máximo − mínimo ≤ 14`) — o preenchimento para no contorno preto do bloco, e
   o critério de neutralidade impede que a grama clara seja comida;
2. **ilhas soltas** (resíduos do xadrez com menos de 4 mil pixels) apagadas;
3. recorte na caixa do bloco, centralização num quadrado e redução para
   **128×128** com média de área — a resolução natural do pixel art, que
   reamostrada para 512 continua com as bordas em degrau de bloco.

O PNG final sai com **filtro 0 em todas as linhas** (33 KB → 25 KB), o mesmo
formato que o projeto escreve, para o decodificador dos testes continuar
valendo.

## O gerador

`renderIcon(size, { background, blockRatio, texture })` deixou de desenhar e
passou a **reamostrar** a arte por média de área:

- a média de área (e não o pixel mais próximo) é o que mantém o bloco legível
  nos ícones pequenos — em 32 px cada pixel do ícone cobre vários da arte;
- quando o ícone é maior que 128, a média cai exatamente sobre um pixel da arte,
  então o pixel art continua **crisp**, sem borrão;
- `background` compõe o céu (com o mesmo degradê de cima para baixo de antes) e
  o `blockRatio` decide quanto do quadro o bloco ocupa;
- `texture: false` reduz tudo a uma **paleta de cinco tons** — é o que salva o
  favicon em 16 px.

O decodificador de PNG passou a viver também no gerador (antes só existia em
`tests/helpers/png.mjs`), com erro explícito se a arte vier com filtro diferente
de 0.

## Os tamanhos

A arte tem conteúdo até **0,544 do lado** (medido pixel a pixel), e os testes
cobram que nada escape do círculo seguro do Android (raio 0,40 do quadro) nem do
canto arredondado do iOS (0,48). Daí os fatores:

| Arquivo | Lado | Fundo | `blockRatio` | Por quê |
| --- | --- | --- | --- | --- |
| `icon-192.png` / `icon-512.png` | 192 / 512 | transparente | 0,92 | janela, dock e lista de apps |
| `icon-maskable-512.png` | 512 | céu | 0,68 | Android recorta em círculo: 0,68 × 0,544 = 0,37 do quadro |
| `apple-touch-icon-180.png` | 180 | céu, opaco | 0,72 | iOS pinta transparência de preto |
| `favicon-32.png` | 32 | transparente, chapado | 0,98 | 5 cores: em 16 px textura vira sujeira |

Os oito testes de `tests/icons.test.mjs` continuam passando sem alteração — o
contrato (círculo seguro, opacidade do iOS, favicon chapado, verde em cima e
terra embaixo) é o mesmo, só a arte mudou.

## Como regerar

```bash
node tools/make-icons.mjs   # regera os 5 PNGs a partir de tools/grass-block.png
npm test                    # inclui os 8 testes de ícone
```

Para trocar a arte no futuro: substitua `tools/grass-block.png` por outro RGBA
8 bits, quadrado, com filtro 0 e fundo transparente, e rode o gerador.

## Pendências

- Conferir no aparelho: Android (launcher em círculo e em quadrado), iPhone
  ("Adicionar à Tela de Início") e a aba do navegador em 16 px.
- `manifest.webmanifest` ainda se chama **Voxel Sandbox** — o nome de instalação
  do app é outro assunto, junto com o `<title>` da aba.
