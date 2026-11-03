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

A busca é feita uma vez por som e o resultado fica em cache: se você adicionar o
arquivo depois de abrir a página, recarregue (Ctrl+F5) para ouvir.

## O que enviar

- Formato: **ogg (Vorbis)** ou **wav** PCM. MP3 não é lido por esta ponte.
- Curtos: clique ≤ 150 ms, hover ≤ 60 ms. Sons longos atrasam a sensação de resposta.
- Mono, 44,1 kHz. O volume final vem do controle **Volume** nas opções.
- Minere o "clique" com um fade-out até o zero — um corte seco produz um estalo.

## Licença

Se você adicionar arquivos, eles passam a fazer parte do repositório: use sons
com licença compatível (CC0 é a mais simples) e registre a origem num
`CREDITS.md` nesta pasta. Sugestões de acervo CC0: Kenney (Interface Sounds,
Impact Sounds) e OpenGameArt.
