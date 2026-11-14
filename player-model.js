import { createPlayerHair } from './player-hair.js';

/** Modelo visual independente da câmera, do mundo e da rede.
 * Frente aponta para +Z; pés ficam em y=0. Medidas em blocos.
 * Os pivôs de braços e pernas permitem animá-los sem alterar a geometria.
 */
export const PLAYER_MODEL_HEIGHT = 1.8;
export const PLAYER_MODEL_COLORS = Object.freeze({
    skin: 0xb77c5f, hair: 0x38281f, tunic: 0x536b47, sleeve: 0xb4a582,
    trousers: 0x514b43, boots: 0x302e2b, belt: 0x654a32, buckle: 0xc2aa72,
    eyes: 0x292923, eyeWhite: 0xeee6d4, trim: 0x384f35,
});

export function createPlayerModel(THREE, colors = {}) {
    const palette = { ...PLAYER_MODEL_COLORS, ...colors };
    const materials = Object.fromEntries(Object.entries(palette).map(([key, color]) => [key, new THREE.MeshLambertMaterial({ color })]));
    const geometries = [];
    const root = new THREE.Group();
    root.name = 'player';
    const unit = PLAYER_MODEL_HEIGHT / 32;
    const part = (name, x, y, z) => {
        const group = new THREE.Group();
        group.name = name;
        group.position.set(x * unit, y * unit, z * unit);
        root.add(group);
        return group;
    };
    const box = (parent, name, material, size, position) => {
        const geometry = new THREE.BoxGeometry(...size.map(n => n * unit));
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, materials[material]);
        mesh.name = name;
        mesh.position.set(...position.map(n => n * unit));
        parent.add(mesh);
        return mesh;
    };
    const head = part('head', 0, 24, 0);
    // Cabeça completa e cabelo independente, preso ao pivô da cabeça.
    box(head, 'face', 'skin', [8, 8, 8], [0, 4, 0]);
    const hair = createPlayerHair(THREE, unit);
    head.add(hair.mesh);
    for (const x of [-2, 2]) {
        box(head, 'eyebrow', 'hair', [1.6, 0.42, 0.08], [x, 5.5, 4.07]);
        box(head, 'eye-white', 'eyeWhite', [1.5, 2.0, 0.08], [x, 4.05, 4.03]);
        box(head, 'pupil', 'eyes', [0.72, 1.35, 0.09], [x - Math.sign(x) * 0.28, 3.90, 4.08]);
    }
    box(head, 'mouth', 'belt', [2, 0.45, 0.08], [0, 2.1, 4.04]);
    const torso = part('torso', 0, 12, 0);
    box(torso, 'tunic', 'tunic', [8, 12, 4], [0, 6, 0]);
    box(torso, 'collar', 'trim', [3, 1, 0.08], [0, 11, 2.04]);
    box(torso, 'belt', 'belt', [8.1, 1.25, 4.1], [0, 1.5, 0]);
    box(torso, 'buckle', 'buckle', [1.25, 1.25, 0.1], [0, 1.5, 2.1]);
    const arms = [-1, 1].map((side) => {
        const arm = part(side < 0 ? 'leftArm' : 'rightArm', side * 6, 24, 0);
        box(arm, 'sleeve', 'sleeve', [4, 5, 4], [0, -2.5, 0]);
        box(arm, 'hand', 'skin', [4, 7, 4], [0, -8.5, 0]);
        return arm;
    });
    const legs = [-1, 1].map((side) => {
        const leg = part(side < 0 ? 'leftLeg' : 'rightLeg', side * 2, 12, 0);
        box(leg, 'trousers', 'trousers', [4, 9, 4], [0, -4.5, 0]);
        box(leg, 'boot', 'boots', [4, 3, 4], [0, -10.5, 0]);
        return leg;
    });
    return {
        root, head, torso, leftArm: arms[0], rightArm: arms[1], leftLeg: legs[0], rightLeg: legs[1],
        dispose() { hair.dispose(); geometries.forEach(geometry => geometry.dispose()); Object.values(materials).forEach(material => material.dispose()); },
    };
}
