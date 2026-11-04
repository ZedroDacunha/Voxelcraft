# SiteCraft

Sandbox voxel no navegador, no estilo Minecraft, escrito em JavaScript puro —
**sem etapa de build, sem bundler e sem dependências de runtime**. A cópia do
three.js vive em `vendor/three/`, o jogo é servido como está e a lógica de jogo
está dividida em módulos pequenos, a maioria testável sem DOM.

## Requisitos

- **Navegador** com WebGL2, ES modules + import map e IndexedDB (Chrome, Edge ou
  Firefox recentes).
- **Node 20.11+** apenas para rodar os testes e as ferramentas. O jogo em si não
  usa Node.

## Rodando

```bash
npm start          # http://localhost:8000
```

`npm start` sobe `tools/serve.mjs`, um servidor estático sem dependências
(porta alternativa: `npm start 8080`). Qualquer servidor HTTP serve, por exemplo:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

> Abrir `index.html` por `file://` **não** funciona: `type="module"`, o import
> map e o Web Worker do terreno exigem HTTP.

## Testes e validação

```bash
npm test           # 303 testes de módulos puros (node --test)
npm run check      # sintaxe de todos os módulos + importmap em dia
npm run stamp      # regrava os hashes de cache no index.html
```

O `check` é o que o CI (`.github/workflows/ci.yml`) roda em todo PR para `main`.

## Como o jogo está organizado

| Área | Arquivos |
| --- | --- |
| Entrada | `world-menu.js` (menu, seleção/criação de mundo, opções) |
| Loop e estado do jogo | `game.js` (mundo, física, HUD, interação, save) |
| Catálogo de blocos e receitas | `world-catalog.js`, `inventory-recipe-book.js` |
| Geração de terreno | `world-terrain.js`, `world-terrain-worker.js`, `world-ore-generation.js`, `world-math.js` |
| Malha e render | `world-grid.js`, `world-instanced-manager.js`, `world-mesh-buffers.js`, `world-textures.js`, `world-sky.js`, `world-clouds.js`, `world-water.js` |
| Sobrevivência e regras | `world-survival-rules.js`, `world-interaction-rules.js`, `world-tool-rules.js`, `world-door.js`, `world-furnace-rules.js` |
| Save e armazenamento | `world-save-*.js`, `world-storage.js`, `world-list-store.js` |
| Inventário | `inventory-*.js`, `inventory.css` |
| Áudio | `world-audio.js` (síntese em WebAudio; arquivos opcionais em `assets/sounds/`) |
| Passos e sons de bloco | `world-block-materials.js` (família por bloco), `world-step-sounds.js` (cadência por distância) |
| Mão em primeira pessoa | `world-hand-animation.js` (laço de mineração + golpe) |
| Ferramentas | `tools/serve.mjs`, `tools/check.mjs`, `tools/stamp-importmap.mjs` |
| Testes | `tests/*.test.mjs` |

Os mundos ficam no IndexedDB do navegador (banco `voxel-sandbox`), com backup,
recuperação e importação/exportação de save.

## Flags de URL

| Flag | Efeito |
| --- | --- |
| `?debug` | expõe `window.dbg` (dar itens, mudar fome, testar portas, ler blocos) e o painel F3 |
| `?gpu=default` | força a preferência de GPU para `default` em vez de `high-performance` |
| `?pr=1` | limita o `devicePixelRatio` usado no render |
| `?reset` | apaga o save do mundo atual **uma vez** (o parâmetro é consumido e removido da URL) |

## Acessibilidade

A interface é operável sem mouse:

- **Inventário**: `Tab` entra na grade, setas/`Home`/`End` navegam, `Enter` =
  clique esquerdo, `Espaço` = clique direito, `Shift` + esses dois = movimento
  rápido. Cada slot tem `aria-label` com item, quantidade e durabilidade.
- **Barras de status**: vida, fome e fôlego expõem o valor em texto
  (`"Fome: 6 de 20 (fome baixa)"`) e os avisos do jogo são anunciados.
- **Tela de morte**: aparece com foco e leva o foco ao botão `Renascer` quando
  ele fica disponível.
- `prefers-reduced-motion` desliga as animações de HUD.

Detalhes em [`MELHORIA-20261102-acessibilidade.md`](MELHORIA-20261102-acessibilidade.md).

## Som

Não há arquivos de som no repositório: cada efeito é **sintetizado** em WebAudio
(`world-audio.js`) e o áudio só é criado no primeiro clique/tecla, como os
navegadores exigem. O volume fica nas opções (0% = mudo) e vale na hora.

Os **passos** vêm do bloco sob os pés (grama, terra, pedra, madeira, areia) e a
cadência é por distância andada — andar devagar espaça os passos, correr
aumenta a frequência; no ar e na água não há passo. **Quebrar** e **colocar**
bloco usam a mesma família de material (ruído + baque grave), com tom variando a
cada golpe. Durante a mineração, a **batida** de cada golpe sai no ritmo do braço
(a fase da animação dita o som, não um cronômetro). A **porta** tem som próprio
para abrir (rangido de dobradiça) e fechar (batida no batente), e a **água** só
soa na transição — splash ao entrar (mais forte quanto maior a queda), saída,
mergulho abafado e braçada — sem laço contínuo. **Dano** tem gemido grave que
cresce com o tamanho do golpe, e a morte tem som próprio.

Para usar um som gravado, copie o arquivo com o nome do efeito para
`assets/sounds/` — o carregador prefere `ui-click.ogg`/`.wav` (e assim por
diante) e cai na síntese quando o arquivo não existe. Lista completa em
[`assets/sounds/LEIA-ME.md`](assets/sounds/LEIA-ME.md).

## Import map e cache

O `index.html` aponta cada módulo com um sufixo `?v=<sha256>`, gerado por
`tools/stamp-importmap.mjs` a partir do conteúdo do arquivo. Isso evita a
mistura clássica de módulo novo com módulo velho em cache depois de um deploy.

**Ao editar qualquer `.js` ou `.css` referenciado pelo `index.html`, rode:**

```bash
npm run stamp
```

Se esquecer, o teste `cache-versioning` e o `npm run check` reprovam.

## Convenções do projeto

- **Um tema por PR**: correções e melhorias entram separadas, cada uma com seu
  teste e sua documentação.
- Regra de jogo em **módulo puro** (sem DOM, sem three.js) sempre que possível —
  é o que permite testar com `node --test`.
- Bug corrigido ganha um `BUG-AAAAMMDD-*.md` com sintoma, causa, correção e
  validação.
- Análises e revisões ficam em `ANALISE-*.md` e `REVISAO-*.md`; melhoria de
  interface/polimento ganha um `MELHORIA-AAAAMMDD-*.md` com antes, depois,
  validação e limitações; cobertura de teste nova ganha um
  `TESTES-AAAAMMDD-*.md` dizendo o que passou a ser verificado.
