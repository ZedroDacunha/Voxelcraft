# MELHORIA: o painel da porta aberta passa a colidir

- **Data:** 03/11/2026 (item 7 da [análise de 31/10](ANALISE-20261031-melhorias.md))
- **Status:** implementado
- **Arquivos principais:** `world-door.js`, `game.js`, `tests/door-collision.test.mjs`

## Antes

As portas abertas são marcadas como `solid: false` no catálogo, e
`woodDoorCollision()` devolvia `null` quando `part.open`. Efeito colateral: o
painel girado **continuava desenhado** na borda do voxel, mas o jogador passava
através dele.

```json
{ "placed": true, "openType": 89, "solid": false, "collision": null }
```

Eram duas regras independentes — o mesher desenhava uma coisa, a física
acreditava em outra — e a análise pedia que a colisão da porta aberta fosse uma
**regra explícita**, não um efeito colateral de `solid: false`.

## Depois

A geometria do painel já estava certa; o que faltava era a física concordar com
ela:

- `woodDoorShape(facing, open)` desenha a porta aberta **girrada 90°**: fina no
  eixo do batente (0,125 de espessura, encostada na borda do voxel) e ocupando a
  profundidade inteira. Como o eixo fino é perpendicular ao sentido em que se
  atravessa o vão, o painel **não tapa a passagem** — sobra 0,875 de bloco livre
  para um jogador de 0,6.
- `woodDoorCollision(part, facing)` passou a devolver a caixa nos **dois**
  estados. Fechada: painel centralizado (já era assim). Aberta: a mesma caixa
  fina rotacionada.
- `World.isSolidForPhysics()` aceita o tipo já conhecido, para o laço de colisão
  não buscar o bloco duas vezes.
- Em `collides()`, a porta é resolvida **antes** do teste de solidez:

  | Antes | Agora |
  | --- | --- |
  | `solid: false` → `continue` → jogador atravessa o painel | porta sempre consulta a caixa fina do painel |
  | porta fechada colidia, aberta não | as duas colidem, com o formato de cada estado |

- `boxOverlapsXZ()` saiu de `game.js` para `world-door.js` e é usado pela
  colisão **e** pela checagem de "saia do vão da porta".
- Abrir a porta agora também checa o jogador: se o painel girado fosse nascer em
  cima dele, aparece *"Saia do vão da porta para abri-la"* (antes só o
  fechamento era verificado).
- `unstickPlayer()`: se o save deixou o corpo dentro do painel (ou sob areia que
  caiu), o carregamento procura o ponto livre mais próximo — mesmo bloco, depois
  um e dois blocos acima, com deslocamentos laterais de 0,45. Sem isso, um save
  antigo com o jogador dentro do painel o deixaria preso sem conseguir andar.

## O que continua igual

- A porta aberta **não** bloqueia o vão: dá para atravessar de ponta a ponta.
- Água e areia continuam tratando a porta aberta como célula vazia (`solid:
  false` no catálogo) — o painel é fino e não veda o fluxo.
- Itens e mobs não consultam a caixa do painel: eles continuam atravessando,
  como antes.

## Validação

```bash
npm test        # 238 testes (4 novos/reescritos em door-collision)
npm run check   # sintaxe + importmap em dia
```

## Limitações conhecidas

- Passar pela porta aberta exige contornar o painel: quem entra muito encostado
  no batente esbarra nele e precisa deslizar para o lado (o vão livre é 0,875 e o
  jogador tem 0,6 de largura). É o preço de manter o painel no lugar em que ele
  é desenhado; mover a folha para o voxel vizinho, no estilo Minecraft, deixaria
  o vão totalmente livre, mas exigiria geometria fora do voxel no mesher.
- A validação é geométrica (caixas × caixa do jogador) e por asserção no código;
  o "esbarrar e deslizar" real depende de navegador.
