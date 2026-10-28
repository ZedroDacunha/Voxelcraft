import { CHUNK_SIZE } from './world-save-settings.js';

export const idx = (localX, y, localZ) => localX + localZ * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
export const chunkKey = (chunkX, chunkZ) => `${chunkX},${chunkZ}`;
export const floorDiv = (value, divisor) => Math.floor(value / divisor);
