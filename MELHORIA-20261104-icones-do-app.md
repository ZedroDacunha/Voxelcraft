# MELHORIA: revisão dos ícones do app

- **Data:** 04/11/2026 (terceira leva do PWA; antes, [instalar + abrir offline](MELHORIA-20261104-pwa.md) e [offline de verdade](MELHORIA-20261104-pwa-offline-de-verdade.md))
- **Status:** implementado
- **Arquivos:** `tools/make-icons.mjs` (desenho reescrito), `icons/` (5 PNGs),
  `index.html` (link do iOS), `service-worker.js` (casca mínima),
  `tests/icons.test.mjs` (novo), `tests/helpers/png.mjs` (novo), `README.md`

## O que estava errado

Os ícones existiam e tinham o tamanho certo — o que faltava era olhar para o que
cada tela faz com eles:

1. **O iPhone pintava um quadrado preto atrás do bloco.** O `apple-touch-icon`
   apontava para o `icon-192.png`, que é **transparente**. O iOS não respeita
   alpha em ícone de tela de início: pixel transparente vira **preto**.
2. **A lateral do bloco era quase toda grama.** A faixa verde das faces laterais
   ocupava metade do bloco; um bloco de grama tem uma faixa fina em cima e terra
   embaixo. O ícone lia como "caixa verde", não como bloco.
3. **O favicon tinha textura fina.** Em 16–32 px o ruído de pixel vira sujeira.
4. **O maskable estava tímido** e ninguém conferia o círculo seguro de verdade: a
   única checagem era "tem 512 de lado".

## O que mudou

### O desenho (`tools/make-icons.mjs`)

- **Faixa de grama de verdade** nas laterais: 30% da face (com a borda irregular,
  que é o que dá a cara do bloco) e terra embaixo, com a face da direita mais
  escura — a luz vem da esquerda.
- **Três formatos, porque cada tela recorta de um jeito:**
  | Arquivo | Lado | Fundo | Por quê |
  | --- | --- | --- | --- |
  | `icon-192.png` / `icon-512.png` | 192 / 512 | transparente | janela, dock e lista de apps do desktop |
  | `icon-maskable-512.png` | 512 | céu | Android recorta em círculo/gota: o bloco fica dentro do círculo de 80% |
  | `apple-touch-icon-180.png` | 180 | céu, **opaco** | iOS pinta transparência de preto e arredonda os cantos |
  | `favicon-32.png` | 32 | transparente, **chapado** | 16 px não perdoa textura |
- O gerador virou importável (`renderIcon`, `ICON_TARGETS`) sem rodar nada ao
  ser importado: dá para testar o desenho, não só o arquivo.

### Os testes olham os pixels (`tests/icons.test.mjs` + `tests/helpers/png.mjs`)

Um decodificador de PNG de ~50 linhas (zlib da biblioteca padrão; o projeto só
gera RGBA 8 bits com filtro 0) permite conferir o que os arquivos realmente
mostram:

- a pasta `icons/` tem **exatamente** os arquivos que o gerador escreve (nada de
  PNG editado à mão envelhecendo ao lado);
- cada ícone do manifest tem o tamanho anunciado;
- **maskable**: fora do círculo seguro de 80% não existe nada além do céu — é o
  teste que pega o bloco fatiado no launcher antes do jogador pegar;
- **maskable**: nenhum pixel transparente (buraco no recorte);
- **iOS**: 180×180, **todo pixel opaco** e o bloco dentro do miolo arredondado;
- todo ícone mostra o bloco: verde em cima, terra embaixo;
- **favicon**: no máximo 6 cores (é chapado) e o bloco cabe no quadro;
- o gerador é determinístico (mesmo desenho toda vez).

## Validação

```bash
node tools/make-icons.mjs   # regera os 5 PNGs
npm test                    # 541 testes
npm run check               # sintaxe + importmap em dia
```

**Conferir no aparelho** (o sandbox não abre navegador): no Android, instalar e
ver o ícone no launcher nos dois formatos de recorte (círculo e quadrado);
no iPhone, "Adicionar à Tela de Início" e confirmar que **não** aparece fundo
preto; na aba do navegador, o favicon em 16 px.

## O que sobrou do PWA

- **Roteiro de teste em navegador real** (instalação, offline e atualização num
  Chrome e num iPhone de verdade).
