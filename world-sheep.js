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
import { creatureInReach } from './world-creature.js';
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

// ---------------------------------------------------------------- pastar
//
// Ela come a grama **à frente do focinho**: para, abaixa a cabeça, morde o bloco
// do chão logo adiante e ele vira terra. A terra volta a ser grama sozinha, entre
// cinco e dez minutos — devagar o bastante para a marca do pasto durar, e sem
// deixar o campo esburacado para sempre.

/** A primeira pastagem chega antes: o jogador precisa ver acontecer. */
export const SHEEP_GRAZE_FIRST_MIN = 8;
export const SHEEP_GRAZE_FIRST_MAX = 20;
/** Depois disso, ela pasta de vez em quando (segundos entre uma e outra). */
export const SHEEP_GRAZE_REST_MIN = 30;
export const SHEEP_GRAZE_REST_MAX = 60;
/** Quanto tempo fica com a cabeça baixa em cada pastagem (segundos). */
export const SHEEP_GRAZE_TIME_MIN = 4;
export const SHEEP_GRAZE_TIME_MAX = 6;
/** Onde, dentro da pastagem, a mordida acontece (fração do tempo). */
export const SHEEP_GRAZE_BITE = 0.45;
/** Que fração do começo e do fim ela leva para descer e subir a cabeça. */
export const SHEEP_GRAZE_DIP = 0.2;
/** Até onde o focinho alcança, à frente do centro dela (blocos). */
export const SHEEP_GRAZE_REACH = 0.8;

/** Pivô do pescoço: a cabeça gira e desce em volta daqui. */
export const SHEEP_NECK_Y = 0.68;
export const SHEEP_NECK_Z = 0.4;
/** Inclinação da cabeça em repouso (radianos) — a mesma de antes do pasto. */
export const SHEEP_HEAD_REST = 0.1;
/** Quanto a cabeça desce e quanto o focinho inclina na pastagem completa. */
export const SHEEP_HEAD_DROP = 0.36;
export const SHEEP_HEAD_TILT = 1.0;

/** A grama comida volta a crescer entre cinco e dez minutos (segundos). */
export const SHEEP_REGROW_MIN = 300;
export const SHEEP_REGROW_MAX = 600;
/** Quantas células ficam na fila de crescimento; as mais antigas saem. */
export const SHEEP_REGROW_LIMIT = 128;

// ---------------------------------------------------------------- a lã e a tesoura

/** Quantos fardos de lã saem de uma tosquia. */
export const SHEEP_WOOL_MIN = 1;
export const SHEEP_WOOL_MAX = 3;
/** Depois de tosquiada, a lã volta entre cinco e oito minutos. */
export const SHEEP_WOOL_REGROW_MIN = 300;
export const SHEEP_WOOL_REGROW_MAX = 480;
/** Cada pastagem enquanto tosquiada adianta o crescimento (segundos). */
export const SHEEP_WOOL_GRAZE_BONUS = 90;
/**
 * Cor da lã → nome do item no catálogo. Fica aqui, e não no jogo, para o teste
 * conferir que as três cores têm item; quem troca o nome pelo ID é o `game.js`,
 * que é o único que conhece o catálogo.
 */
export const SHEEP_WOOL_ITEMS = Object.freeze({
    white: 'WOOL_WHITE', gray: 'WOOL_GRAY', black: 'WOOL_BLACK',
});

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

/**
 * A célula de chão que o focinho alcança, dado o rumo dela.
 *
 * `heading` é o mesmo ângulo do `group.rotation.y`: o modelo olha para +z, então
 * à frente é `(sin, cos)`. Função pura de propósito — o teste confere a conta sem
 * precisar de mundo nem de THREE.
 */
export function grazeCellFor({ x, z, heading, reach = SHEEP_GRAZE_REACH }) {
    return {
        x: Math.floor(x + Math.sin(heading) * reach),
        z: Math.floor(z + Math.cos(heading) * reach),
    };
}

/**
 * O quanto a cabeça está abaixada dentro da pastagem: 0 no começo, 1 no meio,
 * 0 no fim. Ela desce nos primeiros 20% do tempo, fica embaixo e sobe nos
 * últimos 20% — o miolo parado é onde acontece a mordida.
 */
export function grazeEnvelope(progress) {
    const p = Math.min(1, Math.max(0, Number(progress) || 0));
    if (p <= 0 || p >= 1) return 0;
    if (p < SHEEP_GRAZE_DIP) return p / SHEEP_GRAZE_DIP;
    if (p > 1 - SHEEP_GRAZE_DIP) return (1 - p) / SHEEP_GRAZE_DIP;
    return 1;
}

