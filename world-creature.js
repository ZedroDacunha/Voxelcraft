// Mofim: a criatura passiva do jogo.
//
// O que ele faz é simples de propósito — vaga pelo capim, flutua, bate as asas e
// **se assusta**. Medo é o que dá sentido à presença dele: sem isso ele é cenário
// animado, andando em círculos que o jogador não influencia.
//
// Regras do susto (o resto do arquivo é animação):
//
// - chegou perto **andando ou correndo**: foge;
// - chegou perto **agachado**: não percebe (é o modo furtivo do jogador);
// - levou um golpe: foge na hora, de qualquer distância e postura.
//
// A decisão é uma função pura (`shouldFlee`) e o "levou golpe" é outra
// (`creatureInReach`), para poder testar a regra sem THREE, sem mundo e sem
// relógio de verdade.

import { floorDiv as defaultFloorDiv } from './world-grid.js';
import { hash2 as defaultHash2 } from './world-math.js';

/** Linhas de spawn por vez (o resto do mundo continua vazio: é bicho, não enxame). */
export const CREATURE_LIMIT = 3;
/**
 * Distância em que ele nasce e em que desaparece.
 *
 * Nasce **longe** de propósito: ao anoitecer os Mofins vêm andando de longe até
 * o jogador (a chegada), em vez de aparecerem já parados ao lado dele.
 */
export const SPAWN_MIN_DISTANCE = 20;
export const SPAWN_MAX_DISTANCE = 30;
export const DESPAWN_DISTANCE = 38;
/**
 * Chegada: o passeio de vinda ao anoitecer.
 *
 * Os da mesma noite entram pelo mesmo lado (`ARRIVE_SPREAD` de abertura, para não
 * virarem uma fila perfeita) e vêm em passo de passeio — mais rápido que o vagar,
 * bem mais lento que a fuga. Param quando já estão perto e voltam ao passeio de
 * sempre; se o caminho fecha ou demora demais, desistem em vez de insistir.
 */
export const ARRIVE_SPEED = 1.15;
export const ARRIVE_STOP_DISTANCE = 12;
export const ARRIVE_TIMEOUT = 30;
export const ARRIVE_SPREAD = 0.22;
/** Leque de desvios quando o caminho reto da chegada está barrado. */
export const ARRIVE_FAN = [0, 0.6, -0.6, 1.1, -1.1];
/**
 * Espaço mínimo entre um recém-chegado e os outros (blocos).
 *
 * É pequeno porque a chegada é uma fila: um vem alguns blocos atrás do outro, de
 * propósito. Antes o mínimo era de 8 blocos (o que fazia sentido com bichos
 * surgindo parados em pontos sorteados) e a fila era recusada — a noite ficava
 * com dois em vez de três.
 */
export const ARRIVE_MIN_GAP = 4;
/** Velocidade vagando e fugindo (blocos por segundo). */
export const WANDER_SPEED = 0.72;
export const FLEE_SPEED = 3.1;
/** Até onde o jogador assusta o Mofim só por chegar. */
export const SCARE_RADIUS = 7;
/**
 * Velocidade horizontal do jogador que conta como "chegando correndo".
 * Fica entre o passo agachado (1,3) e o caminhada (4,3): agachado passa
 * desapercebido, qualquer passo normal assusta.
 */
export const SCARE_SPEED = 2.2;
/** Quanto tempo ele continua fugindo depois do susto (segundos). */
export const SCARE_DURATION = 4.5;
/** Alcance e abertura do golpe: o corpo cabe numa caixa de ~1 bloco a 3,5. */
export const HIT_REACH = 3.5;
export const HIT_MIN_DOT = 0.86; // ~31° de abertura: mirar no bicho, não "perto dele"
/** Um mesmo Mofim não leva dois golpes no mesmo instante (evita spam com o botão segurado). */
export const HIT_COOLDOWN = 0.35;
/** Altura que ele pula para subir um degrau e duração do pulo (visual e curto). */
export const STEP_UP = 1;
export const HOP_DURATION = 0.26;
export const HOP_HEIGHT = 0.42;
/** Descida: em vez de cair seco, ele planeja com as asas abertas. */
export const GLIDE_DURATION = 0.42;
/**
 * Voo curto: sai do chão, cruza alguns blocos no ar e pousa adiante.
 *
 * É curto de propósito. O Mofim tem asa e plana, então voar é o que se espera
 * dele — mas bicho que voa o tempo todo deixa de ser bicho de chão: o susto, o
 * pulo de degrau e o planeio perderiam o sentido. Por isso são dois casos só:
 * **escapar** quando o chão não dá passagem, e um **passeio** de vez em quando.
 */
export const FLIGHT_DURATION = 0.75;
export const FLIGHT_HEIGHT = 1.5;
export const FLIGHT_DISTANCE = 2.6;
/** Espera entre um voo de passeio e outro (segundos, sorteada na faixa). */
export const FLIGHT_IDLE_MIN = 11;
export const FLIGHT_IDLE_MAX = 22;
/**
 * Travessia: o voo maior, para cruzar o que não se anda.
 *
 * O voo curto resolve o degrau e a beirada; um lago largo, uma ravina ou um
 * barranco no meio do caminho não. Aqui ele sai do chão, plana **baixo** por até
 * nove blocos e pousa do outro lado — mais tempo no ar, mais longe, e ainda
 * assim rente ao chão (rasante), porque não é bicho que sobe.
 *
 * O mínimo de 3,5 blocos existe para não virar atalho do voo curto: o que está
 * perto se resolve com um pulo de asa, não com uma travessia.
 */
export const CROSS_DISTANCE = 9;
export const CROSS_MIN_DISTANCE = 3.5;
/** Altura do pico acima do ponto mais alto do trajeto (blocos). */
export const CROSS_HEIGHT = 2.2;
/** Fração do trajeto gasta subindo; o resto é planeio (0,32 → sobe rápido). */
export const CROSS_RISE = 0.32;
/** Velocidade no ar (blocos por segundo): a travessia longa dura mais. */
export const CROSS_SPEED = 6.5;
/** Depois de uma tentativa, quanto tempo ele espera antes de tentar de novo. */
export const CROSS_COOLDOWN = 6;
/** Vida do bicho: três golpes de mão (cada golpe ainda o assusta). */
export const MOFIM_HEALTH = 3;
/** Tempo que o corpo fica aceso depois de levar dano (segundos). */
export const HURT_FLASH = 0.22;
/** Empurrão do golpe, em blocos (para o bicho "sentir" o impacto). */
export const KNOCKBACK_DISTANCE = 0.35;
/**
 * Piscada: os olhos fecham por um instante de vez em quando.
 *
 * É animação barata, mas é o que separa "escultura" de "bicho": com os olhos
 * parados ele parece um enfeite que anda.
 */
