# MELHORIA: a ovelha pasta (parte 3)

- **Data:** 05/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-sheep.js`, `tests/sheep.test.mjs`

## As escolhas (feitas antes de codar)

| Pergunta | Resposta |
| --- | --- |
| O que ela come? | o bloco de grama **à frente do focinho** (não o que está sob as patas) |
| A terra volta a virar grama? | **sim, entre 5 e 10 minutos** — mais devagar que o "na hora" e sem deixar o campo marcado para sempre |
| Com que frequência? | **pausas raras e longas**: a cada **30–60 s**, **4–6 s** pastando (a primeira vem cedo, 8–20 s, para o jogador ver acontecer) |

## Antes

A ovelha só andava. Passava a vida vagando e nunca mexia no mundo — nem quando o
jogador parava do lado dela, nem em cima de um campo de grama.

## Depois

- **O pasto**: de vez em quando ela **para** (não anda de lado, não desliza),
  **abaixa a cabeça** até o focinho encostar na grama, mastiga (uma tremidinha de
  cabeça no meio) e sobe de novo. Enquanto pasta, o alvo do passeio fica
  esperando — ela retoma o rumo quando termina.
- **A mordida**: acontece uma vez por pastagem, a 45% do tempo, quando a cabeça
  já está no chão. O bloco de grama da célula da frente vira **terra** e a
  touceira de grama alta que estiver nele é comida junto.
- **Só grama**: areia, pedra, terra e água não se comem. Em cima da praia ela
  abaixa a cabeça e não acontece nada — melhor do que "comer" a paisagem.
- **A grama volta**: a célula comida entra numa fila e volta a ser grama entre
  **5 e 10 minutos** depois (sorteado por célula, para o campo não todo de uma
  vez). Se o jogador puser outro bloco no lugar, **o bloco dele manda** e a
  célula sai da fila. A fila tem **teto de 128 células** — pasto infinito não
  vira memória infinita.

## A cabeça precisou de pescoço

O modelo da parte 2 tinha a cara em peças soltas no grupo do corpo (cabeça,
focinho, olhos, brilhos, orelhas). Para baixar o focinho até o chão isso não
serve: girar só a caixa da cabeça deixaria focinho e olhos flutuando.

Agora a cara é **um grupo com o pivô no pescoço** (`SHEEP_NECK_Y`, `SHEEP_NECK_Z`),
com `skull`, `topknot`, `muzzle`, `eye`, `glint` e `ear` dentro. A animação move
o grupo: desce `SHEEP_HEAD_DROP` e inclina `SHEEP_HEAD_TILT`, numa conta só,
`headPoseFor(envelope)` — a mesma que o teste usa para conferir a geometria.

Números conferidos: com a cabeça no chão, o **centro do focinho fica em y = 0,075
e z = 0,62** (o pé é 0, a célula comida começa em 0,5). Ou seja: encosta na
grama, não entra no bloco.

## Validação

```bash
npm test        # 875 testes (39 do módulo da ovelha, 12 novos nesta parte)
npm run check   # sintaxe + importmap em dia
npm run stamp   # index.html recarimbado
```

**Prova de força** — cada quebra proposital derruba o teste que a defende:

| Quebra proposital | Teste que reprova |
| --- | --- |
| comer qualquer bloco (sem exigir grama) | "só come grama…" |
| a grama não virar terra | "pastando, ela para, baixa a cabeça…", "a touceira… sai junto" e "a terra comida volta…" |
| prazo de crescimento curto (5 s) | "a terra comida volta a ser grama entre cinco e dez minutos" |
| crescer por cima do bloco do jogador | "onde o jogador construiu, a grama não volta" |
| fila de crescimento sem teto | "a fila de crescimento tem teto" |
| envelope sempre 1 (cabeça de estalo) | "a cabeça desce, fica embaixo e sobe" |
| cabeça que não desce | "pastando, ela para…" e "com a cabeça no chão, o focinho encosta…" |
| comer a célula de trás | "o focinho alcança a célula da frente" |
| morder a cada quadro (sem o "já mordeu") | "a terra comida volta a ser grama…" |

O desenho de conferência ficou **fora do repositório**, como os das partes
anteriores: `/home/user/sheep-graze.mjs` monta a ovelha pelo `createModel` do
jogo e desenha os três momentos (em pé, no meio da descida e com o focinho na
grama) em `/home/user/ovelha-pastando.png`.

## Limites conhecidos

- A fila de crescimento vive na memória: se a página recarregar antes do prazo, a
  terra continua terra (como se o pasto tivesse sido comido há mais tempo). Não
  vale gastar espaço do save com isso.
- A ovelha não escolhe **o que** comer: come a célula da frente, se for grama.
  Procurar a grama mais perto é outro comportamento (não pedido).

## O que ainda **não** existe (de propósito)

- lã e tesoura — **P4**; balido — **P5**; rebanho e susto — **P6**.
