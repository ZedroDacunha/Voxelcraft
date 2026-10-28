export function createWaterSystemClass({ THREE, BLOCKS, ID, WORLD_HEIGHT, onSubmersionChange }) {
    class WaterSystem {
        static get surfaceHeight() { return 0.88; }
        static isBlock(type) { return BLOCKS[type]?.render === 'liquid'; }
        static flowBlockForLevel(level) {
            const clamped = Math.max(1, Math.min(7, Math.round(level)));
            return ID.WATER_FLOW_1 + clamped - 1;
        }
        static surfaceHeightFor(type, aboveType) {
            const block = BLOCKS[type];
            if (block?.falling) return 1;
            if (block?.flowing) return block.waterLevel;
            return aboveType === 0 ? WaterSystem.surfaceHeight : 1;
        }
    
        constructor(atlas) {
            this.material = new THREE.MeshLambertMaterial({
                map: atlas, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, vertexColors: true
            });
            this.headInWater = false;
            this.feetInWater = false;
            this.flowQueue = [];
            this.queuedCells = new Set();
            this.flowTimer = 0;
        }
    
        isAdjacent(world, x, y, z) {
            return WaterSystem.isBlock(world.getBlock(x + 1, y, z)) ||
                WaterSystem.isBlock(world.getBlock(x - 1, y, z)) ||
                WaterSystem.isBlock(world.getBlock(x, y + 1, z)) ||
                WaterSystem.isBlock(world.getBlock(x, y - 1, z)) ||
                WaterSystem.isBlock(world.getBlock(x, y, z + 1)) ||
                WaterSystem.isBlock(world.getBlock(x, y, z - 1));
        }
    
        updateSubmersion(world, player) {
            const wasHeadInWater = this.headInWater;
            const px = Math.floor(player.pos.x);
            const pz = Math.floor(player.pos.z);
            const headY = Math.floor(player.pos.y + player.eye);
            const feetY = Math.floor(player.pos.y);
            this.headInWater = WaterSystem.isBlock(world.getBlock(px, headY, pz));
            this.feetInWater = WaterSystem.isBlock(world.getBlock(px, feetY, pz));
            if (this.headInWater !== wasHeadInWater) onSubmersionChange();
        }
    
        enqueue(x, y, z) {
            if (y < 0 || y >= WORLD_HEIGHT || this.flowQueue.length >= 4096) return;
            const key = `${x},${y},${z}`;
            if (this.queuedCells.has(key)) return;
            this.queuedCells.add(key);
            this.flowQueue.push({ x, y, z, key });
        }
    
        activate(world, x, y, z) {
            const cells = [[0,0,0], [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
            for (const [dx, dy, dz] of cells) {
                const px = x + dx, py = y + dy, pz = z + dz;
                if (WaterSystem.isBlock(world.getBlock(px, py, pz))) this.enqueue(px, py, pz);
            }
        }
    
        hasNearbySource(world, start, maxSteps = 7) {
            const queue = [{ x: start.x, y: start.y, z: start.z, steps: 0 }];
            const visited = new Set([`${start.x},${start.y},${start.z}`]);
            const directions = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
            for (let i = 0; i < queue.length; i++) {
                const cell = queue[i];
                const block = BLOCKS[world.getBlock(cell.x, cell.y, cell.z)];
                if (block?.waterSource) return true;
                if (cell.steps >= maxSteps) continue;
                for (const [dx, dy, dz] of directions) {
                    const x = cell.x + dx, y = cell.y + dy, z = cell.z + dz;
                    if (y < 0 || y >= WORLD_HEIGHT) continue;
                    const key = `${x},${y},${z}`;
                    const nextSteps = cell.steps + (dy === 0 ? 1 : 0);
                    if (visited.has(key) || nextSteps > maxSteps || !WaterSystem.isBlock(world.getBlock(x, y, z))) continue;
                    visited.add(key);
                    queue.push({ x, y, z, steps: nextSteps });
                }
            }
            return false;
        }
    
        updateFlow(world, dt) {
            this.flowTimer += dt;
            if (this.flowTimer < 0.18) return;
            this.flowTimer = 0;
    
            const directions = [[1,0], [-1,0], [0,1], [0,-1]];
            for (let step = 0; step < 8 && this.flowQueue.length; step++) {
                const cell = this.flowQueue.shift();
                this.queuedCells.delete(cell.key);
                const type = world.getBlock(cell.x, cell.y, cell.z);
                const block = BLOCKS[type];
                if (!block || block.render !== 'liquid') continue;
    
                // Fontes permanecem; água de fluxo sem fonte próxima evapora.
                if (!block.waterSource && !this.hasNearbySource(world, cell, 7)) {
                    if (world.setBlock(cell.x, cell.y, cell.z, 0)) {
                        for (const [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                            this.enqueue(cell.x + dx, cell.y + dy, cell.z + dz);
                        }
                    }
                    continue;
                }
    
                const level = block.waterSource || block.falling ? 8 : block.flowLevel;
                const belowY = cell.y - 1;
                if (belowY > 0 && world.getBlock(cell.x, belowY, cell.z) === 0) {
                    if (world.setBlock(cell.x, belowY, cell.z, ID.WATER_FALL)) {
                        this.enqueue(cell.x, belowY, cell.z);
                        continue;
                    }
                }
                if (level <= 1) continue;
    
                const nextType = WaterSystem.flowBlockForLevel(level - 1);
                for (const [dx, dz] of directions) {
                    const x = cell.x + dx, z = cell.z + dz;
                    const adjacentType = world.getBlock(x, cell.y, z);
                    const adjacent = BLOCKS[adjacentType];
                    if (adjacentType !== 0 && !(adjacent?.flowing && adjacent.flowLevel < level - 1)) continue;
                    if (world.setBlock(x, cell.y, z, nextType)) this.enqueue(x, cell.y, z);
                }
            }
        }
    
        update(world, dt, now) {
            const pulse = Math.sin(now * 0.0017);
            this.material.color.setRGB(0.96 + pulse * 0.025, 0.98 + pulse * 0.02, 1);
            this.updateFlow(world, dt);
        }
    }
    return WaterSystem;
}
