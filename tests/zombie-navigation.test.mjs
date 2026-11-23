import test from 'node:test';
import assert from 'node:assert/strict';
import { zombieFindPath } from '../world-zombie-navigation.js';

const start = { x: 0, y: 0, z: 0 }, goal = { x: 2, y: 0, z: 0 };
test('desvia de obstáculo sem atravessar cantos', () => {
    const path = zombieFindPath(start, goal, p => p.y === 0 && !(p.x === 1 && p.z === 0));
    assert.ok(path);
    assert.deepEqual(path.at(-1), goal);
    let previous = start;
    for (const cell of path) {
        assert.equal(Math.abs(cell.x - previous.x) + Math.abs(cell.z - previous.z), 1);
        assert.notDeepEqual(cell, { x: 1, y: 0, z: 0 });
        previous = cell;
    }
});
test('permite degrau validado e não sobe dois blocos de uma vez', () => {
    const cells = new Set(['1,1,0', '2,2,0']);
    const path = zombieFindPath(start, { x: 2, y: 2, z: 0 }, p => cells.has(`${p.x},${p.y},${p.z}`));
    assert.deepEqual(path, [{ x: 1, y: 1, z: 0 }, { x: 2, y: 2, z: 0 }]);
    assert.equal(zombieFindPath(start, { x: 1, y: 2, z: 0 }, p => p.y === 2), null);
});
test('respeita limites e não inventa caminho impossível', () => {
    assert.deepEqual(zombieFindPath(start, start, () => true), []);
    assert.equal(zombieFindPath(start, goal, () => false), null);
    assert.equal(zombieFindPath(start, goal, () => true, { maxVisited: 1 }), null);
    assert.equal(zombieFindPath(start, goal, () => true, { maxDistance: 1 }), null);
    assert.equal(zombieFindPath(start, goal, null), null);
});
