import { ID } from './world-catalog.js';

export class FurnaceSmokeSystem {
    constructor(THREE, scene) {
        this.THREE = THREE;
        this.scene = scene;
        this.geometry = new THREE.BoxGeometry(0.18, 0.18, 0.18);
        this.particles = [];
        this.emitTimers = new Map();
        this.maxParticles = 40;
    }

    spawn(x, y, z) {
        if (this.particles.length >= this.maxParticles) return;
        const { THREE, scene } = this;
        const material = new THREE.MeshBasicMaterial({
            color: 0x77746f,
            transparent: true,
            opacity: 0.24,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(this.geometry, material);
        mesh.position.set(x + 0.5 + (Math.random() - 0.5) * 0.12, y + 1.08, z + 0.5 + (Math.random() - 0.5) * 0.12);
        mesh.scale.setScalar(0.55 + Math.random() * 0.3);
        scene.add(mesh);
        const life = 0.9 + Math.random() * 0.45;
        this.particles.push({
            mesh,
            material,
            life,
            maxLife: life,
            driftX: (Math.random() - 0.5) * 0.16,
            driftZ: (Math.random() - 0.5) * 0.16,
            rise: 0.35 + Math.random() * 0.2,
        });
    }

    update(dt, furnaces, world, playerPosition) {
        const nearRadiusSq = 32 * 32;
        for (const [key, furnace] of furnaces) {
            if (furnace.burn <= 0) { this.emitTimers.delete(key); continue; }
            const [x, y, z] = key.split(',').map(Number);
            if (world.getBlock(x, y, z) !== ID.FURNACE || world.getBlock(x, y + 1, z) !== 0) {
                this.emitTimers.delete(key);
                continue;
            }
            const dx = playerPosition.x - (x + 0.5), dz = playerPosition.z - (z + 0.5);
            if (dx * dx + dz * dz > nearRadiusSq) { this.emitTimers.delete(key); continue; }
            let timer = (this.emitTimers.get(key) ?? 0) - dt;
            if (timer <= 0) {
                this.spawn(x, y, z);
                timer = 0.28 + Math.random() * 0.2;
            }
            this.emitTimers.set(key, timer);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.life -= dt;
            if (particle.life <= 0) {
                this.scene.remove(particle.mesh);
                particle.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }
            const progress = 1 - particle.life / particle.maxLife;
            particle.mesh.position.x += particle.driftX * dt;
            particle.mesh.position.y += particle.rise * dt;
            particle.mesh.position.z += particle.driftZ * dt;
            particle.mesh.scale.setScalar(0.55 + progress * 1.1);
            particle.material.opacity = 0.24 * (1 - progress) * (1 - progress * 0.25);
        }
    }
}
