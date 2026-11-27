// Plantas de blocos em coordenadas relativas ao pé do tronco.
// O worker usa o mesmo código e os mesmos materiais do catálogo.
import { hash2, mulberry32 } from './world-math.js';

export class TreeShapes {
    // Um passo de inclinação + galho de até três blocos + dois de folhagem.
    static radius = 6;

    constructor(ids) {
        this.ids = ids;
        this.cache = new Map();
    }

    at(x, z, seed, forest) {
        const roll = hash2(x, z, seed + 151);
        const form = roll < (forest ? 0.48 : 0.20) ? 'tall'
            : roll < (forest ? 0.80 : 0.86) ? 'spreading' : 'weeping';
        const variant = Math.floor(hash2(x, z, seed + 7) * 64);
        const key = form + variant;
        if (!this.cache.has(key)) this.cache.set(key, this.build(form, variant));
        return this.cache.get(key);
    }

    build(form, variant) {
        const random = mulberry32(variant + 1907);
        const tall = form === 'tall', weeping = form === 'weeping';
        const { LOG, LEAVES } = this.ids;
        const cells = new Map();
        let height = 0;
        const put = (x, y, z, type) => {
            const key = `${x},${y},${z}`;
            if (type === LEAVES && cells.has(key)) return;
            cells.set(key, [x, y, z, type]);
            height = Math.max(height, y);
        };

        // Volumes arredondados que se encontram nas pontas dos galhos.
        const crown = (x, y, z, width, depth, rise) => {
            for (let dy = -rise; dy <= rise; dy++) {
                for (let dx = -width; dx <= width; dx++) {
                    for (let dz = -depth; dz <= depth; dz++) {
                        const distance = (dx / (width + 0.28)) ** 2
                            + (dz / (depth + 0.28)) ** 2 + (dy / (rise + 0.30)) ** 2;
                        if (distance <= 1) put(x + dx, y + dy, z + dz, LEAVES);
                    }
                }
            }
        };
        const fork = (tall || weeping ? 5 : 4) + Math.floor(random() * 3);
        const angle = random() * Math.PI * 2;
        const bendX = Math.round(Math.cos(angle)), bendZ = bendX ? 0 : Math.sign(Math.sin(angle));
        const tip = fork + (tall ? 4 : 2) + Math.floor(random() * 2);
        for (let y = 1; y <= fork; y++) put(0, y, 0, LOG);
        for (let y = fork; y <= tip; y++) put(bendX, y, bendZ, LOG);
        if (!tall) {
            // Raízes na base, apoiadas no terreno durante a geração.
            put(-bendX, 1, -bendZ, LOG);
            put(bendZ, 1, -bendX, LOG);
        }

        const arms = (tall ? 3 : 4) + Math.floor(random() * 2);
        for (let i = 0; i < arms; i++) {
            const direction = angle + (i + (random() - 0.5) * 0.40) * Math.PI * 2 / arms;
            const cos = Math.cos(direction), sin = Math.sin(direction);
            let length = 3;
            if (tall) length = i < 2 ? 3 : 2;
            else if (!weeping) length = 2 + Math.floor(random() * 2);
            let y = fork + (tall ? i : i % 2) - 1;
            const baseX = y < fork ? 0 : bendX, baseZ = y < fork ? 0 : bendZ;
            let x = baseX, z = baseZ;
            for (let step = 1; step <= length; step++) {
                // Preenche as curvas por face, inclusive em galhos diagonais.
                x = baseX + Math.round(cos * step);
                put(x, y, z, LOG);
                z = baseZ + Math.round(sin * step);
                put(x, y, z, LOG);
                if (step === length || (step === 1 && !weeping)) put(x, ++y, z, LOG);
            }
            crown(x, y + 1, z, 2, tall ? 1 + Math.floor(random() * 2) : 2, tall ? 2 : 1);
            if (weeping) {
                // Duas franjas em alturas diferentes deixam vãos entre os ramos.
                const edgeX = x + Math.round(cos * 1.5), edgeZ = z + Math.round(sin * 1.5);
                const drop = 3 + Math.floor(random() * 3);
                for (let j = 0; j < drop; j++) {
                    put(edgeX, y + 1 - j, edgeZ, LEAVES);
                    if (j < drop - 2) put(edgeX - Math.round(cos), y + 1 - j, edgeZ - Math.round(sin), LEAVES);
                }
            }
        }
        crown(bendX, tip, bendZ, 2, 2, tall ? 2 : 1);
        return { cells: [...cells.values()], height };
    }
}
