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

    // Um material por bloco (quebrar) ou por cor (golpe num bicho): o golpe não
    // tem tipo de bloco, tem cor — a lã da ovelha, o pó do Mofim.
    function materialFor(blockType, color) {
        const key = color == null ? `b${blockType}` : `c${color}`;
        if (!materials.has(key)) {
            materials.set(key, new THREE.MeshBasicMaterial({
                color: color == null ? getBlockColor(blockType) : color,
            }));
        }
        return materials.get(key);
    }

    /**
     * Solta um punhado de lascas.
     *
     * `blockType` é o caminho da quebra de bloco (a cor vem do catálogo). Para
     * o golpe num bicho, passe `color` — e, se quiser um estouro mais junto que
     * o de um bloco, `count`, `spread` e `speed` (0..1 na prática).
     */
    function spawn(x, y, z, blockType, { color = null, count = particlesPerBreak, spread = 1, speed = 1 } = {}) {
        if (particles.length >= maxParticles) return;
        const scene = getScene();
        if (!scene) return;

        const material = materialFor(blockType, color);
        const total = Math.max(0, Math.min(Math.round(count), maxParticles - particles.length));
        for (let i = 0; i < total; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                x + (Math.random() - 0.5) * spread,
                y + (Math.random() - 0.5) * spread,
                z + (Math.random() - 0.5) * spread,
            );
            scene.add(mesh);
            particles.push({
                mesh,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 3 * speed,
                    (Math.random() * 3 + 1) * speed,
                    (Math.random() - 0.5) * 3 * speed,
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
