import { pixelFabric, fabricBox } from './player-outfit-tecido-textura-preview.js';

// Detalhes do conjunto B aprovado na prévia.
export function addIronArmorDetails(THREE, unit, { helmet, chest, leggings, boots }) {
    const dark = pixelFabric(THREE, [96, 106, 111]);
    const mid = pixelFabric(THREE, [184, 195, 199]);
    function detail(parent, name, material, size, pos) {
        const mesh = new THREE.Mesh(fabricBox(THREE, size, unit), material);
        mesh.name = name; mesh.position.set(...pos.map(v => v * unit)); parent.add(mesh);
    }
    // Capacete B: os mesmos detalhes da comparação aprovada.
    detail(helmet.helmet, 'b-brow-rim', mid, [5.7, .25, .07], [0, 6.83, 4.46]);
    for (const side of [-1, 1]) {
        detail(helmet.helmet, 'b-face-rim', mid, [.27, 4.0, .07], [side * 3.2, 4.35, 4.46]);
        detail(helmet.helmet, 'b-bottom-edge', mid, [.07, .24, 7.0], [side * 4.4, 2.78, 0]);
    }
    // Peitoral B, com gola aberta e ombreiras fixas no tronco.
    const torso = chest.root.getObjectByName('chest-torso-pivot');
    for (const side of [-1, 1]) {
        for (const face of [-1, 1]) detail(torso, 'b-vertical', mid, [.32, 8.8, .06], [side * 3.7, 4.2, face * 2.98]);
        detail(torso, 'b-side', mid, [.06, .36, 5.0], [side * 4.46, -.95, 0]);
    }
    for (const face of [-1, 1]) detail(torso, 'b-bottom', mid, [8.3, .36, .06], [0, -.95, face * 2.98]);
    [chest.root.getObjectByName('chest-left-pivot'), chest.root.getObjectByName('chest-right-pivot')].forEach((shoulder, i) => {
        const side = i === 0 ? -1 : 1;
        for (const face of [-1, 1]) detail(shoulder, 'b-shoulder-band', mid, [3.75, .32, .06], [side * .315, -4.55, face * 2.64]);
        detail(shoulder, 'b-shoulder-side', mid, [.06, .32, 4.8], [side * 2.41, -4.55, 0]);
    });
    // Calça B: barras discretas sem fechar o vão entre as pernas.
    leggings.groups.forEach((leg, i) => {
        const side = i === 0 ? -1 : 1;
        for (const face of [-1, 1]) {
            detail(leg, 'b-outer-edge', dark, [.24, 5.5, .06], [side * 1.58, -4.75, face * 2.48]);
            detail(leg, 'b-hem', mid, [3.65, .25, .06], [side * .04, -7.82, face * 2.48]);
        }
        detail(leg, 'b-side-hem', mid, [.06, .25, 4.2], [side * 2.23, -7.82, 0]);
    });
    // Botas B, usando a base com a correção da linha inferior aprovada.
    boots.groups.forEach((boot, i) => {
        const side = i === 0 ? -1 : 1;
        for (const z of [-1, 1]) detail(boot, 'b-upright', dark, [.23, 1.45, .06], [side * 1.55, -9.55, z * 2.40]);
        detail(boot, 'b-bottom-back', dark, [3.6, .20, .06], [0, -11.48, -2.38]);
        detail(boot, 'b-bottom-front', dark, [3.6, .20, .06], [0, -11.48, 3.04]);
        detail(boot, 'b-bottom-side', dark, [.06, .20, 4.2], [side * 2.16, -11.48, 0]);
    });
}
