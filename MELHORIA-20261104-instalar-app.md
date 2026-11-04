# MELHORIA: botão "Instalar app" na tela inicial (PWA)

- **Data:** 04/11/2026 (tema PWA, depois do [T4](MELHORIA-20261104-pulo-tardio.md))
- **Status:** implementado
- **Arquivos:** `world-menu.js`, `index.html`, `tests/pwa.test.mjs`;

  módulo e testes novos: `world-install-prompt.js`, `tests/install-prompt.test.mjs`

## Por que

O jogo já era instalável (manifest, service worker, ícones e cache offline desde
03/11), mas a instalação só existia **no menu do navegador**: quem não conhece
"⋮ → Instalar app" nunca descobre que dá para jogar em janela própria — e sem
rede.

Instalar um PWA, porém, não é chamar uma função: é um **convite do navegador**. O
Chrome/Edge disparam `beforeinstallprompt` quando o app é elegível e, a partir
desse evento guardado, o clique pode chamar `prompt()`. Se o jogo deixa o evento
passar (o padrão quando ninguém escuta), o mini-aviso do Chrome aparece uma vez e
**o convite não volta** — foi para isso que o botão veio junto com o
`preventDefault`.

## A decisão (`world-install-prompt.js`, puro)

| Situação | O que aparece |
| --- | --- |
| já instalado (janela própria, `display-mode: standalone`) | nada |
| navegador deu o evento (`mode: 'prompt'`) | botão **Instalar app** → clique abre o convite nativo |
| iPhone/iPad, sem evento (`mode: 'hint'`) | botão **Instalar app** → clique revela o caminho manual |
| desktop sem evento (Firefox, por exemplo) | nada — não existe caminho útil |

- **Detecção do iOS** por user-agent (`iphone|ipad|ipod`) e, para o iPadOS 13+,
  que se apresenta como *Macintosh* com `Mobile` no UA.
- **Um convite por evento**: `prompt()` descarta o evento antes de usar (o
  navegador recusa o segundo `prompt()` no mesmo evento). Por isso, no
  Android/desktop, depois de recusar o botão some até o navegador oferecer de
  novo — e no iPhone o texto de instrução continua à mão.
- **Nunca lança**: evento malformado não entra (`capturePromptEvent` devolve
  `false`), e `prompt()` que estoura responde `'unavailable'`.

A interface nova segue o padrão do menu: `.classic-btn classic-btn-wide`
(cinza, borda 2px, sem raio), nascendo `hidden`, com o texto de apoio no mesmo
estilo do aviso de sair e `aria-live="polite"`.

## Ligações no `world-menu.js`

```js
window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();          // sem isso o evento se perde no mini-aviso
    installPrompt.capturePromptEvent(event);
    refreshInstallButton();
});
window.addEventListener('appinstalled', () => { ... });   // o botão sai
installButton.addEventListener('click', ...);            // convite ou instrução
```

Mensagens de retorno: instalado ("o jogo agora abre pelo ícone, inclusive sem
rede"), instrução do Safari, ou "este navegador não oferece a instalação agora".

## Testes

- `tests/install-prompt.test.mjs` (novo, **12**, tudo puro — sem DOM):
  - sem evento e sem instrução → nada; com evento → `mode: 'prompt'` e rótulo;
  - iPhone → `mode: 'hint'` com o texto do Compartilhar; iPadOS disfarçado de Mac
    também; Android/desktop sem evento → nada; já instalado → nada (e recusa
    evento novo);
  - clique: `accepted` chama o `prompt()` do navegador uma vez e gasta o evento;
    `dismissed` também gasta; segundo clique responde `unavailable`;
  - sem evento, clique não quebra; `userChoice` rejeitada devolve `unavailable`;
  - evento malformado não entra e o segundo evento não sobrescreve o primeiro;
  - `appinstalled` esconde para sempre e descarta o evento pendente.
- `tests/pwa.test.mjs` (+2, estrutura): o botão existe em `index.html` com o
  padrão `.classic-btn` e nasce escondido, com aviso `aria-live`; e o menu
  realmente guarda o evento (`preventDefault` + `capturePromptEvent`), reage a
  `appinstalled` e chama `installPrompt.prompt()` no clique.

## Validação

```bash
npm test        # 501 testes
npm run check   # sintaxe 114/114 + importmap em dia
```

O sandbox não tem navegador (faltam bibliotecas do Chromium), então o clique no
convite nativo — e o layout do botão na tela inicial — **precisa ser conferido no
aparelho**: abrir em Chrome/Edge e ver o botão, instalar, e no iPhone conferir a
instrução do Safari.

## O que ficou de fora

- **Banner automático** na primeira visita (o botão no menu é discreto de
  propósito).
- Lembrete "não mostrar de novo": o botão não insiste — no Android/desktop ele
  desaparece sozinho quando o convite é gasto.
- Atalhos do manifest (`shortcuts`), `share_target` e botão de instalar **dentro**
  do jogo (a tela inicial é onde se instala).
