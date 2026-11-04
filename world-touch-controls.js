// Controles de toque: joystick virtual, arrastar para olhar e botões de ação.
//
// No desktop o jogo depende de *pointer lock*: o mouse some, todos os eventos
// viram `movementX/movementY` e `controls.isLocked` libera a física. Em celular
// e tablet nada disso existe — `requestPointerLock` não está disponível — então
// o toque precisa de um caminho próprio: o joystick alimenta os mesmos botões
// lógicos do teclado (frente/trás/esquerda/direita/pular), e o arrasto do dedo
// alimenta o mesmo `look` que o mouse alimenta.
//
// Este módulo é só a matemática: vetor do joystick, zona morta, corrida no fim
// do curso e o delta de olhar. Nada de DOM, para poder testar sem navegador.

export const TOUCH_STICK_RADIUS = 58;
export const TOUCH_DEAD_ZONE = 0.3;
export const TOUCH_RUN_THRESHOLD = 0.88;
export const TOUCH_LOOK_SENSITIVITY = 0.0045;

/**
 * Heurística de "este aparelho tem dedo".
 *
 * `maxTouchPoints` cobre celular/tablet; `coarse` cobre aparelho com caneta ou
 * tela sensível sem toque multi-dedo; `touchEvent` cobre navegador antigo. Um
 * notebook com tela de toque também cai aqui — e tudo bem: ele ganha o botão de
 * jogar sem mouse, e o mouse continua funcionando (a UI de toque só aparece
 * quando o jogador entra por esse caminho).
 */
export function isTouchDevice({ maxTouchPoints = 0, coarsePointer = false, touchEvent = false } = {}) {
    const points = Number(maxTouchPoints);
    return (Number.isFinite(points) && points > 0) || Boolean(coarsePointer) || Boolean(touchEvent);
}

/**
 * Vetor do joystick a partir do deslocamento do dedo em relação ao centro.
 *
 * Normaliza pelo raio e trava em 1 (arrastar além da borda não acelera mais):
 * assim "empurrar até o fim" significa a mesma coisa em qualquer tamanho de tela.
 */
export function stickVector(dx, dy, radius = TOUCH_STICK_RADIUS) {
    const limit = Number(radius) > 0 ? Number(radius) : TOUCH_STICK_RADIUS;
    let x = Number(dx);
    let y = Number(dy);
    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 0;
    x /= limit;
    y /= limit;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) {
        x /= magnitude;
        y /= magnitude;
    }
    return { x, y, magnitude: Math.min(1, magnitude) };
}

/** Deslocamento do botão do joystick (para desenhar), já limitado ao raio. */
export function stickKnobOffset(vector, radius = TOUCH_STICK_RADIUS) {
    const limit = Number(radius) > 0 ? Number(radius) : TOUCH_STICK_RADIUS;
    const { x, y, magnitude } = stickVector(vector?.x * limit, vector?.y * limit, limit);
    return { x: x * limit, y: y * limit, magnitude };
}

/**
 * Converte o joystick nos mesmos botões que o teclado aperta (W/A/S/D/Shift).
 *
 * A zona morta é **por eixo** e não pelo módulo: empurrar na diagonal precisa
 * andar em duas direções, mas um toque trêmulo no centro não pode andar em
 * nenhuma. Correr fica no fim do curso, que é o gesto natural de "empurrar
 * fundo" — no teclado é o Shift.
 */
export function movementFromStick(vector, {
    deadZone = TOUCH_DEAD_ZONE,
    runThreshold = TOUCH_RUN_THRESHOLD,
} = {}) {
    const dead = Math.max(0, Math.min(1, Number(deadZone) || 0));
    const run = Math.max(0, Math.min(1, Number(runThreshold) || 0));
    const { x = 0, y = 0, magnitude = 0 } = stickVector(
        (vector?.x ?? 0) * TOUCH_STICK_RADIUS,
        (vector?.y ?? 0) * TOUCH_STICK_RADIUS,
        TOUCH_STICK_RADIUS,
    );
    return {
        forward: y <= -dead,
        backward: y >= dead,
        left: x <= -dead,
        right: x >= dead,
        sprint: magnitude >= run && magnitude > dead,
    };
}

/**
 * Olhar depois de arrastar o dedo.
 *
 * Mesma convenção do mouse: arrastar para a direita gira para a direita (yaw
 * diminui), arrastar para cima olha para cima. Como o dedo faz o papel do mouse
 * e não o de uma alça, não há inversão.
 */
export function lookAfterDrag(current, dx, dy, {
    sensitivity = TOUCH_LOOK_SENSITIVITY,
    maxPitch = Math.PI / 2 - 0.02,
} = {}) {
    const step = Number(sensitivity);
    const scale = Number.isFinite(step) ? step : TOUCH_LOOK_SENSITIVITY;
    const limit = Number.isFinite(Number(maxPitch)) ? Math.abs(Number(maxPitch)) : Math.PI / 2 - 0.02;
    const yaw = Number(current?.yaw) || 0;
    const pitch = Number(current?.pitch) || 0;
    const mx = Number.isFinite(Number(dx)) ? Number(dx) : 0;
    const my = Number.isFinite(Number(dy)) ? Number(dy) : 0;
    return {
        yaw: yaw - mx * scale,
        pitch: Math.max(-limit, Math.min(limit, pitch - my * scale)),
    };
}

/**
 * Botões de toque e o que cada um faz.
 *
 * `hold` são os que ficam apertados (pular, cavar, agachar); `tap` são os de um
 * toque só (usar, inventário). Manter a lista aqui permite que o HTML, o CSS e o
 * `game.js` discordem menos — e o teste confere que o jogo liga todos.
 */
export const TOUCH_BUTTONS = Object.freeze([
    Object.freeze({ id: 'jump', label: 'Pular', mode: 'hold' }),
    Object.freeze({ id: 'break', label: 'Cavar', mode: 'hold' }),
    Object.freeze({ id: 'use', label: 'Usar', mode: 'tap' }),
    Object.freeze({ id: 'crouch', label: 'Agachar', mode: 'tap' }),
    Object.freeze({ id: 'inventory', label: 'Mochila', mode: 'tap' }),
    Object.freeze({ id: 'pause', label: 'Pausar', mode: 'tap' }),
]);

export function touchButtonById(id) {
    return TOUCH_BUTTONS.find(button => button.id === id) ?? null;
}
