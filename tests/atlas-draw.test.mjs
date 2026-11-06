import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ATLAS_COLUMNS, ATLAS_ROWS, TILE_PX, TILE, ITEMS, atlasTileRect,
} from '../world-catalog.js';

// O atlas é desenhado em um canvas; aqui trocamos o canvas por um gravador de
// fillRect para conferir, sem navegador, que cada tile cai na célula certa.
const draws = [];
const canvases = [];

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
    createElement(tag) {
        assert.equal(tag, 'canvas');
        const canvas = { width: 0, height: 0, getContext: () => createFakeContext() };
        canvases.push(canvas);
        return canvas;
    },
};

const THREE = {
    CanvasTexture: class { constructor(image) { this.image = image; } },
    NearestFilter: 1006,
    ClampToEdgeWrapping: 1001,
    SRGBColorSpace: 'srgb',
};

const { createTextureTools } = await import('../world-textures.js');
const tools = createTextureTools(THREE);

test('createAtlasTexture usa a grade e não desenha fora do canvas', () => {
    const texture = tools.createAtlasTexture();
    const canvas = texture.image;

    assert.equal(canvas.width, ATLAS_COLUMNS * TILE_PX);
    assert.equal(canvas.height, ATLAS_ROWS * TILE_PX);

    for (const d of draws) {
        assert.ok(d.x >= 0 && d.x + d.w <= canvas.width, `pixel desenhado fora da largura: ${JSON.stringify(d)}`);
        assert.ok(d.y >= 0 && d.y + d.h <= canvas.height, `pixel desenhado fora da altura: ${JSON.stringify(d)}`);
    }
});

test('todo tile e todo ícone caem dentro da própria célula', () => {
    const inside = (rect, d) => d.x >= rect.x && d.x < rect.x + rect.size
        && d.y >= rect.y && d.y < rect.y + rect.size;

    for (const tile of Object.values(TILE)) {
        const rect = atlasTileRect(tile);
        assert.ok(draws.some(d => inside(rect, d)), `tile ${tile} não foi desenhado na célula ${JSON.stringify(rect)}`);
    }

    for (const item of Object.values(ITEMS)) {
        if (!item.sprite) continue;
        const rect = atlasTileRect(item.iconTile);
        // Ícone de 16 px entra dobrado (2×2); o de bloco já vem em 32 px e cai 1:1
        // na célula — o tamanho vem da arte, não de uma constante.
        const arte = tools.spritePixels(item.sprite.kind, item.sprite.mat);
        const escala = TILE_PX / arte.length;
        assert.ok(
            draws.some(d => d.w === escala && inside(rect, d)),
            `ícone de ${item.name} não foi desenhado na célula ${JSON.stringify(rect)} (escala ${escala})`,
        );
    }
});

test('nenhum tile cai no fallback magenta do atlas', () => {
    // pixel() devolve rgb(255,0,255) para tiles sem arte — foi assim que as
    // duas metades da porta ficaram sem textura até esta revisão.
    const fallback = draws.filter(d => d.fill === 'rgb(255,0,255)');
    assert.equal(fallback.length, 0, `${fallback.length} pixels de fallback magenta no atlas`);
});
