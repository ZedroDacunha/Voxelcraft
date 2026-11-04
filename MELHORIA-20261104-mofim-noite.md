# MELHORIA: o Mofim é bicho de noite (T3, leva 2)

- **Data:** 04/11/2026 (tema 3, depois da [luz real](MELHORIA-20261104-luz-real.md))
- **Status:** implementado
- **Arquivos:** `world-creature.js`, `game.js`, `tests/creature.test.mjs`

## Por que

Depois das levas do T1 e do T2 o Mofim tem comportamento, voz e recurso — mas
nada nele é especial no tempo. Ele nasce a qualquer hora, no mesmo ritmo, e um
vaga-lume de dia é só um bicho verde andando. Com a luz real (leva 1 deste tema),
a noite já tem tocha acesa, lua e estrela; faltava **quem mora nela**.

Agora ele é bicho de noite: aparece quando o céu escurece, brilha (de verdade,
não só de cor) e vai embora quando o sol volta.

## A regra

Uma conta só, pura e testada — o céu já sabe a hora (`worldSky.day`: 0 = noite
fechada, 1 = dia claro), então `night = 1 − day` chega de graça:

```js
isMofimTime(night)  // night >= 0.5
```

| Fase do céu | `night` | Tem Mofim? |
| --- | --- | --- |
| dia claro | 0 | não |
| começo do crepúsculo | ~0,5 | **sim** (a partir daqui) |
| noite fechada | 1 | sim |

Com `DAY_LENGTH` de 1200 s e o mundo começando às 10h48 (`START_TIME` 0,2), os
primeiros Mofins aparecem por volta de **5 min 40 s** de jogo (t ≈ 0,49 do ciclo)
e a noite toda dura **~10 min**. Sem informação de hora, a função assume noite —
é o que mantém os testes antigos e qualquer chamada antiga funcionando.

## O brilho

`nightGlow(night, time)` devolve 0 de dia e até ~0,16 à noite, com uma respiração
lenta (seno de 2,3 rad/s, 75–100%):

- entra no **emissive** do corpo (verde-pálido) junto do clarão do dano — o golpe
  continua mandando enquanto dura;
- a **luzinha das costas** cresce até ~2,3× no escuro (é um `MeshBasicMaterial`,
  então ela já era "acesa", mas pequena); de dia ele volta a ser silhueta.

E, com o pool de PointLights da leva 1, ele também passa a receber a luz das
tochas e lanternas por perto — pó de verdade iluminando pó de verdade.

## Ir embora

Ao amanhecer ele não some de um quadro para o outro (o que parece bug): entra em
`leaving` e, em **0,9 s**, sobe 1,1 bloco, inclina para cima, bate as asas rápido
e encolhe até desaparecer — aí sai da cena, **sem soltar pó** (`onDeath` não é
chamado: ele foi embora, não foi abatido).

Enquanto está indo, **não é alvo**: `creatureInReach` pula quem tem `leaving`
(novo), então o golpe atravessa em vez de roubar o quadro da mineração sem
acertar nada.

## Testes

`tests/creature.test.mjs` (34 → **40**):

- regra da hora: noite cheia, limite exato (0,5 conta como noite), um tico mais
  claro e ele não vem, dia = não, sem hora = noite, `NaN` = noite;
- brilho: zero de dia, cresce com o escuro, satura, respira e fica abaixo de 0,2;
- `leaveProgress`: 0 → 1, metade na metade, trava em 1 e não quebra com duração 0;
- com o sol alto, 40 tentativas de nascimento = nenhum Mofim;
- amanhecer: começa a ir embora (sobe e encolhe), não anda para o lado, ainda não
  sumiu no primeiro quadro, some depois de `LEAVE_DURATION`, sai da cena e
  `onDeath` **não** é chamado;
- quem está indo embora não é achado por `creatureInReach` nem leva `hitFrom`.

O teste do clarão do dano foi ajustado: ele agora compara com o brilho da noite
(que nunca é zero quando é noite) em vez de exigir emissive exatamente 0.

## O que ficou de fora

- **Dormir** para pular a noite (ou atravessar o dia): mecânica própria, com cama
  e save — fora deste tema.
- Outros bichos noturnos, fases da lua e "noite perigosa": conteúdo, depois.
- Aumentar o teto de bichos à noite (`CREATURE_LIMIT` segue 3): com o brilho e o
  chilreio, três já enchem a noite de vida.
