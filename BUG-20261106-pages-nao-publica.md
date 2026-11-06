# BUG: o site no GitHub Pages parou de atualizar

- **Data:** 06/11/2026
- **Status:** corrigido
- **Arquivos principais:** `.github/workflows/pages.yml` (novo), `.nojekyll` (novo)

## Sintoma

PRs mescladas em `main`, CI verde em todas elas, e o jogo em
<https://zedrodacunha.github.io/Voxelcraft/> continuava na mesma versão antiga —
título velho, texturas velhas, nada do que entrou no dia. O endereço respondia
normalmente, então não parecia “site fora do ar”: parecia cache.

## Causa

Não era cache do navegador. Consultando a API do GitHub:

- `GET /repos/ZedroDacunha/Voxelcraft/pages` → `build_type: "workflow"`, ou seja,
  o Pages estava com a fonte **GitHub Actions**;
- o repositório só tinha o `ci.yml` (testes) — **nenhum workflow de deploy**;
- as últimas builds do construtor antigo (`pages/builds`) estavam todas com
  `status: errored`, `error.message: "Page build failed."` (16:31, 16:32 e
  16:33), e a última publicação bem-sucedida foi às 16:36 — antes de boa parte
  do trabalho do dia;
- o último deploy publicado apontava para `0c1529ad` (“Delete CNAME”), commit que
  nem está mais em `main`.

Resumindo: com a fonte em “GitHub Actions” e sem workflow de deploy, **push em
`main` não publica nada**. O CI continuava verde porque ele só roda testes e
`npm run check` — ele nunca publicou o site. E o modo antigo (“Deploy from a
branch”) já vinha falhando por causa do Jekyll.

## Correção

1. `.github/workflows/pages.yml` — o deploy de verdade: `configure-pages` →
   empacota o site → `upload-pages-artifact` → `deploy-pages`, a cada push em
   `main` (e também no botão “Run workflow”).
2. O pacote é montado em `_site/` com o que o navegador pede (página, módulos da
   raiz, `assets/`, `icons/`, `vendor/`) — testes, ferramentas e `.md` ficam fora.
3. `.nojekyll` na raiz — desliga o Jekyll. É o que conserta o modo antigo
   (“Deploy from a branch”), se alguém voltar para ele.

## Validação

- `Actions` → workflow **Pages** → run verde em `main` (etapas *Preparar o site*,
  *Empacotar* e *Publicar*).
- Abrir <https://zedrodacunha.github.io/Voxelcraft/> numa aba anônima: a versão
  nova aparece (o `<title>` e a tela de menu dizem “VOXELCRAFT”).
- Numa aba normal, o jogo pode teimar por causa do **service worker**: recarregar
  com `Ctrl+Shift+R` (ou `Cmd+Shift+R`), ou DevTools → *Application* → *Service
  workers* → **Unregister** + *Clear site data*. Para depurar sem mexer no cache,
  abrir com `?sw=0` (ver README).
- Depois de publicado: cada merge em `main` atualiza o site sozinho.

## Nota sobre o endereço

O repositório passou a se chamar **Voxelcraft**; o Pages mudou de
`/SiteCraft/` para `/Voxelcraft/` (o endereço antigo redireciona). Os caminhos do
jogo, do `manifest.webmanifest` e do service worker são **relativos**, então
funcionam no subdiretório do projeto.
