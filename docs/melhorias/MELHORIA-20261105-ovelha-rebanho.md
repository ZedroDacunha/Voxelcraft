# MELHORIA: o rebanho e o susto da ovelha (parte 6)

- **Data:** 05/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-sheep.js`, `game.js`, `tests/sheep.test.mjs`

## As escolhas (feitas antes de codar)

| Pergunta | Resposta |
| --- | --- |
| Como ela reage ao jogador | **Misto**: perto (correndo/andando rápido, de pé) ela **para, ergue a cabeça e encara**; **golpe** ela **corre para longe** |
| Formato do rebanho | **Líder e seguidoras**: uma é a cabeça do grupo, as outras andam em volta dela |
| O susto pega o bando | **Sim**: uma assustada assusta as companheiras próximas |
| Quantas no mundo | **Seis** (era quatro) |

## Antes

Cada ovelha era uma ilha: nascia sozinha, vagava num alvo próprio e nada a
assustava. Passar correndo por cima dela não mudava nada — ela continuava
pastando como se o jogador fosse parte da paisagem.

## Depois

### O rebanho

- **Nasce em bando**: de **2 a 4** ovelhas por vez, todas com o mesmo `herd`, em
  volta do ponto sorteado (`SHEEP_HERD_SPREAD_MIN`–`MAX`, 1,4–3,2 blocos). A
  primeira é a **líder** (`leader: true`); as outras são seguidoras.
- **A seguidora pastoreia em volta da líder**, não de si mesma — o alvo sorteado
  sai do ponto dela. Se ficar mais de `SHEEP_FOLLOW_GAP` (7 blocos) para trás,
  vai **direto** para o lado dela e revisa o rumo em 1,2 s.
- **Se a líder sumir** (saiu do mundo), a próxima do bando assume
  (`herdLeaderOf` promove a de menor id). O bando nunca fica sem cabeça.
- **Bandos diferentes não nascem no mesmo canto**: o afastamento entre bandos
  continua `SHEEP_MIN_GAP` (6 blocos), maior que o pasto de 4×4 que o teste usa.
- **Limite de 6 no mundo** (`SHEEP_LIMIT`). Um nascimento traz o bando inteiro,
  mas nunca passa do limite.

### O susto

A regra é a **mesma do Mofim**, e agora é uma função importada de
`world-creature.js` (`shouldFlee`), com as constantes da ovelha:

- **Chegou perto correndo** (`SHEEP_ALERT_RADIUS` 4,5 blocos,
  `SHEEP_ALERT_SPEED` 2,2 blocos/s, **de pé**) → ela **para de andar**, vira a
  cara para quem chegou, o focinho **sobe** (`SHEEP_ALERT_HEAD_LIFT`) e fica
  assim por `SHEEP_ALERT_TIME` (1,8 s). Depois volta ao pasto.
- **Agachado perto não assusta** — a regra de sempre: quem chega devagar e baixo
  vê a ovelha de perto.
- **Golpe** (`hitAt`, o mesmo `creatureInReach` da tesoura) → ela **corre para
  longe** de quem bateu por `SHEEP_FLEE_TIME` (3,5 s), a `SHEEP_FLEE_SPEED`
  (1,55 bloco/s) — e a passada anda 1,7× mais rápido. O golpe tem espera própria
  (`SHEEP_HIT_COOLDOWN`, 0,35 s) para um clique duplo não contar duas vezes.
- **Contágio**: o susto e a fuga se espalham para as companheiras do **mesmo
  bando** dentro de `SHEEP_SCARE_SPREAD` (6 blocos) — uma assustada assusta o
  grupo. Bando do lado não é contaminado.

### Um bug antigo que caiu junto

O `pickTarget()` existia desde a parte 3, mas **ninguém o chamava**: a ovelha
sorteava o alvo no nascimento e ficava indo para o mesmo ponto para sempre (e
depois parava de andar). O `turnAt` era escrito e ignorado. Agora o `update()`
chama `pickTarget()` quando vence o prazo — é o que faz o rebanho andar de
verdade, e é o que permite a seguidora voltar para o lado da líder.

## Validação

```bash
npm test        # 903 testes (65 do módulo da ovelha, 14 novos aqui)
npm run check   # sintaxe + importmap em dia
npm run stamp   # index.html recarimbado
```

**Prova de força** — cada quebra proposital derruba o teste que a defende:

| Quebra proposital | Teste que reprova |
| --- | --- |
| a seguidora não persegue a líder (`if (false)`) | "a seguidora vai atrás da líder quando fica para trás" |
| bando de um só (`herdSizeFor` devolve 1) | "o bando nasce junto…" e "o bando é de duas a quatro" |
| tirar o contágio do susto | "o susto se espalha pelo bando, mas não para o bando do lado" |
| o golpe não chama `flee` | "golpe: ela corre para longe…" e "o golpe também se espalha" |
| ignorar o agachamento (`crouching = false`) | "perto, mas agachado (ou devagar), ela não se assusta" |
| `game.js` volta a passar só `{ pos }` | "game.js dá velocidade e agachamento à ovelha e liga o golpe nela" |

## Limites conhecidos

- O bando é **local**: não há hierarquia além de "a primeira nasce líder", nem
  memória entre um bando e outro.
- A fuga é um passo reto para longe do golpe; encurralada (água, encosta), ela
  para — não procura rodeio.
- Contágio alcança só o **mesmo** `herd`: dois bandos pastando lado a lado não se
  assustam juntos.
- O susto de chegada não tem som próprio: quem avisa é o balido de perto, que
  continua valendo pela distância.

## O que ainda **não** existe (de propósito)

Nada pendente da ovelha: as partes 1 a 6 fecharam o bicho (aparência, mundo,
pasto, lã e tesoura, balido, rebanho e susto).
