// Física de deslocamento do jogador: colisão AABB contra voxels e os
// deslocamentos que respeitam essa colisão.
//
// O que mora aqui é só geometria: nada de Three, nada de áudio, nada de estado
// global. O mundo entra por parâmetro (`world`) e o corpo do jogador entra como
// `pos` + `height`. Assim a parte que mais erra — encostar exatamente na
// superfície do bloco, deslizar em vez de travar, sair de dentro de uma porta —
// pode ser testada sem navegador.

import { boxOverlapsXZ, woodDoorPart } from './world-door.js';
import { bedCollisionBox, bedPart } from './world-bed.js';

/** Raio horizontal do corpo do jogador (o voxel tem lado 1). */
export const PLAYER_RADIUS = 0.3;
/** Folga usada nas bordas da AABB: evita "colar" no bloco vizinho por arredondamento. */
export const COLLISION_EPSILON = 1e-4;
/** Maior passo por subdivisão: nada anda mais de 1/4 de bloco por vez. */
export const MAX_MOVE_STEP = 0.25;
/** Iterações da bisseção ao encostar: 6 deixa o erro em ~1/64 do passo. */
export const MOVE_REFINE_STEPS = 6;
/** Quanto abaixo dos pés se procura o chão ao testar apoio (agachado). */
export const SUPPORT_PROBE = 0.05;
/** Pontos do corpo checados em busca de chão: os quatro cantos e o centro. */
export const SUPPORT_POINTS = [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 0]];

// Um save antigo pode ter o corpo dentro do painel de uma porta que passou a
// colidir (ou sob areia que caiu). Em vez de nascer preso, procura o ponto
// livre mais próximo: mesmo bloco, depois um bloco acima, com deslocamentos
// laterais suficientes para sair do painel fino.
export const UNSTICK_OFFSETS = [
    [0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45],
    [0.45, 0.45], [-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45],
];

/**
 * O corpo do jogador em (x, y, z) — pés em `y`, altura `height` — encosta em
 * algum bloco sólido?
 *
 * A porta é o caso especial: ela colide só com o painel, aberta ou fechada. O
 * painel aberto é `solid: false` para não tapar o vão, então ele precisa ser
 * tratado antes do teste de solidez.
 */
export function collidesInWorld(world, x, y, z, height, radius = PLAYER_RADIUS) {
    const e = COLLISION_EPSILON;
    const x0 = Math.floor(x - radius + e), x1 = Math.floor(x + radius - e);
    const y0 = Math.floor(y + e),          y1 = Math.floor(y + height - e);
    const z0 = Math.floor(z - radius + e), z1 = Math.floor(z + radius - e);
    const pMinX = x - radius, pMaxX = x + radius;
    const pMinZ = z - radius, pMaxZ = z + radius;
    for (let bx = x0; bx <= x1; bx++)
        for (let by = y0; by <= y1; by++)
            for (let bz = z0; bz <= z1; bz++) {
                const type = world.getBlock(bx, by, bz);
                if (woodDoorPart(type)) {
                    const box = world.doorCollisionBox(bx, by, bz, type);
                    if (box && boxOverlapsXZ(box, pMinX, pMaxX, pMinZ, pMaxZ)) return true;
                    continue;
                }
                // A cama ocupa o voxel inteiro no plano, mas só 9/16 na altura:
                // dá para subir nela e não dá para atravessá-la de pé no chão.
                if (bedPart(type)) {
                    const box = bedCollisionBox();
                    const overlaps = boxOverlapsXZ({
                        minX: bx + box.minX, maxX: bx + box.maxX,
                        minZ: bz + box.minZ, maxZ: bz + box.maxZ,
                    }, pMinX, pMaxX, pMinZ, pMaxZ);
                    if (overlaps && y < by + box.maxY - e && y + height > by + e) return true;
                    continue;
                }
                if (!world.isSolidForPhysics(bx, by, bz, type)) continue;
                return true;
            }
    return false;
}

/**
 * Tem chão embaixo do corpo? Olha os quatro cantos da base e o centro um fio
 * abaixo dos pés: basta um ponto apoiado para o corpo não cair, então dá para
 * espiar a beirada meio para fora — mas nunca sair andando pelo vazio.
 */
