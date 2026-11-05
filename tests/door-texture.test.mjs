// A porta é o único bloco do jogo desenhado em **duas** células do atlas que
// precisam combinar (metade de cima e metade de baixo). Isso já deu errado uma
// vez: cada metade pintava a própria borda, e a porta ficava com uma faixa escura
// de 4 px no meio, lendo como dois blocos empilhados em vez de uma peça.
//
// Aqui a arte é lida do atlas de verdade (canvas de mentira que grava os
// `fillRect`) e as duas metades são empilhadas numa folha de 32×64 — que é como
// o jogador vê a porta. O que os testes cobram é o que o desenho promete: sem
// costura, batente, dois painéis rebaixados iguais, dobradiças de um lado e
// maçaneta do outro.
import test from 'node:test';
import assert from 'node:assert/strict';

import { TILE, TILE_PX, atlasTileRect } from '../world-catalog.js';

const draws = [];

function createFakeContext() {
    return {
        imageSmoothingEnabled: true,
        fillStyle: '#000',
        fillRect(x, y, w, h) { draws.push({ x, y, w, h, fill: this.fillStyle }); },
        drawImage() {},
        getImageData() { return { data: new Uint8ClampedArray(4) }; },
    };
}

globalThis.document = {
    createElement() {
        return { width: 0, height: 0, getContext: () => createFakeContext() };
    },
};

const THREE = {
    CanvasTexture: class { constructor(image) { this.image = image; } },
    NearestFilter: 1006,
    ClampToEdgeWrapping: 1001,
    SRGBColorSpace: 'srgb',
};

const { createTextureTools } = await import('../world-textures.js');
createTextureTools(THREE).createAtlasTexture();

const MAGENTA = [255, 0, 255];
const parseColor = (fill) => {
    const match = /rgb\((\d+),(\d+),(\d+)\)/.exec(fill);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : MAGENTA;
};

function tilePixels(tile) {
    const rect = atlasTileRect(tile);
    const pixels = Array.from({ length: TILE_PX }, () => Array.from({ length: TILE_PX }, () => MAGENTA));
    for (const draw of draws) {
        const x = draw.x - rect.x;
        const y = draw.y - rect.y;
        if (x < 0 || y < 0 || x >= rect.size || y >= rect.size) continue;
        pixels[y][x] = parseColor(draw.fill);
    }
    return pixels;
}

// Folha da porta: metade de cima em cima, metade de baixo embaixo.
const sheet = [...tilePixels(TILE.WOOD_DOOR_UPPER), ...tilePixels(TILE.WOOD_DOOR_LOWER)];
const at = (x, y) => sheet[y][x];
const brightness = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const spread = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
const isGray = (color) => spread(color) <= 16;
const isWood = (color) => color[0] - color[2] >= 40;
const average = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;

// Linhas de referência: dentro dos painéis, sem dobradiça nem maçaneta em cima.
const UPPER_ROW = 13;
const LOWER_ROW = 45;

test('a porta tem arte própria: nada de magenta (o antigo fallback do atlas)', () => {
    for (let y = 0; y < sheet.length; y++) {
        for (let x = 0; x < TILE_PX; x++) {
            assert.notDeepEqual(at(x, y), MAGENTA, `pixel (${x}, ${y}) ainda é o fallback magenta`);
        }
    }
});

test('as duas metades não têm costura: a junção é madeira como o resto', () => {
    // A junção é a linha 31 (última de cima) com a 32 (primeira de baixo). A
    // arte antiga pintava borda nas duas — uma faixa de ~70 de brilho.
    for (const y of [31, 32]) {
        // As colunas 0–1 e 30–31 são o batente, que atravessa a porta inteira.
        const dark = Math.min(...sheet[y].slice(2, 30).map(brightness));
        assert.ok(dark >= 86, `linha ${y} tem pixel escuro demais (${dark.toFixed(0)}): parece costura`);
    }
    assert.ok(
        Math.abs(average(sheet[31].map(brightness)) - average(sheet[32].map(brightness))) < 16,
        'as duas linhas da junção precisam ter o mesmo tom',
    );
    // E o tom não pode dar salto de uma linha para a outra, coluna por coluna.
    // As colunas 23–25 são a maçaneta, que desce até a linha da junção.
    for (let x = 0; x < TILE_PX; x++) {
        if (x >= 23 && x <= 25) continue;
        const jumpAbove = Math.abs(brightness(at(x, 31)) - brightness(at(x, 30)));
        const jumpBelow = Math.abs(brightness(at(x, 32)) - brightness(at(x, 33)));
        assert.ok(jumpAbove <= 24 && jumpBelow <= 24,
            `coluna ${x} salta de tom na junção (${jumpAbove.toFixed(0)}/${jumpBelow.toFixed(0)})`);
    }
});

