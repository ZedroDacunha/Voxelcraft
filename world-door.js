import { ID } from './world-catalog.js';

export function woodDoorPart(type) {
    switch (type) {
        case ID.WOOD_DOOR_BOTTOM: return { half: 'bottom', open: false };
        case ID.WOOD_DOOR_TOP: return { half: 'top', open: false };
        case ID.WOOD_DOOR_BOTTOM_OPEN: return { half: 'bottom', open: true };
        case ID.WOOD_DOOR_TOP_OPEN: return { half: 'top', open: true };
        default: return null;
    }
}

export function woodDoorType(half, open) {
    if (half === 'top') return open ? ID.WOOD_DOOR_TOP_OPEN : ID.WOOD_DOOR_TOP;
    return open ? ID.WOOD_DOOR_BOTTOM_OPEN : ID.WOOD_DOOR_BOTTOM;
}

export const WOOD_DOOR_THICKNESS = 0.125;

// Painel da porta em coordenadas locais (0..1 dentro do voxel, como o mesher
// desenha). Fechada: painel fino e centralizado, atravessando o vão. Aberta: o
// painel gira 90° e fica encostado na borda do voxel, na direção do batente —
// fino no eixo perpendicular, mas continuando a ocupar a profundidade inteira.
export function woodDoorShape(facing, open) {
    const facesEastWest = facing === 'east' || facing === 'west';
    const closedNormalAxis = facesEastWest ? 0 : 2;
    const normalAxis = open ? 2 - closedNormalAxis : closedNormalAxis;
    const thickness = WOOD_DOOR_THICKNESS;
    const min = [0, 0, 0], max = [1, 1, 1];
    if (open) max[normalAxis] = thickness;
    else {
        min[normalAxis] = (1 - thickness) / 2;
        max[normalAxis] = min[normalAxis] + thickness;
    }
    return { min, max, normalAxis };
}

// Caixa de colisão local (0..1, no plano XZ) do painel, em qualquer estado.
// Antes a porta aberta devolvia null: o jogador atravessava a geometria que
// estava vendo. O vão continua passável porque o painel aberto é fino no eixo
// perpendicular ao batente — sobra 0,875 de bloco livre para o jogador.
export function woodDoorCollision(part, facing) {
    if (!part) return null;
    const { min, max } = woodDoorShape(facing, Boolean(part.open));
    return { minX: min[0], maxX: max[0], minZ: min[2], maxZ: max[2] };
}

// Sobreposição AABB no plano XZ, usada tanto pela colisão do jogador quanto
// pela checagem de "saia do vão" ao abrir/fechar a porta.
export function boxOverlapsXZ(box, minX, maxX, minZ, maxZ) {
    return maxX > box.minX && minX < box.maxX && maxZ > box.minZ && minZ < box.maxZ;
}
