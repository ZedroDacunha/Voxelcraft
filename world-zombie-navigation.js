// Busca limitada em células de chão. O chamador precisa conferir espaço para o
// corpo inteiro, chão e obstáculos em isWalkable; esta função não move o mob.
// Retorna células adjacentes ao início até o destino (ou null se não achou).
export function zombieFindPath(start, goal, isWalkable, { maxVisited = 1024, maxDistance = 24 } = {}) {
    const valid = p => p && ['x', 'y', 'z'].every(k => Number.isSafeInteger(p[k]));
    if (!valid(start) || !valid(goal) || typeof isWalkable !== 'function' ||
        !Number.isSafeInteger(maxVisited) || maxVisited < 1 ||
        !Number.isSafeInteger(maxDistance) || maxDistance < 0) return null;
    const key = p => `${p.x},${p.y},${p.z}`;
    const initial = key(start), destination = key(goal);
    if (initial === destination) return [];
    const queue = [start], seen = new Set([initial]), parents = new Map(), nodes = new Map([[initial, start]]);
    // Quatro direções evitam cortar diagonais através de cantos. Cada passo
    // pode subir ou descer no máximo um bloco, sujeito à validação do mundo.
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < queue.length; i++) {
        const current = queue[i], currentKey = key(current);
        for (const [dx, dz] of directions) {
            for (const dy of [0, 1, -1]) {
                const next = { x: current.x + dx, y: current.y + dy, z: current.z + dz };
                if (Math.abs(next.x - start.x) > maxDistance || Math.abs(next.z - start.z) > maxDistance ||
                    Math.abs(next.y - start.y) > maxDistance) continue;
                const nextKey = key(next);
                if (seen.has(nextKey) || !isWalkable(next, current)) continue;
                if (seen.size >= maxVisited) return null;
                seen.add(nextKey); parents.set(nextKey, currentKey); nodes.set(nextKey, next);
                if (nextKey === destination) {
                    const path = []; let cursor = nextKey;
                    while (cursor !== initial) { path.push(nodes.get(cursor)); cursor = parents.get(cursor); }
                    return path.reverse();
                }
                queue.push(next);
            }
        }
    }
    return null;
}
