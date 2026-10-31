/**
 * Região usada ao reconstruir iluminação de um chunk.
 *
 * O alvo continua sendo o anel imediato, mas a luz de blocos precisa de um
 * halo externo: um emissor fora do anel ainda pode alcançar a borda de dentro.
 */
export function lightHaloRadius(chunkSize, maxLight = 15) {
    if (!Number.isFinite(chunkSize) || chunkSize <= 0) return 0;
    return Math.max(0, Math.ceil((maxLight - 1) / chunkSize));
}

export function collectChunkRegion({ cx, cz, radius, getChunk }) {
    const region = [];
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            const part = getChunk(cx + dx, cz + dz);
            if (part) region.push(part);
        }
    }
    return region;
}

export function buildLightRegions({
    cx,
    cz,
    radius = 1,
    chunkSize,
    maxLight = 15,
    getChunk,
}) {
    const target = collectChunkRegion({ cx, cz, radius, getChunk });
    const halo = lightHaloRadius(chunkSize, maxLight);
    const block = halo > 0
        ? collectChunkRegion({ cx, cz, radius: radius + halo, getChunk })
        : target;
    return { target, block, halo };
}
