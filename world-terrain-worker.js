import { clamp01, hash2, mulberry32, Noise2D, smoothstep } from './world-math.js';
import { COAL_VEIN_CONFIG, OreGenerator } from './world-ore-generation.js';
import { TerrainGenerator } from './world-terrain.js';

// Monta o código do Web Worker. O worker não recebe imports: cada peça usada
// pelo gerador precisa ser injetada explicitamente. Manter esta lista num
// módulo próprio permite testar a paridade com o gerador da thread principal.
export function createTerrainWorkerSource({ CHUNK_SIZE, WORLD_HEIGHT, TERRAIN_CONFIG }) {
    return [
        `const CHUNK_SIZE = ${CHUNK_SIZE};`,
        `const WORLD_HEIGHT = ${WORLD_HEIGHT};`,
        `const TERRAIN_CONFIG = ${JSON.stringify(TERRAIN_CONFIG)};`,
        `const COAL_VEIN_CONFIG = ${JSON.stringify(COAL_VEIN_CONFIG)};`,
        `const clamp01 = ${clamp01.toString()};`,
        `const smoothstep = ${smoothstep.toString()};`,
        mulberry32.toString(),
        hash2.toString(),
        Noise2D.toString(),
        OreGenerator.toString(),
        TerrainGenerator.toString(),
        `let workerGenerator = null; let workerSeed = null;`,
        `self.onmessage = ({ data }) => {`,
        `  if (!workerGenerator || workerSeed !== data.seed) {`,
        `    workerGenerator = new TerrainGenerator(data.seed, TERRAIN_CONFIG);`,
        `    workerSeed = data.seed;`,
        `  }`,
        `  const chunk = { cx: data.cx, cz: data.cz, data: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT), maxY: 0 };`,
        `  workerGenerator.fill(chunk);`,
        `  self.postMessage({ jobId: data.jobId, cx: data.cx, cz: data.cz, maxY: chunk.maxY, data: chunk.data.buffer }, [chunk.data.buffer]);`,
        `};`,
    ].join('\n');
}
