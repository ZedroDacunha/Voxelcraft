import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    TOUCH_BUTTONS,
    TOUCH_DEAD_ZONE,
    TOUCH_LOOK_SENSITIVITY,
    TOUCH_RUN_THRESHOLD,
    TOUCH_STICK_RADIUS,
    isTouchDevice,
    lookAfterDrag,
    movementFromStick,
    stickKnobOffset,
    stickVector,
    touchButtonById,
} from '../world-touch-controls.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// --- detecção -----------------------------------------------------------

test('detecta dedo sem transformar todo computador em tablet', () => {
    assert.equal(isTouchDevice({ maxTouchPoints: 5 }), true);
    assert.equal(isTouchDevice({ maxTouchPoints: 0, coarsePointer: true }), true, 'caneta/tela sem multitoque');
    assert.equal(isTouchDevice({ maxTouchPoints: 0, touchEvent: true }), true);
    assert.equal(isTouchDevice({ maxTouchPoints: 0 }), false, 'desktop com mouse fica no pointer lock');
    assert.equal(isTouchDevice(), false);
    assert.equal(isTouchDevice({ maxTouchPoints: '3' }), true, 'string numérica conta');
});

// --- joystick -----------------------------------------------------------

test('o meio do joystick é parado; a borda é velocidade máxima', () => {
    assert.deepEqual(stickVector(0, 0), { x: 0, y: 0, magnitude: 0 });

    const half = stickVector(TOUCH_STICK_RADIUS / 2, 0);
    assert.equal(half.x, 0.5);
    assert.equal(half.magnitude, 0.5);

    const beyond = stickVector(TOUCH_STICK_RADIUS * 4, 0);
    assert.equal(beyond.x, 1, 'arrastar além da borda não acelera mais');
    assert.equal(beyond.magnitude, 1);

    // diagonal também satura em 1 (senão a diagonal seria 41% mais rápida)
    const diagonal = stickVector(TOUCH_STICK_RADIUS * 3, TOUCH_STICK_RADIUS * 3);
    assert.ok(Math.abs(diagonal.magnitude - 1) < 1e-9);
    assert.ok(Math.abs(diagonal.x - Math.SQRT1_2) < 1e-9);
});

test('deslocamento inválido do joystick não vira NaN', () => {
    for (const value of [NaN, undefined, Infinity, -Infinity]) {
        const vector = stickVector(value, value);
        assert.ok(Number.isFinite(vector.x) && Number.isFinite(vector.y));
        assert.equal(Number.isFinite(vector.magnitude), true);
    }
    assert.deepEqual(stickVector(Number.NaN, TOUCH_STICK_RADIUS * 2, 0), { x: 0, y: 1, magnitude: 1 }, 'raio inválido cai no padrão');
});

test('o botão do joystick nunca sai do disco', () => {
    const inside = stickKnobOffset({ x: 0.5, y: 0 });
    assert.equal(inside.x, TOUCH_STICK_RADIUS / 2);
    const outside = stickKnobOffset({ x: 3, y: 0 });
    assert.equal(outside.x, TOUCH_STICK_RADIUS, 'desenho também satura');
});

test('o joystick alimenta os mesmos botões do WASD', () => {
    const idle = movementFromStick({ x: 0, y: 0 });
    assert.deepEqual(idle, { forward: false, backward: false, left: false, right: false, sprint: false });

    assert.equal(movementFromStick({ x: 0, y: -1 }).forward, true);
    assert.equal(movementFromStick({ x: 0, y: 1 }).backward, true);
    assert.equal(movementFromStick({ x: -1, y: 0 }).left, true);
    assert.equal(movementFromStick({ x: 1, y: 0 }).right, true);

    const diagonal = movementFromStick({ x: 0.8, y: -0.8 });
    assert.equal(diagonal.forward, true);
    assert.equal(diagonal.right, true);
    assert.equal(diagonal.left, false);
});

test('a zona morta é por eixo e a corrida fica no fim do curso', () => {
    const wobble = TOUCH_DEAD_ZONE * 0.9;
    const small = movementFromStick({ x: wobble, y: -wobble });
    assert.equal(small.forward, false, 'tremor de dedo não anda');
    assert.equal(small.right, false);

    const justPast = movementFromStick({ x: 0, y: -(TOUCH_DEAD_ZONE + 0.02) });
    assert.equal(justPast.forward, true, 'passar da zona morta anda');
    assert.equal(justPast.sprint, false, 'mas ainda não é corrida');

    assert.equal(movementFromStick({ x: 0, y: -1 }).sprint, true);
    assert.equal(movementFromStick({ x: 0, y: -(TOUCH_RUN_THRESHOLD - 0.05) }).sprint, false);
    assert.equal(movementFromStick({ x: 0, y: 0 }).sprint, false, 'parado nunca corre');
});

// --- olhar --------------------------------------------------------------

test('arrastar o dedo olha como o mouse olha', () => {
    const start = { yaw: 0, pitch: 0 };
    const right = lookAfterDrag(start, 100, 0);
    assert.ok(right.yaw < 0, 'arrastar para a direita gira para a direita');
    assert.equal(right.pitch, 0, 'sem mexer no eixo vertical');

    const up = lookAfterDrag(start, 0, -100);
    assert.ok(up.pitch > 0, 'arrastar para cima olha para cima');
    assert.equal(up.yaw, 0);

    assert.equal(right.yaw, -100 * TOUCH_LOOK_SENSITIVITY);
    // não muta o estado recebido
    assert.deepEqual(start, { yaw: 0, pitch: 0 });
});

