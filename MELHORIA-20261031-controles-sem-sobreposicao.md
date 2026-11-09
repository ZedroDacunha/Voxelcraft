# Controles móveis sem sobreposição

- Em Opções → Controles → Controles de toque → Editar posições, o controle não entra em outro controle: fica na última posição válida e aparece aviso com destaque vermelho. O retângulo externo do joystick conta como área ocupada (conservador). Um segundo dedo não assume o arrasto.
- Posições antigas já sobrepostas podem ser movidas para reduzir ou remover o conflito. A área segura do aparelho é respeitada.
- Ao abrir o jogo ou mudar orientação/tamanho, tenta-se reposicionar temporariamente controles conflitantes nas posições livres mais próximas, na ordem das peças. Não altera as preferências gravadas. Se não encontrar espaço, mantém o que couber e avisa; não é uma garantia para telas muito pequenas ou com controles muito grandes. A hotbar continua seguindo sua regra existente.
- Cada posição arrastada segue sendo salva como percentual da tela; Restaurar continua disponível. Mudanças na tela podem ajustar visualmente o layout até que haja espaço novamente.

## Teste manual pendente
1. Abrir a edição, arrastar cada botão em direção ao joystick e outros botões: conferir aviso, destaque, impossibilidade de sobrepor e que Pronto salva apenas posição válida.
2. Criar posições personalizadas, girar o celular e alterar escala, incluindo destro/canhoto: conferir separação temporária, áreas seguras, hotbar e recuperação das posições ao voltar ao tamanho original.
3. Testar tela pequena, escala máxima, layout antigo sobreposto, botão Restaurar e multitouch. Se faltar espaço conferir o aviso e reduzir ou mover controles.
4. Verificar Android/iPhone e testar uso real em paisagem/retrato. A ilustração `tools/controles-sem-sobreposicao.html` não é captura de tela.
