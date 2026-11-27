# MELHORIA: o balido da ovelha (parte 5)

- **Data:** 05/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-sheep.js`, `world-audio.js`, `game.js`,
  `assets/sounds/LEIA-ME.md`

## As escolhas (feitas antes de codar)

| Pergunta | Resposta |
| --- | --- |
| Quando ela bale | **nas duas situações, com sons diferentes**: o **chamado** de passeio (de vez em quando, andando ou pastando) e o **"chegou perto"** (quando o jogador entra no raio dela) |
| Volume | **cai com a distância**, como o chilreio do Mofim |

## Antes

A ovelha era muda. Dava para passar meia hora ao lado dela sem ouvir nada — o
que fazia o pasto parecer um cenário, não um bicho.

## Depois

- **Chamado de passeio** (`sheep-bleat`): de vez em quando (14–34 s, sorteado por
  ovelha), discreto. Toca andando, parada ou pastando.
- **"Cheguei perto"** (`sheep-bleat-near`): quando o jogador **entra** no raio de
  5 blocos. Mais agudo, mais curto e um pouco mais alto.
- **Nada de metralhadora**: o "chegou perto" só sai na **transição** de longe para
  perto (ficar parado do lado dela não repete), tem espera própria de 22 s
  (sair e voltar não repete) e todos os balidos respeitam uma pausa mínima
  comum de 4 s.
- **Volume pela distância**: o jogo calcula `1 − distância / 20`, a mesma ideia do
  chilreio do Mofim. Abaixo de 8% de volume (≈18 blocos) não toca; depois de 20
  blocos o balido nem é pedido (`SHEEP_BLEAT_RANGE`).
- **A regra é uma função pura**: `bleatFor()` decide o motivo (`'near'`, `'call'`
  ou `null`) sem THREE, sem mundo e sem áudio — o teste cobre tudo com números.
  O módulo da ovelha **não conhece som**: ele avisa por `onBleat({ reason,
  distance })`, e o `game.js` é quem toca (mesmo desenho do `onChirp` do Mofim).

## Os dois sons sintetizados (reserva)

Enquanto não houver arquivo em `assets/sounds/`, valem estas sínteses:

| Nome | Síntese |
| --- | --- |
| `sheep-bleat` | serra 320→248 Hz, três sílabas de 180 ms ("bé-é-é") |
| `sheep-bleat-near` | serra 392→300 Hz, duas sílabas de 150 ms, mais curta e aguda |

## Para trocar pelo `.ogg` de verdade

1. Gere ou baixe **um balido curto** (0,5–1,2 s).
2. Deixe **mono, 44,1 kHz**, corte o silêncio do começo (uns 20 ms) e ponha um
   fade-out de ~30 ms no fim (corte seco faz "tlec").
3. Salve como `assets/sounds/sheep-bleat.ogg` e, se quiser um diferente para o
   "chegou perto", `assets/sounds/sheep-bleat-near.ogg`.
4. Recarregue com **Ctrl+F5** (a busca pelo arquivo fica em cache) e registre a
   origem no `CREDITS.md` da pasta.

Formato aceito: **OGG Vorbis** ou **WAV** (MP3 não é lido por essa ponte). O
`assets/sounds/LEIA-ME.md` agora lista as duas linhas novas.

## Validação

```bash
npm test        # 889 testes (51 do módulo da ovelha, 6 novos aqui)
npm run check   # sintaxe + importmap em dia
npm run stamp   # index.html recarimbado
```

**Prova de força** — cada quebra proposital derruba o teste que a defende:

| Quebra proposital | Teste que reprova |
| --- | --- |
| balir a cada quadro enquanto o jogador está perto | "quando o jogador chega perto ela bale uma vez…" |
| tirar a espera do "chegou perto" | "quando o jogador chega perto ela bale uma vez…" |
| tirar o alcance do som | "sem ninguém por perto, o balido de passeio sai no relógio dela" |
| tirar a pausa mínima entre balidos | "dois balidos da mesma ovelha nunca saem colados" |

## Limites conhecidos

- O som é **sintetizado** até você pôr o `.ogg`: ele é reconhecível, mas não é o
  balido de uma ovelha de verdade.
- O balido não tem "posição" no espaço (sem áudio 3D): o volume vem da distância
  em linha reta, então atrás de uma parede ele soa igual.
- A ovelha ainda não foge nem se assusta de verdade: o balido de "chegou perto" é
  só um aviso. O susto é a **parte 6**.

## O que ainda **não** existe (de propósito)

Rebanho e susto — **P6**.
