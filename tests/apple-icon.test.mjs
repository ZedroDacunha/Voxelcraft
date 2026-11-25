// A MAÇÃ — o ícone do item `Maçã` (world-catalog.js) e a arte que o atlas
// desenha (world-textures.js, `spritePixels('apple', 'food')`).
//
// Antes ela era um círculo perfeito de raio 4,5 com 2 px de brilho e uma folha
// de 2 px: lia como bola, não como maçã. Agora é pixel art desenhada na grade
// 16×16: dois lobos com a covinha no topo, cabinho em dois tons, folha diagonal
// em três tons grudada no cabinho, reflexo lustroso almofadado por meio-brilho
// e sombra curva em meia-lua de dois níveis (GUIA-DE-ARTE.md §5). Estes testes
// travam forma, rampa de luz/sombra e paleta.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createTextureTools } from '../world-textures.js';

/** Os pixels da maçã pela rota do atlas (o mesmo caminho do jogo). */
function maca() {
    globalThis.document = {
        createElement: () => ({
            width: 0, height: 0,
            getContext: () => ({ fillRect() {}, drawImage() {}, getImageData() { return { data: new Uint8ClampedArray(4) }; } }),
        }),
    };
    const THREE = {
        CanvasTexture: class { constructor(image) { this.image = image; } },
        NearestFilter: 1006, ClampToEdgeWrapping: 1001, SRGBColorSpace: 'srgb',
    };
    const px = createTextureTools(THREE).spritePixels('apple', 'food');
    delete globalThis.document;
    return px;
}

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test('a maçã é uma grade 16×16 com a paleta combinada', () => {
    const px = maca();
    assert.equal(px.length, 16, '16 linhas');
    for (const linha of px) assert.equal(linha.length, 16, '16 colunas');

    const cores = new Set(px.flat().filter(Boolean).map(c => c.join(',')));
    assert.deepEqual([...cores].sort(), [
        '96,16,26',     // O contorno vinho profundo
        '136,20,34',    // s sombra funda
        '172,28,39',    // 1 meia-sombra
        '208,42,44',    // 2 corpo
        '234,76,58',    // 3 luz quente
        '246,128,98',   // h meio-brilho
        '253,194,166',  // 4 brilho especular
        '98,60,26',     // T cabinho sombra
        '134,86,38',    // t cabinho luz
        '38,94,34',     // L folha sombra
        '66,142,52',    // m folha corpo
        '112,190,78',   // l folha luz
    ].sort(), 'doze cores na rampa completa');

    assert.ok(!cores.has('240,110,100'), 'sem o brilho de 2 px do círculo antigo');
});

test('a silhueta tem covinha sombreada, reflexo almofadado e sombra curva em meia-lua', () => {
    const px = maca();
    const em = (x, y) => px[y][x];

    // A covinha: o meio do topo (7,5) é vazio, com um lobo de cada lado e
    // meia-sombra logo abaixo (7,6) separando os dois lobos.
    assert.equal(em(7, 5), null, 'a covinha no topo é vazia');
    assert.deepEqual(em(4, 5), [96, 16, 26], 'lobo esquerdo');
    assert.deepEqual(em(8, 5), [96, 16, 26], 'lobo direito');
    assert.deepEqual(em(7, 6), [172, 28, 39], 'vinco sombreado da covinha');

    // Cabinho de madeira em dois tons saindo da covinha.
    assert.deepEqual(em(8, 2), [134, 86, 38], 'ponta iluminada do cabinho');
    assert.deepEqual(em(8, 4), [98, 60, 26], 'base sombreada do cabinho');
    assert.deepEqual(em(7, 4), [134, 86, 38], 'cabinho de 2 px na base');

    // Folha diagonal em três tons grudada no cabinho.
    assert.deepEqual(em(12, 1), [112, 190, 78], 'ponta iluminada da folha');
    assert.deepEqual(em(9, 3), [66, 142, 52], 'corpo da folha encostado no cabinho');
    assert.deepEqual(em(13, 3), [38, 94, 34], 'borda inferior escura da folha');

    // Brilho lustroso: não é quadrado colado no contorno — fica 1 px para
    // dentro (5,7 e 5,8), almofadado por meio-brilho e luz quente.
    assert.deepEqual(em(4, 6), [234, 76, 58], 'canto arredondado em luz quente, sem quadrado chapado');
    assert.deepEqual(em(5, 6), [246, 128, 98], 'halo de meio-brilho acima do reflexo');
    assert.deepEqual(em(4, 7), [246, 128, 98], 'halo de meio-brilho à esquerda do reflexo');
    assert.deepEqual(em(5, 7), [253, 194, 166], 'pico do brilho');
    assert.deepEqual(em(5, 8), [253, 194, 166], 'extensão oval do brilho');

    // Sombra curva em meia-lua: abraça a lateral direita E toda a base inferior.
    assert.deepEqual(em(7, 9), [208, 42, 44], 'corpo vermelho no centro');
    assert.deepEqual(em(10, 10), [172, 28, 39], 'meia-sombra fazendo a curva');
    assert.deepEqual(em(11, 12), [136, 20, 34], 'sombra funda na direita');
    assert.deepEqual(em(5, 13), [136, 20, 34], 'sombra funda abraçando a base esquerda');
    assert.deepEqual(em(10, 13), [136, 20, 34], 'sombra funda abraçando a base direita');
    assert.deepEqual(em(3, 6), [96, 16, 26], 'contorno esquerdo tingido');
});

test('a rampa da maçã sobe em luminância e puxa matiz frio na sombra e quente na luz', () => {
    const tons = {
        O: [96, 16, 26],
        s: [136, 20, 34],
        '1': [172, 28, 39],
        '2': [208, 42, 44],
        '3': [234, 76, 58],
        h: [246, 128, 98],
        '4': [253, 194, 166],
    };
    const ordem = ['O', 's', '1', '2', '3', 'h', '4'];
    for (let i = 1; i < ordem.length; i++) {
        assert.ok(lum(tons[ordem[i]]) > lum(tons[ordem[i - 1]]),
            `${ordem[i]} mais claro que ${ordem[i - 1]}`);
    }
    assert.ok(tons.O[0] + tons.O[1] + tons.O[2] > 60, 'contorno tingido, nunca preto puro');
    assert.ok(tons.s[2] > tons.s[1], 'sombra funda puxa para o vinho frio (B > G)');
    assert.ok(tons['3'][1] > tons['3'][2], 'luz puxa para o escarlate quente (G > B)');
});