test('o olhar não passa do limite vertical nem estoura', () => {
    const maxPitch = Math.PI / 2 - 0.02;
    assert.equal(lookAfterDrag({ yaw: 0, pitch: 0 }, 0, -100000).pitch, maxPitch);
    assert.equal(lookAfterDrag({ yaw: 0, pitch: 0 }, 0, 100000).pitch, -maxPitch);

    const weird = lookAfterDrag({ yaw: NaN, pitch: undefined }, NaN, NaN);
    assert.equal(weird.yaw, 0);
    assert.equal(weird.pitch, 0);
});

test('a sensibilidade das opções vale também no toque', () => {
    const slow = lookAfterDrag({ yaw: 0, pitch: 0 }, 100, 0, { sensitivity: TOUCH_LOOK_SENSITIVITY * 0.5 });
    const fast = lookAfterDrag({ yaw: 0, pitch: 0 }, 100, 0, { sensitivity: TOUCH_LOOK_SENSITIVITY * 2 });
    assert.ok(Math.abs(fast.yaw) > Math.abs(slow.yaw));
    assert.match(game, /sensitivity: TOUCH_LOOK_SENSITIVITY \* LOOK_SENSITIVITY/);
});

// --- botões e fiação ----------------------------------------------------

test('todo botão de toque existe no HTML e é tratado no jogo', () => {
    const ids = TOUCH_BUTTONS.map(button => button.id);
    assert.equal(new Set(ids).size, ids.length, 'sem id repetido');
    for (const button of TOUCH_BUTTONS) {
        assert.ok(['hold', 'tap'].includes(button.mode), `${button.id}: modo válido`);
        assert.ok(button.label && button.label.length <= 12, `${button.id}: rótulo curto o suficiente para o dedo`);
        assert.ok(html.includes(`data-touch="${button.id}"`), `${button.id}: existe no index.html`);
        assert.ok(game.includes(`id === '${button.id}'`), `${button.id}: o jogo trata o botão`);
    }
    assert.equal(touchButtonById('jump').mode, 'hold');
    assert.equal(touchButtonById('nada'), null);
});

test('a UI de toque segue o padrão de botões do menu', () => {
    assert.match(html, /class="classic-btn touch-btn"[^>]*data-touch="jump"/,
        'botões usam .classic-btn (cinza, borda 2px, sem raio)');
    assert.match(css, /\.touch-btn \{/);
    assert.match(css, /body\.touch-mode canvas \{ touch-action: none;/,
        'sem isso o dedo rola a página em vez de olhar');
    assert.match(css, /#touch-ui \{[^}]*pointer-events: none;/);
    assert.match(css, /#touch-stick \{[^}]*pointer-events: auto;/);
});

test('toque e mouse compartilham a mesma ação de "usar"', () => {
    assert.match(game, /function useHeldItem\(\{ sneaking = false \} = \{\}\)/);
    assert.match(game, /useHeldItem\(\{ sneaking: event\.shiftKey \|\| wantToCrouch \}\)/, 'mouse');
    assert.match(game, /useHeldItem\(\{ sneaking: wantToCrouch \}\)/, 'toque');
});

test('playing() substitui o pointer lock sem deixar buracos', () => {
    assert.match(game, /function playing\(\) \{\n    return Boolean\(controls\?\.isLocked\) \|\| touchActive;\n\}/);

    // a física, o relógio do mundo e o salvamento seguem o mesmo critério
    assert.match(game, /if \(playing\(\)\) \{\n        updatePhysics\(dt\);/);
    assert.match(game, /if \(playing\(\) \|\| inventoryOpen\) \{\n        updateWorldClock\(dt\);/);
    assert.match(game, /setInterval\(\(\) => \{ if \(playing\(\)\) saveGame\(true\); \}, 30000\);/);
    assert.match(game, /locked: playing\(\)/);

    // e morrer desliga o toque, senão a física seguiria rodando na tela de morte
    assert.match(game, /dead = true;\n    touchActive = false;\n    resetInputFlags\(\);/);
});

test('o modo toque pode ser forçado pela URL, para testar no desktop', () => {
    assert.match(game, /urlParams\.has\('touch'\)/);
    assert.match(game, /urlParams\.get\('touch'\) !== '0'/);
    assert.match(html, /id="menu-touch-hint"/, 'o menu avisa que existem controles de toque');
});

test('nenhum caminho de entrada ignora o modo toque', () => {
    // botão Jogar, clique na tela e renascer entram todos por startPlay()
    assert.ok((game.match(/startPlay\(/g) ?? []).length >= 4, 'a entrada passa por startPlay em toda a UI');
    assert.match(game, /touchActive = true;/, 'beginTouchPlay liga o modo toque');
    // híbrido: mouse manda quando o jogador clicou com mouse, dedo quando tocou
    assert.match(game, /preferMouse: lastPointerKind === 'mouse'/);
    // abrir/fechar inventário no toque não pede pointer lock
    assert.match(game, /if \(touchMode\) \{\n        syncPauseMenu\(\);\n        return;\n    \}/);
    // e se o lock falhar num aparelho de toque, cai no toque em vez de travar
    assert.match(game, /if \(touchMode\) \{ beginTouchPlay\(\); return true; \}/);
});
