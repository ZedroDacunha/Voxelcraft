/**
 * O kit do golpe em bicho: tudo o que é **igual para todo mob**.
 *
 * O golpe nasceu no Mofim (`world-creature.js`) e a ovelha depois o herdou
 * importando do arquivo dele — o que já era esquisito, porque o "kit" (mira,
 * clarão, amassado, recuo) não tem nada de Mofim. Pior: um bicho novo teria de
 * copiar a lista de constantes e, esquecendo uma, ficaria com um golpe
 * diferente dos outros sem ninguém notar.
 *
 * Aqui ficam as contas do golpe, puras: a mira (`creatureInReach`), o clarão
 * (`hurtFlashFor`), a reação do corpo (`hurtScaleFor`) e os números que os dois
 * usam. Quem aplica o golpe de verdade é o `takeHit` da base
 * (`world-creature-base.js`), que serve qualquer espécie — vida, clarão, recuo,
 * morte com queda e o que solta ao morrer saem de graça para quem estende a
 * base. `tests/mob-kit.test.mjs` cobra isso de cada bicho novo.
 *
 * Nada aqui conhece THREE, mundo nem relógio de verdade.
 */

/** Alcance do golpe (blocos): curto de propósito, é braço, não espada. */
export const HIT_REACH = 3.5;

/**
 * Alinhamento mínimo entre a mira e o corpo do bicho (cosseno).
 *
 * Sem isso o golpe acertaria quem está de lado, encostado na câmera — o jogador
 * bateria no ar e o bicho cairia.
 */
export const HIT_MIN_DOT = 0.86;

/**
 * Intervalo mínimo entre dois golpes no mesmo bicho (segundos).
 *
 * O braço tem a cadência dele (`ATTACK_COOLDOWN`, 0,45 s, no `game.js`); esta é
 * a trava do **bicho**: nem duas fontes de golpe (toque + mouse, ou um `/kill`
 * futuro) derrubam o mesmo corpo em dois quadros seguidos.
 */
export const HIT_COOLDOWN = 0.35;

/** Tempo que o corpo fica aceso depois de levar dano (segundos). */
export const HURT_FLASH = 0.22;

/** Empurrão do golpe, em blocos (para o bicho "sentir" o impacto). */
export const KNOCKBACK_DISTANCE = 0.35;

/**
 * Reação do corpo no golpe: encolhe na altura, alarga nos lados e as orelhas
 * deitam — o mesmo "clarão" que acende o material dura o impacto todo.
 */
export const HURT_SQUASH = 0.09;
export const HURT_SPREAD = 0.05;
export const HURT_HEAD_KICK = 0.32;
export const HURT_EAR_FLAT = 0.45;

/**
 * Qual bicho está na mira do golpe? Devolve o mais próximo que estiver dentro do
 * alcance e da abertura, ou `null`.
 *
 * Vale para qualquer espécie: a conta é a mesma (corpo na altura da mira, bicho
 * caindo fora) e cada bicho só declara onde é o próprio centro (`bodyOffset`).
 */
export function creatureInReach(entities, origin, direction, {
    reach = HIT_REACH,
    minDot = HIT_MIN_DOT,
    // Quem estiver mais longe que isso não leva o golpe: no jogo é a distância
    // do bloco na mira — se o bloco está na frente, o bicho está atrás dele.
    maxDistance = Infinity,
} = {}) {
    if (!entities?.length || !direction) return null;
    const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
    const dx = direction.x / length, dy = direction.y / length, dz = direction.z / length;
    let best = null;
    let bestScore = Infinity;
    for (const entity of entities) {
        // Sumindo ao amanhecer (ou já caindo) ele não é alvo: bater num bicho
        // que está desaparecendo roubaria o quadro da mineração sem acertar nada.
        if (entity.leaving || entity.dying) continue;
        // O corpo do Mofim fica a ~0,45 do chão onde está a origem dele — e, no
        // ar (pulo, planeio, voo), a altura que vale é a que se vê. Bicho mais
        // alto (a ovelha) declara a altura do próprio centro em `bodyOffset`:
        // sem isso a mira tinha de ser no chão para acertar o corpo dela.
        const bodyY = Number.isFinite(entity.visualY) ? entity.visualY : entity.y;
        const bodyOffset = Number.isFinite(entity.bodyOffset) ? entity.bodyOffset : 0.45;
        const ex = entity.x - origin.x;
        const ey = bodyY + bodyOffset - origin.y;
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
 * Quanto do clarão do dano ainda está aceso, de 0 a 1 (1 no instante do golpe,
 * 0 quando o tempo acaba). É a mesma conta para todos os bichos: o Mofim põe
 * isso no `emissive` do corpo, a ovelha na lã dela.
 */
export function hurtFlashFor(hurtUntil = 0, at = 0, duration = HURT_FLASH) {
    const span = Number(duration) > 0 ? Number(duration) : HURT_FLASH;
    const left = Number(hurtUntil) - Number(at);
    if (!Number.isFinite(left) || left <= 0) return 0;
    return Math.min(1, left / span);
}

/**
 * A escala do corpo no impacto, a partir do clarão (0..1): mais baixo e mais
 * largo no instante do golpe, normal quando o clarão apaga.
 *
 * Está aqui — e não em cada bicho — porque "o corpo reage igual" é parte do
 * golpe: um mob novo que desenhasse a reação por conta própria divergiria no
 * primeiro ajuste de número.
 */
export function hurtScaleFor(flash = 0) {
    const f = Math.max(0, Math.min(1, Number(flash) || 0));
    return {
        x: 1 + HURT_SPREAD * f,
        y: 1 - HURT_SQUASH * f,
        z: 1 + HURT_SPREAD * f,
    };
}
