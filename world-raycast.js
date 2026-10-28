/** Percorre a grade de voxels com DDA e retorna o primeiro bloco selecionável. */
export function raycastVoxels(origin, direction, maxDist, {
    getBlock,
    isIgnoredBlock = () => false,
    maxSteps = 128,
}) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const sx = direction.x > 0 ? 1 : -1;
    const sy = direction.y > 0 ? 1 : -1;
    const sz = direction.z > 0 ? 1 : -1;
    const tdx = direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tdy = direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tdz = direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity;
    let tmx = direction.x !== 0 ? (direction.x > 0 ? x + 1 - origin.x : origin.x - x) * tdx : Infinity;
    let tmy = direction.y !== 0 ? (direction.y > 0 ? y + 1 - origin.y : origin.y - y) * tdy : Infinity;
    let tmz = direction.z !== 0 ? (direction.z > 0 ? z + 1 - origin.z : origin.z - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, distance = 0;

    for (let step = 0; step < maxSteps && distance <= maxDist; step++) {
        const type = getBlock(x, y, z);
        if (type !== 0 && !isIgnoredBlock(type, x, y, z)) {
            return { x, y, z, nx, ny, nz, type, dist: distance };
        }

        if (tmx < tmy && tmx < tmz) {
            x += sx; distance = tmx; tmx += tdx;
            nx = -sx; ny = 0; nz = 0;
        } else if (tmy < tmz) {
            y += sy; distance = tmy; tmy += tdy;
            nx = 0; ny = -sy; nz = 0;
        } else {
            z += sz; distance = tmz; tmz += tdz;
            nx = 0; ny = 0; nz = -sz;
        }
    }
    return null;
}
