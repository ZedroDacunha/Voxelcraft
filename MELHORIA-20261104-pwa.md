# MELHORIA: PWA instalável e offline

- **Data:** 04/11/2026 (item "PWA" da [análise de 31/10](ANALISE-20261031-melhorias.md))
- **Status:** implementado
- **Arquivos principais:** `manifest.webmanifest`, `service-worker.js`,
  `world-pwa.js`, `icons/` (4 PNGs), `tools/make-icons.mjs`, `index.html`,
  `world-menu.js`, `tools/serve.mjs`, `tools/stamp-importmap.mjs`,
  `tests/pwa.test.mjs` e `tests/service-worker-runtime.test.mjs` (novos)

## Por que

O jogo já abria sem CDN (o `three.js` foi vendorizado antes), mas ainda precisava
de rede **toda vez**: nenhum arquivo era guardado no aparelho. Sem rede, a página
nem carregava — e num celular isso significa "não abre no ônibus".

PWA resolve duas coisas de uma vez: **instalar** (ícone na tela inicial, janela
sem barra do navegador) e **abrir offline** depois da primeira visita.

## Como

### As peças

| Peça | Papel |
| --- | --- |
| `manifest.webmanifest` | nome, `display: standalone`, `start_url`/`scope` relativos, cores, 4 ícones |
| `service-worker.js` | guarda a casca na instalação; o resto entra no primeiro uso |
| `world-pwa.js` | decisão de registrar + lista `APP_SHELL_FILES` |
| `icons/*.png` | 192, 512, maskable 512 e favicon 32 |

`start_url` e `scope` são **relativos** (`./`), então o mesmo manifest funciona
servido na raiz ou numa subpasta (GitHub Pages, por exemplo).

### Duas estratégias, porque os problemas são opostos

O documento e os arquivos falham de maneiras diferentes:

- **documento** → **rede primeiro**. Se saiu versão nova, o jogador recebe na
  hora; sem rede, cai na cópia guardada. Sem cópia, mostra uma página curta
  dizendo "conecte-se uma vez" em vez de erro de rede.
- **arquivos** → **cache primeiro, atualização em segundo plano**
  (stale-while-revalidate). Aqui não existe risco de código velho: os módulos já
  vêm com `?v=<hash>` no importmap, e hash diferente é URL diferente.

Só a **própria origem** é cacheada: CDN, fonte e qualquer terceiro ficam de fora.
O `service-worker.js` também não cacheia a si mesmo (senão não haveria como
atualizar).

### Versão do cache

`CACHE_VERSION` é explícito. Na ativação, tudo que começa com `voxel-sandbox-` e
não é a versão atual é apagado — e caches de outros projetos no mesmo domínio são
preservados. `skipWaiting()` + `clients.claim()` fazem a versão nova assumir sem
exigir que todas as abas sejam fechadas.

### Instalação não pode ser frágil

`cache.add()` de cada arquivo tem `.catch()`: um 404 na casca (arquivo renomeado,
por exemplo) não pode impedir a instalação inteira. E `registerServiceWorker()`
nunca rejeita: se falhar, avisa no console e o jogo segue jogável com rede.

`?sw=0` desliga o registro — necessário para depurar cache sem limpar os dados do
site.

### Ícones sem editor de imagem

`tools/make-icons.mjs` desenha o bloco de grama em isométrico e escreve PNG com
`zlib` da biblioteca padrão (sem dependência nenhuma). A textura vem de um ruído
determinístico por célula de 8 px, então o ícone sai sempre igual. O maskable tem
fundo de céu cheio e bloco menor, para o recorte circular do Android.

## Validação

```bash
npm test        # 375 testes (30 novos)
npm run check   # sintaxe 107/107 + importmap em dia
```

**Testes de estrutura** (`tests/pwa.test.mjs`): manifest com os campos que o
navegador exige, cada ícone existindo com o tamanho anunciado (lidos do header
PNG), a lista da casca batendo com a do service worker, o worker fora do
importmap, o MIME do manifest no servidor de desenvolvimento, e `?sw=0`.

**Testes de comportamento** (`tests/service-worker-runtime.test.mjs`): o
`service-worker.js` é **executado de verdade** num contexto de `node:vm` com
dublês de `caches`/`fetch`/`self`:

- instala e guarda a casca inteira; um 404 não impede a instalação;
- ativa apagando só as versões antigas do próprio jogo;
- navegação online guarda a cópia offline; offline serve essa cópia; sem nunca ter
  aberto online, entrega a página explicativa;
- arquivo novo é buscado e cacheado; arquivo em cache é servido na hora e
  atualizado por trás (o teste confere o conteúdo do cache **depois** da
  atualização em segundo plano);
- offline sem cache → 504 explícito;
- requisição de outra origem, `POST` e o próprio worker **não** são interceptados.

## Limitações conhecidas

- **Não testei em navegador** (o sandbox não tem Chromium): o service worker é
  validado por execução simulada, não por um navegador de verdade. Os candidatos
  a surpresa são específicos do ambiente (iOS e o cache de 50 MB, por exemplo).
- Sem botão "Instalar" próprio: usa o convite nativo do navegador. Um botão nas
  opções (`beforeinstallprompt`) é polish separado.
- Sem sincronização de fundo, sem notificações, sem compartilhamento de mundo.
- Não há estratégia de "cache por mundo": o save continua no IndexedDB, que já é
  local — e o service worker não toca nele.
- Atualizar a versão do cache é manual (`CACHE_VERSION`). Automatizar isso num
  build não existe porque o projeto não tem build.
