import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    acquireMeshScratch, exactMeshBuffer, meshVertexBufferLength, storeMeshScratch,
} from '../world-mesh-buffers.js';

const gameSource = readFileSync(new URL('../game.js', import.meta.url), 'utf8');

const VERTICES = 256;
const INDEXES = 512;

test('buffers de vértice têm o tamanho certo por atributo', () => {
    assert.equal(meshVertexBufferLength('positions', 10), 30);
    assert.equal(meshVertexBufferLength('normals', 10), 30);
    assert.equal(meshVertexBufferLength('colors', 10), 30);
    assert.equal(meshVertexBufferLength('uvs', 10), 20);
    assert.equal(meshVertexBufferLength('torchInfluence', 10), 10);
    assert.equal(meshVertexBufferLength('furnaceFlame', 10), 10);
});

test('primeira aquisição cria todas as arrays com a capacidade pedida', () => {
    const scratch = {};
    const arrays = acquireMeshScratch(scratch, VERTICES, INDEXES);

    assert.equal(arrays.positions.length, VERTICES * 3);
    assert.equal(arrays.normals.length, VERTICES * 3);
    assert.equal(arrays.uvs.length, VERTICES * 2);
    assert.equal(arrays.colors.length, VERTICES * 3);
    assert.equal(arrays.torchInfluence.length, VERTICES);
    assert.equal(arrays.furnaceFlame.length, VERTICES);
    for (const key of ['indices', 'cutoutIndices', 'waterIndices']) {
        assert.equal(arrays[key].length, INDEXES, key);
        assert.equal(arrays[key] instanceof Uint32Array, true, key);
    }
    assert.equal(arrays.positions instanceof Float32Array, true);
});

test('a segunda malha reaproveita as mesmas arrays (sem alocar)', () => {
    const scratch = {};
    const first = acquireMeshScratch(scratch, VERTICES, INDEXES);
    const second = acquireMeshScratch(scratch, VERTICES, INDEXES);

    for (const key of Object.keys(first)) {
        assert.equal(second[key], first[key], `${key} deveria ser a mesma instância`);
    }
});

test('pedido maior aloca maior; pedido menor mantém o que já existe', () => {
    const scratch = {};
    const first = acquireMeshScratch(scratch, VERTICES, INDEXES);
    const bigger = acquireMeshScratch(scratch, VERTICES * 4, INDEXES * 4);
    assert.notEqual(bigger.positions, first.positions);
    assert.equal(bigger.positions.length, VERTICES * 4 * 3);

    const smaller = acquireMeshScratch(scratch, VERTICES, INDEXES);
    assert.equal(smaller.positions, bigger.positions, 'não encolhe o rascunho');
});

test('array que cresceu durante a malha volta para o rascunho', () => {
    const scratch = {};
    const arrays = acquireMeshScratch(scratch, VERTICES, INDEXES);

    // simula `growTypedArray` dentro do mesher
    const grown = new Float32Array(VERTICES * 8 * 3);
    grown.set(arrays.positions);
    storeMeshScratch(scratch, { ...arrays, positions: grown });

    const next = acquireMeshScratch(scratch, VERTICES, INDEXES);
    assert.equal(next.positions, grown, 'a próxima malha já começa com o buffer maior');
    assert.equal(next.normals, arrays.normals, 'os outros continuam os mesmos');
});

test('rascunho nunca encolhe ao guardar arrays menores', () => {
    const scratch = {};
    const arrays = acquireMeshScratch(scratch, VERTICES * 4, INDEXES * 4);

    storeMeshScratch(scratch, {
        positions: new Float32Array(VERTICES * 3),
        indices: new Uint32Array(INDEXES),
    });

    assert.equal(scratch.positions, arrays.positions);
    assert.equal(scratch.indices, arrays.indices);
});

test('storeMeshScratch tolera entrada vazia', () => {
    const scratch = {};
    assert.equal(storeMeshScratch(scratch, null), scratch);
    assert.equal(storeMeshScratch(scratch, {}), scratch);
    assert.deepEqual(scratch, {});
});

test('capacity inválida não quebra a aquisição', () => {
    const scratch = {};
    const arrays = acquireMeshScratch(scratch, 0, -5);
    assert.equal(arrays.positions.length, 3, 'mínimo de 1 vértice');
    assert.equal(arrays.indices.length, 1);

    const weird = acquireMeshScratch({}, NaN, undefined);
    assert.equal(weird.positions.length, 3);
});

test('a geometria recebe cópia exata, não uma view do rascunho', () => {
    const scratch = {};
    const arrays = acquireMeshScratch(scratch, VERTICES, INDEXES);
    arrays.positions[0] = 1;
    arrays.positions[1] = 2;
    arrays.positions[2] = 3;

    const copy = exactMeshBuffer(arrays.positions, 3);
    assert.equal(copy.length, 3);
    assert.deepEqual([...copy], [1, 2, 3]);
    assert.notEqual(copy.buffer, arrays.positions.buffer, 'buffer próprio');

    // sobrescrever o rascunho (próxima malha) não afeta a cópia
    arrays.positions[0] = 99;
    assert.equal(copy[0], 1);
});

test('exactMeshBuffer com tamanho inválido devolve buffer vazio', () => {
    const source = new Float32Array([1, 2, 3, 4]);
    assert.equal(exactMeshBuffer(source, 0).length, 0);
    assert.equal(exactMeshBuffer(source, -2).length, 0);
    assert.equal(exactMeshBuffer(source, NaN).length, 0);
    assert.equal(exactMeshBuffer(source, 999).length, 4, 'nunca passa do disponível');
    assert.equal(exactMeshBuffer(null, 3), null);
});

test('o mesher usa os buffers de rascunho e copia o tamanho exato', () => {
    assert.match(gameSource, /this\.meshScratch = \{\}/);
    assert.match(gameSource, /acquireMeshScratch\(this\.meshScratch, CS \* CS \* 8, CS \* CS \* 12\)/);
    assert.match(gameSource, /storeScratch\(\); return;/, 'malha vazia também devolve o rascunho');
    assert.match(gameSource, /storeMeshScratch\(this\.meshScratch, \{/);
    assert.match(gameSource, /exactMeshBuffer\(positions, vertexCount \* 3\)/);
    assert.match(gameSource, /exactMeshBuffer\(torchInfluence, vertexCount\)/);
    // as alocações por malha não existem mais
    assert.doesNotMatch(gameSource, /new Float32Array\(initialVertexCapacity \* 3\)/);
    assert.doesNotMatch(gameSource, /positions\.subarray\(0, vertexCount \* 3\)/);
    assert.doesNotMatch(gameSource, /torchInfluence\.subarray\(0, vertexCount\)/);
});
