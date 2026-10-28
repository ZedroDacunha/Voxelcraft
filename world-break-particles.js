export function createBreakParticleSystem({
    THREE,
    getScene,
    getBlockColor,
    getImmersionAt,
    maxParticles = 150,
    particlesPerBreak = 12,
}) {
    const particles = [];
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const materials = new Map();

    function spawn(x, y, z, blockType) {
        if (particles.length >= maxParticles) return;
        if (!materials.has(blockType)) {
            materials.set(blockType, new THREE.MeshBasicMaterial({ color: getBlockColor(blockType) }));
        }
        const scene = getScene();
        if (!scene) return;

        const material = materials.get(blockType);
        for (let i = 0; i < particlesPerBreak && particles.length < maxParticles; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x + Math.random(), y + Math.random(), z + Math.random());
            scene.add(mesh);
            particles.push({
                mesh,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 3,
                    Math.random() * 3 + 1,
                    (Math.random() - 0.5) * 3,
                ),
                life: 0.6 + Math.random() * 0.4,
            });
        }
    }

    function update(dt) {
        const scene = getScene();
        for (let i = particles.length - 1; i >= 0; i--) {
            const particle = particles[i];
            particle.life -= dt;
            if (particle.life <= 0) {
                scene?.remove(particle.mesh);
                particles.splice(i, 1);
                continue;
            }

            particle.velocity.y -= 18 * dt;
            const position = particle.mesh.position;
            const immersion = getImmersionAt(position.x, position.y, position.z, 0.05);
            if (immersion > 0) {
                particle.velocity.y += 20 * immersion * dt;
                particle.velocity.multiplyScalar(Math.exp(-4.5 * immersion * dt));
            }
            position.addScaledVector(particle.velocity, dt);
        }
    }

    function clear() {
        const scene = getScene();
        for (const particle of particles) scene?.remove(particle.mesh);
        particles.length = 0;
    }

    return { spawn, update, clear, get count() { return particles.length; } };
}
