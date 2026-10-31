# BUG: busca de receitas deixava entradas ocultas visíveis

- **Data:** 31/10/2026
- **Status:** corrigido
- **Arquivos principais:** `inventory-recipe-search.js`, `inventory-recipe-book.js`, `inventory.css`, `index.html`

## Sintoma

Ao buscar por “porta” no livro de receitas, a entrada correta era filtrada, mas
as demais continuavam renderizadas. Na auditoria em navegador, 26 entradas
ficavam visíveis e 25 delas estavam marcadas com `hidden`, porém ainda ocupavam
espaço na tela.

## Causa

`.recipe-entry` e `.recipe-entry-craft` definiam `display: grid`. Essa regra de
autor vencia o `display: none` padrão do atributo `hidden`, então esconder a
entrada pelo JavaScript não a removia do layout.

A lógica de busca também estava acoplada ao livro de receitas, percorrendo o DOM
e comparando `textContent` diretamente a cada evento de input.

## Correção

- `inventory-recipe-search.js` concentra a normalização, o índice e o filtro.
- A busca ignora caixa, acentos e espaços repetidos.
- Vários termos precisam aparecer no texto, em qualquer ordem.
- O livro aplica ao DOM apenas os conjuntos de entradas/seções visíveis.
- `inventory.css` ganhou uma regra escorada para que `hidden` vença os displays
  de grid/flex dentro do livro de receitas.
- O campo de busca recebeu nome acessível e `aria-controls`; a mensagem de
  resultado vazio recebeu `role="status"`.

## Validação

```bash
node --test tests/*.test.mjs
node tools/stamp-importmap.mjs --check
git diff --check
```

Resultado: 86 testes aprovados.

Verificação em navegador headless:

| Busca | Entradas visíveis | Ocultas ainda renderizadas | Mensagem vazia |
| --- | ---: | ---: | --- |
| sem busca | 36 | 0 | não |
| `porta` | 1 | 0 | não |
| `tabuas` | 9 | 0 | não |
| `carvalho porta` | 1 | 0 | não |
| `xyz-inexistente` | 0 | 0 | sim |
| busca limpa | 36 | 0 | não |

Nenhum erro de página foi registrado durante a verificação.
