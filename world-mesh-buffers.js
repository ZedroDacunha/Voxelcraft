// Buffers de rascunho do mesher.
//
// `meshChunk()` monta a malha de um chunk inteiro em arrays tipados. Antes esses
// arrays nasciam com capacidade fixa (16×16×8 vértices) a cada malha e eram
// descartados logo depois: ~140 KB de lixo por chunk remontado, mais o buffer
// grande que cada geometria herdava via `subarray()`.
//
// Aqui as mesmas arrays voltam para o próximo chunk. A geometria recebe uma
// cópia do tamanho exato (`exactMeshBuffer`), então:
// - o rascunho não vira lixo a cada malha;
// - cada atributo da GPU fica do tamanho que precisa, em vez de segurar o buffer
//   grande inteiro só porque os primeiros vértices foram usados.

const VERTEX_KEYS = ['positions', 'normals', 'uvs', 'colors', 'torchInfluence', 'furnaceFlame'];
const INDEX_KEYS = ['indices', 'cutoutIndices', 'waterIndices'];

/** Quantos floats cada buffer de vértice ocupa para `capacity` vértices. */
export function meshVertexBufferLength(key, capacity) {
    if (key === 'uvs') return capacity * 2;
    if (key === 'torchInfluence' || key === 'furnaceFlame') return capacity;
    return capacity * 3;
}

const positive = value => (Number.isFinite(value) && value > 0 ? Math.ceil(value) : 1);

/**
 * Devolve as arrays de rascunho, criando só o que ainda não existe (ou o que
 * precisa crescer). Chamadas seguintes reaproveitam as mesmas instâncias.
 */
export function acquireMeshScratch(scratch, vertexCapacity, indexCapacity) {
    const vertices = positive(vertexCapacity);
    const indexes = positive(indexCapacity);
    for (const key of VERTEX_KEYS) {
        const length = meshVertexBufferLength(key, vertices);
        if (!scratch[key] || scratch[key].length < length) scratch[key] = new Float32Array(length);
    }
    for (const key of INDEX_KEYS) {
        if (!scratch[key] || scratch[key].length < indexes) scratch[key] = new Uint32Array(indexes);
    }
    return {
        positions: scratch.positions,
        normals: scratch.normals,
        uvs: scratch.uvs,
        colors: scratch.colors,
        torchInfluence: scratch.torchInfluence,
        furnaceFlame: scratch.furnaceFlame,
        indices: scratch.indices,
        cutoutIndices: scratch.cutoutIndices,
        waterIndices: scratch.waterIndices,
    };
}

/**
 * Guarda as arrays de volta (podem ter crescido durante a malha). Arrays menores
 * que os já guardados são ignorados, para o rascunho nunca encolher.
 */
export function storeMeshScratch(scratch, arrays) {
    if (!arrays) return scratch;
    for (const key of [...VERTEX_KEYS, ...INDEX_KEYS]) {
        const next = arrays[key];
        if (!next) continue;
        if (!scratch[key] || next.length >= scratch[key].length) scratch[key] = next;
    }
    return scratch;
}

/**
 * Cópia do tamanho exato para a geometria.
 *
 * `subarray()` compartilha o buffer inteiro com o rascunho: a geometria ficaria
 * presa ao array grande e ainda seria sobrescrita pela próxima malha. `slice()`
 * copia o trecho usado e devolve um buffer próprio.
 */
export function exactMeshBuffer(array, length) {
    if (!array) return array;
    const size = Number.isFinite(length) && length > 0 ? Math.min(Math.floor(length), array.length) : 0;
    return array.slice(0, size);
}
