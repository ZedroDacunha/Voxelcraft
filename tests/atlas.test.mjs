import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ATLAS_COLUMNS, ATLAS_ROWS, TILE_PX, TILE, BLOCKS, ITEMS,
    atlasCell, atlasTileRect, atlasUV, atlasUVInto,
} from '../world-catalog.js';

// Todos os tiles que o jogo desenha no atlas: terreno, faces de blocos e ícones
// de itens.
function usedTiles() {
    return [...new Set([
        ...Object.values(TILE),
        ...Object.values(BLOCKS).flatMap(block => Object.values(block.tiles)),
        ...Object.values(ITEMS).map(item => item.iconTile),
    ])].sort((a, b) => a - b);
}

test('atlas cabe no limite garantido de textura (2048 px nos dois eixos)', () => {
    assert.ok(ATLAS_COLUMNS * TILE_PX <= 2048, `largura ${ATLAS_COLUMNS * TILE_PX}px`);
    assert.ok(ATLAS_ROWS * TILE_PX <= 2048, `altura ${ATLAS_ROWS * TILE_PX}px`);
});

test('cada tile usado ocupa uma célula exclusiva dentro da grade', () => {
    const seen = new Map();
    for (const tile of usedTiles()) {
        const { col, row } = atlasCell(tile);
        assert.ok(col >= 0 && col < ATLAS_COLUMNS, `coluna ${col} fora da grade (tile ${tile})`);
        assert.ok(row >= 0 && row < ATLAS_ROWS, `linha ${row} fora do atlas (tile ${tile})`);

        const key = `${col},${row}`;
        assert.ok(!seen.has(key), `tiles ${seen.get(key)} e ${tile} caem na mesma célula (${key})`);
        seen.set(key, tile);

        const rect = atlasTileRect(tile);
        assert.equal(rect.x, col * TILE_PX);
        assert.equal(rect.y, row * TILE_PX);
        assert.equal(rect.size, TILE_PX);
        assert.ok(rect.x + TILE_PX <= ATLAS_COLUMNS * TILE_PX);
        assert.ok(rect.y + TILE_PX <= ATLAS_ROWS * TILE_PX);
    }
});

test('a grade tem espaço de sobra depois do maior tile', () => {
    const maxTile = Math.max(...usedTiles());
    assert.ok(ATLAS_COLUMNS * ATLAS_ROWS > maxTile);
});

test('atlasUV mapeia a célula com flipY e com afastamento de meia borda', () => {
    const pad = 0.5;
    const width = ATLAS_COLUMNS * TILE_PX;
    const height = ATLAS_ROWS * TILE_PX;
    for (const tile of usedTiles()) {
        const { col, row } = atlasCell(tile);
        const uv = atlasUV(tile, pad);
        assert.ok(Math.abs(uv.u0 - (col * TILE_PX + pad) / width) < 1e-12);
        // O canvas é desenhado de cima para baixo e o three usa flipY: a linha
        // 0 do atlas fica na faixa de v mais alta da textura.
        assert.ok(Math.abs(uv.v0 - ((ATLAS_ROWS - 1 - row) * TILE_PX + pad) / height) < 1e-12);
        assert.ok(Math.abs(uv.uWidth - (TILE_PX - 2 * pad) / width) < 1e-12);
        assert.ok(Math.abs(uv.vHeight - (TILE_PX - 2 * pad) / height) < 1e-12);
        assert.ok(uv.u0 > 0 && uv.u0 + uv.uWidth < 1, `tile ${tile} vaza na horizontal`);
        assert.ok(uv.v0 > 0 && uv.v0 + uv.vHeight < 1, `tile ${tile} vaza na vertical`);
    }
});

test('sem afastamento o retângulo encosta nas bordas da célula', () => {
    const uv = atlasUV(0, 0);
    assert.equal(uv.u0, 0);
    assert.ok(Math.abs(uv.v0 - (ATLAS_ROWS - 1) / ATLAS_ROWS) < 1e-12);
    assert.ok(Math.abs(uv.uWidth - 1 / ATLAS_COLUMNS) < 1e-12);
    assert.ok(Math.abs(uv.vHeight - 1 / ATLAS_ROWS) < 1e-12);
});

test('tiles vizinhos não se sobrepõem em UV', () => {
    const left = atlasUV(0, 0);
    const right = atlasUV(1, 0);
    assert.equal(left.v0, right.v0, 'tiles da mesma linha devem ter o mesmo v0');
    assert.ok(left.u0 + left.uWidth <= right.u0 + 1e-12, 'vizinhos na horizontal se sobrepõem');

    const first = atlasUV(0, 0);
    const below = atlasUV(ATLAS_COLUMNS, 0);
    // A linha seguinte do canvas fica abaixo, ou seja, em v menor.
    assert.ok(below.v0 + below.vHeight <= first.v0 + 1e-12, 'vizinhos na vertical se sobrepõem');
});

test('atlasUVInto reaproveita o objeto e devolve o mesmo retângulo', () => {
    const out = { u0: 0, v0: 0, uWidth: 0, vHeight: 0 };
    for (const tile of usedTiles()) {
        const expected = atlasUV(tile, 0.5);
        const actual = atlasUVInto(tile, 0.5, out);
        assert.equal(actual, out, 'atlasUVInto deve escrever no objeto recebido');
        assert.deepEqual(actual, expected);
    }
});
