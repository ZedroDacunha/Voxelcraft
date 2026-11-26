import test from 'node:test';
import assert from 'node:assert/strict';
import { sweepLeaf, leafSurfaceBelow, leafOverlaps } from '../world-falling-leaf-collision.js';

const classify = type => type === 0 ? 'pass' : type === 2 ? 'water' : 'solid';
function world(entries) {
    const blocks = new Map(entries.map(([x, y, z, type]) => [`${x},${y},${z}`, type]));
    return (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0;
}

test('a varredura impede atravessar o topo, mesmo num quadro longo', () => {
    const read = world([[0, 0, 0, 1]]);
    const hit = sweepLeaf({ x: 0.5, y: 4, z: 0.5 }, { x: 0.5, y: -2, z: 0.5 }, read, classify);
    assert.equal(hit.kind, 'solid');
    assert.deepEqual(hit.normal, { axis: 'y', sign: 1 });
    assert.ok(Math.abs((4 - hit.t * 6) - 1.18) < 1e-9);
    assert.equal(sweepLeaf({ x: 2, y: 4, z: 0.5 }, { x: 2, y: -2, z: 0.5 }, read, classify), null);
});

test('paredes, água e região descarregada são reconhecidas sem atravessar', () => {
    const from = { x: -1, y: 0.5, z: 0.5 }, to = { x: 2, y: 0.5, z: 0.5 };
    const wall = sweepLeaf(from, to, world([[0, 0, 0, 1]]), classify);
    assert.deepEqual(wall.normal, { axis: 'x', sign: -1 });
    assert.equal(sweepLeaf(from, to, world([[0, 0, 0, 2]]), classify).kind, 'water');
    assert.equal(sweepLeaf(from, to, (x, y, z) => x === 0 && y === 0 && z === 0 ? null : 0, classify).kind, 'unknown');
    assert.equal(leafOverlaps({ x: 0.5, y: 0.5, z: 0.5 }, world([[0, 0, 0, 1]]), classify), true);
    assert.equal(leafOverlaps({ x: 1.5, y: 0.5, z: 0.5 }, world([[0, 0, 0, 1]]), classify), false);
    assert.equal(leafOverlaps({ x: 0.5, y: 0.5, z: 0.5 }, () => null, classify), true);
});

test('a superfície considera altura, borda e remoção do bloco', () => {
    const read = world([[0, 0, 0, 1], [1, 1, 0, 1], [0, 1, 1, 2]]);
    assert.equal(leafSurfaceBelow({ x: 1.1, y: 2.5, z: 0.5 }, read, classify).top, 2);
    assert.equal(leafSurfaceBelow({ x: 0.5, y: 1.7, z: 0.5 }, read, classify).top, 1);
    assert.equal(leafSurfaceBelow({ x: 0.5, y: 2.5, z: 1.5 }, read, classify), null);
    assert.equal(leafSurfaceBelow({ x: 4, y: 1.7, z: 4 }, read, classify), null);
});
