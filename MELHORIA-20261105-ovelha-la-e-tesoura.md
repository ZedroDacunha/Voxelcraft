# MELHORIA: a lã e a tesoura (parte 4)

- **Data:** 05/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-catalog.js`, `world-textures.js`, `world-sheep.js`,
  `world-block-materials.js`, `world-audio.js`, `game.js`, `world-chat-commands.js`

## As escolhas (feitas antes de codar)

| Pergunta | Resposta |
| --- | --- |
| Aparência da tosquiada | **B — tosada rente**: uma camada de lã baixa e lisa, sem tufos e sem topete, corpo menor (comparativo em `/home/user/ovelha-tosquiada-opcoes.png`) |
| Como se faz a tesoura | **duas barras de ferro na diagonal** (como no Minecraft — reconhecível sem tutorial) |
| Que lã ela solta | **uma por cor** (branca, cinza, preta, conforme a lã dela) e **quatro fardos da mesma cor viram o bloco daquela cor** |
| Quando a lã volta | **de 5 a 8 minutos**, e **cada pastagem adianta 90 s** |

## Antes

A ovelha só existia, andava e pastava. O jogador chegava perto, batia nela… e nada
acontecia: não havia o que fazer com ela, nem como usar a lã.

## Depois

### A tesoura
- Item novo (`ID.SHEARS`, 99), com durabilidade 238 e `tool.type: 'shears'`.
- **Não** entrou em `TOOL_KINDS`: ali as ferramentas são `base + índice` do
  material, e enfiar um quarto tipo renumeraria picareta, machado e pá de todos
  os materiais — e os saves com isso. Ela é item próprio, com receita
  `[[ferro, —], [—, ferro]]`.
- Gasta um ponto de durabilidade por tosquia e tem som próprio (`shear`: ruído
  curto e fino, sem baque — baque é de golpe).

### Tosquiar
- Com a tesoura na mão, o **clique esquerdo** procura a ovelha na mira
  (`shearAt` usa a mesma mira do golpe, `creatureInReach`) e tosquia.
- Sai **1 a 3 fardos** na cor dela (`woolCountFor`), que caem no chão como item.
- A ovelha **troca de modelo** na hora: `createModel(coat, { sheared: true })` é
  o corpo tosado — 18 malhas contra 28 da com lã. Trocar o modelo inteiro (em vez
  de esconder peças) é o que permite a tosquiada ser **menor**, e não a mesma
  ovelha com peças apagadas.
- Sem ovelha com lã na mira, o clique segue o caminho normal (golpe/mineração).
- Enquanto tosquiada, ela continua andando e pastando normalmente.

### A lã volta
- Relógio de **300–480 s**, sorteado por ovelha (`SHEEP_WOOL_REGROW_MIN/MAX`).
- **Pastar adianta 90 s** por mordida (`SHEEP_WOOL_GRAZE_BONUS`) — a lã voltar
  depende de a ovelha comer, como no Minecraft, mas sem depender de uma
  mecanização complicada: o pasto do P3 já estava pronto.
- Quando o relógio chega, o modelo com lã volta (tufos, topete, rabo maior).

### Lã como material e como bloco
- **Fardos**: `ID.WOOL_WHITE/GRAY/BLACK` (96–98), stackam de 64, com sprite
  próprio (`kind: 'wool'`, cor pelo `mat`).
- **Blocos**: `ID.WOOL_BLOCK_WHITE/GRAY/BLACK` (93–95), sólidos, macios
  (dureza 0,6, quebram na mão), um tile por cor no atlas (35–37).
- **Receita**: quatro fardos **da mesma cor** → um bloco daquela cor. Cores
  diferentes não fecham receita (testado).
- **Som de lã**: a família `wool` entrou em `BLOCK_MATERIALS`, então passo,
  batida, quebra e colocação saem abafados de graça nos três blocos.

## Validação

```bash
npm test        # 883 testes (45 do módulo da ovelha, 11 do catálogo; 8 novos aqui)
npm run check   # sintaxe + importmap em dia
npm run stamp   # index.html recarimbado
```

**Prova de força** — cada quebra proposital derruba o teste que a defende:

| Quebra proposital | Teste que reprova |
| --- | --- |
| a tosquiada ainda com tufos | "tosquiada, ela fica com uma camada de lã baixa e lisa…" |
| tosquiar a mesma ovelha duas vezes | "a tesoura tira a lã…" (não se tosquia duas vezes) |
| pastar sem adiantar o relógio | "a lã volta em cinco a oito minutos, e pastar adianta…" |
| sempre 1 fardo | "a tosquia dá de um a três fardos…" |
| lã volta na hora (1 s) | "a lã volta em cinco a oito minutos…" |
| receita da tesoura na vertical | "a tesoura é item próprio…" |
| receita só da lã branca | "a lã vem em três cores…" |

Conferência visual, fora do repositório: `/home/user/sheep-p4-preview.mjs`
desenha o **modelo do jogo** (`createModel`) com lã e tosquiado nas três cores em
`/home/user/ovelha-tosquiada-no-jogo.png`.

## Limites conhecidos

- A ovelha tosquiada **não é salva**: ovelhas nascem do nada e não vão para o
  save, então recarregar a página devolve todas com lã. A lã já colhida fica
  (vira item/bloco no inventário).
- Não existe tosquia por golpe: só a tesoura tosquia (bater nela ainda não faz
  nada — o susto e a morte da ovelha são a parte 6).
- O bloco de lã ainda não tem uso em receita (cama, tapete, etc.) — ele é a
  recompensa por juntar quatro fardos, e é um bloco de construção como os outros.

## O que ainda **não** existe (de propósito)

- balido — **P5**; rebanho e susto — **P6**.
