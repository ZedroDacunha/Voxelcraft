export const WORLD_CLOUD_CONFIG = Object.freeze({
    cellSize: 8,
    thickness: 3,
    gridSize: 32,
    height: 80,
    speed: 1.6,
    noiseScale: 0.13,
    threshold: 0.12,
});

export function createWorldClouds({ THREE, Noise2D, faces, config = WORLD_CLOUD_CONFIG }) {
    let cloudMesh = null;
    let cloudNoise = null;
    const cloudMaterial = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.88, fog: false,
    });
    const state = { scroll: 0, key: '', cells: 0 };
    const noiseCache = new Map();
    const noiseCacheLimit = 8192;
    const brightness = { top: 1.0, side: 0.84, bottom: 0.68 };
    const nightColor = new THREE.Color(0x232a46);
    const duskColor = new THREE.Color(0xffb690);
    const whiteColor = new THREE.Color(0xffffff);
    const cloudColor = new THREE.Color();

    function create(scene, seed) {
        cloudNoise = new Noise2D(seed + 555);
        noiseCache.clear();
        cloudMesh = new THREE.Mesh(new THREE.BufferGeometry(), cloudMaterial);
        cloudMesh.frustumCulled = false;
        cloudMesh.renderOrder = -0.5;
        scene.add(cloudMesh);
    }

    function densityAt(x, z) {
        const key = `${x},${z}`;
        if (noiseCache.has(key)) {
            const density = noiseCache.get(key);
            noiseCache.delete(key);
            noiseCache.set(key, density);
            return density;
        }
        const density = cloudNoise.fbm(x * config.noiseScale, z * config.noiseScale, 3);
        noiseCache.set(key, density);
        if (noiseCache.size > noiseCacheLimit) noiseCache.delete(noiseCache.keys().next().value);
        return density;
    }

    function buildGeometry(camCx, camCz, cloudIndex) {
        const grid = config.gridSize, half = grid / 2;
        const filled = new Uint8Array(grid * grid);
        let count = 0;
        for (let j = 0; j < grid; j++) {
            for (let i = 0; i < grid; i++) {
                const di = i - half, dj = j - half;
                if (di * di + dj * dj > half * half) continue;
                const density = densityAt(di + camCx - cloudIndex, dj + camCz);
                if (density > config.threshold) { filled[i + j * grid] = 1; count++; }
            }
        }
        state.cells = count;
        const has = (i, j) => i >= 0 && j >= 0 && i < grid && j < grid && filled[i + j * grid] === 1;
        const positions = [], normals = [], colors = [], indices = [];
        const size = config.cellSize, thickness = config.thickness;
        for (let j = 0; j < grid; j++) {
            for (let i = 0; i < grid; i++) {
                if (!filled[i + j * grid]) continue;
                const ox = (i - half) * size, oz = (j - half) * size;
                for (const face of faces) {
                    if (face.dir[1] === 0 && has(i + face.dir[0], j + face.dir[2])) continue;
                    const shade = face.dir[1] > 0 ? brightness.top : face.dir[1] < 0 ? brightness.bottom : brightness.side;
                    const base = positions.length / 3;
                    for (const corner of face.corners) {
                        positions.push(ox + corner.pos[0] * size, corner.pos[1] * thickness, oz + corner.pos[2] * size);
                        normals.push(face.dir[0], face.dir[1], face.dir[2]);
                        colors.push(shade, shade, shade);
                    }
                    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
                }
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        return geometry;
    }

    function update(deltaSeconds, camera) {
        if (!cloudMesh) return;
        state.scroll += deltaSeconds * config.speed / config.cellSize;
        const cloudIndex = Math.floor(state.scroll), fraction = state.scroll - cloudIndex;
        const cameraCellX = Math.floor(camera.position.x / config.cellSize);
        const cameraCellZ = Math.floor(camera.position.z / config.cellSize);
        const key = `${cameraCellX},${cameraCellZ},${cloudIndex}`;
        if (key !== state.key) {
            state.key = key;
            const oldGeometry = cloudMesh.geometry;
            cloudMesh.geometry = buildGeometry(cameraCellX, cameraCellZ, cloudIndex);
            oldGeometry.dispose();
        }
        cloudMesh.position.set(
            (cameraCellX + fraction) * config.cellSize,
            config.height,
            cameraCellZ * config.cellSize,
        );
    }

    function updateTint(day, warm) {
        cloudColor.copy(nightColor).lerp(whiteColor, day).lerp(duskColor, warm * 0.55);
        cloudMaterial.color.copy(cloudColor);
    }

    return {
        create,
        update,
        updateTint,
        get cells() { return state.cells; },
        get gridSize() { return config.gridSize; },
        get height() { return config.height; },
    };
}
