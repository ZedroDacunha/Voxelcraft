// Luz de verdade (PointLight) em cima da luz assada por bloco.
//
// A luz do mundo é por voxel: cada face recebe o nível do bloco vizinho, o que
// dá o degradê certo do cômodo mas nenhuma luz "redonda" — o Mofim, os itens no
// chão e o jogador não são iluminados por uma tocha acesa ao lado, porque o
// material deles só conhece hemisférica e sol.
//
// Aqui ficam as contas (sem Three): quanto uma tocha, uma lanterna ou uma
// fornalha acesa valem como fonte de luz real e **quais** das fontes próximas
// merecem uma PointLight de verdade. O jogo mantém um número fixo de luzes e só
// troca posição/intensidade — mudar a *quantidade* de luzes na cena faria o
// Three recompilar todos os materiais e travaria o quadro.
import { ID } from './world-catalog.js';

/** Quantas PointLights o mundo mantém vivas (além da da mão). */
export const LIGHT_POOL_SIZE = 2;
/** Alcance da busca por emissores e raio máximo da luz (em blocos). */
export const LIGHT_POOL_RANGE = 13;

// Nível de luz "cheio" do motor (a tocha é 14, a lanterna 13).
const FULL_LEVEL = 14;

// Cor da luz real por emissor: fogo é laranja, o pó do Mofim é mais dourado.
const EMITTER_COLORS = new Map([
    [ID.TORCH, 0xffb45b],
    [ID.TORCH_WALL_XP, 0xffb45b],
    [ID.TORCH_WALL_XN, 0xffb45b],
    [ID.TORCH_WALL_ZP, 0xffb45b],
    [ID.TORCH_WALL_ZN, 0xffb45b],
    [ID.MOFIM_LANTERN, 0xffdc9a],
    [ID.FURNACE, 0xffa050],
]);

export function emitterColor(blockType) {
    return EMITTER_COLORS.get(blockType) ?? 0xffc07a;
}

// A luzinha do Mofim também disputa o pool. O nível é o de uma tocha fraca: ele
// não é lampião, é bicho — a poça de luz tem de ser um convite, não um poste.
export const MOFIM_LIGHT_LEVEL = 10;
export const MOFIM_LIGHT_COLOR = 0xffdc9a;
/** Quanto a luz incha no chilreio (fração do nível, 0,8 = +80% no pico). */
export const MOFIM_PULSE_GAIN = 0.8;

/**
 * A criatura pode entrar na disputa por uma PointLight?
 *
 * No modo gráfico mais baixo (escala 0,5) não: a máquina já está no limite e as
 * duas vagas ficam com as tochas. É o único custo que existe aqui — nenhuma luz
 * nova é criada, o pool é o mesmo.
 */
export function creatureLightsAllowed(mode) {
    return mode !== 0.5;
}

/**
 * Candidatos a PointLight vindos das criaturas.
 *
 * A posição é **exata** (a luz fica na ponta da antena, onde o bicho está) e não
 * o centro de um bloco. O pulso do chilreio não entra no nível daqui: ele é
 * aplicado no quadro, em `updateEmitterLights`, senão a luz só piscaria a cada
 * 250 ms da varredura.
 */
/** A luz nasce acima do corpo, na ponta da antena. */
export const MOFIM_LIGHT_OFFSET = 0.66;

/**
 * Onde fica a luz de uma criatura, agora.
 *
 * `visualY` é a altura **desenhada** (pulo, voo, planeio); `y` é a do chão. A luz
 * tem de seguir a primeira — no voo curto o bicho sobe 1,5 bloco e a luz fica
 * boiando no chão se usar `y`.
 */
export function creatureLightPoint(entity) {
    if (!entity) return null;
    const y = Number.isFinite(entity.visualY) ? entity.visualY : entity.y;
    if (!Number.isFinite(entity.x) || !Number.isFinite(entity.z) || !Number.isFinite(y)) return null;
    return { x: entity.x, y: y + MOFIM_LIGHT_OFFSET, z: entity.z };
}

