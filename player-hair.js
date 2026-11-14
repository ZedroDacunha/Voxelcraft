/** Cabelo como peça independente. Uma cabeça 8×8×8 ocupa x,z [-4,4] e y [0,8]. */
export function hairCells() {
    const cells = new Map();
    const add = (x, y, z) => cells.set(`${x},${y},${z}`, { x, y, z });
    for (let x = -5; x <= 4; x++) for (let z = -5; z <= 4; z++) add(x, 8, z);
    for (let x = -4; x <= 3; x++) for (let z = -4; z <= 3; z++) add(x, 9, z);
    for (let x = -5; x <= 4; x++) for (let y = 2; y <= 7; y++) add(x, y, -5);
    for (const x of [-5, 4]) for (let z = -4; z <= 3; z++) for (let y = 4; y <= 7; y++) add(x, y, z);
    for (const x of [-5, 4]) for (let z = -4; z <= -1; z++) for (let y = 2; y <= 3; y++) add(x, y, z);
    for (let x = -4; x <= 3; x++) add(x, 7, 4);
    for (const x of [-4, -3, -1, 1, 2, 3]) add(x, 6, 4);
    for (const x of [-4, 3]) add(x, 5, 4);
    return cells;
}

// Só faces externas: blocos vizinhos não geram pares coplanares internos.
const DIRECTIONS = [
    { n: [1, 0, 0], c: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
    { n: [-1, 0, 0], c: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
    { n: [0, 1, 0], c: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
    { n: [0, -1, 0], c: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
    { n: [0, 0, 1], c: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
    { n: [0, 0, -1], c: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] },
];
export function hairSurface(cells = hairCells()) {
    const positions = [], normals = [], colors = [];
    for (const { x, y, z } of cells.values()) for (const { n, c } of DIRECTIONS) {
        if (cells.has(`${x+n[0]},${y+n[1]},${z+n[2]}`)) continue;
        const seed = ((x*17 + y*31 + z*13) % 7 + 7) % 7;
        const shade = [0.77, 0.82, 0.88, 0.93, 0.97, 1.02, 1.06][seed];
        for (const i of [0, 1, 2, 0, 2, 3]) {
            const p = c[i]; positions.push(x+p[0], y+p[1], z+p[2]); normals.push(...n);
            colors.push(.09*shade, .045*shade, .025*shade);
        }
    }
    return { positions, normals, colors };
}

export function createPlayerHair(THREE, unit) {
    const data = hairSurface();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
    geometry.computeBoundingSphere();
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'player-hair';
    mesh.scale.setScalar(unit);
    return { mesh, dispose() { geometry.dispose(); material.dispose(); } };
}
