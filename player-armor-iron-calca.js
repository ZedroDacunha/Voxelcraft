import { pixelFabric, fabricBox } from './player-outfit-tecido-textura-preview.js';

// Estudo independente: cada placa segue o pivô da própria perna.
export function previewIronLeggings(THREE, model, unit) {
    const copper = pixelFabric(THREE, [155, 168, 173]);
    const shade = pixelFabric(THREE, [96, 106, 111]);
    const rim = pixelFabric(THREE, [65, 72, 77]);
    const light = pixelFabric(THREE, [184, 195, 199]);
    const glint = pixelFabric(THREE, [239, 244, 244]);
    const groups = [], covered = [];
    function box(parent, name, mat, size, pos) {
        const mesh = new THREE.Mesh(fabricBox(THREE, size, unit), mat);
        mesh.name = name;
        mesh.position.set(...pos.map(n => n * unit));
        parent.add(mesh);
    }
    for (const [leg, side] of [[model.leftLeg, -1], [model.rightLeg, 1]]) {
        const piece = new THREE.Group();
        piece.name = 'iron-leggings-preview';
        leg.add(piece); groups.push(piece);
        // O tecido e seus painéis de dobra são cobertos pela armadura. Deixar
        // os dois visíveis fazia o painel lateral atravessar o metal e piscar.
        for (const name of ['trousers-preview', 'trousers']) {
            const garment = leg.getObjectByName(name);
            if (garment) covered.push({ garment, original: garment.visible });
        }
        // A superfície interna mantém uma fresta para as pernas nunca piscarem
        // quando se encontram; o cobre envolve tecido à frente, atrás e fora.
        box(piece, 'copper-leg', copper, [3.96, 8.0, 4.5], [side * .04, -4.2, 0]);
        // Camada de cintura segmentada em cada perna: acompanha a animação sem
        // criar uma peça rígida atravessando o vão das pernas.
        for (const z of [-1, 1]) {
            box(piece, 'waist-copper', shade, [3.96, 1.02, .10], [side * .04, -.73, z * 2.31]);
            box(piece, 'waist-light', light, [3.96, .24, .08], [side * .04, -.37, z * 2.40]);
            box(piece, 'waist-glint', glint, [2.2, .16, .05], [side * .10, -.38, z * 2.46]);
            box(piece, 'waist-dark-line', rim, [3.96, .18, .08], [side * .04, -1.21, z * 2.40]);
        }
        box(piece, 'waist-side', shade, [.10, 1.02, 4.52], [side * 2.07, -.73, 0]);
        box(piece, 'waist-side-top', light, [.08, .24, 4.54], [side * 2.16, -.37, 0]);
        box(piece, 'waist-side-line', rim, [.08, .18, 4.54], [side * 2.16, -1.21, 0]);
        // Bordas laterais escuras e reflexos em blocos como no ícone.
        for (const z of [-1, 1]) {
            box(piece, 'outer-edge', shade, [.25, 6.4, .08], [side * 1.84, -4.7, z * 2.30]);
            box(piece, 'thigh-plate-highlight', light, [1.2, 1.0, .08], [side * .6, -2.55, z * 2.31]);
            box(piece, 'thigh-plate-glint', glint, [.50, .32, .05], [side * .6, -2.30, z * 2.38]);
            box(piece, 'knee-facet', shade, [.7, .22, .07], [-side * .65, -5.0, z * 2.30]);
        }
        box(piece, 'side-thigh-light', light, [.07, 1.0, 1.05], [side * 2.08, -2.55, .65]);
        // Faixas envolventes, como a barra inferior do peitoral aprovado.
        for (const z of [-1, 1]) {
            box(piece, 'hem-front-back', rim, [3.96, .18, .08], [side * .04, -8.12, z * 2.29]);
            
            box(piece, 'lower-reflection', light, [.38, .62, .06], [-side * .58, -6.25, z * 2.29]);
            box(piece, 'lower-dark-pixel', shade, [.35, .25, .06], [side * 1.2, -7.65, z * 2.29]);
        }
        box(piece, 'hem-outer', rim, [.08, .18, 4.6], [side * 2.06, -8.12, 0]);
        
    }
    function setVisible(value) {
        groups.forEach(g => { g.visible = !!value; });
        for (const { garment, original } of covered) garment.visible = value ? false : original;
    }
    setVisible(true);
    return { setVisible, groups };

}
