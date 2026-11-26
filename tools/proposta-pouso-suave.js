// Refinamento da parte 4. Uma única folha muda de orientação gradualmente;
// a ilha é plana e a integração com blocos do jogo ainda é outra etapa.
import { FALLING_LEAF_MOTIONS, sampleFallingLeafMotion } from './proposta-movimento-folhas.js';
import { WIND_LEAF_SCENARIOS } from './proposta-emissao-vento.js';
import { LANDING_STYLES } from './proposta-pouso-folhas.js';

export const LONG_LANDING = {
    ...LANDING_STYLES[2], badge: 'Pouso demorado · Refinado', tag: 'Transição contínua',
    title: 'Pouso demorado, mais suave',
    description: 'A folha se deita gradualmente na grama, permanece por 3 segundos e desaparece aos poucos.',
};
const motion = FALLING_LEAF_MOTIONS[3];
const events = WIND_LEAF_SCENARIOS[1].events;
const period = 90;
const groundY = 1;
const contact = 1.27;
const progressAtContact = (2.98 - contact) / 2.04;
const tiltDuration = 0.9;
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const smooth = x => x * x * (3 - 2 * x);

function safePosition(event, p) {
    let x = event.x + p.x + 1.25;
    const z = clamp(event.z + p.z - 1.15, -2.22, 2.22);
    if (Math.abs(event.z) < 0.86 && event.x - 0.22 < 0.78 && event.x + 0.47 > -0.78) {
        x = (event.x < 0 ? -1.26 : 1.06) + p.x + 1.25;
    }
    return { x: clamp(x, -2.22, 2.22), z };
}

// axisX/Y: componentes verticais dos eixos locais do plano já rotacionado.
// O retângulo inteiro fica acima do chão mesmo durante o giro e em zoom maior.
export function landingCenterY(desiredY, size, width, axisX, axisY) {
    const halfHeight = size * 0.5 * (Math.abs(axisX) * width + Math.abs(axisY));
    return Math.max(desiredY, groundY + 0.012 + halfHeight);
}

export function sampleSmoothLanding(time) {
    const t = (Number.isFinite(time) ? Math.max(0, time) : 0) % period;
    const result = [];
    for (let id = 0; id < events.length; id++) {
        const event = events[id];
        const age = (t - event.time + period) % period;
        const landingTime = motion.duration * event.speed * progressAtContact;
        const sinceLanding = age - landingTime;
        if (sinceLanding >= LONG_LANDING.hold + LONG_LANDING.fade) continue;
        const p = sampleFallingLeafMotion(motion, Math.min(age / event.speed, motion.duration * progressAtContact), 0);
        const tilt = smooth(clamp((sinceLanding + tiltDuration) / tiltDuration, 0, 1));
        const fade = sinceLanding <= LONG_LANDING.hold ? 1 : clamp(1 - (sinceLanding - LONG_LANDING.hold) / LONG_LANDING.fade, 0, 1);
        result.push({
            id, ...safePosition(event, p),
            desiredY: p.y - 0.14 - (contact - groundY - 0.012) * tilt,
            rotation: p.rotation + event.rotation,
            width: p.width + (1 - p.width) * tilt,
            opacity: (p.opacity + (1 - p.opacity) * tilt) * fade,
            tilt,
        });
    }
    return result;
}
