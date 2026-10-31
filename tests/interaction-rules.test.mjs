import test from 'node:test';
import assert from 'node:assert/strict';

import { rightClickIntent } from '../world-interaction-rules.js';

test('sem nada na mira e sem comida, o clique direito coloca bloco', () => {
    assert.equal(rightClickIntent(), 'place');
    assert.equal(rightClickIntent({}), 'place');
});

test('comida na mão come mesmo mirando em um bloco', () => {
    // Regressão: antes só comia com `!currentHit`, ou seja, olhando para o céu.
    assert.equal(rightClickIntent({ food: true }), 'eat');
});

test('bancada, forno e baú têm prioridade sobre a comida', () => {
    assert.equal(rightClickIntent({ station: true }), 'station');
    assert.equal(rightClickIntent({ station: true, food: true }), 'station');
});

test('porta tem prioridade sobre a comida, mas perde para a bancada', () => {
    assert.equal(rightClickIntent({ door: true }), 'door');
    assert.equal(rightClickIntent({ door: true, food: true }), 'door');
    assert.equal(rightClickIntent({ door: true, station: true }), 'station');
});

test('agachado ignora bloco e usa o item da mão', () => {
    assert.equal(rightClickIntent({ sneaking: true, station: true }), 'place');
    assert.equal(rightClickIntent({ sneaking: true, door: true }), 'place');
    assert.equal(rightClickIntent({ sneaking: true, station: true, food: true }), 'eat');
    assert.equal(rightClickIntent({ sneaking: true, door: true, food: true }), 'eat');
});
