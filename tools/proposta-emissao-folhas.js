// Parte 3: apenas um estudo de emissão para uma árvore de prévia.
// Posições são sorteadas sob os blocos inferiores da copa demonstrada;
// colisão, vento e integração com o mundo ainda não estão implementados.
import { FALLING_LEAF_MOTIONS, sampleFallingLeafMotion } from './proposta-movimento-folhas.js';

const PERIOD = 90;
const motion = FALLING_LEAF_MOTIONS[3];
const cells = [];
for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
    if ((Math.abs(x) === 2 && Math.abs(z) === 2) || (x === 0 && z === 0)) continue;
    cells.push([x, z]);
}

function random(index, salt) {
    let h = Math.imul(index + 1, 374761393) + Math.imul(salt + 1, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function createSchedule(style) {
    const events = [];
    let t = 0.2, group = 0, index = 0;
    while (t < PERIOD) {
        const amount = style.burst ? 3 + Math.floor(random(group, 81) * 2) : 1;
        for (let n = 0; n < amount && t + n * 0.24 < PERIOD; n++) {
            const [x, z] = cells[Math.floor(random(index, 13) * cells.length)];
            events.push({
                time: t + n * 0.24,
                x: x + (random(index, 37) - 0.5) * 0.7,
                z: z + (random(index, 51) - 0.5) * 0.7,
                speed: 0.9 + random(index, 77) * 0.2,
                rotation: (random(index, 93) - 0.5) * 0.6,
            });
            index++;
        }
        t += style.interval * (0.75 + random(group, 109) * 0.5);
        group++;
    }
    return events;
}

export function createLeafEmissionStyle(style) {
    if (!Number.isFinite(style.interval) || style.interval <= 0) throw new Error('Intervalo inválido');
    return { ...style, events: createSchedule(style) };
}

export const FALLING_LEAF_EMISSION_STYLES = [
    {
        id: 'discreta', badge: 'Emissão 1 · Discreta', tag: 'Queda esparsa',
        title: '1 — Discreta', description: 'Aproximadamente uma folhinha a cada 2,8 segundos por árvore, com intervalos variados.',
        interval: 2.8,
    },
    {
        id: 'equilibrada', badge: 'Emissão 2 · Equilibrada', tag: 'Presença leve', recommended: true,
        title: '2 — Equilibrada', description: 'Aproximadamente uma folhinha a cada 1,6 segundo por árvore, com pequenas pausas naturais.',
        interval: 1.6,
    },
    {
        id: 'viva', badge: 'Emissão 3 · Frequente', tag: 'Copa mais ativa',
        title: '3 — Frequente', description: 'Aproximadamente uma folhinha a cada 0,85 segundo por árvore; cria um efeito mais visível.',
        interval: 0.85,
    },
    {
        id: 'rajadas', badge: 'Emissão 4 · Grupos', tag: 'Pausas e pequenos grupos',
        title: '4 — Grupos ocasionais', description: 'Três ou quatro folhinhas em sequência a cada cerca de 7 segundos, com pausas entre os grupos.',
        interval: 7.0, burst: true,
    },
].map(createLeafEmissionStyle);

// Amostra partículas vivas da prévia: o loop evita uma interrupção ao repetir.
export function sampleLeafEmission(style, time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    const result = [];
    for (const event of style.events) {
        const age = (t - event.time + PERIOD) % PERIOD;
        if (age >= motion.duration * event.speed) continue;
        const p = sampleFallingLeafMotion(motion, age / event.speed, 0);
        result.push({
            x: event.x + (p.x + 1.25),
            y: p.y - 0.14,
            z: event.z + (p.z - 1.15),
            rotation: p.rotation + event.rotation,
            width: p.width,
            opacity: p.opacity,
        });
    }
    return result;
}
