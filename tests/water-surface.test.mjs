import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKS, ID } from '../world-catalog.js';
import { createWaterSystemClass } from '../world-water.js';

const Water = createWaterSystemClass({ BLOCKS, ID });
const cells = entries => {
    const blocks = new Map(entries.map(([x, y, z, type]) => [`${x},${y},${z}`, type]));
    return (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0;
};

test('o lábio do degrau encontra a água inferior nos dois extremos, nas quatro direções', () => {
    for (const [dx, dz] of [[1,0], [-1,0], [0,1], [0,-1]]) {
        const x = -16, y = 30, z = 16;
        const read = cells([[x,y,z,ID.WATER_FLOW_7], [x,y-1,z,ID.STONE], [x+dx,y-1,z+dz,ID.WATER_FLOW_7]]);
        for (const end of [0,1]) {
            const vx = x + (dx === 0 ? end : Number(dx > 0));
            const vz = z + (dz === 0 ? end : Number(dz > 0));
            assert.equal(y - 1 + Water.cornerHeight(read, vx, y - 1, vz), y);
            const lip = Water.cornerHeight(read, vx, y, vz);
            assert.ok(lip > 0 && lip < BLOCKS[ID.WATER_FLOW_7].waterLevel);
        }
    }
});

test('níveis vizinhos dividem a aresta, inclusive entre dois chunks', () => {
    const read = cells([[15,2,5,ID.WATER_FLOW_7],[16,2,5,ID.WATER_FLOW_3]]);
    const local = cx => (x,y,z) => read(cx * 16 + x,y,z);
    for (const z of [5,6]) {
        assert.equal(Water.cornerHeight(local(0),16,2,z), 5/8);
        assert.equal(Water.cornerHeight(local(1),0,2,z), 5/8);
    }
    assert.equal(Water.surfaceAt(read,15.5,2,5.25), 0.75);
    assert.equal(Water.surfaceAt(read,15.5,2,5.75), 0.75);
});

test('lago em repouso conserva o nível junto às margens e à beira seca', () => {
    const read = cells([[0,3,0,ID.WATER],[1,3,0,ID.STONE]]);
    for (const x of [0,1]) for (const z of [0,1]) {
        assert.equal(Water.cornerHeight(read,x,3,z), Water.surfaceHeight);
    }
    const dry = cells([[0,3,0,ID.WATER_FLOW_3],[1,2,1,ID.WATER]]);
    assert.equal(Water.cornerHeight(dry,1,3,1),3/8);
});

test('corrente sob outra água preenche toda a altura, mesmo no nível mais raso', () => {
    for (const upper of [ID.WATER, ID.WATER_FLOW_2, ID.WATER_FALL]) {
        const read = cells([[0,2,0,ID.WATER_FLOW_1],[0,3,0,upper]]);
        for (const x of [0,1]) for (const z of [0,1]) assert.equal(Water.cornerHeight(read,x,2,z),1);
    }
});

test('espessura compartilhada mede o fundo, afina na margem e satura em cinco blocos', () => {
    const basin = depth => (x, y, z) => y <= 12 && y > 12 - depth ? ID.WATER : 0;
    assert.equal(Water.cornerDepth(basin(1), -16, 12, 16), Water.surfaceHeight);
    assert.equal(Water.cornerDepth(basin(3), -16, 12, 16), 2 + Water.surfaceHeight);
    assert.equal(Water.cornerDepth(basin(12), -16, 12, 16), 4 + Water.surfaceHeight);
    const bank = (x, y, z) => x < 0 ? ID.STONE : basin(1)(x, y, z);
    assert.equal(Water.cornerDepth(bank, 0, 12, 16), Water.surfaceHeight / 2);
});