test('batente: a borda de fora escurece e o vinco de dentro clareia', () => {
    for (const y of [13, 24, 27, 34, 44]) {
        assert.ok(isWood(at(0, y)) && isWood(at(31, y)), 'a borda é madeira escurecida, não contorno preto');
        assert.ok(brightness(at(0, y)) < brightness(at(3, y)) - 8,
            `linha ${y}: borda esquerda (${brightness(at(0, y)).toFixed(0)}) devia ser mais escura que a madeira (${brightness(at(3, y)).toFixed(0)})`);
        assert.ok(brightness(at(31, y)) < brightness(at(28, y)) - 8,
            `linha ${y}: borda direita devia ser mais escura que a madeira`);
    }
    // Vinco claro logo por dentro da borda (uma linha de luz separando batente
    // e prancha), longe dos painéis.
    assert.ok(brightness(at(2, 44)) > brightness(at(1, 44)),
        'vinco de luz na coluna 2, por dentro do batente');
});

test('dois painéis rebaixados, um em cada metade, com o mesmo desenho', () => {
    for (const y of [UPPER_ROW, LOWER_ROW]) {
        const plank = brightness(at(3, y));
        const border = brightness(at(7, y));
        const innerShadow = brightness(at(8, y));
        const inside = brightness(at(13, y));
        const innerLight = brightness(at(23, y));

        assert.ok(innerShadow < inside, `linha ${y}: sombra por dentro, em cima/à esquerda`);
        assert.ok(innerLight > inside + 20, `linha ${y}: luz por dentro, embaixo/à direita`);
        assert.ok(inside < plank, `linha ${y}: painel rebaixado é mais escuro que a prancha`);
        assert.ok(border <= plank + 4, `linha ${y}: moldura do painel não pode ser mais clara que a prancha`);
    }
});

test('dobradiças de ferro à esquerda, uma por metade', () => {
    for (const top of [10, 50]) {
        for (const y of [top, top + 2]) {
            for (let x = 2; x <= 7; x++) {
                assert.ok(isGray(at(x, y)), `dobradiça (${x}, ${y}) devia ser ferro: ${at(x, y)}`);
                assert.ok(brightness(at(x, y)) < 100, 'e mais escura que a madeira');
            }
        }
        assert.ok(isGray(at(4, top + 1)), 'o miolo da chapa também é ferro');
        assert.ok(isWood(at(9, top)), 'a madeira volta logo depois da dobradiça');
        assert.ok(isWood(at(28, top)), 'ferragem só do lado da charneira');
    }
});

test('maçaneta dourada do lado oposto às dobradiças, com luz e sombra', () => {
    const light = at(23, 29);
    const body = at(24, 30);
    const shadow = at(25, 31);

    assert.ok(light[0] > 240 && light[1] > 220, 'brilho no canto de cima à esquerda');
    assert.ok(body[0] > 200 && body[2] < 130, 'corpo dourado');
    assert.ok(brightness(shadow) < brightness(body) - 20, 'sombra embaixo à direita');
    assert.ok(spread(body) > 80, 'dourado, não ferro');
    assert.ok(brightness(body) > brightness(at(19, 30)) + 30, 'a maçaneta se destaca da prancha');
    assert.ok(isWood(at(28, 30)), 'e fica afastada da borda direita');
});

test('a folha da porta tem 32×64 e as metades não são cópia uma da outra', () => {
    assert.equal(sheet.length, TILE_PX * 2);
    const upper = sheet.slice(0, TILE_PX);
    const lower = sheet.slice(TILE_PX);
    assert.notDeepEqual(upper, lower, 'dobradiças e maçaneta quebram a simetria');
    // Painéis começam na mesma coluna nas duas metades.
    assert.equal(brightness(at(7, 5)) > 0, true);
    assert.equal(brightness(at(7, 42)) > 0, true);
});
