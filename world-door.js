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

export function woodDoorShape(facing, open) {
    const facesEastWest = facing === 'east' || facing === 'west';
    const closedNormalAxis = facesEastWest ? 0 : 2;
    const normalAxis = open ? 2 - closedNormalAxis : closedNormalAxis;
    const thickness = 0.125;
    const min = [0, 0, 0], max = [1, 1, 1];
    if (open) max[normalAxis] = thickness;
    else {
        min[normalAxis] = (1 - thickness) / 2;
        max[normalAxis] = min[normalAxis] + thickness;
    }
    return { min, max, normalAxis };
}

// Caixa de colisão local (0..1, no plano XZ) da porta fechada. A porta aberta
// devolve null porque o catálogo a marca como `solid: false` (passável).
export function woodDoorCollision(part, facing) {
    if (!part || part.open) return null;
    const { min, max } = woodDoorShape(facing, false);
    return { minX: min[0], maxX: max[0], minZ: min[2], maxZ: max[2] };
}
