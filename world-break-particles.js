export function createBreakParticleSystem({
    THREE,
    getScene,
    getBlockColor,
    getImmersionAt,
    isSolidAt = () => false,
    maxParticles = 150,
    particlesPerBreak = 12,
    // Opção Partículas do menu de Efeitos: quando desligada, nada nasce — o que
    // já está no ar termina sozinho, sem congelar no meio do caminho.
    enabled = () => true,
}) {
    const particles = [];
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const materials = new Map();

    // Um material por bloco (quebrar) ou por cor (golpe num bicho): o golpe não
    // tem tipo de bloco, tem cor — a lã da ovelha, o pó do Mofim.
    function materialFor(blockType, color) {
        const key = color == null ? `b${blockType}` : `c${color}`;
        if (!materials.has(key)) {
            materials.set(key, color == null
                ? new THREE.MeshLambertMaterial({ color: getBlockColor(blockType) })
                : new THREE.MeshBasicMaterial({ color }));
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
        if (!enabled()) return;
        if (particles.length >= maxParticles) return;
        const scene = getScene();
        if (!scene) return;

        const material = materialFor(blockType, color);
        const total = Math.max(0, Math.min(Math.round(count), maxParticles - particles.length));
        for (let i = 0; i < total; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            const isBlock = blockType != null;
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 3 * speed,
                (Math.random() * 3 + 1) * speed,
                (Math.random() - 0.5) * 3 * speed,
            );
            const remnant = isBlock && i % 4 === 0;
            let scale = 1;
            if (isBlock) {
                // Distribui as origens pelos oito octantes do bloco quebrado.
                const dx = i % 2 ? 1 : -1;
                const dy = Math.floor(i / 2) % 2 ? 1 : -1;
                const dz = Math.floor(i / 4) % 2 ? 1 : -1;
                mesh.position.set(
                    x + 0.5 + dx * (0.14 + Math.random() * 0.18),
                    y + 0.5 + dy * (0.14 + Math.random() * 0.18),
                    z + 0.5 + dz * (0.14 + Math.random() * 0.18),
                );
                velocity.x = dx * (0.55 + Math.random() * 1.25);
                velocity.z = dz * (0.55 + Math.random() * 1.25);
                scale = (remnant ? 1.4 : 0.7) + Math.random() * 0.45;
                mesh.scale.setScalar(scale);
                mesh.rotation.y = Math.random() * Math.PI;
            } else {
                mesh.position.set(
                    x + (Math.random() - 0.5) * spread,
                    y + (Math.random() - 0.5) * spread,
                    z + (Math.random() - 0.5) * spread,
                );
            }
            scene.add(mesh);
            particles.push({
                mesh, velocity, isBlock, scale,
                spin: isBlock ? (Math.random() - 0.5) * 10 : 0,
                canBounce: remnant,
                life: (remnant ? 2.8 : 0.6) + Math.random() * 0.4,
            });
        }
    }

    // Avança cada eixo até a primeira face sólida. O passo do jogo é limitado a 0,05 s.
    function moveFragment(particle, dt) {
        const { mesh, velocity } = particle;
        const scale = particle.scale * Math.min(1, particle.life / 0.25);
        mesh.scale.setScalar(scale);
        const pos = mesh.position;
        mesh.rotation.y += particle.spin * dt;
        const half = 0.05 * scale;
        const horizontalRadius = half * (Math.abs(Math.cos(mesh.rotation.y)) + Math.abs(Math.sin(mesh.rotation.y)));
        for (const axis of ['x', 'z', 'y']) {
            if (velocity[axis] === 0) continue;
            const direction = Math.sign(velocity[axis]);
            const next = pos[axis] + velocity[axis] * dt;
            const radius = axis === 'y' ? half : horizontalRadius;
            const edge = Math.floor(next + direction * radius);
            if (isSolidAt(axis === 'x' ? edge : Math.floor(pos.x),
                          axis === 'y' ? edge : Math.floor(pos.y),
                          axis === 'z' ? edge : Math.floor(pos.z))) {
                pos[axis] = edge + (direction < 0 ? 1 + radius : -radius);
                const impact = Math.abs(velocity[axis]);
                velocity[axis] = 0;
                if (axis === 'y' && direction < 0) {
                    if (particle.canBounce && impact > 2) {
                        velocity.y = impact * 0.23;
                        velocity.x *= 0.4;
                        velocity.z *= 0.4;
                        particle.spin *= 0.4;
                        particle.canBounce = false;
                    } else {
                        velocity.x = 0;
                        velocity.z = 0;
                        particle.spin = 0;
                    }
                }
            } else {
                pos[axis] = next;
            }
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
            if (particle.isBlock) moveFragment(particle, dt);
            else position.addScaledVector(particle.velocity, dt);
        }
    }

    function clear() {
        const scene = getScene();
        for (const particle of particles) scene?.remove(particle.mesh);
        particles.length = 0;
    }

    return { spawn, update, clear, get count() { return particles.length; } };
}
