# MELHORIA: arte autoral das ferramentas (e o guia de arte)

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-tool-textures.js`, `world-textures.js`, `GUIA-DE-ARTE.md`, `tests/tool-art.test.mjs`, `tests/art-style.test.mjs`, `tests/tool-art.mjs`

## O problema

Nos PRs #119 (picareta), #120 (machado) e #121 (pá) a arte das ferramentas foi
**transcrita pixel a pixel** do sprite clássico: 256/256 pixels idênticos em
madeira, pedra, ferro, ouro e diamante. Ficou bonita e fiel — e era cópia de arte
de outra pessoa.

Não é plágio no sentido acadêmico (que é sobre atribuição): é **reprodução de
obra protegida**. As diretrizes de uso do Minecraft dizem para não redistribuir
os assets do jogo e não explorar comercialmente o que não é seu; o EULA chama isso
de "a grande regra". Projeto pessoal, sem dinheiro, tem risco prático pequeno —
mas o dono da obra pode pedir a remoção a qualquer momento, e o risco cresce se
o jogo virar app de loja ou tiver monetização.

Decisão: **redesenhar**. Intensidade **média** — silhueta própria, paleta própria
e detalhes-assinatura, mantendo a leitura de ferramenta na hora.

## As regras (viraram `GUIA-DE-ARTE.md`)

1. **Silhueta própria** — nenhuma ferramenta repete o perfil do clássico; o teste
   exige pelo menos 8 linhas com perfil diferente.
2. **Contorno tingido** (`O`) — a sombra do material, nunca preto puro, e diferente
   em cada um dos seis materiais.
3. **Quatro tons + acento** — `1`…`4` do escuro ao claro e um `5` no máximo 2 px,
   sempre o amarelo-cítrico `#fdf0a8`, em todos os materiais.
4. **Cabo comum** — `a`…`d` iguais nas três: mesma oficina.
5. **Faixa de couro costurada** — `g` couro e `s` costura, na metade de baixo do
   cabo (uma faixa sob o encaixe, outra no punho).

## As três ferramentas

| | forma | px |
| --- | --- | --- |
| Picareta | duas pontas: a barra sobe da ponta esquerda (embaixo) à direita (em cima), punho no meio | **51** |
| Machado | lâmina de topo reto, gume alto e convexo à esquerda, afinando para o olho; barba curta | **64** |
| Pá | concha de topo largo e cantos arredondados, pescoço comprido até a virola | **69** |

Nenhuma célula é cópia: a silhueta, as cores e os detalhes são outros. As
silhuetas do sprite clássico continuam no repositório **apenas como números** (as
contagens por linha, em `tests/tool-art.mjs`), para o teste provar a diferença —
sem guardar a arte de ninguém.

## Como ficou no código

- `world-tool-textures.js` reescrito: as três grades, `CABO_PALETA`,
  `PUNHO_PALETA`, `ACENTO`, uma paleta de material por família e as funções
  `createPickaxeSpritePixels` / `createAxeSpritePixels` / `createShovelSpritePixels`
  (mais `*GradeFor` / `*PaletteFor`). Material fora da arte devolve `null` e o
  `world-textures.js` cai no desenho antigo — nada quebra.
- `world-textures.js`: só mudaram os comentários; os três galhos já chamavam a
  arte da casa.
- Testes: os três arquivos antigos (`pickaxe-`, `axe-` e `shovel-item-texture`)
  saíram — eles travavam a cópia. Entraram `tool-art.test.mjs` (16) e
  `art-style.test.mjs` (8), com um ajudante comum em `tests/tool-art.mjs`.

## Provas

- **1112/1112** testes na suíte (24 novos, 32 antigos de transcrição removidos).
- **Sete mutações, todas derrubam teste:**

| Mutação | Testes que caem |
| --- | --- |
| contorno preto puro no ferro | 1 |
| acento vira branco | 1 |
| cabo um tom mais escuro | 1 |
| costura mais clara | 1 |
| pá sem a faixa de couro | 2 |
| silhueta da pá vira retângulo | 1 |
| (extra) paleta de material trocada | 2 |

- `npm run check`: 182/182 arquivos, importmap em dia.

## Limitações

- A picareta, o machado e a pá antigos (transcritos) **saíram**: não há como
  "manter os dois". Quem já tinha o jogo salvo não perde nada — o item é o mesmo,
  só muda o ícone.
- A arte continua simples de propósito: 16×16, sem animação.

## Próximo passo

A **tesoura**, a última ferramenta, já nasce debaixo do guia — nada de transcrição.

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 58.
