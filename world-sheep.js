/**
 * A ovelha: a primeira criatura de **dia** do mundo.
 *
 * O Mofim é bicho de noite, com medo, luz e voo. A ovelha é o oposto em tudo: de
 * dia, mansa e devagar. Essa diferença é o motivo de existir este arquivo em vez
 * de mais um `if` dentro do Mofim — o que as duas compartilham (achar chão, dar
 * passo, subir degrau) já mora em `world-creature-base.js`.
 *
 * Neste primeiro recorte ela **existe, nasce e vaga**:
 *
 * - nasce de dia (o céu decide) em campo de grama, entre 16 e 30 blocos do
 *   jogador, no máximo quatro por vez — como o Mofim, nasce longe e chega
 *   andando, em vez de aparecer parada ao lado;
 * - vaga devagar (0,55 bloco/s, contra 0,72 do Mofim), sorteando um alvo perto a
 *   cada 3–8 s;
 * - **não foge**: é mansa. Quem chega perto, agachado ou correndo, não muda nada
 *   no pasto. O susto (e o golpe) entram depois, junto com a lã.
 *
 * Três cores de lã, sorteadas no nascimento: branca (68%), cinza (20%) e preta
 * (12%). A cor é decidida por `coatFor(roll)`, uma função pura — o teste confere
 * as faixas sem precisar de THREE nem de mundo.
 */

import { createCreatureBaseClass, glideHeightAt, hopHeightAt } from './world-creature-base.js';
import { floorDiv as defaultFloorDiv } from './world-grid.js';
import { hash2 as defaultHash2 } from './world-math.js';

/** Quantas ovelhas cabem no mundo ao mesmo tempo. */
export const SHEEP_LIMIT = 4;
/** Intervalo entre tentativas de nascimento (segundos). */
export const SHEEP_SPAWN_INTERVAL = 6;
/**
 * Distância em que ela nasce do jogador.
 *
 * Longe o suficiente para não aparecer no campo de visão e perto o suficiente
 * para ser encontrada andando — a mesma ideia do Mofim, com um pouco menos de
 * distância porque é de dia e ela não vem "chegando".
 */
export const SHEEP_SPAWN_MIN_DISTANCE = 16;
export const SHEEP_SPAWN_MAX_DISTANCE = 30;
/** Leque de desvios em volta do jogador, para as quatro não nascerem em fila. */
export const SHEEP_SPAWN_SPREAD = 1.6;
/** Longe demais, ela sai da cena (some sem morrer). */
export const SHEEP_DESPAWN_DISTANCE = 44;
/** Nenhuma nasce colada em outra: ovelha é bicho de pasto, não de fila. */
export const SHEEP_MIN_GAP = 6;

/** Velocidade do pasto (blocos por segundo) — devagar de propósito. */
export const SHEEP_WANDER_SPEED = 0.55;
/** De quanto em quanto tempo ela escolhe outro ponto (segundos). */
export const SHEEP_TURN_MIN = 3.2;
export const SHEEP_TURN_MAX = 8;
/** Raio do passeio em volta de onde ela está. */
export const SHEEP_ROAM_MIN = 1.4;
export const SHEEP_ROAM_MAX = 4.2;
/** Abaixo disto o alvo conta como alcançado. */
export const SHEEP_ARRIVE = 0.15;

/**
 * A partir de que ponto do dia ela aparece.
 *
 * O jogo passa `day` de 0 (noite fechada) a 1 (dia claro) — `worldSky.day`. O
 * limiar fica acima do meio para ela nascer com o sol já subindo e sumir de
 * cena só quando a noite chega (o Mofim aparece justamente aí).
 */
export const SHEEP_DAY_THRESHOLD = 0.45;

/** Passada das patas: velocidade do ciclo e amplitude (radianos). */
export const SHEEP_STRIDE_SPEED = 5.4;
export const SHEEP_LEG_SWING = 0.5;
/** Duração do arco ao subir/decer degrau (segundos e blocos). */
export const SHEEP_HOP_TIME = 0.24;
export const SHEEP_GLIDE_TIME = 0.3;