/**
 * A pose da cabeça para um envelope de pastagem (0 em pé, 1 com o focinho no
 * chão). Fica numa função só porque o teste e a animação precisam da mesma
 * conta: com o pescoço em `SHEEP_NECK_Y`, descer `SHEEP_HEAD_DROP` e inclinar
 * `SHEEP_HEAD_TILT` deixa o focinho encostado na grama da frente.
 */
export function headPoseFor(envelope) {
    const e = Math.min(1, Math.max(0, Number(envelope) || 0));
    return {
        rotationX: SHEEP_HEAD_REST + SHEEP_HEAD_TILT * e,
        y: SHEEP_NECK_Y - SHEEP_HEAD_DROP * e,
        z: SHEEP_NECK_Z + 0.04 * e,
    };
}

/**
 * Quantos fardos saem de uma tosquia, a partir de um sorteio de 0 a 1: um, dois
 * ou três, em partes iguais.
 */
export function woolCountFor(roll) {
    const r = Math.min(0.999999, Math.max(0, Number(roll) || 0));
    return SHEEP_WOOL_MIN + Math.floor(r * (SHEEP_WOOL_MAX - SHEEP_WOOL_MIN + 1));
}

/** Quanto tempo até a próxima pastagem, a partir de um sorteio de 0 a 1. */
export function grazeDelayFor(roll, first = false) {
    const r = Math.min(1, Math.max(0, Number(roll) || 0));
    const [min, max] = first
        ? [SHEEP_GRAZE_FIRST_MIN, SHEEP_GRAZE_FIRST_MAX]
        : [SHEEP_GRAZE_REST_MIN, SHEEP_GRAZE_REST_MAX];
    return min + r * (max - min);
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
            // Células de grama comida esperando crescer de volta (5–10 min).
            this.regrow = [];
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
         * dependem deles: `body` (miolo), `tuft`, `head` (o grupo do pescoço, com
         * `skull`, `topknot`, `muzzle`, `eye`, `glint` e `ear` dentro),
         * `leg` (com `shin` e `hoof` dentro) e `tail`.
         *
         * As patas são **grupos** com o pivô no quadril: ao girar, a pata e o
         * casco andam juntos, como perna de verdade — antes a caixa girava no
         * próprio centro e o casco ficaria plantado no chão.
         */
        createModel(coatKey = 'white', { sheared = false } = {}) {
            const group = new THREE.Group();
            const wool = this.coatMaterials.get(coatKey) ?? this.coatMaterials.get('white');
            const part = (x, y, z, sx, sy, sz, material, name) => {
                const mesh = this.addPart(group, material, x, y, z, sx, sy, sz);
                mesh.name = name;
                return mesh;
            };

            // Tosquiada: a lã vira **uma camada baixa e lisa** (corpo menor, sem
            // tufos e sem topete). É o desenho escolhido no comparativo: parece
            // corte de cabelo, e não outro bicho. Com lã, o corpo é o miolo mais
            // os nove tufos.
            const body = sheared
                ? { x: 0, y: 0.61, z: 0, sx: 0.5, sy: 0.42, sz: 0.74 }
                : { x: 0, y: 0.62, z: 0, sx: 0.54, sy: 0.46, sz: 0.78 };
            part(body.x, body.y, body.z, body.sx, body.sy, body.sz, wool, 'body');
            const tufts = sheared ? [] : SHEEP_TUFTS.map(tuft => part(
                tuft.x, tuft.y, tuft.z, tuft.sx, tuft.sy, tuft.sz, wool, 'tuft',
            ));

            // A cabeça é um **grupo** com o pivô no pescoço, e não peças soltas:
            // é o que permite baixar o focinho até o chão para pastar sem a cara
            // se desmontar. As posições aqui dentro são relativas ao pescoço.
            const head = new THREE.Group();
            head.name = 'head';
            head.position.set(0, SHEEP_NECK_Y, SHEEP_NECK_Z);
            head.rotation.x = SHEEP_HEAD_REST;
            group.add(head);
            const naCabeca = (x, y, z, sx, sy, sz, material, name) => {
                const mesh = this.addPart(head, material, x, y - SHEEP_NECK_Y, z - SHEEP_NECK_Z, sx, sy, sz);
                mesh.name = name;
                return mesh;
            };

            naCabeca(0, 0.8, 0.52, 0.36, 0.32, 0.32, wool, 'skull');
            if (!sheared) naCabeca(0, 0.99, 0.48, 0.2, 0.12, 0.18, wool, 'topknot');
            naCabeca(0, 0.73, 0.7, 0.24, 0.16, 0.06, this.materials.skin, 'muzzle');

            const eyes = [];
            const glints = [];
            for (const side of [1, -1]) {
                eyes.push(naCabeca(side * 0.11, 0.85, 0.69, 0.06, 0.06, 0.03, this.materials.eye, 'eye'));
                // O brilho fica no canto de cima do olho, do mesmo lado.
                glints.push(naCabeca(side * 0.095, 0.87, 0.705, 0.02, 0.02, 0.02, this.materials.glint, 'glint'));
            }

            // Orelhas: deitadas para os lados e caídas. É a diferença de leitura
            // mais barata entre a ovelha e qualquer outro bicho de caixa.
            const ears = [1, -1].map(side => {
                const ear = naCabeca(side * 0.26, 0.8, 0.48, 0.28, 0.07, 0.12, wool, 'ear');
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

            const tail = sheared
                ? part(0, 0.74, -0.48, 0.12, 0.14, 0.1, wool, 'tail')
                : part(0, 0.78, -0.5, 0.14, 0.16, 0.12, wool, 'tail');

            return { group, head, tufts, eyes, glints, ears, legs, tail, coat: coatKey, sheared };
        }

        // ------------------------------------------------------------ pastar

        /**
         * Come a grama à frente do focinho: o bloco do chão vira terra e a grama
         * alta que estiver nele sai. Devolve `true` se comeu.
         *
         * Nunca come no escuro: só grama. Areia, pedra e terra viram um "não" —
         * é o que impede a ovelha de "comer" a praia.
         */
        eatAhead(entity, at) {
            const cell = grazeCellFor({ x: entity.x, z: entity.z, heading: entity.heading });
            const front = this.surfaceAt(cell.x, cell.z);
            if (front === null) return false;
            const gy = front - 1;
            if (this.world.getBlock(cell.x, gy, cell.z) !== ID.GRASS) return false;
            if (!this.world.setBlock?.(cell.x, gy, cell.z, ID.DIRT)) return false;
            // Touceira em cima da grama: come a planta junto.
            if (this.world.getBlock(cell.x, gy + 1, cell.z) === ID.TALL_GRASS) {
                this.world.setBlock(cell.x, gy + 1, cell.z, 0);
            }
            this.queueRegrow(cell.x, gy, cell.z, at);
            // Tosquiada, cada pastagem adianta o crescimento da lã.
            if (entity.sheared) entity.woolAt -= SHEEP_WOOL_GRAZE_BONUS;
            return true;
        }

        /** Põe a célula comida na fila de crescimento (5–10 min, sorteado). */
        queueRegrow(x, y, z, at) {
            const roll = hash2(x, z, (this.world.seed ?? 0) + 613);
            const delay = SHEEP_REGROW_MIN + roll * (SHEEP_REGROW_MAX - SHEEP_REGROW_MIN);
            this.regrow.push({ x, y, z, at: at + delay });
            if (this.regrow.length > SHEEP_REGROW_LIMIT) {
                this.regrow.splice(0, this.regrow.length - SHEEP_REGROW_LIMIT);
            }
        }

        /**
         * Faz a grama voltar. Só devolve terra → grama: se o jogador construiu em
         * cima (ou pôs outro bloco ali), o bloco dele manda e a célula sai da fila.
         * Célula em chunk que não está na memória fica para a próxima.
         */
        growBack(at) {
            for (let i = this.regrow.length - 1; i >= 0; i--) {
                const cell = this.regrow[i];
                if (at < cell.at) continue;
                const loaded = this.world.getChunk?.(
                    floorDiv(cell.x, CHUNK_SIZE), floorDiv(cell.z, CHUNK_SIZE),
                );
                if (!loaded) continue;
                if (this.world.getBlock(cell.x, cell.y, cell.z) !== ID.DIRT) {
                    this.regrow.splice(i, 1);
                    continue;
                }
                if (this.world.setBlock?.(cell.x, cell.y, cell.z, ID.GRASS)) this.regrow.splice(i, 1);
            }
        }

        // ------------------------------------------------------------ a lã

        /**
         * Veste ou tira a lã: troca o modelo inteiro e acerta o relógio do
         * crescimento.
         *
         * Trocar o modelo (em vez de esconder peças) é o que deixa a ovelha
         * tosquiada ser **menor** que a com lã: são dois corpos diferentes, não
         * o mesmo corpo com peças apagadas. Acontece duas vezes na vida de cada
         * tosquia, então o custo de remontar não aparece.
         */
        setSheared(entity, sheared, at) {
            const where = { x: entity.x, y: entity.visualY, z: entity.z, rot: entity.group.rotation.y };
            this.world.scene.remove(entity.group);
            const model = this.createModel(entity.coat, { sheared });
            model.group.position.set(where.x, where.y, where.z);
            model.group.rotation.y = where.rot;
            this.world.scene.add(model.group);
            Object.assign(entity, model);
            entity.sheared = sheared;
            entity.woolAt = sheared
                ? at + SHEEP_WOOL_REGROW_MIN
                    + hash2(entity.id, 617) * (SHEEP_WOOL_REGROW_MAX - SHEEP_WOOL_REGROW_MIN)
                : 0;
            return entity;
        }

        /**
         * A ovelha na mira que ainda tem lã, ou `null`.
         *
         * Reaproveita a mira do golpe (`creatureInReach`): tosquiar é acertar o
         * mesmo alvo que o golpe acertaria, só que com tesoura na mão.
         */
        sheepInReach(origin, direction, options = {}) {
            return creatureInReach(this.entities.filter(entity => !entity.sheared), origin, direction, options);
        }

        /**
         * Tosquia a ovelha na mira. Devolve `{ entity, coat, count }` — com a cor
         * da lã, que é o que o jogo precisa para soltar o fardo certo — ou `null`
         * quando não há ovelha com lã ali.
         */
        shearAt(origin, direction, options = {}) {
            const target = this.sheepInReach(origin, direction, options);
            if (!target) return null;
            const at = now();
            const count = woolCountFor(hash2(target.id, Math.round(at * 10), 941));
            this.setSheared(target, true, at);
            return { entity: target, coat: target.coat, count };
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
                    // Pasto: a primeira vem cedo (para o jogador ver), depois de
                    // vez em quando. `grazeT` é o relógio da pastagem em curso
                    // (null quando não está pastando) e `bit`, se já mordeu.
                    grazeAt: at + grazeDelayFor(hash2(seed, attempt, 401), true),
                    grazeT: null,
                    grazeFor: 0,
                    bit: false,
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
            this.growBack(at);

            for (let i = this.entities.length - 1; i >= 0; i--) {
                const e = this.entities[i];
                const distanceToPlayer = Math.hypot(e.x - playerPos.x, e.z - playerPos.z);
                if (distanceToPlayer > SHEEP_DESPAWN_DISTANCE) {
                    this.removeEntity(e);
                    continue;
                }

                // Lã de volta: a ovelha tosquiada cresce de novo quando o
                // relógio (adiantado pelas pastagens) chega.
                if (e.sheared && at >= e.woolAt) this.setSheared(e, false, at);

                // Pasto: para, abaixa a cabeça, morde (no meio do tempo) e sobe.
                if (e.grazeT !== null) {
                    e.grazeT += dt;
                    const progress = e.grazeT / e.grazeFor;
                    if (!e.bit && progress >= SHEEP_GRAZE_BITE) {
                        e.bit = true;
                        this.eatAhead(e, at);
                    }
                    if (e.grazeT >= e.grazeFor) {
                        e.grazeT = null;
                        e.grazeAt = at + grazeDelayFor(hash2(e.id, Math.round(at), 733), false);
                    }
                } else if (at >= e.grazeAt) {
                    e.grazeT = 0;
                    e.grazeFor = SHEEP_GRAZE_TIME_MIN
                        + hash2(e.id, Math.round(at), 811) * (SHEEP_GRAZE_TIME_MAX - SHEEP_GRAZE_TIME_MIN);
                    e.bit = false;
                }
                const pastando = e.grazeT !== null;

                let andou = false;
                if (!pastando) {
                    const dx = e.targetX - e.x, dz = e.targetZ - e.z;
                    const distanceToTarget = Math.hypot(dx, dz);
                    if (distanceToTarget > SHEEP_ARRIVE) {
                        andou = this.stepToward(e, dx, dz, SHEEP_WANDER_SPEED, dt);
                        // Barrada (água, encosta, buraco): sorteia outro alvo em
                        // vez de empurrar a mesma parede até o tempo acabar.
                        if (!andou) e.turnAt = at;
                    }
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
                // Cabeça: balanço curto junto com a passada e, no pasto, o
                // focinho descendo até o chão com uma mastigadinha no meio.
                if (e.head) {
                    const envelope = pastando ? grazeEnvelope(e.grazeT / e.grazeFor) : 0;
                    const pose = headPoseFor(envelope);
                    const mascando = Math.sin((pastando ? e.grazeT / e.grazeFor : 0) * Math.PI * 6) * 0.05;
                    e.head.rotation.x = pose.rotationX
                        + Math.sin(e.stride * 2) * 0.06 * e.walking
                        + mascando * envelope;
                    e.head.position.y = pose.y;
                    e.head.position.z = pose.z;
                }

                e.group.position.set(e.x, e.visualY, e.z);
                e.group.rotation.y = e.heading;
            }
        }
    }
    return SheepSystem;
}
