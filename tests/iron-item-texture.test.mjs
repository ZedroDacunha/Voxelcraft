// O ITEM de ferro bruto: a arte escolhida (opção E · grumos, espelhada).
//
// Segundo item de minério desenhado à mão (o primeiro foi o cobre bruto, no
// #111). Arte de item é 16×16 px com fundo transparente, 1 px por célula da
// máscara; o relevo é o mesmo do carvão: cima/esquerda acende, baixo/direita
// escurece.
//
// O ferro usa a mesma família de forma do cobre (quatro grumos), mas **não o
// mesmo desenho**: espelhado e com outros tamanhos, senão o jogador voltaria a
// ter dois itens iguais na barra — o problema que esta rodada existe para
// resolver. Quem separa de vez é a cor: pêssego claro contra laranja.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createMineralSpritePixels, rawItemMaskFor } from '../world-mineral-textures.js';

const MASCARA = rawItemMaskFor('iron');
const MASCARA_COBRE = rawItemMaskFor('copper');
const dentro = (x, y) => (MASCARA[y]?.[x] ?? '.') === '#';
const sprite = createMineralSpritePixels('raw', 'iron');
const cor = (x, y) => sprite[y][x];
const chave = c => c.join(',');
const brilho = c => (c[0] + c[1] + c[2]) / 3;
const saturacao = c => Math.max(...c) - Math.min(...c);

/** Cores da arte, escritas de propósito: o teste é a especificação. */
const PALETA = [[88, 64, 48], [160, 112, 80], [192, 152, 112], [224, 192, 152]];
const daPaleta = c => PALETA.some(p => chave(p) === chave(c));

const media = (px) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const linha of px) for (const c of linha) {
        if (!c) continue;
        r += c[0]; g += c[1]; b += c[2]; n++;
    }
    return [r / n, g / n, b / n];
};

function pedacos() {
    const vistos = new Set();
    const tamanhos = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!dentro(x, y) || vistos.has(`${x},${y}`)) continue;
        const pilha = [[x, y]];
        let tamanho = 0;
        vistos.add(`${x},${y}`);
        while (pilha.length) {
            const [cx, cy] = pilha.pop();
            tamanho++;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (!dentro(nx, ny) || vistos.has(`${nx},${ny}`)) continue;
                vistos.add(`${nx},${ny}`);
                pilha.push([nx, ny]);
            }
        }
        tamanhos.push(tamanho);
    }
    return tamanhos.sort((a, b) => b - a);
}

test('a máscara do item de ferro é 16×16, só com "#" e "."', () => {
    assert.ok(MASCARA, 'o ferro bruto precisa de uma máscara desenhada');
    assert.equal(MASCARA.length, 16, '16 linhas');
    for (const linha of MASCARA) {
        assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
        assert.match(linha, /^[.#]+$/, 'só "." (vazio) e "#" (ferro)');
    }
    const cheios = MASCARA.join('').split('').filter(c => c === '#').length;
    const cobertura = cheios / 256;
    assert.ok(cobertura > 0.27 && cobertura < 0.35, `cobertura ${(cobertura * 100).toFixed(0)}%`);
});

test('são grumos cheios, nenhum pixel solto', () => {
    const tamanhos = pedacos();
    assert.ok(tamanhos.length >= 4 && tamanhos.length <= 6, `grumos: ${tamanhos.length}`);
    assert.ok(tamanhos.every(t => t >= 8), 'nenhum grumo pequeno demais para ler o relevo');
    assert.ok(tamanhos[0] <= 22, `o maior grumo tem ${tamanhos[0]} px`);
    assert.ok(tamanhos[0] - tamanhos[tamanhos.length - 1] >= 4, 'os grumos têm tamanhos diferentes');
});

test('a arte de item é 1 px por célula, com fundo transparente', () => {
    assert.equal(sprite.length, 16, '16 linhas de pixels');
    for (let y = 0; y < 16; y++) {
        assert.equal(sprite[y].length, 16, `linha ${y} com 16 px`);
        for (let x = 0; x < 16; x++) {
            if (dentro(x, y)) assert.ok(cor(x, y), `(${x},${y}) é ferro e ficou vazio`);
            else assert.equal(cor(x, y), null, `(${x},${y}) está fora da máscara`);
        }
    }
});

test('o relevo acende em cima/esquerda e escurece embaixo/direita', () => {
    const usadas = new Set(sprite.flat().filter(Boolean).map(chave));
    assert.equal(usadas.size, 4, `a arte usa os quatro tons da paleta (tem ${usadas.size})`);
    for (const c of sprite.flat().filter(Boolean)) assert.ok(daPaleta(c), `cor fora da paleta: ${chave(c)}`);

    const tons = [...usadas].map(c => c.split(',').map(Number)).sort((a, b) => brilho(a) - brilho(b));
    const escuro = tons[0], claro = tons[tons.length - 1];

    let beiradasClaras = 0, beiradasEscuras = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!dentro(x, y)) continue;
        const c = cor(x, y);
        if (!dentro(x, y - 1) || !dentro(x - 1, y)) {
            beiradasClaras++;
            assert.equal(chave(c), chave(claro), `beirada de cima/esquerda clara em (${x},${y})`);
        } else if (!dentro(x, y + 1) || !dentro(x + 1, y)) {
            beiradasEscuras++;
            assert.equal(chave(c), chave(escuro), `beirada de baixo/direita escura em (${x},${y})`);
        }
    }
    assert.ok(beiradasClaras > 15, 'o grumo tem beirada clara');
    assert.ok(beiradasEscuras > 10, 'e beirada escura');
});

