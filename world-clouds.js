export const WORLD_CLOUD_CONFIG = Object.freeze({
    cellSize: 8,
    thickness: 3,
    gridSize: 32,
    height: 80,
    speed: 1.6,
    noiseScale: 0.13,
    threshold: 0.14,
});

// Altura relativa ao plano das nuvens. O miolo cresce para cima e ganha
// um pequeno degrau por baixo, visível para quem está no chão.
const TOP = [0, 0.55, 1.30, 2.15];
const BOTTOM = [0, 0, -0.20, -0.45];

export function createWorldClouds({ THREE, Noise2D, faces, config = WORLD_CLOUD_CONFIG }) {
    let cloudMesh = null;
    let cloudNoise = null;
    const night = new THREE.Color(0x303952);
    const dayColor = new THREE.Color(0xfafcff);
    const duskShade = new THREE.Color(0xa69db2);
    const uniforms = {
        ambientTint: { value: dayColor.clone() },
        rimTint: { value: new THREE.Color(0xffc38f) },
        sunDirection: { value: new THREE.Vector3(0, 1, 0) },
        warmth: { value: 0 },
        invThickness: { value: 1 / config.thickness },
    };
    const cloudMaterial = new THREE.ShaderMaterial({
        uniforms, transparent: true,
        vertexShader: `
            uniform vec3 ambientTint, rimTint, sunDirection;
            uniform float warmth, invThickness;
            varying vec3 faceColor;
            void main() {
                float sunward = max(dot(normal, sunDirection), 0.0);
                float underside = max(-normal.y, 0.0);
                float core = clamp(-position.y * invThickness / 0.45, 0.0, 1.0);
                float shade = 0.84 + 0.16 * normal.y - underside * core * 0.22;
                faceColor = mix(ambientTint * shade, rimTint, warmth * sunward);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            varying vec3 faceColor;
            void main() {
                gl_FragColor = vec4(faceColor, 0.88);
                #include <colorspace_fragment>
            }`,
    });
    const grid = config.gridSize, half = grid / 2, stride = grid + 2;
    // A moldura vazia permite consultar os quatro vizinhos, inclusive na borda.
    const tiers = new Uint8Array(stride * stride);
    const tierCache = new Map();
    const state = { scroll: 0, originX: NaN, originZ: NaN, cells: 0 };

    function create(scene, seed) {
        cloudNoise = new Noise2D(seed + 555);
        tierCache.clear();
        state.scroll = 0;
        state.originX = NaN;
        cloudMesh = new THREE.Mesh(new THREE.BufferGeometry(), cloudMaterial);
        cloudMesh.frustumCulled = false;
        cloudMesh.renderOrder = -0.5;
        scene.add(cloudMesh);
    }

    function tierAt(x, z) {
        const key = `${x},${z}`;
        const cached = tierCache.get(key);
        if (cached !== undefined) return cached;
        const density = cloudNoise.fbm(x * config.noiseScale, z * config.noiseScale, 3) - config.threshold;
        const tier = density <= 0 ? 0 : density < 0.105 ? 1 : density < 0.245 ? 2 : 3;
        tierCache.set(key, tier);
        if (tierCache.size > 8192) tierCache.delete(tierCache.keys().next().value);
        return tier;
    }

    function buildGeometry(originX, originZ) {
        let count = 0;
        for (let z = 0; z < grid; z++) {
            for (let x = 0; x < grid; x++) {
                const dx = x - half, dz = z - half;
                const tier = dx * dx + dz * dz <= half * half ? tierAt(originX + dx, originZ + dz) : 0;
                tiers[(z + 1) * stride + x + 1] = tier;
                if (tier) count++;
            }
        }
        state.cells = count;
        const positions = [], normals = [], indices = [];
        const { cellSize, thickness } = config;
        function quad(face, x, z, width, depth, low, high) {
            const base = positions.length / 3;
            for (const { pos } of face.corners) {
                positions.push((x - half + pos[0] * width) * cellSize,
                    (pos[1] ? high : low) * thickness, (z - half + pos[2] * depth) * cellSize);
                normals.push(face.dir[0], face.dir[1], face.dir[2]);
            }
            indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
        // Une faces coplanares em faixas. Entre dois níveis desenha só os
        // degraus expostos acima e abaixo do vizinho mais baixo.
        for (const face of faces) {
            const [nx, ny, nz] = face.dir;
            const step = nx ? stride : 1;
            const neighbor = nx + nz * stride;
            for (let row = 0; row < grid; row++) {
                let index = stride + 1 + row * (nx ? 1 : stride);
                for (let col = 0; col < grid;) {
                    const tier = tiers[index];
                    const adjacent = ny ? 0 : tiers[index + neighbor];
                    if (tier <= adjacent) { col++; index += step; continue; }
                    let run = 1;
                    while (col + run < grid && tiers[index + run * step] === tier
                        && (ny || tiers[index + run * step + neighbor] === adjacent)) run++;
                    const x = nx ? row : col, z = nx ? col : row;
                    const w = nx ? 1 : run, d = nx ? run : 1;
                    if (ny || !adjacent) {
                        quad(face, x, z, w, d, BOTTOM[tier], TOP[tier]);
                    } else {
                        quad(face, x, z, w, d, TOP[adjacent], TOP[tier]);
                        quad(face, x, z, w, d, BOTTOM[tier], BOTTOM[adjacent]);
                    }
                    col += run;
                    index += run * step;
                }
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Int8BufferAttribute(normals, 3));
        geometry.setIndex(indices);
        return geometry;
    }

    function update(deltaSeconds, camera) {
        if (!cloudMesh) return;
        state.scroll += deltaSeconds * config.speed / config.cellSize;
        const cellX = Math.floor(camera.position.x / config.cellSize - state.scroll);
        const cellZ = Math.floor(camera.position.z / config.cellSize);
        if (cellX !== state.originX || cellZ !== state.originZ) {
            state.originX = cellX;
            state.originZ = cellZ;
            const oldGeometry = cloudMesh.geometry;
            cloudMesh.geometry = buildGeometry(cellX, cellZ);
            oldGeometry.dispose();
        }
        cloudMesh.position.set((cellX + state.scroll) * config.cellSize, config.height, cellZ * config.cellSize);
    }

    function updateTint(day, warm, sunDirection) {
        uniforms.ambientTint.value.copy(night).lerp(dayColor, day).lerp(duskShade, warm * 0.85);
        uniforms.warmth.value = warm;
        uniforms.sunDirection.value.copy(sunDirection);
    }

    return {
        create, update, updateTint,
        get cells() { return state.cells; },
        get gridSize() { return grid; },
        get height() { return config.height; },
    };
}
