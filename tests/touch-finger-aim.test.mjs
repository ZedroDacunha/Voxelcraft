import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { fingerAimDirection } from '../world-touch-aim.js';
import { DEFAULT_GAME_SETTINGS, sanitizeGameSettings, formatSetting } from '../world-game-settings.js';

function aim(x, y, { third = false, hit = null } = {}) {
    const viewCamera = new THREE.PerspectiveCamera(75, 2, 0.1, 100);
    viewCamera.position.set(0, 0, third ? 3 : 0);
    const eye = new THREE.Vector3(0, 0, 0);
    const direction = new THREE.Vector3();
    let visualCalls = 0;
    fingerAimDirection({ x, y, rect: { left: 100, top: 50, width: 800, height: 400 },
        viewCamera, eye, raycaster: new THREE.Raycaster(), ndc: new THREE.Vector2(), direction,
        third, reach: 5, cameraDistance: 3, raycast: () => { visualCalls++; return hit; } });
    return { direction, visualCalls };
}

test('preferência é opcional, persistível e mantém mira central como padrão', () => {
    assert.equal(DEFAULT_GAME_SETTINGS.touchAimMode, 'center');
    assert.equal(sanitizeGameSettings({ touchAimMode: 'finger' }).touchAimMode, 'finger');
    assert.equal(sanitizeGameSettings({ touchAimMode: 'errado' }).touchAimMode, 'center');
    assert.equal(formatSetting('touchAimMode', 'finger'), 'Sem mira');
});

test('posição do dedo escolhe direções diferentes, inclusive com canvas deslocado', () => {
    const center = aim(500, 250);
    assert.ok(center.direction.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-10);
    assert.ok(aim(800, 250).direction.x > 0);
    assert.ok(aim(200, 250).direction.x < 0);
    assert.equal(center.visualCalls, 0);
});

test('terceira pessoa projeta ponto visual a partir dos olhos', () => {
    const target = aim(650, 250, { third: true, hit: { dist: 5 } });
    assert.equal(target.visualCalls, 1);
    assert.ok(target.direction.x > 0);
    assert.ok(Math.abs(target.direction.length() - 1) < 1e-10);
});

test('integração limita o raio ao alcance e limpa gesto ao sair', () => {
    const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    assert.match(game, /raycastVoxels\(camera\.position, touchAim\.dir, REACH, WORLD_RAYCAST_ACCESS\)/);
    assert.match(game, /touchLook\.mode === 'hold' && fingerAimEnabled\(\)/);
    assert.match(game, /if \(fingerAimEnabled\(\)\) setFingerAim\(event\.clientX, event\.clientY\)/);
    assert.match(game, /function stopTouchGesture\(\)[\s\S]*?clearTouchAim\(\)/);
    assert.match(game, /function toggleThirdPerson\(\)[\s\S]*?clearTouchAim\(\)/);
    assert.match(css, /body\.touch-mode\.touch-aim-finger #crosshair \{ display: none; \}/);
});