export function creatureEmitterCandidates(entities = [], { allowed = true } = {}) {
    if (!allowed || !Array.isArray(entities)) return [];
    const out = [];
    for (const e of entities) {
        if (!e || e.leaving) continue;
        const p = creatureLightPoint(e);
        if (!p) continue;
        out.push({
            x: p.x,
            y: p.y,
            z: p.z,
            level: MOFIM_LIGHT_LEVEL,
            color: MOFIM_LIGHT_COLOR,
            exact: true,
            creature: true,
            entity: e,
        });
    }
    return out;
}

// Luz do item na mão. A tocha tremula (fogo), a lanterna é firme e alcança mais;
// `offset` é onde a luz fica no espaço da câmera (na ponta do que se segura).
export const HELD_LIGHTS = new Map([
    [ID.TORCH, { color: 0xffb45b, base: 1.05, flicker: 0.12, distance: 7, offset: { x: 0.34, y: -0.25, z: -0.7 } }],
    [ID.MOFIM_LANTERN, { color: 0xffdc9a, base: 1.2, flicker: 0.03, distance: 9, offset: { x: 0.30, y: -0.30, z: -0.6 } }],
]);

/** Especificação da luz do item segurado, ou `null` se ele não ilumina. */
export function heldLightFor(blockType) {
    return HELD_LIGHTS.get(blockType) ?? null;
}

// Duas senoides de períodos diferentes: o fogo respira sem parecer um pisca.
export function heldLightIntensity(spec, time) {
    if (!spec) return 0;
    const t = Number.isFinite(time) ? time : 0;
    return spec.base + spec.flicker * Math.sin(t * 8.7) + spec.flicker * 0.42 * Math.sin(t * 13.1 + 1.2);
}

/**
 * Quanto um bloco emissor ilumina de verdade a uma certa distância.
 * Cai com o quadrado da distância normalizada: perto do fogo é forte, na borda
 * do alcance some sem degrau visível.
 */
export function emitterIntensity(level, distance, range = LIGHT_POOL_RANGE) {
    const l = Number(level);
    const d = Number(distance);
    const r = Number(range);
    if (!(l > 0) || !(r > 0) || !(d >= 0) || d >= r) return 0;
    const falloff = 1 - d / r;
    return Math.min(1.2, (l / FULL_LEVEL) * 1.05) * falloff * falloff;
}

/**
 * Escolhe até `max` emissores para virarem PointLight: os mais próximos que
 * ainda alcançam a origem. Devolve `{ x, y, z, level, color, distance,
 * intensity }`, com a posição já no centro do bloco (um pouco acima do meio,
 * onde a chama/pó fica de fato).
 */
export function pickEmitters(candidates, { origin, max = LIGHT_POOL_SIZE, range = LIGHT_POOL_RANGE } = {}) {
    if (!origin || !Array.isArray(candidates) || !(max > 0) || !(range > 0)) return [];
    const picked = [];
    for (const candidate of candidates) {
        const level = Number(candidate?.level);
        if (!(level > 0)) continue;
        const x = Number(candidate.x), y = Number(candidate.y), z = Number(candidate.z);
        if (![x, y, z].every(Number.isFinite)) continue;
        // Bloco ilumina do centro (um pouco acima do meio, onde a chama fica);
        // criatura ilumina de onde ela está, sem arredondar para o bloco.
        const exato = candidate.exact === true;
        const cx = exato ? x : x + 0.5;
        const cy = exato ? y : y + 0.6;
        const cz = exato ? z : z + 0.5;
        const distance = Math.hypot(cx - origin.x, (exato ? cy : y + 0.5) - origin.y, cz - origin.z);
        const intensity = emitterIntensity(level, distance, range);
        if (intensity <= 0) continue;
        // Aceita a cor pronta (fornalha acesa muda de cor) ou deduz do tipo.
        const color = Number.isFinite(candidate.color) ? candidate.color : emitterColor(candidate.type);
        picked.push({
            x: cx, y: cy, z: cz, level, color, distance, intensity,
            creature: candidate.creature === true,
            entity: candidate.entity,
        });
    }
    // `sort` é estável, então empate fica na ordem em que a busca encontrou.
    picked.sort((a, b) => a.distance - b.distance);
    return picked.slice(0, Math.floor(max));
}
