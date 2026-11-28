// A região do lago usa blocos inteiros. Ao redor dela só precisamos da
// superfície visível, com células maiores à medida que entram na neblina.
import { FACES } from './world-faces.js';
import { smoothstep } from './world-math.js';
import { menuGrassHeight } from './menu-panorama.js';

function terrainEdges(radius) {
    const inside = Array.from({ length: radius * 2 + 2 }, (_, i) => i - radius - 0.5);
    const outside = [];
    let edge = radius + 0.5;
    for (const [count, step] of [[6, 1], [8, 2], [10, 4], [10, 8], [8, 32]]) {
        for (let i = 0; i < count; i++) outside.push(edge += step);
    }
    return [...outside.map(n => -n).reverse(), ...inside, ...outside];
}

function hillHeight(x, z) {
    const distance = Math.hypot(x, z);
    const ridge = Math.sin(x * 0.047 + Math.cos(z * 0.042)) * 5
        + Math.cos(z * 0.063 - x * 0.029) * 4 + Math.sin((x + z) * 0.091) * 2;
    return Math.round(menuGrassHeight(x, z) + smoothstep(43, 85, distance) * (17 + ridge));
}

export function buildMenuHorizon(THREE, panorama) {
    const { radius, heights } = panorama;
    const edges = terrainEdges(radius);
    const n = edges.length - 1;
    const levels = new Int16Array(n * n);
    const inside = (x, z) => Math.max(Math.abs(x), Math.abs(z)) <= radius;
    const mid = i => (edges[i] + edges[i + 1]) / 2;
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const x = mid(i), z = mid(j);
            levels[j * n + i] = inside(x, z) ? heights.get(`${x},${z}`) : hillHeight(x, z);
        }
    }

    const positions = [], normals = [], uvs = [], topIndices = [], sideIndices = [];
    function quad(face, x0, y0, z0, x1, y1, z1) {
        const start = positions.length / 3;
        const [nx, ny, nz] = face.dir;
        for (const { pos } of face.corners) {
            const x = pos[0] ? x1 : x0, y = pos[1] ? y1 : y0, z = pos[2] ? z1 : z0;
            positions.push(x, y, z);
            normals.push(nx, ny, nz);
            uvs.push(nx ? z + 0.5 : -x - 0.5, ny ? z + 0.5 : y + 0.5);
        }
        (ny ? topIndices : sideIndices).push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
    }

    const top = FACES.find(face => face.kind === 'top');
    const sides = FACES.filter(face => face.kind === 'side');
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            if (inside(mid(i), mid(j))) continue;
            const y = levels[j * n + i] + 0.5;
            const x0 = edges[i], x1 = edges[i + 1], z0 = edges[j], z1 = edges[j + 1];
            quad(top, x0, y, z0, x1, y, z1);
            for (const face of sides) {
                const ni = i + face.dir[0], nj = j + face.dir[2];
                if (ni < 0 || ni >= n || nj < 0 || nj >= n) continue;
                const base = levels[nj * n + ni] + 0.5;
                if (y > base) quad(face, x0, base, z0, x1, y, z1);
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(topIndices.concat(sideIndices));
    geometry.addGroup(0, topIndices.length, 0);
    geometry.addGroup(topIndices.length, sideIndices.length, 1);
    return geometry;
}
