// Ritmo e limites da simulação de fluxo de água.
export const WATER_FLOW_INTERVAL = 0.18;      // segundos entre passadas
export const WATER_FLOW_CELLS_PER_TICK = 8;   // células processadas por passada
export const WATER_FLOW_QUEUE_LIMIT = 4096;   // células pendentes no máximo
export const WATER_FLOW_QUEUE_COMPACT_MIN = 64; // só compacta a fila a partir daqui

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
            // A fila é consumida por um cursor (`flowHead`) em vez de `shift()`:
            // tirar o primeiro elemento de um array custa O(fila) a cada célula, e
            // a fila chega a milhares de células. O array é compactado aos poucos.
            this.flowHead = 0;
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
    
        /** Células ainda na fila (o array guarda também as já consumidas). */
        pendingFlow() {
            return this.flowQueue.length - this.flowHead;
        }

        enqueue(x, y, z) {
            if (y < 0 || y >= WORLD_HEIGHT || this.pendingFlow() >= WATER_FLOW_QUEUE_LIMIT) return;
            const key = `${x},${y},${z}`;
            if (this.queuedCells.has(key)) return;
            this.queuedCells.add(key);
            this.flowQueue.push({ x, y, z, key });
        }

        dequeueFlow() {
            if (this.flowHead >= this.flowQueue.length) return null;
            const cell = this.flowQueue[this.flowHead];
            this.flowHead++;
            // Sai da fila e da marcação juntas: uma célula pendente está sempre
            // em `queuedCells`, então ela pode voltar a ser enfileirada depois.
            this.queuedCells.delete(cell.key);
            // Compacta quando metade do array já foi consumida: a fila nunca
            // ocupa mais que ~2x as células pendentes.
            if (this.flowHead >= WATER_FLOW_QUEUE_COMPACT_MIN && this.flowHead * 2 >= this.flowQueue.length) {
                this.flowQueue = this.flowQueue.slice(this.flowHead);
                this.flowHead = 0;
            }
            return cell;
        }
    
        activate(world, x, y, z) {
            const cells = [[0,0,0], [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
            for (const [dx, dy, dz] of cells) {
                const px = x + dx, py = y + dy, pz = z + dz;
                if (WaterSystem.isBlock(world.getBlock(px, py, pz))) this.enqueue(px, py, pz);
            }
        }
    
        // Chamado quando o jogador quebra um bloco: a célula fica vazia e, se
        // havia água em volta, os vizinhos são reenfileirados para escorrer
        // para dentro — como água de fluxo, que evapora quando se afasta da
        // fonte. Antes o jogo gravava `ID.WATER` (fonte) nessa célula, então
        // cada bloco quebrado ao lado d'água virava uma nascente permanente e
        // dava para duplicar água minerando em volta de um lago.
        onBlockBroken(world, x, y, z) {
            const touchesWater = this.isAdjacent(world, x, y, z);
            world.setBlock(x, y, z, 0);
            if (touchesWater) this.activate(world, x, y, z);
            return touchesWater;
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
            if (this.flowTimer < WATER_FLOW_INTERVAL) return;
            this.flowTimer = 0;
    
            const directions = [[1,0], [-1,0], [0,1], [0,-1]];
            for (let step = 0; step < WATER_FLOW_CELLS_PER_TICK && this.pendingFlow() > 0; step++) {
                const cell = this.dequeueFlow();
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