// ---------------------------------------------------------------- a arte da ovelha
//
// Medidas em blocos, com o **pé no y = 0** (o grupo é posto na altura do chão).
// O desenho escolhido no comparativo de opções foi o "fofinho": a lã não é um
// bloco só, e sim um miolo com tufos em volta — é o que faz a silhueta ser de
// ovelha e não de porco de caixa. Junto vieram o casco escuro e o brilho no
// olho, que dão leitura de bicho de perto.

/**
 * Altura da pata e do casco (blocos). A pata gira no quadril, o casco vai junto.
 *
 * A pata entra um dedo dentro da lã (a barriga fica em 0,39): sem essa sobra
 * aparecia uma fresta entre a perna e o corpo, e a ovelha parecia flutuar.
 */
export const SHEEP_LEG_HEIGHT = 0.4;
export const SHEEP_HOOF_HEIGHT = 0.08;
const SHEEP_LEG_WIDTH = 0.16;

/** Os quatro cantos onde ficam as patas (frente-esquerda, frente-direita, trás…). */
export const SHEEP_LEG_SPOTS = Object.freeze([
    Object.freeze({ x: 0.18, z: 0.27 }),
    Object.freeze({ x: -0.18, z: 0.27 }),
    Object.freeze({ x: 0.18, z: -0.27 }),
    Object.freeze({ x: -0.18, z: -0.27 }),
]);

/**
 * Os tufos de lã em volta do corpo.
 *
 * Cada um é uma caixa de tamanho diferente: é a irregularidade deles que dá o
 * "fofinho". Mexer aqui muda a silhueta sem tocar em mais nada.
 */
export const SHEEP_TUFTS = Object.freeze([
    // laterais da frente e de trás
    Object.freeze({ x: -0.26, y: 0.62, z: 0.36, sx: 0.24, sy: 0.22, sz: 0.2 }),
    Object.freeze({ x: 0.24, y: 0.6, z: 0.34, sx: 0.22, sy: 0.2, sz: 0.2 }),
    Object.freeze({ x: -0.24, y: 0.6, z: -0.32, sx: 0.22, sy: 0.2, sz: 0.2 }),
    Object.freeze({ x: 0.24, y: 0.62, z: -0.3, sx: 0.2, sy: 0.22, sz: 0.22 }),
    // flancos (mais altos, para a barriga não virar um bloco reto)
    Object.freeze({ x: -0.3, y: 0.62, z: 0.02, sx: 0.18, sy: 0.3, sz: 0.34 }),
    Object.freeze({ x: 0.3, y: 0.62, z: -0.02, sx: 0.18, sy: 0.3, sz: 0.34 }),
    // lombo
    Object.freeze({ x: -0.12, y: 0.9, z: -0.12, sx: 0.22, sy: 0.16, sz: 0.24 }),
    Object.freeze({ x: 0.14, y: 0.9, z: 0.06, sx: 0.2, sy: 0.16, sz: 0.2 }),
    Object.freeze({ x: 0.02, y: 0.88, z: -0.4, sx: 0.2, sy: 0.18, sz: 0.18 }),
]);

/**
 * As três lãs, com a fatia de sorteio de cada uma.
 *
 * `upTo` é cumulativo: o sorteio é um número em [0, 1) e vale a primeira faixa
 * que o alcança. Somar as fatias (0,68 / 0,20 / 0,12) é o que o teste confere.
 */
export const SHEEP_COATS = [
    { key: 'white', label: 'branca', wool: 0xe9e4d6, upTo: 0.68 },
    { key: 'gray', label: 'cinza', wool: 0x9a9a94, upTo: 0.88 },
    { key: 'black', label: 'preta', wool: 0x3a3a3c, upTo: 1 },
];

/** Cor da lã sorteada para um número em [0, 1). */
export function coatFor(roll) {
    const value = Number.isFinite(roll) ? roll : 0;
    const clamped = value < 0 ? 0 : value >= 1 ? 0.999999 : value;
    return SHEEP_COATS.find(coat => clamped < coat.upTo) ?? SHEEP_COATS[SHEEP_COATS.length - 1];
}

/** É hora de ovelha no pasto? O céu diz (`day` de 0 a 1); sem céu, não é. */
export function isPastureTime(day) {
    const value = Number(day);
    return Number.isFinite(value) && value >= SHEEP_DAY_THRESHOLD;
}

