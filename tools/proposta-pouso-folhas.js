// Parte 4: prévia em ilha plana, não um sistema de colisão do jogo.
// A mesma sequência e a mesma queda são usadas em todos os cartões.
import { FALLING_LEAF_MOTIONS, sampleFallingLeafMotion } from './proposta-movimento-folhas.js';
import { WIND_LEAF_SCENARIOS } from './proposta-emissao-vento.js';

export const LANDING_STYLES = [
    { id: 'breve', badge: 'Pouso 1 · Breve', tag: 'Quase imediato', title: '1 — Pouso breve', description: 'A folha toca a grama e desaparece suavemente em meio segundo.', hold: 0, fade: 0.5 },
    { id: 'suave', badge: 'Pouso 2 · Suave', tag: 'Pausa discreta', title: '2 — Pausa suave', description: 'A folha fica por um instante sobre a grama e depois desaparece devagar.', hold: 1.2, fade: 0.9, recommended: true },
    { id: 'demorado', badge: 'Pouso 3 · Demorado', tag: 'Mais visível no chão', title: '3 — Pouso demorado', description: 'A folha permanece por mais tempo sobre a grama antes de desaparecer.', hold: 3.0, fade: 1.2 },
];

const PERIOD = 90;
const motion = FALLING_LEAF_MOTIONS[3];
const events = WIND_LEAF_SCENARIOS[1].events; // Vento leve simulado (~1,6 s).
const GROUND = 1;
const MAX_RADIUS = 0.27; // Abrange até 0,38 bloco, mesmo durante a rotação.
const CONTACT = GROUND + MAX_RADIUS;
const LAND_PROGRESS = (2.98 - CONTACT) / 2.04;
const TRANSITION = 0.22;
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

// Afasta preventivamente a trajetória inteira do tronco e das bordas da ilha.
// É uma restrição deste cenário plano, não uma colisão genérica de voxels.
function safePosition(event, p) {
    let x = event.x + p.x + 1.25;
    const z = clamp(event.z + p.z - 1.15, -2.22, 2.22);
    if (Math.abs(event.z) < 0.86 && event.x - 0.22 < 0.78 && event.x + 0.47 > -0.78) {
        x = (event.x < 0 ? -1.26 : 1.06) + (p.x + 1.25);
    }
    return { x: clamp(x, -2.22, 2.22), z };
}

export function sampleLanding(style, time) {
    const t = (Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD;
    const result = [];
    for (const event of events) {
        const age = (t - event.time + PERIOD) % PERIOD;
        const landingTime = motion.duration * event.speed * LAND_PROGRESS;
        const sinceLanding = age - landingTime;
        if (sinceLanding >= style.hold + style.fade) continue;
        const motionTime = Math.min(age / event.speed, motion.duration * LAND_PROGRESS);
        const p = sampleFallingLeafMotion(motion, motionTime, 0);
        const position = safePosition(event, p);
        const transition = clamp((sinceLanding + TRANSITION) / TRANSITION, 0, 1);
        const fade = sinceLanding <= style.hold ? 1 : clamp(1 - (sinceLanding - style.hold) / style.fade, 0, 1);
        result.push({
            ...position,
            y: Math.max(CONTACT, p.y - 0.14),
            rotation: p.rotation + event.rotation,
            width: p.width,
            flyingOpacity: p.opacity * (1 - transition),
            groundOpacity: transition * fade,
            groundY: GROUND + 0.012,
        });
    }
    return result;
}
