# MELHORIA: a morte — o corpo tomba antes de sumir

- **Data:** 06/11/2026
- **Status:** implementado
- **Arquivos principais:** `world-creature-base.js`, `world-creature.js`, `world-sheep.js`, `tests/dying.test.mjs`, `tests/mob-hit.test.mjs`, `tests/creature.test.mjs`

## A escolha (feita antes de codar)

O pacote **D** do menu da morte: o bicho **tomba e some** em vez de desaparecer no ar.

| Antes | Depois |
| --- | --- |
| no golpe fatal o bicho era arrancado do mundo **no mesmo quadro** — sumia no ar, sem tombar | o corpo **cai de lado** (giro em Z até 90°), fica caído e **encolhe até sumir** em 0,8 s; só então sai do mundo |
| os itens caíam junto com a morte instantânea | os itens continuam caindo **no golpe** (com o corpo ainda no chão) |
| — | quem está caindo **não é alvo**, **não lidera** o bando e **não ocupa lugar** no rebanho |

## Como ficou

### A conta é pura: `dyingPoseFor(t)`

```js
export const DYING_TIME = 0.8;   // a queda inteira
export const DYING_TIP  = 0.45;  // fração gasta só para tombar
export const DYING_FADE = 0.2;   // fração final em que o corpo encolhe

dyingPoseFor(t, { time, tip, fade, side })
// → { roll, scale, progress, done }
```

| Peça | Conta | Efeito na tela |
| --- | --- | --- |
| `roll` | `side · (π/2) · (1 − (1 − p/tip)²)` | **tumba rápido e assenta** (acelera, não é reta) e nunca passa de 90° |
| `scale` | `1` até `1 − fade`; depois `(1 − p) / fade`, com piso **0,02** | inteiro enquanto cai; no fim **encolhe até sumir** (nunca escala zero, que estoura a matriz) |
| `done` | `t ≥ time` | avisa que já pode sair do mundo |
| `side` | `id` par → `+1`, ímpar → `−1` | cada corpo cai para o seu lado |

### Quem cai

| Peça | Onde | O que faz |
| --- | --- | --- |
| `startDying(e, at)` | base | marca `dying`, zera `dieT`, grava o lado e **desarma** fuga, susto, pasto e recuo; devolve `false` se já estava caindo |
| `stepDying(e, dt)` | base | avança `dieT` e, no fim, chama `removeEntity` — quem chama só desenha |

No jogo, `hitAt` (ovelha) e `hitFrom` (Mofim) chamam `startDying` **e** o `onDeath`
no golpe fatal: o pó, a lã e a carne saem na hora, com o corpo ainda de pé.
Os `update` desenham `rotation.z`, `scale` e a posição do corpo caído, e dão
`continue` — pasto, susto, passo e voo ficam de fora.

### Caindo não conta mais

| Regra | Por que |
| --- | --- |
| `creatureInReach` ignora `dying` | bater num corpo caído roubaria o quadro da mineração sem acertar nada — e o `onDeath` (itens) não repete |
| `herdLeaderOf` ignora `dying` | a líder caída passa o comando para a companheira mais antiga |
| `countNear` ignora `dying` | o chão do cadáver fica livre para quem for nascer ali |

### Detalhes que o olho pega

- o **clarão do golpe continua apagando** durante a queda (congelado, o cadáver
  ficaria aceso os 0,8 s inteiros);
- a **lanterna** do Mofim encolhe junto com o corpo, e olhos/`lightPulse` apagam;
- longe demais do jogador o despawn continua mandando: o cadáver sai na hora (não
  se vê);
- ao amanhecer, o Mofim caindo **não** foge voando: a queda manda até o fim.

## Provas

- **964** testes na suíte (14 novos em `dying`, 12 em `mob-hit`, 75 em `creature`).
- `tests/dying.test.mjs` — 14 testes:
  - **a curva**: começa em pé e termina deitado (giro de 90°), o giro nunca
    recua, tomba mais da metade no meio do tombo, encolhe só na cauda e nunca
    chega a escala zero, o lado espelha o giro, `done` só no fim;
  - **o corpo**: a ovelha abatida fica no mundo e na cena, tombando no lugar sem
    andar; no meio da queda está deitada e inteira; não some antes da hora e sai
    no fim (uma vez só); a queda dura `DYING_TIME` de mundo;
  - **a mira**: um corpo caído já não é alvo (nem gasta golpe, nem reinicia a
    queda);
  - **o rebanho**: quem cai não lidera (outra assume) nem ocupa lugar
    (`countNear` = 0);
  - **o Mofim**: tomba igual, não anda/foge/grita caindo, e sai uma vez só;
  - **o desenho**: o clarão apaga com o corpo e a lanterna encolhe;
  - **uma morte só**: o segundo golpe num corpo caído devolve `null` e não solta
    item de novo.
- Ajustes: os dois testes antigos que exigiam o sumiço no quadro do golpe agora
  medem `dying` e depois correm ~1 s de quadros até a saída.
- **Prova de força** (18 mutações, todas derrubam teste):

| Mutação | Testes que quebram |
| --- | --- |
| tomba de uma vez (giro 90° desde o começo) | 3 (dying) |
| corpo parado de pé (giro 0) | 6 |
| some no golpe (sai sem cair) | 5 |
| queda sem `removeEntity` (corpo eterno) | 5 |
| queda que nunca termina (`done` sempre falso) | 7 |
| encolhe desde o começo | 3 |
| escala zero no fim (estoura a matriz) | 1 |
| queda reinicia a cada golpe | 5 |
| caindo ainda é alvo do golpe | 1 |
| caindo ainda lidera o bando | 1 |
| caindo ainda ocupa lugar (`countNear`) | 1 |
| a ovelha some no golpe (`update` sem o ramo) | 1 |
| o Mofim some no golpe (`update` sem o ramo) | 5 |
| a queda não desenha a escala | 4 |
| o Mofim caído não desenha o giro | 4 |
| clarão congelado na ovelha caída | 1 |
| clarão congelado no Mofim caído | 2 |
| lanterna do Mofim caído fica acesa | 2 |

## Roteiro de teste

Em [`TESTE-EM-NAVEGADOR.md`](TESTE-EM-NAVEGADOR.md), seção 37.