/**
 * Onde ela nasce: um ponto em volta do jogador, sorteado por tentativa.
 *
 * Separado do sistema para o teste poder conferir distância e espalhamento sem
 * mundo nenhum.
 */
export function spawnPointFor({
    origin = { x: 0, z: 0 },
    seed = 0,
    attempt = 0,
    hash2 = defaultHash2,
} = {}) {
    const angle = hash2(seed, attempt, 41) * Math.PI * 2;
    const distance = SHEEP_SPAWN_MIN_DISTANCE
        + hash2(seed, attempt, 89) * (SHEEP_SPAWN_MAX_DISTANCE - SHEEP_SPAWN_MIN_DISTANCE);
    return {
        x: origin.x + Math.cos(angle) * distance,
        z: origin.z + Math.sin(angle) * distance,
        angle,
        distance,
    };
}

/** Alvo do próximo trecho de pasto, em volta de onde ela está. */
export function wanderTargetFor({
    x = 0, z = 0, seed = 0, id = 0, at = 0, hash2 = defaultHash2,
} = {}) {
    const sorteio = seed + id * 104729 + Math.floor(at * 0.25);
    const angle = hash2(sorteio, id, 7) * Math.PI * 2;
    const distance = SHEEP_ROAM_MIN + hash2(sorteio, id, 13) * (SHEEP_ROAM_MAX - SHEEP_ROAM_MIN);
    const duration = SHEEP_TURN_MIN + hash2(seed + id * 7919, Math.floor(at * 0.5), 23)
        * (SHEEP_TURN_MAX - SHEEP_TURN_MIN);
    return { x: x + Math.cos(angle) * distance, z: z + Math.sin(angle) * distance, duration };
}

/**
 * Rotação das quatro patas para uma fase da passada.
 *
 * Em diagonal (frente-esquerda com trás-direita, e vice-versa): é assim que um
 * quadrúpede anda, e é o que faz quatro patas parecerem um passo em vez de um
 * trem. Ordem: frente-esquerda, frente-direita, trás-esquerda, trás-direita.
 */
export function legPose(stride) {
    const swing = Math.sin(stride) * SHEEP_LEG_SWING;
    return [swing, -swing, -swing, swing];
}

