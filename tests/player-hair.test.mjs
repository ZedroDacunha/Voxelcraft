import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { hairCells, hairSurface } from '../player-hair.js';
import { createPlayerModel, PLAYER_MODEL_HEIGHT } from '../player-model.js';

const neighbors = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
test('peça de cabelo é contínua e gera só as faces sem vizinho', () => {
    const cells = hairCells(), first = cells.values().next().value;
    const key = (x,y,z) => `${x},${y},${z}`;
    const seen = new Set([key(first.x,first.y,first.z)]), queue = [first];
    let exposed = 0;
    for (let i = 0; i < queue.length; i++) {
        const {x,y,z} = queue[i];
        for (const [dx,dy,dz] of neighbors) {
            const k = key(x+dx,y+dy,z+dz);
            if (!cells.has(k)) exposed++;
            else if (!seen.has(k)) { seen.add(k); queue.push(cells.get(k)); }
        }
    }
    assert.equal(seen.size, cells.size);
    const surface = hairSurface(cells);
    assert.equal(surface.positions.length, exposed * 18);
    assert.equal(surface.normals.length, surface.positions.length);
    assert.equal(surface.colors.length, surface.positions.length);
    for (let i = 0; i < surface.colors.length; i += 3) {
        const [r,g,b] = surface.colors.slice(i, i+3);
        assert.ok(r > g && g > b && r < .1, 'marrom escuro');
    }
});
test('a peça acompanha o pivô da cabeça e libera seus recursos', () => {
    const model = createPlayerModel(THREE), hair = model.head.getObjectByName('player-hair');
    assert.ok(hair && hair.parent === model.head);
    assert.equal(hair.scale.x, PLAYER_MODEL_HEIGHT / 32);
    let geometryDisposed = false, materialDisposed = false;
    hair.geometry.addEventListener('dispose', () => geometryDisposed = true);
    hair.material.addEventListener('dispose', () => materialDisposed = true);
    model.dispose(); assert.ok(geometryDisposed && materialDisposed);
});
test('mechas não ocupam a região das sobrancelhas', () => {
    const unit = PLAYER_MODEL_HEIGHT / 32, model = createPlayerModel(THREE);
    const eyebrows = model.head.children.filter(p => p.name === 'eyebrow');
    for (const {x,y,z} of hairCells().values()) if (z === 4) for (const brow of eyebrows) {
        const minX = (brow.position.x - brow.geometry.parameters.width / 2) / unit;
        const maxX = (brow.position.x + brow.geometry.parameters.width / 2) / unit;
        if (x < maxX && x + 1 > minX) {
            const top = (brow.position.y + brow.geometry.parameters.height / 2) / unit;
            assert.ok(y > top, `mecha em y=${y} cobre sobrancelha`);
        }
    }
    model.dispose();
});
