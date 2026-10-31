# BUG: iluminação de fronteira apagava ao recalcular chunk vizinho

- **Data:** 31/10/2026
- **Status:** corrigido
- **Arquivos principais:** `world-light-region.js`, `game.js`

## Sintoma

Uma tocha em um chunk podia iluminar a borda do chunk vizinho. Quando outro
chunk próximo era recalculado, essa contribuição desaparecia, criando manchas
escuras perto de divisas de chunk mesmo com a tocha ainda colocada.

Reprodução da auditoria:

- Tocha em `x=32, y=60, z=0`.
- Célula de fronteira em `x=31, y=60, z=0`.
- Antes de recalcular o chunk vizinho: `blockLight=13`.
- Depois: `blockLight=0`, embora a tocha continuasse existindo.

## Causa

`rebuildSkyLight()` zerava e propagava luz de blocos apenas em um anel 3×3 de
chunks. Emissores fora desse anel, mas ainda dentro do alcance da luz, não eram
considerados como fonte ao reconstruir a região.

## Correção

- `world-light-region.js` calcula a região alvo e um halo externo baseado no
  alcance máximo da luz e no tamanho do chunk.
- A luz de blocos passa a usar o halo quando existe emissor externo capaz de
  alcançar a região alvo.
- Quando não há emissor externo, a propagação continua usando apenas o anel
  imediato, evitando custo extra desnecessário.
- A luz do céu continua sendo reconstruída na região alvo imediata.
- O modo debug ganhou `lightAt()` e `rebuildLight()` para verificar iluminação
  sem depender de leitura visual da malha.

## Validação

```bash
node --test tests/*.test.mjs
node tools/stamp-importmap.mjs --check
git diff --check
```

Resultado: 103 testes aprovados.

Verificação em navegador headless:

| Momento | `blockLight` em `x=31, y=60, z=0` |
| --- | ---: |
| depois de calcular a luz da tocha | 13 |
| depois de recalcular o chunk vizinho | 13 |
| depois de remover a tocha e recalcular | 0 |

A tocha permaneceu no mundo durante o recalculo (`sourceStillThere=true`) e
nenhum erro de página foi registrado.
