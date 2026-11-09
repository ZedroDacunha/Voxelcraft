import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    TOUCH_BUTTONS,
    TOUCH_DEAD_ZONE,
    TOUCH_HOLD_MS,
    TOUCH_LOOK_SENSITIVITY,
    TOUCH_LOOK_SLOP,
    TOUCH_RUN_THRESHOLD,
    TOUCH_STICK_RADIUS,
    isTouchDevice,
    lookAfterDrag,
    movementFromStick,
    ndcFromPoint,
    stickKnobOffset,
    stickVector,
    touchButtonById,
    touchGesture,
    touchLookSensitivity,
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

test('a sensibilidade do olhar vale também no toque', () => {
    // o mesmo arrasto, três posições da barra do dedo
    const turn = (touchSensitivity) => lookAfterDrag({ yaw: 0, pitch: 0 }, 100, 0, { sensitivity: touchLookSensitivity({ touchSensitivity }) });
    assert.ok(Math.abs(turn(2).yaw) > Math.abs(turn(1).yaw));
    assert.ok(Math.abs(turn(1).yaw) > Math.abs(turn(0.5).yaw));
    // no toque quem manda é a barra do toque, não a do mouse
    assert.match(game, /sensitivity: touchLookScale,/);
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

    // a física, o relógio do mundo e o salvamento seguem o mesmo critério —
    // com uma exceção deliberada: o chat aberto mantém o mundo rodando
    assert.match(game, /const worldRunning = playing\(\) \|\| chat\.open;/);
    // a física só para enquanto o jogador dorme (quem mexe na câmera é a cama)
    assert.match(game, /if \(worldRunning\) \{[\s\S]{0,400}?if \(!sleep\.active\) updatePhysics\(dt\);/);
    assert.match(game, /if \(worldRunning \|\| inventoryOpen\) \{\n        updateWorldClock\(dt\);/);
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

// --- toque no mundo (a cruz central é a mira) -----------------------------

test('dedo parado é toque curto; parado demais vira segurar; andar vira olhar', () => {
    // ainda no ar, sem andar e sem tempo: nada decidido
    assert.equal(touchGesture({ elapsed: 0 }), 'wait');
    // soltou cedo e parado: toque curto = golpear
    assert.equal(touchGesture({ elapsed: 90, released: true }), 'tap');
    // chegou no tempo e continua com o dedo: segurar = cavar
    assert.equal(touchGesture({ elapsed: TOUCH_HOLD_MS }), 'hold');
    assert.equal(touchGesture({ elapsed: TOUCH_HOLD_MS * 4 }), 'hold');
    // andou mais que a folga: olhar, mesmo que solte depois
    assert.equal(touchGesture({ dx: TOUCH_LOOK_SLOP, elapsed: 10 }), 'look');
    assert.equal(touchGesture({ dx: 40, dy: -30, elapsed: 10, released: true }), 'look');
    // a folga é um raio, não dois eixos separados: diagonal conta inteira
    assert.equal(touchGesture({ dx: 9, dy: 9, elapsed: 10 }), 'look');
    assert.equal(touchGesture({ dx: 5, dy: 5, elapsed: 10 }), 'wait');
    // soltar depois de já estar cavando não vira toque curto
    assert.equal(touchGesture({ elapsed: TOUCH_HOLD_MS, released: true }), 'hold');
});

test('o gesto sobrevive a números estranhos', () => {
    assert.equal(touchGesture(), 'wait');
    assert.equal(touchGesture({ dx: NaN, dy: undefined, elapsed: -50, released: true }), 'tap');
    assert.equal(touchGesture({ elapsed: Infinity }), 'wait', 'tempo infinito não é tempo passado');
    // folga zero não pode transformar qualquer tremida em arrasto: volta ao padrão
    assert.equal(touchGesture({ dx: 1 }, { slop: 0 }), 'wait');
    assert.equal(touchGesture({ dx: 30 }, { slop: 0 }), 'look');
});

test('ponto da tela vira direção de câmera com o y invertido', () => {
    // centro da tela é o centro da câmera
    assert.deepEqual(ndcFromPoint(400, 300, 800, 600), { x: 0, y: 0 });
    // cantos: esquerda/baixo e direita/cima
    assert.deepEqual(ndcFromPoint(0, 600, 800, 600), { x: -1, y: -1 });
    assert.deepEqual(ndcFromPoint(800, 0, 800, 600), { x: 1, y: 1 });
    // metade da tela
    assert.deepEqual(ndcFromPoint(600, 150, 800, 600), { x: 0.5, y: 0.5 });
    // fora da tela (barra de endereço, teclado aberto) é travado na borda
    assert.deepEqual(ndcFromPoint(-50, -50, 800, 600), { x: -1, y: 1 });
    assert.deepEqual(ndcFromPoint(9000, 9000, 800, 600), { x: 1, y: -1 });
    // tela sem tamanho e valores estranhos não viram NaN
    assert.deepEqual(ndcFromPoint(10, 10, 0, 0), { x: 0, y: 0 });
    assert.deepEqual(ndcFromPoint(NaN, NaN, 800, 600), { x: 0, y: 0 });
});

test('blocos e criaturas compartilham a direção do modo selecionado', () => {
    assert.match(game, /if \(fingerAimEnabled\(\) && touchAim\.on\) creatureAim\.copy\(touchAim\.dir\)/);
    assert.match(game, /currentHit = raycastVoxels\(camera\.position, touchAim\.dir, REACH/);
    assert.match(game, /camera\.getWorldDirection\(tmpDir\);\s*currentHit = raycastVoxels\(camera\.position, tmpDir, REACH/);
});

test('toque golpeia, segurar minera e arrastar olha sem ativar golpe no retorno', () => {
    assert.match(game, /touchLook\.holdTimer = setTimeout\(\(\) => \{/);
    assert.match(game, /\}, TOUCH_HOLD_MS\);/);
    assert.match(game, /function startBreaking\(\) \{\n {12}touchLook\.mode = 'hold';[\s\S]*?syncAttackHeld\(\)/);
    assert.match(game, /touchLook\.mode === 'wait' && gesture === 'tap' && playing\(\) && !sleep\.active/);
    assert.match(game, /performTouchTapAttack\(\{ updateTarget, strikeCreature, updateMining/);
    assert.match(game, /touchLook\.mode !== 'look' && touchLook\.mode !== 'hold'/);
    assert.match(game, /touchLook\.mode = 'wait';\n {12}syncAttackHeld\(\)/);
    assert.match(game, /stopTouchGesture\(\);\n {4}stopHaptics\(\);\n {4}resetMining\(\);/);
    assert.match(game, /for \(const button of document\.querySelectorAll\('\.touch-btn\.pressed'\)\)/);
    assert.match(game, /if \(id === 'use'\) useHeldItem\(\{ sneaking: wantToCrouch \}\)/);
});

test('os controles são só ícones, mas continuam dizendo o que fazem', () => {
    const buttons = [...html.matchAll(/<button[^>]*data-touch="(\w+)"[^>]*>([\s\S]*?)<\/button>/g)];
    assert.equal(buttons.length, TOUCH_BUTTONS.length, 'um botão no HTML para cada botão do módulo');
    for (const [, id, inner] of buttons) {
        const label = touchButtonById(id).label;
        assert.match(inner, /^<svg class="touch-icon"/, `${id}: só o ícone dentro do botão`);
        assert.ok(!inner.replace(/<[^>]*>/g, '').trim(), `${id}: sem texto solto no botão`);
        assert.match(inner, /aria-hidden="true"/, `${id}: o ícone não é lido em voz alta`);
        assert.match(html, new RegExp(`data-touch="${id}"[^>]*aria-label="${label}"`),
            `${id}: aria-label com o nome do módulo`);
        assert.ok(!/touch-btn[^>]*>[^<]*[A-Za-zÀ-ú]/.test(html), `${id}: nada de rótulo escrito`);
    }
    // ícone desenhado no CSS, sem imagem externa para baixar/offline; o tamanho
    // sai de --touch-scale (a opção "Tamanho dos botões")
    assert.match(css, /\.touch-icon \{ width: var\(--touch-icon-size, 34px\); height: var\(--touch-icon-size, 34px\);/);
    assert.match(css, /\.touch-icon \{[^}]*fill: currentColor;/);
    assert.match(css, /--touch-icon-size: min\(calc\(34px \* var\(--touch-scale, 1\)\), 9vw\);/);
    assert.match(css, /\.touch-btn \{ display: grid; place-items: center; min-height: 0; padding: 0;/);
    assert.ok(!/data-touch="[^"]+"[^>]*><img/.test(html), 'sem <img> nos botões');
});
