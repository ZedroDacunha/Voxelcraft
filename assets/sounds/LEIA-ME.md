# Sons do jogo (opcional)

O jogo **não precisa** de arquivos aqui: todo efeito é sintetizado em WebAudio
(`world-audio.js`). Esta pasta existe para você trocar o som de um efeito sem
mexer em código.

## Como trocar

Copie o arquivo com o nome exato do efeito. A cada clique/toque o jogo tenta
`assets/sounds/<nome>.ogg` e depois `assets/sounds/<nome>.wav`; se nenhum
existir, usa a síntese.

| Nome | Quando toca | Síntese atual |
| --- | --- | --- |
| `ui-click.ogg` / `.wav` | clique em qualquer botão (menu, diálogos, inventário) | triângulo 640→420 Hz, 80 ms |
| `ui-hover.ogg` / `.wav` | passada de mouse sobre um botão | seno 940→900 Hz, 35 ms |
| `step-grass.ogg` / `.wav` | passo em grama, folhas e grama alta | ruído 1900→800 Hz, 90 ms |
| `step-dirt.ogg` / `.wav` | passo em terra | ruído 1150→520 Hz, 100 ms |
| `step-stone.ogg` / `.wav` | passo em pedra, pedregulho, minérios e forno | ruído 3200→1500 Hz, 70 ms |
| `step-wood.ogg` / `.wav` | passo em madeira, tábuas, baú, bancada e portas | ruído 950→480 Hz com ressonância, 90 ms |
| `step-sand.ogg` / `.wav` | passo em areia | ruído 2600→2300 Hz, 120 ms |
| `break-*.ogg` / `.wav` | bloco quebrado (um por material: grass, dirt, stone, wood, sand) | ruído 0,11–0,18 s + baque grave |
| `hit-*.ogg` / `.wav` | batida de cada golpe enquanto minera (um por material) | ruído 0,04–0,06 s |
| `place-*.ogg` / `.wav` | bloco colocado (um por material) | ruído 0,05–0,08 s + baque curto |

A busca é feita uma vez por som e o resultado fica em cache: se você adicionar o
arquivo depois de abrir a página, recarregue (Ctrl+F5) para ouvir.

## O que enviar

- Formato: **ogg (Vorbis)** ou **wav** PCM. MP3 não é lido por esta ponte.
- Curtos: clique ≤ 150 ms, hover ≤ 60 ms, passo ≤ 150 ms, batida ≤ 70 ms,
  quebrar ≤ 200 ms. Sons longos atrasam a sensação de resposta.
- Mono, 44,1 kHz. O volume final vem do controle **Volume** nas opções.
- Minere o "clique" com um fade-out até o zero — um corte seco produz um estalo.

## Licença

Se você adicionar arquivos, eles passam a fazer parte do repositório: use sons
com licença compatível (CC0 é a mais simples) e registre a origem num
`CREDITS.md` nesta pasta. Sugestões de acervo CC0: Kenney (Interface Sounds,
Impact Sounds) e OpenGameArt.