test('o item é ferro: pêssego, quente mas sem virar laranja', () => {
    const m = media(sprite);
    assert.ok(m[0] > m[1] && m[1] > m[2], `ferro esverdeado? ${m.map(v => v.toFixed(0)).join('/')}`);
    assert.ok(m[0] - m[2] > 55, `pouco quente: R−B = ${(m[0] - m[2]).toFixed(0)}`);
    assert.ok(m[0] > 150, `o ferro é claro o bastante (R = ${m[0].toFixed(0)})`);
});

test('o item de ferro não se confunde com o de cobre', () => {
    assert.ok(MASCARA_COBRE, 'o cobre já está feito');
    assert.notEqual(MASCARA.join(''), MASCARA_COBRE.join(''), 'as máscaras são diferentes');

    const ferro = media(sprite);
    const cobre = media(createMineralSpritePixels('raw', 'copper'));
    // Mais claro e menos saturado que o cobre: é o que separa os dois "laranjas".
    assert.ok(brilho(ferro) > brilho(cobre) + 10, `ferro ${brilho(ferro).toFixed(0)} × cobre ${brilho(cobre).toFixed(0)}`);
    assert.ok(saturacao(ferro) < saturacao(cobre) - 15, `ferro ${saturacao(ferro).toFixed(0)} × cobre ${saturacao(cobre).toFixed(0)}`);
    // E o desenho é outro, não o mesmo espelhado de leve: pelo menos uma dúzia
    // de pixels muda de lugar ou de cor.
    const cobreSprite = createMineralSpritePixels('raw', 'copper');
    assert.notEqual(JSON.stringify(sprite), JSON.stringify(cobreSprite));
    let diferentes = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const a = sprite[y][x], b = cobreSprite[y][x];
        if (chave(a ?? [0, 0, 0]) !== chave(b ?? [0, 0, 0])) diferentes++;
    }
    assert.ok(diferentes >= 12, `ferro e cobre diferem em ${diferentes} px`);
});

test('o ouro bruto ainda está no sprite genérico', () => {
    assert.equal(rawItemMaskFor('gold'), null, 'o ouro é o próximo da fila');
    const ouro = createMineralSpritePixels('raw', 'gold');
    assert.ok(ouro, 'o ouro bruto continua com sprite');
    assert.notEqual(JSON.stringify(ouro), JSON.stringify(sprite), 'ferro e ouro não são o mesmo desenho');
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    assert.deepEqual(createMineralSpritePixels('raw', 'iron'), sprite, 'duas chamadas dão a mesma arte');
    for (const linha of sprite) for (const c of linha) {
        if (!c) continue;
        assert.equal(c.length, 3, 'cor é [r,g,b]');
        for (const canal of c) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
    }
});