export function hasGroundSupport(world, pos, height, radius = PLAYER_RADIUS) {
    const edge = radius - COLLISION_EPSILON;
    const by = Math.floor(pos.y - SUPPORT_PROBE);
    for (const [sx, sz] of SUPPORT_POINTS) {
        const bx = Math.floor(pos.x + sx * edge);
        const bz = Math.floor(pos.z + sz * edge);
        const type = world.getBlock(bx, by, bz);
        if (world.isSolidForPhysics(bx, by, bz, type)) return true;
    }
    return false;
}

/**
 * Move `pos[axis]` em `amount`, sem atravessar bloco, em passos de no máximo
 * `MAX_MOVE_STEP`. Devolve `true` se o movimento foi barrado.
 *
 * `keepOnGround` (só faz sentido em x/z) barra o passo que deixaria o corpo sem
 * chão embaixo — é o que impede de cair da beirada agachado. A parada é
 * refinada por bisseção igual à da parede, senão sobraria até um quarto de
 * bloco de folga antes da borda.
 */
export function movePlayerAxis(world, pos, axis, amount, height, radius = PLAYER_RADIUS, { keepOnGround = false } = {}) {
    if (amount === 0) return false;
    const guard = keepOnGround && axis !== 'y';
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / MAX_MOVE_STEP));
    const step = amount / steps;
    for (let i = 0; i < steps; i++) {
        const from = pos[axis];
        pos[axis] = from + step;
        if (!collidesInWorld(world, pos.x, pos.y, pos.z, height, radius)) {
            if (!guard || hasGroundSupport(world, pos, height, radius)) continue;
            // Andou para fora do chão: volta até a última posição apoiada.
            let safe = from, beyond = pos[axis];
            for (let k = 0; k < MOVE_REFINE_STEPS; k++) {
                const mid = (safe + beyond) / 2;
                pos[axis] = mid;
                if (hasGroundSupport(world, pos, height, radius)
                    && !collidesInWorld(world, pos.x, pos.y, pos.z, height, radius)) safe = mid;
                else beyond = mid;
            }
            pos[axis] = safe;
            return true;
        }
        // Encostou em algo: aproxima o máximo possível da superfície em vez de
        // voltar para a borda do voxel. Blocos comuns param no mesmo ponto de
        // antes; a porta fina deixa o jogador encostar no painel.
        let free = from, blocked = pos[axis];
        for (let k = 0; k < MOVE_REFINE_STEPS; k++) {
            const mid = (free + blocked) / 2;
            pos[axis] = mid;
            if (collidesInWorld(world, pos.x, pos.y, pos.z, height, radius)) blocked = mid;
            else free = mid;
        }
        pos[axis] = free;
        return true;
    }
    return false;
}

/**
 * Tira o corpo de dentro de um bloco, se possível: mesmo lugar, depois um e dois
 * blocos acima, tentando os deslocamentos laterais de `UNSTICK_OFFSETS` em cada
 * altura. Devolve `true` se achou um ponto livre (e move `pos` para lá).
 */
export function unstickInWorld(world, pos, height, radius = PLAYER_RADIUS) {
    if (!collidesInWorld(world, pos.x, pos.y, pos.z, height, radius)) return false;
    for (let dy = 0; dy <= 2; dy++)
        for (const [dx, dz] of UNSTICK_OFFSETS) {
            const x = pos.x + dx, y = pos.y + dy, z = pos.z + dz;
            if (!collidesInWorld(world, x, y, z, height, radius)) {
                pos.set ? pos.set(x, y, z) : Object.assign(pos, { x, y, z });
                return true;
            }
        }
    return false;
}

/** O corpo do jogador ocupa (parcialmente) a célula (bx, by, bz)? */
export function playerIntersectsBlock(pos, height, bx, by, bz, radius = PLAYER_RADIUS) {
    return (pos.x - radius < bx + 1 && pos.x + radius > bx) &&
           (pos.y < by + 1 && pos.y + height > by) &&
           (pos.z - radius < bz + 1 && pos.z + radius > bz);
}
