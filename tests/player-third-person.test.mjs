import test from 'node:test';
import assert from 'node:assert/strict';
import { thirdPersonDistance, thirdPersonLimbSwing, THIRD_PERSON_DISTANCE } from '../player-third-person.js';

test('câmera recua sem atravessar a parede e volta ao máximo ao sair', () => {
    assert.equal(thirdPersonDistance(undefined), THIRD_PERSON_DISTANCE);
    assert.equal(thirdPersonDistance(10), THIRD_PERSON_DISTANCE);
    assert.ok(Math.abs(thirdPersonDistance(1) - 0.8) < 1e-9);
    assert.equal(thirdPersonDistance(0.1), 0);
});
test('braços e pernas seguem a fase da passada e param sem amplitude', () => {
    assert.equal(thirdPersonLimbSwing(0, 1), 0);
    assert.equal(thirdPersonLimbSwing(Math.PI / 2, 0), 0);
    assert.equal(thirdPersonLimbSwing(Math.PI / 2, 1), 0.55);
    assert.ok(thirdPersonLimbSwing(3 * Math.PI / 2, 1) < 0);
});