export const BLINK_DURATION = 0.12;
export const BLINK_MIN = 3.2;
export const BLINK_MAX = 7.5;
/** Quanto os olhos fecham na piscada (fração da altura). */
export const BLINK_SHUT = 0.15;
/**
 * Noite a partir da qual o Mofim aparece (`night` = 1 - dia do céu).
 *
 * Fica abaixo de 0,5 de propósito: eles entram em cena no **crepúsculo**, com o
 * sol ainda no horizonte, e só então vêm andando. Esperar a noite fechada fazia
 * o bicho aparecer já no escuro, do nada.
 */
export const NIGHT_SPAWN_THRESHOLD = 0.38;
/** Tempo que ele leva para sumir quando o dia amanhece (segundos). */
export const LEAVE_DURATION = 0.9;
/** Quanto ele sobe enquanto desaparece (blocos). */
export const LEAVE_RISE = 1.1;

/**
 * É hora de Mofim? Ele é bicho de noite: aparece quando o céu escurece e vai
 * embora quando o sol volta. `night` vem de graça do céu (1 = noite fechada,
 * 0 = dia claro) e o padrão é noite, para quem chama sem saber a hora.
 */
export function isMofimTime(night = 1) {
    const value = Number(night);
    return Number.isFinite(value) ? value >= NIGHT_SPAWN_THRESHOLD : true;
}

/**
 * Brilho próprio do corpo à noite (0..~0,16): o bichinho deixa de ser uma
 * silhueta e vira uma luzinha verde-pálida que respira devagar. De dia é zero.
 */
export function nightGlow(night = 1, time = 0) {
    const value = Math.min(1, Math.max(0, Number(night) || 0));
    if (value <= 0) return 0;
    const t = Number.isFinite(time) ? time : 0;
    return 0.16 * value * (0.75 + 0.25 * Math.sin(t * 2.3));
}

/** Progresso do "ir embora" (0 → 1), que encolhe e sobe o corpo. */
export function leaveProgress(elapsed, duration = LEAVE_DURATION) {
    if (!(duration > 0)) return 1;
    const p = Number(elapsed) / duration;
    if (!Number.isFinite(p)) return 1;
    return Math.min(1, Math.max(0, p));
}

/** Chilreio: alcance, ritmo e o silêncio entre um chamado e outro. */
export const CHIRP_RANGE = 16;
export const CHIRP_COOLDOWN = 1.2;
export const CHIRP_IDLE_MIN = 7;
export const CHIRP_IDLE_MAX = 15;
/**
 * Pulso de luz do chilreio: a luzinha incha junto com o som e apaga em 0,45 s.
 *
 * É o que amarra som e luz — quem ouve o chiado vê de onde ele veio, e a luz
 * deixa de ser um enfeite parado.
 */
export const CHIRP_PULSE_DURATION = 0.45;

/** Quanto do pulso ainda resta (0..1), a partir do tempo que falta. */
export function chirpPulse(restante, duration = CHIRP_PULSE_DURATION) {
    const r = Number(restante);
    if (!(r > 0) || !(duration > 0)) return 0;
    return Math.min(1, r / duration);
}

/**
 * O jogador assusta o Mofim agora?
 *
 * `playerSpeed` é a velocidade horizontal (m/s) e `crouching` é o estado real de
 * agachar — não o botão. Agachado nunca assusta: é a regra que faz o modo furtivo
 * valer algo.
 */
export function shouldFlee({
    distance,
    playerSpeed = 0,
    crouching = false,
    scareRadius = SCARE_RADIUS,
    scareSpeed = SCARE_SPEED,
} = {}) {
    if (crouching) return false;
    if (!(distance <= scareRadius)) return false;
    return playerSpeed >= scareSpeed;
}

/**
 * Qual Mofim está na mira do golpe? Devolve o mais próximo que estiver dentro do
 * alcance e da abertura, ou `null`.
 *
 * Aceita posições simples (`{x, y, z}`) — nada de Three aqui.
 */
export function creatureInReach(entities, origin, direction, {
    reach = HIT_REACH,
    minDot = HIT_MIN_DOT,
    // Quem estiver mais longe que isso não leva o golpe: no jogo é a distância
    // do bloco na mira — se o bloco está na frente, o Mofim está atrás dele.
    maxDistance = Infinity,
} = {}) {
    if (!entities?.length || !direction) return null;
    const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
    const dx = direction.x / length, dy = direction.y / length, dz = direction.z / length;
    let best = null;
    let bestScore = Infinity;
    for (const entity of entities) {
        // Sumindo ao amanhecer ele já não é alvo: bater num bicho que está
        // desaparecendo roubaria o quadro da mineração sem acertar nada.
        if (entity.leaving) continue;
        // O corpo do Mofim fica a ~0,45 do chão onde está a origem dele — e, no
        // ar (pulo, planeio, voo), a altura que vale é a que se vê.
        const bodyY = Number.isFinite(entity.visualY) ? entity.visualY : entity.y;
        const ex = entity.x - origin.x;
        const ey = bodyY + 0.45 - origin.y;
        const ez = entity.z - origin.z;
        const distance = Math.hypot(ex, ey, ez);
        if (distance > reach || distance > maxDistance || distance === 0) continue;
        const dot = (ex * dx + ey * dy + ez * dz) / distance;
        if (dot < minDot) continue;
        // Mais perto e mais alinhado ganha; distância domina.
        const score = distance - dot;
        if (score < bestScore) { bestScore = score; best = entity; }
    }
    return best;
}

/**
 * Vale um chilreio agora? Devolve o motivo (`'startle'`, `'panic'`, `'idle'`) ou
 * `null`.
 *
 * O silêncio é o padrão: chilreio de criatura é enfeite, e três bichos chilreando
 * sem parada viram zumbido. Por isso há alcance, espera entre chamados e um
 * sorteio longo para o chamado de quem está só passeando.
 */
export function chirpFor({
    at,
    distance,
    scared = false,
    pending = null,
    lastChirpAt = -Infinity,
    nextIdleAt = Infinity,
    cooldown = CHIRP_COOLDOWN,
    range = CHIRP_RANGE,
} = {}) {
    if (!(distance <= range)) return null;
    if (at - lastChirpAt < cooldown) return null;
    if (pending) return pending;
    if (scared) return 'panic';
    if (at >= nextIdleAt) return 'idle';
    return null;
}

/**
 * Altura do corpo durante o pulo do degrau.
 *
 * Sobe até `altura` acima do destino e desce até pousar nele — um arco de salto,
 * não uma rampa. Rampa (linear + seno) quase não levanta o corpo quando o degrau
 * é de 1 bloco, e o pulo fica invisível.
 */
