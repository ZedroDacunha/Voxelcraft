import { pixelFabric, fabricBox } from './player-outfit-tecido-textura-preview.js';

// Geometrias das peças selecionadas nas prévias do conjunto de ouro.
export function addGoldArmorDetails(THREE, unit, { helmet, chest, leggings, boots }) {
    const mid = pixelFabric(THREE, [218, 163, 39]);
    const bright = pixelFabric(THREE, [255, 218, 86]);
    const dark = pixelFabric(THREE, [125, 82, 19]);
    function box(parent, name, material, size, pos) {
        const mesh = new THREE.Mesh(fabricBox(THREE, size, unit), material);
        mesh.name = name; mesh.position.set(...pos.map(v => v * unit)); parent.add(mesh);
    }
    // Capacete D escolhido.
    box(helmet.helmet, 'd-top', bright, [7.5, .18, 7.5], [0, 9.17, 0]);
    for (const side of [-1, 1]) {
        box(helmet.helmet, 'd-side', mid, [.07, 4.0, .42], [side * 4.39, 4.65, -1.1]);
        box(helmet.helmet, 'd-front', bright, [.38, 2.7, .07], [side * 3.85, 4.55, 4.46]);
    }
    // Peitoral B detalhado aprovado.
    const torso = chest.root.getObjectByName('chest-torso-pivot');
    const shoulders = [chest.root.getObjectByName('chest-left-pivot'), chest.root.getObjectByName('chest-right-pivot')];
    for (const side of [-1, 1]) {
        for (const face of [-1, 1]) box(torso, 'b-vertical', mid, [.32, 8.8, .06], [side * 3.7, 4.2, face * 2.98]);
        box(torso, 'b-side-bottom', mid, [.06, .36, 5], [side * 4.46, -.95, 0]);
    }
    for (const face of [-1, 1]) box(torso, 'b-bottom', mid, [8.3, .36, .06], [0, -.95, face * 2.98]);
    shoulders.forEach((shoulder, i) => {
        const side = i === 0 ? -1 : 1;
        for (const face of [-1, 1]) box(shoulder, 'b-cuff', mid, [3.75, .32, .06], [side * .315, -4.55, face * 2.64]);
        box(shoulder, 'b-cuff-side', mid, [.06, .32, 4.8], [side * 2.41, -4.55, 0]);
    });
    for (const face of [-1, 1]) {
        for (const side of [-1, 1]) {
            box(torso, 'refined-brow-light', bright, [1.15, .25, .06], [side * 2.55, 8.15, face * 3.06]);
            box(torso, 'refined-vertical-light', mid, [.24, 4.5, .06], [side * 2.82, 4.6, face * 3.06]);
            box(torso, 'refined-lower-step', bright, [.9, .22, .06], [side * 2.35, 1.45, face * 3.06]);
        }
        box(torso, 'refined-lower-line', dark, [7.45, .20, .06], [0, -.50, face * 3.06]);
    }
    for (const side of [-1, 1]) {
        box(torso, 'refined-side-vertical', mid, [.06, 5.0, .35], [side * 4.53, 4.5, -.8]);
        box(torso, 'refined-side-light', bright, [.06, .24, 2.7], [side * 4.53, 7.55, 0]);
        box(torso, 'refined-side-bottom', dark, [.06, .20, 4.8], [side * 4.53, -.5, 0]);
    }
    shoulders.forEach((shoulder, i) => {
        const side = i === 0 ? -1 : 1;
        for (const face of [-1, 1]) {
            box(shoulder, 'refined-shoulder-light', bright, [1.55, .25, .06], [side * .45, -1.85, face * 2.72]);
            box(shoulder, 'refined-shoulder-edge', dark, [.20, 2.5, .06], [side * 1.7, -3.05, face * 2.72]);
        }
        box(shoulder, 'refined-shoulder-side', mid, [.06, .25, 3.2], [side * 2.49, -1.85, 0]);
    });
    // Calça A detalhada, com relevos integrados às placas.
    leggings.groups.forEach((leg, i) => {
        const side = i === 0 ? -1 : 1;
        for (const face of [-1, 1]) {
            box(leg, 'a-upper-band', bright, [3.65, .24, .13], [side * .04, -1.65, face * 2.305]);
            box(leg, 'refined-outer-line', dark, [.20, 5.3, .20], [side * 1.57, -4.75, face * 2.34]);
            box(leg, 'refined-upper-step', mid, [1.2, .25, .20], [side * .45, -2.12, face * 2.34]);
            box(leg, 'refined-lower-light', bright, [.34, .75, .20], [-side * .55, -6.25, face * 2.34]);
            box(leg, 'refined-hem-light', mid, [3.55, .21, .20], [side * .04, -7.8, face * 2.34]);
        }
        box(leg, 'a-side-band', bright, [.10, .24, 4.2], [side * 2.06, -1.65, 0]);
        box(leg, 'refined-side-vertical', mid, [.14, 4.7, .32], [side * 2.08, -4.65, -.9]);
        box(leg, 'refined-side-upper', mid, [.14, .22, 2.7], [side * 2.08, -2.1, 0]);
        box(leg, 'refined-side-hem', mid, [.14, .21, 4.1], [side * 2.08, -7.8, 0]);
    });
    // Botas C escolhidas.
    boots.groups.forEach((boot, i) => {
        const side = i === 0 ? -1 : 1;
        box(boot, 'c-side-panel', mid, [.06, 1.25, 2.5], [side * 2.16, -9.75, 0]);
        for (const face of [-1, 1]) box(boot, 'c-edge', mid, [.25, 1.25, .06], [side * 1.55, -9.75, face * 2.42]);
    });
}
