/**
 * O enquadramento do panorama do menu — e onde o sol cai no quadro.
 *
 * O menu rodava sem sol visível: o céu colocava o sol na direção dele e a câmera
 * do panorama apontava para o lado oposto. Pior: com a ilha ocupando quase a tela
 * inteira sobrava uma tira de céu de ~5% no topo — nem um sol baixo cabia ali.
 *
 * Este módulo guarda a conta que resolveu isso, separada do DOM:
 *
 * - a **hora do menu** (`MENU_SUN_TIME`), que é o que dá o sol baixo e o céu de
 *   fim de tarde;
 * - o **enquadramento** (`MENU_CAMERA`): câmera mais afastada, mais baixa e com o
 *   alvo levantado — é isso que abre o céu em cima da ilha;
 * - o **ângulo inicial**: a câmera abre virada para o azimute do sol, senão ele
 *   só entraria em cena depois de minutos de giro;
 * - `sunOnScreen()`, que responde "o sol está no quadro?" para qualquer formato de
 *   tela — a pergunta que o teste faz e que o olho não perdoa.
 *
 * Tudo puro: dá para testar em Node sem WebGL e sem `document`.
 */

import { sunDirectionAt } from './world-sky.js';

/** Hora do menu: fim de tarde. O sol fica a ~2° do horizonte. */
export const MENU_SUN_TIME = 0.006;

/**
 * Enquadramento da ilha.
 *
 * Antes: altura 18,5 · raio 39 · alvo em y=5 (ilha gigante, céu de 5%).
 * Agora: altura 14 · raio 44 · alvo em y=13 — a linha das árvores cai perto do
 * meio do quadro e sobra céu para o sol, sem a ilha virar selo no rodapé.
 */
export const MENU_CAMERA = Object.freeze({
    height: 14,
    radius: 44,
    targetY: 13,
    fov: 43,
});

/** Giro da câmera, em radianos por milissegundo (uma volta a cada ~7,5 min). */
export const MENU_TURN_SPEED = 0.000014;

/** Balanço vertical da câmera, em blocos (respiração, não movimento). */
export const MENU_BOB = 0.5;

/** Direção do sol no menu (unitária, no plano XZ + y de elevação). */
export function menuSun(time = MENU_SUN_TIME) {
    return sunDirectionAt(time);
}

/**
 * Ângulo inicial da câmera: o azimute do sol mais meia volta.
 *
 * Azimute aqui é `atan2(z, x)`, a mesma convenção de `menuSun()`. A câmera fica
 * do lado oposto ao sol para olhar **na direção** dele.
 */
export function menuStartAngle(sun = menuSun()) {
    return Math.atan2(sun.z, sun.x) + Math.PI;
}

/** Ângulo da câmera num instante (ms). Com movimento reduzido, fica parada. */
export function menuAngleAt(now = 0, { reduced = false } = {}) {
    const start = menuStartAngle();
    if (reduced) return start;
    return start + (Number(now) || 0) * MENU_TURN_SPEED;
}

/** Posição da câmera num instante (ms) — a mesma curva que o menu desenha. */
export function menuCameraPosition(now = 0, { reduced = false, camera = MENU_CAMERA } = {}) {
    const angle = menuAngleAt(now, { reduced });
    return {
        x: Math.cos(angle) * camera.radius,
        y: camera.height + Math.sin(angle * 1.7) * MENU_BOB,
        z: Math.sin(angle) * camera.radius,
    };
}

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
});
const norm = (v) => {
    const length = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / length, y: v.y / length, z: v.z / length };
};

/**
 * Onde o sol cai no quadro, em frações da tela (0..1, origem no canto superior).
 *
 * O sol está a 250 unidades da câmera e a ilha a dezenas: para o olho ele está
 * no infinito, então aqui se projeta só a **direção** — sem paralaxe e sem
 * depender do tamanho do sol.
 *
 * `visible` é a resposta que interessa: com o giro ligado, o sol sai de quadro
 * depois de alguns minutos (foi a escolha do menu: girar normal, com o sol
 * começando em cena).
 */
export function sunOnScreen({
    width = 1600,
    height = 900,
    now = 0,
    reduced = false,
    time = MENU_SUN_TIME,
    camera = MENU_CAMERA,
    fov = MENU_CAMERA.fov,
} = {}) {
    const aspect = (Number(width) || 1) / Math.max(1, Number(height) || 1);
    const sun = menuSun(time);
    const position = menuCameraPosition(now, { reduced, camera });
    const target = { x: 0, y: camera.targetY, z: 0 };
    const forward = norm(sub(target, position));
    const right = norm(cross(forward, { x: 0, y: 1, z: 0 }));
    const up = cross(right, forward);
    const depth = dot(sun, forward);
    const halfV = Math.tan((fov * Math.PI) / 180 / 2);
    const halfH = halfV * aspect;
    if (!(depth > 0)) {
        return { visible: false, behind: true, x: NaN, y: NaN, aspect, elevation: sun.y, depth };
    }
    const x = 0.5 + 0.5 * (dot(sun, right) / depth) / halfH;
    const y = 0.5 - 0.5 * (dot(sun, up) / depth) / halfV;
    return {
        visible: x > 0 && x < 1 && y > 0 && y < 1,
        behind: false,
        x,
        y,
        aspect,
        elevation: sun.y,
        // Quanto o eixo da câmera está abaixo da horizontal (graus, positivo = olhando para baixo).
        pitch: Math.asin(-forward.y) * 180 / Math.PI,
        depth,
    };
}