export function hopHeightAt(from, to, progress, altura = HOP_HEIGHT) {
    if (!(progress > 0)) return from;
    if (progress >= 1) return to;
    const peak = to + altura;
    const subida = 0.6;
    return progress < subida
        ? from + (peak - from) * (progress / subida)
        : peak + (to - peak) * ((progress - subida) / (1 - subida));
}

/**
 * Altura do corpo ao descer um degrau, com as asas abertas.
 *
 * É o inverso do pulo: desce depressa no começo e **pousa devagar** (a curva
 * desacelera até parar no chão). Queda `to + (from - to) * (1 - p)²` — sem
 * "quique", sem passar do chão.
 */
export function glideHeightAt(from, to, progress) {
    if (!(progress > 0)) return from;
    if (progress >= 1) return to;
    const queda = 1 - progress;
    return to + (from - to) * queda * queda;
}

/**
 * Altura do corpo durante o voo curto.
 *
 * Arco único: sai de `from`, sobe `height` acima da reta e desce em `to` — o
 * pico cai no meio do trajeto. Linear puro passaria raspando no chão, e o
 * "voo" viraria um deslize.
 */
export function flightHeightAt(from, to, progress, height = FLIGHT_HEIGHT) {
    if (!(progress > 0)) return from;
    if (progress >= 1) return to;
    const p = Number(progress);
    return from + (to - from) * p + height * Math.sin(Math.PI * p);
}

/** Curva suave de 0 a 1 (acelera no meio, trava nas pontas). */
function smoothstep(q) {
    const t = Math.min(1, Math.max(0, q));
    return t * t * (3 - 2 * t);
}

/**
 * Altura do corpo durante a travessia (o voo maior).
 *
 * Diferente do voo curto, aqui o ponto alto não fica no meio: ele **sobe rápido**
 * nos primeiros 32% do trajeto e passa o resto planando. A descida é uma curva em
 * S — segura a altura no começo (é o que dá a cara de rasante) e alivia perto do
 * chão, para o pouso não ser um tombo.
 */
export function crossHeightAt(from, to, progress, height = CROSS_HEIGHT, rise = CROSS_RISE) {
    if (!(progress > 0)) return from;
    if (progress >= 1) return to;
    const p = Number(progress);
    const peak = Math.max(from, to) + height;
    if (p < rise) return from + (peak - from) * smoothstep(p / rise);
    return peak + (to - peak) * smoothstep((p - rise) / (1 - rise));
}

/**
 * Vale tentar a travessia agora? Só quando o chão barra o passo **e** já passou a
 * espera da última tentativa — sem esse relógio ele tentaria de novo a cada
 * quadro contra a mesma margem.
 */
export function crossFlightFor({ at, nextCrossAt = Infinity, blocked = false } = {}) {
    if (!blocked) return false;
    const now = Number(at);
    if (!Number.isFinite(now)) return false;
    return now >= Number(nextCrossAt);
}

/**
 * Vale sair voando agora? Devolve o motivo (`'escape'`, `'wander'`) ou `null`.
 *
 * - **`'escape'`**: fugindo e o chão não deu passagem (lago, encosta, buraco).
 *   Não espera sorteio: é a saída do bicho encurralado.
 * - **`'wander'`**: passeio de vez em quando, no relógio de `nextFlightAt` —
 *   voar a toda hora achataria o resto do comportamento.
 * - **`null`**: fica no chão. Quem foge com o caminho livre corre: voar seria
 *   fuga fácil demais.
 */
export function flightFor({ at, nextFlightAt = Infinity, fleeing = false, blocked = false } = {}) {
    if (blocked) return fleeing ? 'escape' : null;
    const now = Number(at);
    if (!Number.isFinite(now)) return null;
    return now >= Number(nextFlightAt) ? 'wander' : null;
}

/**
 * A chegada acabou? `true` = pode voltar a passear por ali.
 *
 * Três motivos para terminar, todos na mesma função pura: já chegou perto o
 * bastante, passou do tempo (o jogador foi embora, o caminho enroscou) ou o
 * jogador veio até ele.
 */
export function arrivalDone({
    distance,
    startedAt = 0,
    at = 0,
    stopDistance = ARRIVE_STOP_DISTANCE,
    timeout = ARRIVE_TIMEOUT,
} = {}) {
    const d = Number(distance);
    if (Number.isFinite(d) && d <= stopDistance) return true;
    const elapsed = Number(at) - Number(startedAt);
    if (!Number.isFinite(elapsed)) return true;
    return elapsed >= timeout;
}

/** Gira um vetor 2D: usado para desviar de encostas enquanto foge. */
function rotate2(x, z, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: x * c - z * s, z: x * s + z * c };
}

/** Tamanhos do corpo que a animação mexe (o desenho e a animação têm de bater). */
const EYE_HEIGHT = 0.075;
const TORSO_HEIGHT = 0.34;
const GLOW_SIZE = 0.055;