export function createSheepSystemClass({
    THREE,
    ID,
    BLOCKS = {},
    CHUNK_SIZE,
    floorDiv = defaultFloorDiv,
    hash2 = defaultHash2,
    now = () => performance.now() * 0.001,
}) {
    const CreatureBase = createCreatureBaseClass({ THREE, BLOCKS, CHUNK_SIZE, floorDiv });

    class SheepSystem extends CreatureBase {
        constructor(world) {
            super(world);
            this.nextSpawnAt = 0;
            this.spawnAttempt = 0;
            // Pele do focinho, olho e casco: iguais em todas, então são
            // compartilhados. A lã é uma por cor e também é compartilhada (a
            // ovelha não pisca nem leva golpe neste recorte: nada pinta o corpo
            // dela em tempo de execução).
            this.materials = {
                skin: new THREE.MeshLambertMaterial({ color: 0xd8c7ae }),
                eye: new THREE.MeshLambertMaterial({ color: 0x1c1a17 }),
                // Brilho do olho: um ponto claro que só se vê de perto, mas é o
                // que faz a cara parecer viva em vez de dois buracos.
                glint: new THREE.MeshLambertMaterial({ color: 0xf4f4f4 }),
                hoof: new THREE.MeshLambertMaterial({ color: 0x4a4038 }),
            };
            this.coatMaterials = new Map(SHEEP_COATS.map(coat => [
                coat.key, new THREE.MeshLambertMaterial({ color: coat.wool }),
            ]));
        }

        /**
         * O corpo da ovelha.
         *
         * Tudo caixa — o estilo do jogo —, mas a lã não é um bloco só: é um
         * miolo com nove tufos em volta (`SHEEP_TUFTS`), um topete entre as
         * orelhas e um rabo. É essa irregularidade que faz a silhueta ler como
         * ovelha a vinte blocos de distância.
         *
         * Cada peça tem um trabalho e um nome, porque o teste e a animação
         * dependem deles: `body` (miolo), `tuft`, `head`, `topknot`, `muzzle`,
         * `eye`, `glint`, `ear`, `leg` (com `shin` e `hoof` dentro), `tail`.
         *
         * As patas são **grupos** com o pivô no quadril: ao girar, a pata e o
         * casco andam juntos, como perna de verdade — antes a caixa girava no
         * próprio centro e o casco ficaria plantado no chão.
         */
        createModel(coatKey = 'white') {
            const group = new THREE.Group();
            const wool = this.coatMaterials.get(coatKey) ?? this.coatMaterials.get('white');
            const part = (x, y, z, sx, sy, sz, material, name) => {
                const mesh = this.addPart(group, material, x, y, z, sx, sy, sz);
                mesh.name = name;
                return mesh;
            };

            part(0, 0.62, 0, 0.54, 0.46, 0.78, wool, 'body');
            const tufts = SHEEP_TUFTS.map(tuft => part(
                tuft.x, tuft.y, tuft.z, tuft.sx, tuft.sy, tuft.sz, wool, 'tuft',
            ));

            // Cabeça, topete e cara.
            const head = part(0, 0.8, 0.52, 0.36, 0.32, 0.32, wool, 'head');
            head.rotation.x = 0.1;
            part(0, 0.99, 0.48, 0.2, 0.12, 0.18, wool, 'topknot');
            part(0, 0.73, 0.7, 0.24, 0.16, 0.06, this.materials.skin, 'muzzle');

            const eyes = [];
            const glints = [];
            for (const side of [1, -1]) {
                eyes.push(part(side * 0.11, 0.85, 0.69, 0.06, 0.06, 0.03, this.materials.eye, 'eye'));
                // O brilho fica no canto de cima do olho, do mesmo lado.
                glints.push(part(side * 0.095, 0.87, 0.705, 0.02, 0.02, 0.02, this.materials.glint, 'glint'));
            }

            // Orelhas: deitadas para os lados e caídas. É a diferença de leitura
            // mais barata entre a ovelha e qualquer outro bicho de caixa.
            const ears = [1, -1].map(side => {
                const ear = part(side * 0.26, 0.8, 0.48, 0.28, 0.07, 0.12, wool, 'ear');
                ear.rotation.z = -side * 0.34;
                return ear;
            });

            const legs = SHEEP_LEG_SPOTS.map(spot => {
                const hip = new THREE.Group();
                hip.name = 'leg';
                hip.position.set(spot.x, SHEEP_LEG_HEIGHT, spot.z);
                const shin = this.addPart(hip, wool, 0, -SHEEP_LEG_HEIGHT / 2, 0,
                    SHEEP_LEG_WIDTH, SHEEP_LEG_HEIGHT, SHEEP_LEG_WIDTH);
                shin.name = 'shin';
                const hoof = this.addPart(hip, this.materials.hoof, 0,
                    -SHEEP_LEG_HEIGHT + SHEEP_HOOF_HEIGHT / 2, 0,
                    SHEEP_LEG_WIDTH + 0.01, SHEEP_HOOF_HEIGHT, SHEEP_LEG_WIDTH + 0.01);
                hoof.name = 'hoof';
                group.add(hip);
                return hip;
            });

            const tail = part(0, 0.78, -0.5, 0.14, 0.16, 0.12, wool, 'tail');

            return { group, head, tufts, eyes, glints, ears, legs, tail, coat: coatKey };
        }

        trySpawn(playerPos, at, day = 1) {
            if (!isPastureTime(day)) return;
            if (at < this.nextSpawnAt || this.entities.length >= SHEEP_LIMIT) return;
            this.nextSpawnAt = at + SHEEP_SPAWN_INTERVAL;
            const seed = this.world.seed + this.spawnAttempt++ * 7919;
            for (let attempt = 0; attempt < 12; attempt++) {
                const point = spawnPointFor({ origin: playerPos, seed, attempt, hash2 });
                const y = this.surfaceAt(point.x, point.z);
                if (y === null) continue;
                // Só em pasto: areia, pedra e água ficam de fora — é ovelha, não
                // bicho de deserto.
                if (this.groundTypeAt(point.x, point.z) !== ID.GRASS) continue;
                if (this.countNear(point.x, point.z, SHEEP_MIN_GAP) > 0) continue;

                const coat = coatFor(hash2(seed, attempt, 173));
                const model = this.createModel(coat.key);
                model.group.position.set(point.x, y, point.z);
                this.world.scene.add(model.group);
                this.entities.push({
                    id: this.nextId++,
                    x: point.x, y, z: point.z,
                    visualY: y,
                    targetX: point.x, targetZ: point.z,
                    heading: hash2(seed, attempt, 211) * Math.PI * 2,
                    turnAt: at,
                    // Passada das patas: fase e quanto ela está andando (0..1),
                    // para as pernas voltarem devagar ao repouso quando ela para.
                    stride: hash2(seed, attempt, 307) * Math.PI * 2,
                    walking: 0,
                    hopFrom: y, hopT: SHEEP_HOP_TIME,
                    glideFrom: y, glideT: SHEEP_GLIDE_TIME,
                    coat: coat.key,
                    ...model,
                });
                return;
            }
        }

        /** Sorteia o próximo trecho de pasto. */
        pickTarget(entity, at) {
            const target = wanderTargetFor({
                x: entity.x, z: entity.z, seed: this.world.seed, id: entity.id, at, hash2,
            });
            entity.targetX = target.x;
            entity.targetZ = target.z;
            entity.turnAt = at + target.duration;
        }

        update(dt, player, active, { day = 1 } = {}) {
            if (!active) return;
            const at = now();
            const playerPos = player?.pos ?? { x: 0, z: 0 };
            const dayNow = Number.isFinite(Number(day)) ? Number(day) : 1;

            this.trySpawn(playerPos, at, dayNow);

            for (let i = this.entities.length - 1; i >= 0; i--) {
                const e = this.entities[i];
                const distanceToPlayer = Math.hypot(e.x - playerPos.x, e.z - playerPos.z);
                if (distanceToPlayer > SHEEP_DESPAWN_DISTANCE) {
                    this.removeEntity(e);
                    continue;
                }

                if (at >= e.turnAt) this.pickTarget(e, at);

                const dx = e.targetX - e.x, dz = e.targetZ - e.z;
                const distanceToTarget = Math.hypot(dx, dz);
                let andou = false;
                if (distanceToTarget > SHEEP_ARRIVE) {
                    andou = this.stepToward(e, dx, dz, SHEEP_WANDER_SPEED, dt);
                    // Barrada (água, encosta, buraco): sorteia outro alvo em vez
                    // de empurrar a mesma parede até o tempo acabar.
                    if (!andou) e.turnAt = at;
                }

                // O chão manda na altura: subir degrau é um arco, descer é um
                // planeio curto (o mesmo desenho do Mofim, vindo da base).
                e.hopT = Math.min(SHEEP_HOP_TIME, e.hopT + dt);
                e.glideT = Math.min(SHEEP_GLIDE_TIME, e.glideT + dt);
                if (e.hopT < SHEEP_HOP_TIME) e.visualY = hopHeightAt(e.hopFrom, e.y, e.hopT / SHEEP_HOP_TIME);
                else if (e.glideT < SHEEP_GLIDE_TIME) e.visualY = glideHeightAt(e.glideFrom, e.y, e.glideT / SHEEP_GLIDE_TIME);
                else e.visualY = e.y;

                // Passada: a fase só anda quando ela anda, e a amplitude entra e
                // sai suave para a pata não congelar no meio do passo.
                if (andou) e.stride += dt * SHEEP_STRIDE_SPEED;
                const alvoAmplitude = andou ? 1 : 0;
                e.walking += (alvoAmplitude - e.walking) * Math.min(1, 8 * dt);
                const pose = legPose(e.stride);
                for (let leg = 0; leg < e.legs.length; leg++) {
                    e.legs[leg].rotation.x = pose[leg] * e.walking;
                }
                // Cabeça: um balanço curto junto com a passada.
                if (e.head) e.head.rotation.x = 0.1 + Math.sin(e.stride * 2) * 0.06 * e.walking;

                e.group.position.set(e.x, e.visualY, e.z);
                e.group.rotation.y = e.heading;
            }
        }
    }
    return SheepSystem;
}
