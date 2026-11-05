# MELHORIA: o sol no menu

- **Data:** 05/11/2026 (depois do [menu com a luz do mundo](MELHORIA-20261104-menu-com-a-luz-do-mundo.md)
  e do [pó ao vento](MELHORIA-20261105-po-ao-vento.md))
- **Status:** implementado
- **Arquivos:** `menu-framing.js` (novo), `world-sky.js`, `menu-background.js`,
  `tests/menu-framing.test.mjs` (novo), `service-worker.js`, `README.md`,
  `TESTE-EM-NAVEGADOR.md`

## Por que

O sol **existia** no menu desde o PR #53: o céu do jogo (`world-sky.js`) é quem
desenha o panorama, e ele cria e posiciona a malha do sol. Só que ninguém nunca
via — por dois motivos somados:

1. **o sol ficava atrás da câmera.** O céu o coloca na direção
   `(cos, sen, 0,3)`, e a câmera do panorama abria num ângulo qualquer (`-0,1`),
   quase do lado oposto. Numa volta de 7,5 min ele passava pelo quadro, mas quem
   abre o jogo não espera 3 minutos para ver o sol;
2. **não havia céu para ele.** Com a ilha ocupando quase a tela inteira, sobrava
   uma tira de céu de ~5% no topo — nem um sol baixo cabia ali.

O que era "só" mostrar o sol virou uma decisão de **enquadramento**, e por isso
foi escolhido com desenho na mão.

## 1. A hora: fim de tarde

`MENU_SUN_TIME` foi de **0,06** (manhã, sol a ~20°) para **0,006** (fim de tarde,
sol a ~2°).

Não é gosto: com a câmera olhando a ilha de cima, o quadro só tem céu até uns 2°
acima da linha das árvores. Um sol alto é matematicamente invisível nesse
enquadramento — ou ele entra, ou a ilha sai.

Efeito colateral bem-vindo: o céu pega o laranja do poente (`warm` alto), a luz
fica dourada e o menu ganha uma hora do dia em vez de uma clarabóia.

## 2. O enquadramento: mais céu em cima

| | antes | agora |
| --- | --- | --- |
| altura da câmera | 18,5 | **14** |
| raio | 39 | **44** |
| alvo | y = 5 | **y = 13** |

Afastar, baixar e levantar o alvo faz a linha das árvores cair perto do meio do
quadro: a ilha continua sendo a dona da tela, mas agora **sobra céu** — e é nesse
céu que o sol cabe.

## 3. A câmera abre virada para o sol

`menuStartAngle()` devolve o azimute do sol mais meia volta (`atan2(z, x)`), e a
câmera começa exatamente ali. Sem isso, o sol estaria em cena — só que depois de
alguns minutos de giro.

O giro continua como era (uma volta a cada ~7,5 min): **o sol começa em quadro e
sai depois de alguns minutos**. Foi a escolha explícita do menu — girar normal é
mais honesto do que prender o sol na tela ou fazer a câmera ir e voltar.

## 4. A conta virou módulo

`menu-framing.js` guarda hora, enquadramento, ângulo inicial e **`sunOnScreen()`**,
que responde "o sol está no quadro?" para qualquer formato de tela. O módulo é
puro (sem `document`, sem WebGL), então o teste pergunta isso em 1920×1080,
1600×900, 1440×900, 4:3, ultrawide, celular em pé e deitado.

O `sunDirectionAt()` saiu de dentro do céu e virou função exportada: o menu
precisa da direção **antes** de desenhar, e o céu passou a usar a mesma função —
uma conta de sol, não duas.

| número | valor | por quê |
| --- | --- | --- |
| `MENU_SUN_TIME` | 0,006 | fim de tarde, sol a ~2° |
| `MENU_CAMERA` | 14 · 44 · 13 | altura, raio, alvo |
| `MENU_TURN_SPEED` | 0,000014 rad/ms | uma volta a cada ~7,5 min |
| `MENU_BOB` | 0,5 | respiração vertical da câmera |

## 5. O que **não** mudou

- **No jogo**, nada: `world-sky.js` só trocou a conta inline por `sunDirectionAt`
  (mesmo resultado, agora testável);
- a luz, o nevoeiro, as nuvens e as estrelas do menu continuam vindo do céu;
- com **movimento reduzido**, a câmera não gira e o sol fica parado em cena;
- o `menu-panorama.svg` (imagem de reserva para quando não há WebGL) **não** tem
  sol — ele é um retrato estático antigo, e continua servindo de reserva.

## Testes

**645 → 655.**

- `sunDirectionAt`: unitária em várias horas, sol no horizonte na hora 0, a pino
  em 0,25, abaixo em 0,75, e preenchendo um alvo sem alocar por quadro;
- a hora do menu é fim de tarde (0 < elevação < 0,1);
- a câmera abre virada para o sol (produto escalar > 0,999) e no raio certo;
- `sunOnScreen` marca **visível** nos sete formatos de tela testados, com o sol
  centralizado na horizontal e na metade de cima;
- o enquadramento **antigo** deixa o sol fora — o teste guarda o motivo da
  mudança, para ninguém "consertar" o enquadramento de volta;
- girando, o sol sai de quadro em dezenas de segundos (não é bug nem instantâneo);
- com movimento reduzido, nunca sai;
- e o `menu-background.js` usa a hora e a câmera deste módulo (leitura do fonte).

## Como conferir no jogo

Item **12** novo em `TESTE-EM-NAVEGADOR.md`.
