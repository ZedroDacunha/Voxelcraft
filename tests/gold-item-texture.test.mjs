// O ITEM de ouro bruto: a arte escolhida (opção B · pepitas).
//
// Terceiro item de minério desenhado à mão (carvão, cobre bruto, ferro bruto).
// Arte de item é 16×16 px com fundo transparente, 1 px por célula da máscara; o
// relevo é o mesmo dos outros: cima/esquerda acende, baixo/direita escurece.
//
// O ouro é o mais claro e o mais amarelo dos brutos, e a forma segue o veio do
// bloco: pepitas soltas, nem o punhado cheio do carvão nem os grumos do cobre e
// do ferro.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createMineralSpritePixels, rawItemMaskFor, coalItemMaskFor } from '../world-mineral-textures.js';

const MASCARA = rawItemMaskFor('gold');
const MASCARA_COBRE = rawItemMaskFor('copper');
const MASCARA_FERRO = rawItemMaskFor('iron');
const MASCARA_CARVAO = coalItemMaskFor('mineral');
const dentro = (x, y) => (MASCARA[y]?.[x] ?? '.') === '#';
const sprite = createMineralSpritePixels('raw', 'gold');
const cor = (x, y) => sprite[y][x];
const chave = c => c.join(',');
const brilho = c => (c[0] + c[1] + c[2]) / 3;
const saturacao = c => Math.max(...c) - Math.min(...c);

/** Cores da arte, escritas de propósito: o teste é a especificação. */
const PALETA = [[152, 104, 24], [200, 144, 24], [232, 184, 40], [248, 216, 96]];
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

test('a máscara do item de ouro é 16×16, só com "#" e "."', () => {
    assert.ok(MASCARA, 'o ouro bruto precisa de uma máscara desenhada');
    assert.equal(MASCARA.length, 16, '16 linhas');
    for (const linha of MASCARA) {
        assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
        assert.match(linha, /^[.#]+$/, 'só "." (vazio) e "#" (ouro)');
    }
    const cheios = MASCARA.join('').split('').filter(c => c === '#').length;
    const cobertura = cheios / 256;
    assert.ok(cobertura > 0.27 && cobertura < 0.32, `cobertura ${(cobertura * 100).toFixed(0)}%`);
});

test('são pepitas: muitas peças pequenas e nenhuma migalha', () => {
    const tamanhos = pedacos();
    assert.ok(tamanhos.length >= 6 && tamanhos.length <= 10, `pepitas: ${tamanhos.length}`);
    assert.ok(tamanhos.every(t => t >= 6), 'nenhuma pepita de 1–5 px (viraria sujeira no ícone)');
    assert.ok(tamanhos[0] <= 14, `a maior pepita tem ${tamanhos[0]} px`);
    assert.ok(tamanhos[0] - tamanhos[tamanhos.length - 1] >= 2, 'as pepitas não são todas do mesmo tamanho');
});

test('a arte de item é 1 px por célula, com fundo transparente', () => {
    assert.equal(sprite.length, 16, '16 linhas de pixels');
    for (let y = 0; y < 16; y++) {
        assert.equal(sprite[y].length, 16, `linha ${y} com 16 px`);
        for (let x = 0; x < 16; x++) {
            if (dentro(x, y)) assert.ok(cor(x, y), `(${x},${y}) é ouro e ficou vazio`);
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
    assert.ok(beiradasClaras > 20, 'as pepitas têm beirada clara');
    assert.ok(beiradasEscuras > 15, 'e beirada escura');
});

test('o item é ouro: amarelo de verdade, o mais claro dos brutos', () => {
    const m = media(sprite);
    assert.ok(m[0] > m[1] && m[1] > m[2], `ouro fora do amarelo? ${m.map(v => v.toFixed(0)).join('/')}`);
    assert.ok(m[1] > 150, `o verde tem de subir para virar amarelo (G = ${m[1].toFixed(0)})`);
    assert.ok(m[0] - m[2] > 100, `pouco amarelo: R−B = ${(m[0] - m[2]).toFixed(0)}`);
    assert.ok(brilho(m) > 150, `o ouro é claro (${brilho(m).toFixed(0)})`);
});

test('o item de ouro não se confunde com o de cobre nem com o de ferro', () => {
    const ouro = media(sprite);
    for (const [nome, outra] of [['cobre', MASCARA_COBRE], ['ferro', MASCARA_FERRO]]) {
        assert.ok(outra, `${nome} já tem arte`);
        assert.notEqual(MASCARA.join(''), outra.join(''), `máscaras do ouro e do ${nome} são diferentes`);
        const m = media(createMineralSpritePixels('raw', nome === 'cobre' ? 'copper' : 'iron'));
        // Ouro é o mais claro e o mais amarelo dos três. A claridade sozinha
        // não separa muito (o ferro já é um pêssego claro) — quem faz o serviço
        // é o amarelo, o R−B logo abaixo.
        assert.ok(brilho(ouro) > brilho(m) + 6, `ouro ${brilho(ouro).toFixed(0)} × ${nome} ${brilho(m).toFixed(0)}`);
        assert.ok(ouro[0] - ouro[2] > (m[0] - m[2]) + 30, `R−B do ouro ${(ouro[0] - ouro[2]).toFixed(0)} × ${nome} ${(m[0] - m[2]).toFixed(0)}`);
        assert.ok(saturacao(ouro) > saturacao(m) - 10, `o ouro não perde saturação para o ${nome}`);
    }
});

test('as quatro artes de item (carvão, cobre, ferro, ouro) são diferentes', () => {
    const desenhos = new Set([
        MASCARA.join(''), MASCARA_CARVAO.join(''), MASCARA_COBRE.join(''), MASCARA_FERRO.join(''),
    ]);
    assert.equal(desenhos.size, 4, 'nenhuma máscara repetida entre os itens de minério');
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    assert.deepEqual(createMineralSpritePixels('raw', 'gold'), sprite, 'duas chamadas dão a mesma arte');
    for (const linha of sprite) for (const c of linha) {
        if (!c) continue;
        assert.equal(c.length, 3, 'cor é [r,g,b]');
        for (const canal of c) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
    }
});
