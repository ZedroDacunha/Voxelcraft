import { pixelFabric, fabricBox } from './player-outfit-tecido-textura-preview.js';

// Modelos D, A facetado, A detalhado e C detalhado do conjunto de diamante.
export function addDiamondArmorDetails(THREE, unit, { helmet, chest, leggings, boots }) {
    const dark = pixelFabric(THREE, [32, 119, 145]);
    const mid = pixelFabric(THREE, [80, 196, 216]);
    const bright = pixelFabric(THREE, [190, 246, 250]);
    function box(parent, name, material, size, pos) {
        const mesh = new THREE.Mesh(fabricBox(THREE, size, unit), material);
        mesh.name = name; mesh.position.set(...pos.map(v => v * unit)); parent.add(mesh);
    }
    // Peças reproduzem as versões mais detalhadas mostradas nas prévias.
    {
        const addHelmet = (name, material, size, pos) => box(helmet.helmet, name, material, size, pos);
        // Base D idêntica à prévia escolhida.
        addHelmet('d-top', bright, [7.5, .18, 7.5], [0, 9.14, 0]);
        for (const side of [-1, 1]) {
            addHelmet('d-side', mid, [.16, 4.0, .42], [side * 4.40, 4.65, -1.1]);
            addHelmet('d-front', bright, [.38, 2.7, .16], [side * 3.85, 4.55, 4.40]);
        }
        {
            // Relevos ligados ao metal, com profundidade diferente dos detalhes existentes.
            addHelmet('refined-front-top', mid, [3.7, .18, .20], [0, 7.95, 4.42]);
            addHelmet('refined-back-band', mid, [7.2, .22, .20], [0, 7.05, -4.42]);
            for (const side of [-1, 1]) {
                addHelmet('refined-side-lower', dark, [.20, .20, 6.4], [side * 4.42, 2.92, 0]);
                addHelmet('refined-side-glint', bright, [.20, .28, 1.65], [side * 4.42, 6.4, 1.55]);
                addHelmet('refined-back-edge', dark, [.32, 3.6, .20], [side * 3.35, 4.7, -4.42]);
                addHelmet('refined-front-glint', mid, [.26, .9, .20], [side * 3.35, 5.15, 4.42]);
            }
            addHelmet('refined-top-glint', mid, [2.6, .08, 1.4], [0, 9.25, 1.1]);
        }
    }
    {
        const torso = chest.root.getObjectByName('chest-torso-pivot');
        const shoulders = [chest.root.getObjectByName('chest-left-pivot'), chest.root.getObjectByName('chest-right-pivot')];
        // Base A como na opção escolhida: faixa sobre a placa e ombreiras fixas.
        for (const face of [-1, 1]) box(torso, 'a-band', bright, [8.3, .42, .20], [0, 6.65, face * 2.90]);
        for (const side of [-1, 1]) box(torso, 'a-side', bright, [.16, .42, 5], [side * 4.43, 6.65, 0]);
        shoulders.forEach((shoulder, i) => {
            const side = i === 0 ? -1 : 1;
            for (const face of [-1, 1]) box(shoulder, 'a-shoulder-band', bright, [3.75, .36, .16], [side * .315, -2.35, face * 2.56]);
            box(shoulder, 'a-shoulder-side', bright, [.16, .36, 4.8], [side * 2.34, -2.35, 0]);
        });
        {
            // Relevos entram ligeiramente na placa, sem ocultar a abertura da gola.
            for (const face of [-1, 1]) {
                for (const side of [-1, 1]) {
                    box(torso, 'refined-upper-glint', mid, [1.05, .24, .22], [side * 2.55, 8.35, face * 2.91]);
                    box(torso, 'refined-edge', dark, [.26, 4.1, .22], [side * 3.3, 3.7, face * 2.91]);
                    box(torso, 'refined-lower-glint', mid, [.85, .26, .22], [side * 2.3, 1.05, face * 2.91]);
                }
                box(torso, 'refined-bottom', mid, [7.5, .23, .22], [0, -.70, face * 2.91]);
            }
            for (const side of [-1, 1]) {
                box(torso, 'refined-side-edge', mid, [.20, 4.6, .30], [side * 4.45, 3.6, -.8]);
                box(torso, 'refined-side-light', mid, [.20, .24, 2.7], [side * 4.45, 8.05, 0]);
                box(torso, 'refined-side-bottom', mid, [.20, .23, 4.8], [side * 4.45, -.70, 0]);
            }
            shoulders.forEach((shoulder, i) => {
                const side = i === 0 ? -1 : 1;
                for (const face of [-1, 1]) {
                    box(shoulder, 'refined-shoulder-glint', mid, [1.4, .23, .22], [side * .4, -1.35, face * 2.57]);
                    box(shoulder, 'refined-shoulder-edge', dark, [.20, 1.3, .22], [side * 1.55, -3.55, face * 2.57]);
                }
                box(shoulder, 'refined-shoulder-side', mid, [.20, .23, 3.0], [side * 2.36, -1.35, 0]);
            });
        }
        {
            // Uma segunda camada de facetas, como relevo ligado à peça, destaca
            // o diamante sem fechar a gola ou separar as ombreiras do tronco.
            for (const face of [-1, 1]) {
                box(torso, 'elite-center-upper', bright, [2.4, .30, .30], [0, 5.8, face * 2.96]);
                box(torso, 'elite-center-mid', mid, [1.6, .30, .30], [0, 5.49, face * 2.96]);
                box(torso, 'elite-center-lower', bright, [.8, .30, .30], [0, 5.18, face * 2.96]);
                for (const side of [-1, 1]) {
                    box(torso, 'elite-shoulder-facing', bright, [.9, .24, .30], [side * 3.35, 9.35, face * 2.96]);
                    box(torso, 'elite-lower-facing', bright, [1.05, .24, .30], [side * 2.2, .35, face * 2.96]);
                }
            }
            for (const side of [-1, 1]) {
                box(torso, 'elite-side-upper', bright, [.30, .26, 3.8], [side * 4.48, 7.32, 0]);
                box(torso, 'elite-side-facet', dark, [.30, 2.0, 1.1], [side * 4.48, 4.3, 1.0]);
                box(torso, 'elite-side-lower', bright, [.30, .24, 3.8], [side * 4.48, .35, 0]);
            }
            shoulders.forEach((shoulder, i) => {
                const side = i === 0 ? -1 : 1;
                for (const face of [-1, 1]) {
                    box(shoulder, 'elite-shoulder-facet', mid, [2.0, .24, .30], [side * .30, -3.05, face * 2.60]);
                    box(shoulder, 'elite-shoulder-glint', bright, [.8, .23, .30], [side * .35, -.78, face * 2.60]);
                }
                box(shoulder, 'elite-shoulder-side', bright, [.30, .24, 3.4], [side * 2.39, -3.05, 0]);
            });
        }
    }
        leggings.groups.forEach((leg, i) => {
            const side = i === 0 ? -1 : 1;
            for (const face of [-1, 1]) box(leg, 'a-upper-band', bright, [3.65, .24, .20], [side * .04, -1.65, face * 2.34]);
            box(leg, 'a-side-band', bright, [.14, .24, 4.2], [side * 2.08, -1.65, 0]);
            {
                // Relevos entram na placa e acompanham sua perna, sem peças soltas.
                for (const face of [-1, 1]) {
                    box(leg, 'refined-outer-edge', dark, [.23, 4.5, .23], [side * 1.55, -4.75, face * 2.365]);
                    box(leg, 'refined-upper-facet', bright, [1.25, .23, .23], [side * .28, -2.15, face * 2.365]);
                    box(leg, 'refined-lower-facet', mid, [.75, .23, .23], [-side * .10, -2.44, face * 2.365]);
                    box(leg, 'refined-lower-glint', bright, [.34, .7, .23], [-side * .55, -6.15, face * 2.365]);
                    box(leg, 'refined-hem', mid, [3.55, .23, .23], [side * .04, -7.8, face * 2.365]);
                }
                box(leg, 'refined-side-line', mid, [.18, 4.2, .32], [side * 2.10, -4.6, -.9]);
                box(leg, 'refined-side-upper', bright, [.18, .24, 2.7], [side * 2.10, -2.1, 0]);
                box(leg, 'refined-side-lower', mid, [.18, .23, 4.0], [side * 2.10, -7.8, 0]);
            }
        });
        boots.groups.forEach((boot, i) => {
            const side = i === 0 ? -1 : 1;
            // Base C escolhida, com painel lateral e contornos ligados ao cano.
            box(boot, 'c-side-panel', mid, [.14, 1.25, 2.5], [side * 2.035, -9.75, 0]);
            for (const face of [-1, 1]) box(boot, 'c-edge', mid, [.25, 1.25, .16], [side * 1.55, -9.75, face * 2.30]);
            {
                // Facetas e linhas são relevos que entram no cano e na ponteira.
                for (const face of [-1, 1]) {
                    box(boot, 'refined-cuff-glint', bright, [1.5, .20, .20], [side * .15, -9.15, face * 2.32]);
                    box(boot, 'refined-shaft-edge', dark, [.22, .7, .20], [-side * 1.42, -9.95, face * 2.32]);
                    box(boot, 'refined-lower-band', mid, [3.25, .18, .16], [0, -11.30, face === 1 ? 3.00 : -2.30]);
                    box(boot, 'refined-toe-glint', bright, [1.1, .18, .16], [side * .45, -10.57, face === 1 ? 3.00 : -2.30]);
                }
                box(boot, 'refined-side-upper', bright, [.23, .20, 2.8], [side * 2.08, -9.10, 0]);
                box(boot, 'refined-side-facet', dark, [.23, .70, .35], [side * 2.08, -10.0, -.75]);
                box(boot, 'refined-side-lower', mid, [.23, .18, 3.8], [side * 2.08, -11.30, 0]);
            }

        });
}
