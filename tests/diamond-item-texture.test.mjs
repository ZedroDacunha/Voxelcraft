// O ITEM de diamante: a arte escolhida (opção C · lasca).
//
// O diamante não é minério bruto: é **gema**, e a arte dele é de cristal — uma
// lasca grande atravessada na diagonal, a mesma ideia dos estilhaços do veio no
// bloco. Arte de item: 16×16 px com fundo transparente, 1 px por célula.
//
// É o único item com **brilho**: a estrela (`*` na máscara) pinta um pixel de
// branco-gelo que nenhum outro item tem.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createMineralSpritePixels, gemItemMaskFor, rawItemMaskFor, coalItemMaskFor } from '../world-mineral-textures.js';

const MASCARA = gemItemMaskFor('diamond');
const dentro = (x, y) => ['#', '*'].includes(MASCARA[y]?.[x] ?? '.');
const estrela = (x, y) => MASCARA[y]?.[x] === '*';
const sprite = createMineralSpritePixels('gem', 'diamond');
const cor = (x, y) => sprite[y][x];
const chave = c => c.join(',');
const brilhoDe = c => (c[0] + c[1] + c[2]) / 3;

/** Cores da arte, escritas de propósito: o teste é a especificação. */
const PALETA = [[24, 88, 112], [48, 152, 176], [80, 196, 216], [136, 232, 240], [216, 253, 255]];
const ESCURO = PALETA[0], CLARO = PALETA[3], BRILHO = PALETA[4];
const daPaleta = c => PALETA.some(p => chave(p) === chave(c));

const media = (px) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const linha of px) for (const c of linha) {
        if (!c) continue;
        r += c[0]; g += c[1]; b += c[2]; n++;
    }
    return [r / n, g / n, b / n];
};

test('a máscara do diamante é 16×16, só com "#", "*" e "."', () => {
    assert.ok(MASCARA, 'o diamante precisa de uma máscara desenhada');
    assert.equal(MASCARA.length, 16, '16 linhas');
    for (const linha of MASCARA) {
        assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
        assert.match(linha, /^[#*.]+$/, 'só "." (vazio), "#" (diamante) e "*" (brilho)');
    }
    const cheios = MASCARA.join('').split('').filter(c => c === '#' || c === '*').length;
    const cobertura = cheios / 256;
    assert.ok(cobertura > 0.17 && cobertura < 0.24, `cobertura ${(cobertura * 100).toFixed(0)}%`);
});

test('é uma lasca só, com uma estrela de brilho', () => {
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
    assert.equal(tamanhos.length, 1, `a lasca precisa ser uma peça só (tem ${tamanhos.length})`);
    assert.ok(tamanhos[0] >= 40 && tamanhos[0] <= 60, `a lasca tem ${tamanhos[0]} px`);

    const estrelas = MASCARA.join('').split('').filter(c => c === '*').length;
    assert.ok(estrelas >= 1 && estrelas <= 2, `a lasca tem ${estrelas} px de brilho`);
});

test('a arte de item é 1 px por célula, com fundo transparente', () => {
    assert.equal(sprite.length, 16, '16 linhas de pixels');
    for (let y = 0; y < 16; y++) {
        assert.equal(sprite[y].length, 16, `linha ${y} com 16 px`);
        for (let x = 0; x < 16; x++) {
            if (dentro(x, y)) assert.ok(cor(x, y), `(${x},${y}) é diamante e ficou vazio`);
            else assert.equal(cor(x, y), null, `(${x},${y}) está fora da máscara`);
        }
    }
});

test('o relevo acende em cima/esquerda, escurece embaixo/direita e a estrela brilha', () => {
    const usadas = new Set(sprite.flat().filter(Boolean).map(chave));
    assert.equal(usadas.size, 5, `a arte usa os cinco tons (tem ${usadas.size})`);
    for (const c of sprite.flat().filter(Boolean)) assert.ok(daPaleta(c), `cor fora da paleta: ${chave(c)}`);

    let beiradasClaras = 0, beiradasEscuras = 0, brilhos = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!dentro(x, y)) continue;
        const c = cor(x, y);
        if (estrela(x, y)) {
            brilhos++;
            assert.equal(chave(c), chave(BRILHO), `a estrela em (${x},${y}) é o branco do brilho`);
            assert.ok(brilhoDe(c) > brilhoDe(CLARO), 'o brilho é mais claro que qualquer tom da pedra');
        } else if (!dentro(x, y - 1) || !dentro(x - 1, y)) {
            beiradasClaras++;
            assert.equal(chave(c), chave(CLARO), `beirada de cima/esquerda clara em (${x},${y})`);
        } else if (!dentro(x, y + 1) || !dentro(x + 1, y)) {
            beiradasEscuras++;
            assert.equal(chave(c), chave(ESCURO), `beirada de baixo/direita escura em (${x},${y})`);
        }
    }
    assert.ok(beiradasClaras > 10, 'a lasca tem beirada clara');
    // A lasca é fina e diagonal: quase toda ela é beirada, e o lado escuro
    // (baixo/direita) é menor que o claro — por isso o piso é mais baixo que nos
    // grumos dos brutos.
    assert.ok(beiradasEscuras >= 8, `e beirada escura (${beiradasEscuras} px)`);
    assert.equal(brilhos, MASCARA.join('').split('').filter(c => c === '*').length, 'todo "*" virou brilho');
});

test('o item é diamante: ciano-gelo, o único item frio', () => {
    const m = media(sprite);
    assert.ok(m[2] > m[1] && m[1] > m[0], `diamante fora do ciano? ${m.map(v => v.toFixed(0)).join('/')}`);
    assert.ok(m[2] - m[0] > 90, `pouco azul: B−R = ${(m[2] - m[0]).toFixed(0)}`);

    // Todos os outros brutos são quentes (R acima de B). O diamante é o oposto.
    for (const material of ['copper', 'iron', 'gold']) {
        const outro = media(createMineralSpritePixels('raw', material));
        assert.ok(outro[0] > outro[2], `${material} é quente`);
        // Azul do diamante contra o azul do outro: ouro e cobre ficam bem
        // abaixo de zero, o diamante bem acima.
        assert.ok(m[2] - m[0] > (outro[2] - outro[0]) + 80,
            `diamante ${(m[2] - m[0]).toFixed(0)} × ${material} ${(outro[2] - outro[0]).toFixed(0)}`);
    }
});

test('o diamante não é minério bruto: a arte dele vive no mapa das gemas', () => {
    assert.equal(rawItemMaskFor('diamond'), null, 'diamante não é `raw`');
    assert.ok(gemItemMaskFor('diamond'), 'a gema tem máscara própria');
    assert.ok(rawItemMaskFor('gold'), 'e o ouro bruto continua no mapa dos brutos');
    assert.equal(gemItemMaskFor('gold'), null, 'ouro não é gema');
});

test('as cinco artes de item (carvão, cobre, ferro, ouro, diamante) são diferentes', () => {
    const desenhos = new Set([
        MASCARA.join(''),
        coalItemMaskFor('mineral').join(''),
        rawItemMaskFor('copper').join(''),
        rawItemMaskFor('iron').join(''),
        rawItemMaskFor('gold').join(''),
    ]);
    assert.equal(desenhos.size, 5, 'nenhuma máscara repetida entre os itens');
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    assert.deepEqual(createMineralSpritePixels('gem', 'diamond'), sprite, 'duas chamadas dão a mesma arte');
    for (const linha of sprite) for (const c of linha) {
        if (!c) continue;
        assert.equal(c.length, 3, 'cor é [r,g,b]');
        for (const canal of c) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
    }
});