export function createCreatureSystemClass({
    THREE,
    ID,
    BLOCKS = {},
    CHUNK_SIZE,
    floorDiv = defaultFloorDiv,
    hash2 = defaultHash2,
    now = () => performance.now() * 0.001,
    onChirp = () => {},
    onDeath = () => {},
}) {
    class CreatureSystem {
        constructor(world) {
            this.world = world;
            this.entities = [];
            this.nextSpawnAt = 0;
            this.spawnAttempt = 0;
            this.nextId = 1;
            // Lado de onde a noite inteira chega; zera quando o dia volta.
            this.arrivalBearing = null;
            this.cube = new THREE.BoxGeometry(1, 1, 1);
            this.materials = {
                body: new THREE.MeshLambertMaterial({ color: 0x438f78 }),
                belly: new THREE.MeshLambertMaterial({ color: 0xb7d8a1 }),
                wing: new THREE.MeshLambertMaterial({ color: 0xb8e5d8, transparent: true, opacity: 0.78 }),
                eye: new THREE.MeshLambertMaterial({ color: 0x173b42 }),
                glow: new THREE.MeshBasicMaterial({ color: 0xf2c86b }),
            };
        }

        /** Chão serve se for sólido: grama, terra, areia, pedra, neve… */
        isGround(type) {
            return type !== 0 && (BLOCKS[type]?.solid ?? true);
        }

        /**
         * Ele atravessa o que não é sólido — grama alta, tocha, flor — mas não
         * água: sem isso ficava preso na primeira touceira do caminho (a grama
         * alta ocupava a célula de cima e a coluna era recusada) e, num campo
         * cheio dela, nem nascia.
         */
        isClear(type) {
            if (type === 0) return true;
            const block = BLOCKS[type];
            if (!block) return true;
            return !(block.solid ?? true) && block.render !== 'liquid';
        }

        surfaceAt(x, z) {
            const bx = Math.floor(x), bz = Math.floor(z);
            if (!this.world.getChunk(floorDiv(bx, CHUNK_SIZE), floorDiv(bz, CHUNK_SIZE))) return null;
            const y = this.world.generator.heightAt(bx, bz);
            if (!this.isGround(this.world.getBlock(bx, y, bz))) return null;
            if (!this.isClear(this.world.getBlock(bx, y + 1, bz))) return null;
            if (!this.isClear(this.world.getBlock(bx, y + 2, bz))) return null;
            return y + 1;
        }

        addPart(group, material, x, y, z, sx, sy, sz) {
            const mesh = new THREE.Mesh(this.cube, material);
            mesh.position.set(x, y, z);
            mesh.scale.set(sx, sy, sz);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            group.add(mesh);
            return mesh;
        }

        /**
         * O corpo do Mofim.
         *
         * Tudo é caixa — é o estilo do jogo —, mas as caixas fazem um trabalho:
         * orelhas e cauda quebram a silhueta de bloco, o focinho separa a cara do
         * resto, os pés tiram o corpo do ar (antes ele flutuava 0,07 do chão) e a
         * luzinha virou a ponta de uma antena, em vez de uma caixinha solta acima
         * da cabeça.
         *
         * `tone` (0..1) desloca um pouco o matiz: os três da noite não são clones.
         */
        createModel(tone = 0.5) {
            const group = new THREE.Group();
            // Cópia do material por criatura: o clarão do dano não pode pintar as
            // outras (os materiais são compartilhados pelo sistema).
            const base = this.materials.body.color.clone()
                .offsetHSL((tone - 0.5) * 0.07, (tone - 0.5) * 0.05, (tone - 0.5) * 0.07);
            const body = new THREE.MeshLambertMaterial({ color: base });
            // Olhos com material próprio: acendem à noite e piscam.
            const eye = new THREE.MeshLambertMaterial({ color: 0x173b42 });
            const torso = this.addPart(group, body, 0, 0.24, 0, 0.46, 0.34, 0.42);
            torso.name = 'torso';
            this.addPart(group, this.materials.belly, 0, 0.18, 0.215, 0.28, 0.18, 0.025).name = 'belly';
            this.addPart(group, body, 0, 0.43, 0.105, 0.30, 0.28, 0.28).name = 'head';
            // Focinho claro + nariz: a cara deixa de ser a parede do corpo.
            this.addPart(group, this.materials.belly, 0, 0.395, 0.245, 0.15, 0.10, 0.05).name = 'muzzle';
            this.addPart(group, this.materials.eye, 0, 0.405, 0.275, 0.05, 0.035, 0.02).name = 'nose';
            // Orelhas: o que faz a silhueta ler como bicho de longe.
            const leftEar = this.addPart(group, body, -0.10, 0.58, 0.09, 0.075, 0.13, 0.05);
            const rightEar = this.addPart(group, body, 0.10, 0.58, 0.09, 0.075, 0.13, 0.05);
            leftEar.rotation.z = -0.22;
            rightEar.rotation.z = 0.22;
            leftEar.name = 'ear';
            rightEar.name = 'ear';
            const leftEye = this.addPart(group, eye, -0.078, 0.47, 0.252, 0.055, 0.075, 0.03);
            const rightEye = this.addPart(group, eye, 0.078, 0.47, 0.252, 0.055, 0.075, 0.03);
            leftEye.name = 'eye';
            rightEye.name = 'eye';
            // Asas de mariposa. Cada lado é um conjunto preso no **ombro** (antes
            // era uma placa girando em torno do próprio meio, e a ponta mal se mexia):
            // asa dianteira maior, traseira menor e articulada, borda escura e a
            // mancha clara — é o que dá recorte de asa contra o céu da noite.
            const leftWing = new THREE.Group();
            leftWing.position.set(-0.23, 0.34, -0.01);
            leftWing.rotation.z = -0.25;
            leftWing.name = 'wing';
            const rightWing = new THREE.Group();
            rightWing.position.set(0.23, 0.34, -0.01);
            rightWing.rotation.z = 0.25;
            rightWing.name = 'wing';
            group.add(leftWing, rightWing);
            const montarAsa = (pivot, lado) => {
                this.addPart(pivot, this.materials.wing, lado * 0.12, 0, 0, 0.26, 0.13, 0.035).name = 'forewing';
                const traseira = this.addPart(pivot, this.materials.wing, lado * 0.09, -0.09, -0.035, 0.20, 0.10, 0.03);
                traseira.name = 'hindwing';
                this.addPart(pivot, this.materials.eye, lado * 0.245, 0, 0, 0.03, 0.13, 0.038).name = 'wing-edge';
                this.addPart(pivot, this.materials.belly, lado * 0.13, 0.01, 0.019, 0.07, 0.07, 0.006).name = 'wing-spot';
                return traseira;
            };
            const leftHind = montarAsa(leftWing, -1);
            const rightHind = montarAsa(rightWing, 1);
            // Pés: encostam no chão, então ele pisa em vez de flutuar.
            this.addPart(group, body, -0.13, 0.06, 0.07, 0.09, 0.09, 0.15).name = 'foot';
            this.addPart(group, body, 0.13, 0.06, 0.07, 0.09, 0.09, 0.15).name = 'foot';
            const tail = this.addPart(group, body, 0, 0.30, -0.31, 0.08, 0.20, 0.08);
            tail.rotation.x = -0.3;
            tail.name = 'tail';
            // Luzinha na ponta da antena (antes ela boiava acima da cabeça).
            this.addPart(group, this.materials.eye, 0, 0.60, 0.06, 0.02, 0.10, 0.02).name = 'antenna';
            const glowMesh = this.addPart(group, this.materials.glow, 0, 0.665, 0.06, 0.055, 0.055, 0.055);
            glowMesh.name = 'lantern';
            return {
                group, leftWing, rightWing, leftHind, rightHind, torso,
                bodyMaterial: body, eyeMaterial: eye,
                eyeMeshes: [leftEye, rightEye], glowMesh,
            };
        }

        trySpawn(playerPos, at, night = 1) {
            if (!isMofimTime(night)) {
                // De dia não há chegada: a próxima noite escolhe outro lado.
                this.arrivalBearing = null;
                return;
            }
            if (at < this.nextSpawnAt || this.entities.length >= CREATURE_LIMIT) return;
            this.nextSpawnAt = at + 4.5;
            const seed = this.world.seed + this.spawnAttempt++ * 7919;
            // Os da mesma noite entram pelo mesmo lado: é o que faz a chegada
            // parecer um grupo vindo de longe, e não três bichos surgindo em
            // pontos aleatórios do horizonte.
            if (this.arrivalBearing === null) {
                this.arrivalBearing = hash2(seed, 0, 977) * Math.PI * 2;
            }
            for (let attempt = 0; attempt < 10; attempt++) {
                const angle = this.arrivalBearing
                    + (hash2(seed, attempt, 41) - 0.5) * ARRIVE_SPREAD;
                const distance = SPAWN_MIN_DISTANCE + hash2(seed, attempt, 89) * (SPAWN_MAX_DISTANCE - SPAWN_MIN_DISTANCE);
                const x = playerPos.x + Math.cos(angle) * distance;
                const z = playerPos.z + Math.sin(angle) * distance;
                const y = this.surfaceAt(x, z);
                if (y === null) continue;
                if (this.entities.some(e => (e.x - x) ** 2 + (e.z - z) ** 2 < ARRIVE_MIN_GAP ** 2)) continue;
                const model = this.createModel(hash2(seed, attempt, 173));
                model.group.position.set(x, y, z);
                this.world.scene.add(model.group);
                this.entities.push({
                    id: this.nextId++, x, y, z, targetX: x, targetZ: z, turnAt: at,
                    phase: hash2(seed, attempt, 131) * Math.PI * 2, heading: 0,
                    scaredUntil: 0, lastHitAt: -Infinity,
                    lastChirpAt: -Infinity, chirpPending: null,
                    nextIdleAt: at + CHIRP_IDLE_MIN + hash2(seed, attempt, 211) * (CHIRP_IDLE_MAX - CHIRP_IDLE_MIN),
                    health: MOFIM_HEALTH, hurtUntil: 0,
                    blinkAt: at + BLINK_MIN + hash2(seed, attempt, 617) * (BLINK_MAX - BLINK_MIN),
                    blinkT: 0,
                    // Pulso de luz do chilreio (0 = apagado). O jogo lê isto para
                    // fazer a PointLight do bicho inchar junto com o som.
                    pulseT: 0, lightPulse: 0,
                    // Chegada ao anoitecer: nasce longe e vem andando até perto.
                    arriving: true, arriveAt: at,
                    leaving: false, leaveT: 0, leaveFromY: y,
                    hopFrom: 0, hopTo: 0, hopT: HOP_DURATION,
                    glideFrom: y, glideT: GLIDE_DURATION, visualY: y, glidePitch: 0,
                    flight: null,
                    nextFlightAt: at + FLIGHT_IDLE_MIN
                        + hash2(seed, attempt, 401) * (FLIGHT_IDLE_MAX - FLIGHT_IDLE_MIN),
                    // A travessia não tem horário: ela só acontece quando o chão
                    // fecha o caminho. Isto é a espera depois de uma tentativa.
                    nextCrossAt: 0,
                    ...model,
                });
                return;
            }
        }

        /** Faz o Mofim se assustar: foge do ponto `from` pelos próximos segundos. */
        scare(entity, at, from) {
            entity.scaredUntil = at + SCARE_DURATION;
            entity.lastHitAt = at;
            // Quem se assusta corre: a chegada tranquila acabou.
            entity.arriving = false;
            // O primeiro chilreio do susto é diferente do resto: é o grito, não o
            // chiado de quem está correndo.
            entity.chirpPending = 'startle';
            // Alvo imediato para longe de quem assustou: sem isso ele levaria
            // até 5 s (o sorteio do vagar) para começar a correr.
            const dx = entity.x - (from?.x ?? entity.x);
            const dz = entity.z - (from?.z ?? entity.z);
            const distance = Math.hypot(dx, dz);
            if (distance > 1e-4) {
                entity.targetX = entity.x + (dx / distance) * 3;
                entity.targetZ = entity.z + (dz / distance) * 3;
            }
        }

        /** Tira o Mofim do mundo e solta o material dele (não é compartilhado). */
        removeEntity(entity) {
            const index = this.entities.indexOf(entity);
            if (index >= 0) this.entities.splice(index, 1);
            this.world.scene.remove(entity.group);
            entity.bodyMaterial?.dispose?.();
        }

        /**
         * O jogador deu um golpe? Assusta o Mofim atingido, tira-lhe um ponto de
         * vida e devolve `{ entity, killed }` — ou `null` se não acertou ninguém.
         * Chamar a cada quadro com o botão apertado é seguro: `HIT_COOLDOWN`
         * impede que um clique vire vários golpes.
         */
        hitFrom(origin, direction, options = {}) {
            const at = now();
            const target = creatureInReach(this.entities, origin, direction, options);
            if (!target || at - target.lastHitAt < HIT_COOLDOWN) return null;
            this.scare(target, at, origin);
            target.health -= 1;
            target.hurtUntil = at + HURT_FLASH;
            // Empurrão: o bicho recua um dedo na direção do golpe. Sem isso o
            // dano não teria resposta visível além do clarão.
            const dx = target.x - origin.x, dz = target.z - origin.z;
            // No ar o empurrão brigaria com o arco do voo: o dano ainda conta,
            // só não mexe no corpo até ele pousar.
            if (!target.flight && Math.hypot(dx, dz) > 1e-4) {
                this.stepToward(target, dx, dz, KNOCKBACK_DISTANCE, 1);
            }
            if (target.health > 0) return { entity: target, killed: false };
            // Sem vida: some do mundo e avisa quem chamou (o jogo solta o pó).
            this.removeEntity(target);
            onDeath(target);
            return { entity: target, killed: true };
        }

        /**
         * Dá um passo na direção pedida, se o chão à frente servir. Devolve
         * `false` quando o caminho está barrado (encosta, água, buraco) — quem
         * chama decide o que fazer, e o passo nunca é dado "no escuro".
         */
        stepToward(e, dirX, dirZ, speed, dt) {
            const length = Math.hypot(dirX, dirZ);
            if (!(length > 1e-6)) return false;
            const step = speed * dt;
            const nx = e.x + (dirX / length) * step;
            const nz = e.z + (dirZ / length) * step;
            const ny = this.surfaceAt(nx, nz);
            if (ny === null || Math.abs(ny - e.y) > STEP_UP) return false;
            if (ny > e.y) {
                e.hopFrom = e.visualY;
                e.hopTo = ny;
                e.hopT = 0;
            } else if (ny < e.y) {
                e.glideFrom = e.visualY;
                e.glideT = 0;
            }
            e.x = nx; e.z = nz; e.y = ny;
            e.heading = Math.atan2(dirX, dirZ);
            return true;
        }

        /**
         * O ar do caminho está livre até a altura do pico? Sem esta checagem o
         * voo atravessaria a encosta: o Mofim tem asa, não é fantasma.
         *
         * A conta começa na altura do corpo (e não na do pouso): uma parede de
         * dois blocos no meio do caminho barra o voo, um degrau de um bloco não
         * — é o mesmo critério do passo, só que pelo ar.
         */
        flightPathClear(e, toX, toZ, toY, height = FLIGHT_HEIGHT) {
            const peak = Math.max(e.y, toY) + height;
            const floorY = Math.floor(Number.isFinite(e.visualY) ? e.visualY : e.y) + 1;
            const steps = Math.max(1, Math.ceil(Math.hypot(toX - e.x, toZ - e.z) / 0.5));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const bx = Math.floor(e.x + (toX - e.x) * t);
                const bz = Math.floor(e.z + (toZ - e.z) * t);
                for (let cy = floorY; cy <= Math.floor(peak); cy++) {
                    if (!this.isClear(this.world.getBlock(bx, cy, bz))) return false;
                }
            }
            return true;
        }

        /**
         * Onde este voo curto pousa? Anda `FLIGHT_DISTANCE` na direção pedida e
         * procura chão firme com o ar livre no caminho; se não houver, tenta
         * voos mais curtos. Sem pouso, não há voo.
         */
        flightTarget(e, dirX, dirZ) {
            const length = Math.hypot(dirX, dirZ);
            if (!(length > 1e-6)) return null;
            const ux = dirX / length, uz = dirZ / length;
            for (const distance of [FLIGHT_DISTANCE, FLIGHT_DISTANCE * 0.7, FLIGHT_DISTANCE * 0.45]) {
                const x = e.x + ux * distance;
                const z = e.z + uz * distance;
                const y = this.surfaceAt(x, z);
                if (y === null) continue;
                if (!this.flightPathClear(e, x, z, y)) continue;
                return { x, y, z };
            }
            return null;
        }

        /** Levanta voo na direção pedida. Devolve `false` se não há onde pousar. */
        startFlight(e, dirX, dirZ, at) {
            // O relógio do próximo passeio anda mesmo quando o voo não sai: é o
            // que evita tentar voar a cada quadro contra a mesma parede.
            e.nextFlightAt = at + FLIGHT_IDLE_MIN
                + hash2(this.world.seed + e.id * 7919, e.id, 401) * (FLIGHT_IDLE_MAX - FLIGHT_IDLE_MIN);
            const target = this.flightTarget(e, dirX, dirZ);
            if (!target) return false;
            e.flight = {
                kind: 'hop',
                t: 0,
                duration: FLIGHT_DURATION,
                fromX: e.x, fromZ: e.z, fromY: e.visualY,
                toX: target.x, toZ: target.z, toY: target.y,
            };
            // O arco do voo manda no corpo agora; nada de pulo/planeio pendente.
            e.hopT = HOP_DURATION;
            e.glideT = GLIDE_DURATION;
            return true;
        }

        /**
         * Onde a travessia pousa? Anda a direção pedida procurando chão firme do
         * outro lado do vão — **do mais longe para o mais perto**, porque atravessar
         * é justamente o ponto: parar no primeiro metro de grama depois do lago
         * não cruza nada.
         *
         * O ar do caminho é checado até a altura do pico da travessia: um barranco
         * de dois blocos reprova, um vão de água passa.
         */
        crossTarget(e, dirX, dirZ) {
            const length = Math.hypot(dirX, dirZ);
            if (!(length > 1e-6)) return null;
            const ux = dirX / length, uz = dirZ / length;
            const passos = Math.round((CROSS_DISTANCE - CROSS_MIN_DISTANCE) / 0.5);
            for (let i = 0; i <= passos; i++) {
                const distance = CROSS_DISTANCE - i * 0.5;
                if (distance < CROSS_MIN_DISTANCE) break;
                const x = e.x + ux * distance;
                const z = e.z + uz * distance;
                const y = this.surfaceAt(x, z);
                if (y === null) continue;
                if (!this.flightPathClear(e, x, z, y, CROSS_HEIGHT)) continue;
                return { x, y, z, distance };
            }
            return null;
        }

        /**
         * Levanta voo para atravessar o que o passo não vence. Devolve `false`
         * quando não há pouso do outro lado — e aí ele volta a andar.
         *
         * O relógio anda mesmo quando a travessia é recusada: sem isso ele
         * tentaria de novo a cada quadro contra a mesma margem.
         */
        startCrossFlight(e, dirX, dirZ, at) {
            e.nextCrossAt = at + CROSS_COOLDOWN;
            const target = this.crossTarget(e, dirX, dirZ);
            if (!target) return false;
            e.flight = {
                kind: 'cross',
                t: 0,
                duration: Math.min(1.8, Math.max(0.5, target.distance / CROSS_SPEED)),
                fromX: e.x, fromZ: e.z, fromY: e.visualY,
                toX: target.x, toZ: target.z, toY: target.y,
            };
            e.hopT = HOP_DURATION;
            e.glideT = GLIDE_DURATION;
            return true;
        }

        /** Um quadro do voo. Devolve `true` enquanto o corpo está no ar. */
        updateFlight(e, dt) {
            const f = e.flight;
            if (!f) return false;
            f.t = Math.min(f.duration, f.t + dt);
            const p = f.duration > 0 ? f.t / f.duration : 1;
            e.x = f.fromX + (f.toX - f.fromX) * p;
            e.z = f.fromZ + (f.toZ - f.fromZ) * p;
            e.visualY = f.kind === 'cross'
                ? crossHeightAt(f.fromY, f.toY, p)
                : flightHeightAt(f.fromY, f.toY, p);
            e.heading = Math.atan2(f.toX - f.fromX, f.toZ - f.fromZ);
            if (p >= 1) {
                e.x = f.toX; e.z = f.toZ;
                e.y = f.toY; e.visualY = f.toY;
                e.flight = null;
            }
            return true;
        }

        /**
         * Um passo da chegada: vem na direção do jogador em passo de passeio e,
         * se o caminho reto está barrado, abre em leque (cada bicho para o seu
         * lado). Devolve `false` quando não há por onde vir — aí ele desiste de
         * vir e passeia por onde está.
         */
        arrivalStep(e, dirX, dirZ, dt) {
            const length = Math.hypot(dirX, dirZ);
            if (!(length > 1e-6)) return false;
            const side = e.id % 2 ? 1 : -1;
            for (const angle of ARRIVE_FAN) {
                const dir = rotate2(dirX, dirZ, angle * side);
                if (this.stepToward(e, dir.x, dir.z, ARRIVE_SPEED, dt)) return true;
            }
            return false;
        }

        /**
         * Fuga: reto para longe e, se o chão barra, diagonais cada vez mais
         * abertas. Antes o alvo de fuga era recalculado a cada quadro e o desvio
         * se perdia — ele ficava parado, tremendo contra a grama alta.
         */
        fleeStep(e, awayX, awayZ, dt) {
            const away = Math.hypot(awayX, awayZ);
            const ax = away > 1e-4 ? awayX / away : 1;
            const az = away > 1e-4 ? awayZ / away : 0;
            const side = e.id % 2 ? 1 : -1;
            // Leque de 0° a ~109°: os ângulos grandes importam porque, encostado
            // num lago ou numa encosta, todas as direções "para longe" ainda
            // apontam para dentro do obstáculo — ele precisa poder correr ao
            // longo dele.
            const angles = [0, side * 0.7, -side * 0.7, side * 1.3, -side * 1.3, side * 1.9, -side * 1.9];
            for (const angle of angles) {
                const dir = rotate2(ax, az, angle);
                if (this.stepToward(e, dir.x, dir.z, FLEE_SPEED, dt)) return true;
            }
            return false;
        }

        update(dt, player, active, { night = 1 } = {}) {
            if (!active) return;
            const at = now();
            const nightNow = Number.isFinite(Number(night)) ? Number(night) : 1;
            const playerPos = player.pos;
            const playerSpeed = Math.hypot(player.vel?.x ?? 0, player.vel?.z ?? 0);
            const crouching = Boolean(player.crouching);

            this.trySpawn(playerPos, at, nightNow);

            for (let i = this.entities.length - 1; i >= 0; i--) {
                const e = this.entities[i];
                const dxp = e.x - playerPos.x, dzp = e.z - playerPos.z;
                const distanceToPlayer = Math.hypot(dxp, dzp);
                if (distanceToPlayer > DESPAWN_DISTANCE) {
                    this.removeEntity(e);
                    continue;
                }

                // Amanheceu: ele sobe, encolhe e some — sem pó, porque não foi
                // abatido. A saída corre em vez de sumir de um quadro para o
                // outro, senão parece bug.
                if (!isMofimTime(nightNow) && !e.leaving) {
                    e.leaving = true;
                    e.leaveT = 0;
                    e.leaveFromY = e.visualY;
                }
                if (e.leaving) {
                    e.leaveT = Math.min(LEAVE_DURATION, e.leaveT + dt);
                    const gone = leaveProgress(e.leaveT);
                    e.group.position.set(e.x, e.leaveFromY + LEAVE_RISE * gone, e.z);
                    e.group.scale.setScalar(Math.max(0.02, 1 - gone));
                    e.group.rotation.x = -0.4 * gone;
                    const flap = Math.sin(at * 30 + e.phase) * 0.35;
                    e.leftWing.rotation.z = -0.1 + flap;
                    e.rightWing.rotation.z = 0.1 - flap;
                    e.leftHind.rotation.z = flap * 0.3;
                    e.rightHind.rotation.z = -flap * 0.3;
                    // O dia chegou: a luzinha apaga junto com ele (antes ela
                    // ficava acesa até o bicho sumir).
                    const flashSaindo = Math.max(0, (e.hurtUntil - at) / HURT_FLASH);
                    e.bodyMaterial.emissive.setRGB(flashSaindo * 0.85, flashSaindo * 0.45, flashSaindo * 0.12);
                    e.eyeMaterial.emissive.setRGB(0, 0, 0);
                    e.lightPulse = 0;
                    e.glowMesh.scale.setScalar(GLOW_SIZE * (1 - gone));
                    if (gone >= 1) this.removeEntity(e);
                    continue;
                }

                if (shouldFlee({ distance: distanceToPlayer, playerSpeed, crouching })) {
                    this.scare(e, at, playerPos);
                }
                const fleeing = at < e.scaredUntil;

                const reason = chirpFor({
                    at,
                    distance: distanceToPlayer,
                    scared: fleeing,
                    pending: e.chirpPending,
                    lastChirpAt: e.lastChirpAt,
                    nextIdleAt: e.nextIdleAt,
                });
                if (reason) {
                    e.lastChirpAt = at;
                    e.chirpPending = null;
                    // O chiado acende a luzinha; ela apaga no meio segundo seguinte.
                    e.pulseT = CHIRP_PULSE_DURATION;
                    if (reason === 'idle') {
                        const seed = this.world.seed + e.id * 7919 + Math.floor(at);
                        e.nextIdleAt = at + CHIRP_IDLE_MIN
                            + hash2(seed, e.id, 307) * (CHIRP_IDLE_MAX - CHIRP_IDLE_MIN);
                    }
                    onChirp({ reason, distance: distanceToPlayer, entity: e });
                } else if (distanceToPlayer > CHIRP_RANGE) {
                    // Longe demais para ser ouvido: o grito não fica guardado
                    // para tocar depois, quando o jogador se aproximar.
                    e.chirpPending = null;
                }

                // Voo curto. No ar, o arco manda no corpo: nem passo, nem alvo
                // de passeio. Quem decide sair voando é `flightFor`.
                const flying = this.updateFlight(e, dt);
                if (!flying) {
                    if (fleeing) {
                        // Primeiro o caminho direto para longe. Se ele está
                        // barrado (lago, encosta), o bicho tenta o ar antes de
                        // sair desviando pelo chão — e, se não houver onde
                        // pousar, desvia como sempre desviou.
                        if (!this.stepToward(e, dxp, dzp, FLEE_SPEED, dt)) {
                            // A beirada se resolve com o voo curto; o lago largo,
                            // só com a travessia. Sem pouso em nenhum dos dois, ele
                            // desvia pelo chão como sempre desviou.
                            const saltou = flightFor({ at, fleeing: true, blocked: true }) === 'escape'
                                && this.startFlight(e, dxp, dzp, at);
                            const cruzou = !saltou && this.startCrossFlight(e, dxp, dzp, at);
                            if (!saltou && !cruzou) this.fleeStep(e, dxp, dzp, dt);
                        }
                    } else if (e.arriving) {
                        // Chegada ao anoitecer: vem andando de longe até perto do
                        // jogador. Enquanto isso não passeia nem sorteia alvo — o
                        // caminho dele é o jogador. Termina ao chegar, ao demorar
                        // demais ou quando não há por onde vir.
                        if (arrivalDone({ distance: distanceToPlayer, startedAt: e.arriveAt, at })
                            || !this.arrivalStep(e, -dxp, -dzp, dt)) {
                            e.arriving = false;
                        }
                    } else {
                        // Passeio: de vez em quando um voo curto no rumo do alvo.
                        if (flightFor({ at, nextFlightAt: e.nextFlightAt }) === 'wander') {
                            const dirX = (e.targetX - e.x) || Math.sin(e.heading);
                            const dirZ = (e.targetZ - e.z) || Math.cos(e.heading);
                            if (!this.startFlight(e, dirX, dirZ, at)) e.nextFlightAt = at + 4;
                        }
                        // O passo do passeio não roda no quadro em que ele saiu
                        // voando (o corpo já está no ar).
                        if (!e.flight) {
                            if (at >= e.turnAt) {
                                const seed = this.world.seed + e.id * 104729 + Math.floor(at * 0.2);
                                const angle = hash2(seed, e.id, 7) * Math.PI * 2;
                                const distancia = 1.5 + hash2(seed, e.id, 13) * 3;
                                e.targetX = e.x + Math.cos(angle) * distancia;
                                e.targetZ = e.z + Math.sin(angle) * distancia;
                                e.turnAt = at + 2 + hash2(seed, e.id, 23) * 3;
                            }
                            const dx = e.targetX - e.x, dz = e.targetZ - e.z;
                            const distance = Math.hypot(dx, dz);
                            // Barrado passeando: se há chão firme do outro lado do
                            // vão, ele atravessa; senão sorteia outro alvo em vez de
                            // insistir contra a mesma margem.
                            if (distance > 0.08 && !this.stepToward(e, dx, dz, WANDER_SPEED, dt)) {
                                const tentar = crossFlightFor({ at, nextCrossAt: e.nextCrossAt, blocked: true });
                                if (!tentar || !this.startCrossFlight(e, dx, dz, at)) e.turnAt = at;
                            }
                        }
                    }
                }

                // No ar, o arco do voo já pôs o corpo na altura certa: pulo e
                // planeio não entram, senão brigariam pelo mesmo `visualY`.
                const airborne = flying || Boolean(e.flight);
                const bob = airborne ? 0 : (fleeing ? 0.02 : 0.035);
                if (!airborne) {
                    e.hopT = Math.min(HOP_DURATION, e.hopT + dt);
                    e.glideT = Math.min(GLIDE_DURATION, e.glideT + dt);
                }
                const hopping = !airborne && e.hopT < HOP_DURATION;
                const gliding = !airborne && !hopping && e.glideT < GLIDE_DURATION;
                if (hopping) e.visualY = hopHeightAt(e.hopFrom, e.y, e.hopT / HOP_DURATION);
                else if (gliding) e.visualY = glideHeightAt(e.glideFrom, e.y, e.glideT / GLIDE_DURATION);
                else if (!airborne) e.visualY = e.y;
                // Clarão do dano (laranja) e brilho próprio da noite (verde-pálido)
                // dividem o mesmo emissive: o golpe manda enquanto dura.
                const flash = Math.max(0, (e.hurtUntil - at) / HURT_FLASH);
                const glow = nightGlow(nightNow, at + e.phase);
                // Pulso do chilreio: anda no tempo do quadro (não no da varredura
                // de luzes) e vale para o desenho e para a PointLight.
                e.pulseT = Math.max(0, e.pulseT - dt);
                const pulso = chirpPulse(e.pulseT);
                e.lightPulse = pulso;
                e.bodyMaterial.emissive.setRGB(
                    flash * 0.85 + glow * 0.35 + pulso * 0.30,
                    flash * 0.45 + glow * 0.75 + pulso * 0.24,
                    flash * 0.12 + glow * 0.45 + pulso * 0.10,
                );
                // Olhos: de dia são dois pontos escuros; à noite, duas luzinhas.
                // É o que faz o bicho ser visto no escuro — o corpo, à noite, é
                // quase silhueta.
                const luz = Math.min(1, glow / 0.16);
                e.eyeMaterial.emissive.setRGB(
                    0.95 * luz + pulso * 0.6,
                    0.68 * luz + pulso * 0.45,
                    0.26 * luz + pulso * 0.2,
                );
                // Piscada: os dois fecham juntos por um instante, de vez em quando.
                e.blinkT = Math.max(0, e.blinkT - dt);
                if (at >= e.blinkAt) {
                    e.blinkT = BLINK_DURATION;
                    const seed = this.world.seed + e.id * 7919 + Math.floor(at);
                    e.blinkAt = at + BLINK_MIN + hash2(seed, e.id, 617) * (BLINK_MAX - BLINK_MIN);
                }
                const olho = e.blinkT > 0 ? BLINK_SHUT : 1;
                for (const eyeMesh of e.eyeMeshes) eyeMesh.scale.y = EYE_HEIGHT * olho;
                // Respiração: o corpo sobe e desce um fio, devagar, sem parar.
                e.torso.scale.y = TORSO_HEIGHT * (1 + 0.03 * Math.sin(at * 2.1 + e.phase));
                // A luzinha da antena cresce no escuro.
                e.glowMesh.scale.setScalar(GLOW_SIZE * (1 + 1.4 * luz + 1.1 * pulso));
                e.group.position.set(e.x, e.visualY + Math.sin(at * 3 + e.phase) * bob, e.z);
                e.group.rotation.y = e.heading;
                // Planando, o corpo inclina um pouco para a frente e as asas
                // abrem na horizontal — é o que faz a descida parecer planeio.
                // Voando, ele sobe de peito erguido e desce de bico baixo.
                const flightProgress = e.flight ? e.flight.t / e.flight.duration : 0;
                // Na travessia ele sobe de peito erguido e passa o resto do
                // trajeto de bico baixo, planando: asas abertas, batidas lentas.
                const crossFlight = e.flight?.kind === 'cross';
                const pitchTarget = airborne
                    ? (crossFlight
                        ? (flightProgress < CROSS_RISE ? -0.24 : 0.14)
                        : (flightProgress < 0.5 ? -0.2 : 0.2))
                    : (gliding ? 0.2 : 0);
                e.glidePitch += (pitchTarget - e.glidePitch) * Math.min(1, 10 * dt);
                e.group.rotation.x = e.glidePitch;
                const wingBase = airborne ? (crossFlight ? 0 : 0.02) : (gliding ? 0.03 : 0.25);
                const flapSpeed = airborne
                    ? (crossFlight ? 13 : 26)
                    : (gliding ? 5 : (fleeing ? 22 : 8));
                // Amplitudes menores que as de antes: com o pivô no ombro a ponta
                // da asa percorre o dobro, e o bater exagerado virava borboleta.
                const flapAmp = airborne
                    ? (crossFlight ? 0.2 : 0.32)
                    : (gliding ? 0.05 : (fleeing ? 0.24 : 0.12));
                const flap = Math.sin(at * flapSpeed + e.phase) * flapAmp;
                e.leftWing.rotation.z = -wingBase + flap;
                e.rightWing.rotation.z = wingBase - flap;
                // A asa de trás acompanha o bater com atraso (articulação): sem
                // isso as duas peças giram juntas e o conjunto vira um remo.
                e.leftHind.rotation.z = flap * 0.3;
                e.rightHind.rotation.z = -flap * 0.3;
            }
        }
    }
    return CreatureSystem;
}
