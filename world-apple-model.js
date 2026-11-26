// Modelo 3D voxel da Maçã (Refino C2 · Textura 3 aprovada) + estágios progressivos de mordida.
// Geometria normalizada para altura unitária (tamanho ~ [0.816, 1.0, 0.726]),
// centrada na mesma origem em todos os estágios (0 = inteira, 1 = 1ª mordida, 2 = 2ª mordida, 3 = miolo).

export const APPLE_PALETTE = Object.freeze({
    O: '#60101a', // contorno / sombra profunda vinho
    s: '#881422', // sombra rubi-vinho
    '1': '#ac1c27', // meia-sombra
    '2': '#d02a2c', // corpo vermelho maçã vivo
    '3': '#ea4c3a', // luz escarlate quente
    h: '#f68062', // meio-brilho
    '4': '#fdc2a6', // brilho especular
    stemD: '#623c1a',
    stemL: '#865626',
    leafD: '#265e22',
    leafM: '#428e34',
    leafL: '#70be4e',
    // Polpa interna cremosa + borda fina de casca + sementes
    fleshHi: '#fff7de',
    fleshLight: '#f8e6b5',
    fleshMid: '#ebd093',
    fleshShade: '#d7b271',
    rindRed: '#b81d27',
    seedDark: '#4a2713',
    seedHi: '#6e3d20',
});

// Mapa contínuo 12×12 aprovado (Textura 3 · Sombra Profunda em Vinho)
export const APPLE_SKIN_T3 = Object.freeze({
    front: Object.freeze([
        '333322222211',
        '33hh32222211',
        '3h4h3222211s',
        '3h43222211ss',
        '23h322211sss',
        '22322211ssss',
        '1222211ssssO',
        '112211ssssOO',
        '11111ssssOOO',
        's11sssssOOOO',
        'sssssssOOOOO',
        'ssOOOOOOOOOO',
    ]),
    left: Object.freeze([
        '222223333333',
        '222222333333',
        '222222333333',
        '222222233333',
        '122222223322',
        '112222222222',
        's11222221111',
        'ss1122111111',
        'sss111111111',
        'sssss11111ss',
        'Osssssssssss',
        'OOssssssssss',
    ]),
    right: Object.freeze([
        '112222211111',
        '1122221111ss',
        's11122111sss',
        'ss11111sssss',
        'sss11sssssss',
        'sssssssssssO',
        'OsssssssssOO',
        'OOsssssssOOO',
        'OOOsssssOOOO',
        'OOOOOOOOOOOO',
        'OOOOOOOOOOOO',
        'OOOOOOOOOOOO',
    ]),
    back: Object.freeze([
        '222222111111',
        '2222221111ss',
        '222221111sss',
        '2222111sssss',
        '122111ssssss',
        '1111sssssssO',
        's11sssssssOO',
        'sssssssssOOO',
        'ssssssssOOOO',
        'sssssssOOOOO',
        'OOOOssOOOOOO',
        'OOOOOOOOOOOO',
    ]),
    top: Object.freeze([
        '222222211111',
        '222222211111',
        '222222221111',
        '223221122111',
        '2333sOOOs221',
        '3333OOOO1221',
        '333hOOOO2221',
        '33hhsOOs2221',
        '33hh32222211',
        '33hh32222211',
        '333332222211',
        '333322222211',
    ]),
});

// Normalização fixa calculada sobre a maçã inteira para que nenhum estágio desloque o centro
const NORM_SCALE = 1 / 8.842;
const NORM_CENTER = Object.freeze({ x: 0.35, y: 1.00, z: 0.0 });

export function sampleAppleSkin(wx, wy, wz, face, skin = APPLE_SKIN_T3) {
    const ix = Math.max(0, Math.min(11, Math.floor(((wx + 3.27) / 6.54) * 12)));
    const iy = Math.max(0, Math.min(11, Math.floor(((3.35 - wy) / 6.77) * 12)));
    const iz = Math.max(0, Math.min(11, Math.floor(((wz + 3.27) / 6.54) * 12)));

    if (face === '+Y' && wy < 2.85 && Math.abs(wx) < 1.0 && Math.abs(wz) < 1.0) {
        return APPLE_PALETTE[Math.hypot(wx, wz) < 0.58 ? 'O' : 's'];
    }
    if (face === '-Y') return APPLE_PALETTE.O;
    if (face === '+Y') return APPLE_PALETTE[skin.top[iz][ix]];

    if (wz >= Math.abs(wx)) return APPLE_PALETTE[skin.front[iy][ix]];
    if (wz <= -Math.abs(wx)) return APPLE_PALETTE[skin.back[iy][ix]];
    if (wx < 0) return APPLE_PALETTE[skin.left[iy][iz]];
    return APPLE_PALETTE[skin.right[iy][11 - iz]];
}

// Amostrador pixel-art da polpa mordida (creme iluminado, miolo sombreado, casquinha na borda e sementes)
export function sampleAppleFlesh(wx, wy, wz, face, opts = {}) {
    const radial = Math.hypot(wx, wz);

    // Casquinha fina vermelha exatamente onde o corte encontra a borda externa da maçã
    const outerLimit = wy > -0.6 ? 2.58 : 2.22;
    if (opts.rindBorder && radial > outerLimit) {
        return wy > 0.6 ? APPLE_PALETTE['2'] : APPLE_PALETTE.rindRed;
    }

    // Sementes escuras discretas quando a mordida chega perto do eixo central (estágios 2 e 3)
    if (opts.showSeeds && face !== '+Y' && face !== '-Y') {
        const s1 = Math.abs(wy - 0.55) < 0.34 && Math.abs(wx + 0.28) < 0.22 && Math.abs(wz - 0.28) < 1.05;
        const s2 = Math.abs(wy + 0.15) < 0.32 && Math.abs(wx - 0.32) < 1.05 && Math.abs(wz + 0.20) < 0.22;
        if (s1 || s2) {
            return wy > (s1 ? 0.62 : -0.08) ? APPLE_PALETTE.seedHi : APPLE_PALETTE.seedDark;
        }
    }

    // Granulação pixel-art suave determinística na polpa
    const gx = Math.floor((wx + 4) * 4);
    const gy = Math.floor((wy + 4) * 4);
    const gz = Math.floor((wz + 4) * 4);
    const grain = ((gx * 17 + gy * 31 + gz * 13) & 7);

    if (face === '+Y') {
        return grain < 2 ? APPLE_PALETTE.fleshHi : APPLE_PALETTE.fleshLight;
    }
    if (face === '-Y') {
        return APPLE_PALETTE.fleshShade;
    }
    // Mais clara perto da borda iluminada superior/esquerda, levemente amanteigada no fundo côncavo
    const lightScore = (wy * 0.28) + (-wx * 0.14) + (wz * 0.16) + (radial * 0.22) - (grain === 0 ? 0.22 : 0);
    if (lightScore > 0.82) return APPLE_PALETTE.fleshHi;
    if (lightScore > 0.28) return APPLE_PALETTE.fleshLight;
    if (lightScore > -0.22) return APPLE_PALETTE.fleshMid;
    return APPLE_PALETTE.fleshShade;
}

function paintCanvasMat(THREE, w, h, painter, roughness = 0.44) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    painter(ctx, w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    if ('colorSpace' in tex && THREE.SRGBColorSpace !== undefined) {
        tex.colorSpace = THREE.SRGBColorSpace;
    }
    return new THREE.MeshStandardMaterial({ map: tex, roughness, metalness: 0.03 });
}

// Cria caixa onde cada face pode ser 'skin' (casca externa contínua) ou 'flesh' (polpa mordida)
// facesFlesh: conjunto opcional de faces cortadas, ex: new Set(['+Z', '-X']) ou 'all'
function makeAppleBox(THREE, sx, sy, sz, cx, cy, cz, skin, facesFlesh = null, fleshOpts = {}) {
    const RES = 8;
    const rx = Math.max(4, Math.round(sx * RES));
    const ry = Math.max(4, Math.round(sy * RES));
    const rz = Math.max(4, Math.round(sz * RES));

    const specs = [
        { w: rz, h: ry, f: '+X', pt: (u, v) => [cx + sx / 2, cy + sy / 2 - (v + 0.5) * (sy / ry), cz + sz / 2 - (u + 0.5) * (sz / rz)] },
        { w: rz, h: ry, f: '-X', pt: (u, v) => [cx - sx / 2, cy + sy / 2 - (v + 0.5) * (sy / ry), cz - sz / 2 + (u + 0.5) * (sz / rz)] },
        { w: rx, h: rz, f: '+Y', pt: (u, v) => [cx - sx / 2 + (u + 0.5) * (sx / rx), cy + sy / 2, cz - sz / 2 + (v + 0.5) * (sz / rz)] },
        { w: rx, h: rz, f: '-Y', pt: (u, v) => [cx - sx / 2 + (u + 0.5) * (sx / rx), cy - sy / 2, cz + sz / 2 - (v + 0.5) * (sz / rz)] },
        { w: rx, h: ry, f: '+Z', pt: (u, v) => [cx - sx / 2 + (u + 0.5) * (sx / rx), cy + sy / 2 - (v + 0.5) * (sy / ry), cz + sz / 2] },
        { w: rx, h: ry, f: '-Z', pt: (u, v) => [cx + sx / 2 - (u + 0.5) * (sx / rx), cy + sy / 2 - (v + 0.5) * (sy / ry), cz - sz / 2] },
    ];

    const mats = specs.map(sp => {
        const isFlesh = facesFlesh === 'all' || (facesFlesh && facesFlesh.has(sp.f));
        return paintCanvasMat(THREE, sp.w, sp.h, (ctx, w, h) => {
            for (let v = 0; v < h; v++) {
                for (let u = 0; u < w; u++) {
                    const [wx, wy, wz] = sp.pt(u, v);
                    ctx.fillStyle = isFlesh
                        ? sampleAppleFlesh(wx, wy, wz, sp.f, fleshOpts)
                        : sampleAppleSkin(wx, wy, wz, sp.f, skin);
                    ctx.fillRect(u, v, 1, 1);
                }
            }
        }, isFlesh ? 0.58 : 0.44);
    });

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mats);
    mesh.position.set(cx, cy, cz);
    return mesh;
}

function makeStemAndLeaf(THREE, g) {
    const addStem = (sx, sy, sz, cx, cy, cz, rotZ) => {
        const mats = [0, 1, 2, 3, 4, 5].map(fi => paintCanvasMat(THREE, 4, 6, (ctx, w, h) => {
            for (let v = 0; v < h; v++) {
                for (let u = 0; u < w; u++) {
                    const lit = fi === 2 || (v < 3 && fi !== 3 && u < 3);
                    ctx.fillStyle = lit ? APPLE_PALETTE.stemL : APPLE_PALETTE.stemD;
                    ctx.fillRect(u, v, 1, 1);
                }
            }
        }, 0.84));
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mats);
        mesh.position.set(cx, cy, cz);
        mesh.rotation.z = rotZ;
        g.add(mesh);
    };

    addStem(0.78, 1.65, 0.78,  0,    3.45, 0, 0.04);
    addStem(0.72, 1.35, 0.72, -0.18, 4.72, 0, 0.22);

    const leafGroup = new THREE.Group();
    const petioleMat = new THREE.MeshStandardMaterial({ color: APPLE_PALETTE.leafD, roughness: 0.55 });
    const bladeMat = paintCanvasMat(THREE, 5, 4, ctx => {
        const rows = ['lllmm', 'llmmL', 'mmmmL', 'LLLLL'];
        const m = { l: APPLE_PALETTE.leafL, m: APPLE_PALETTE.leafM, L: APPLE_PALETTE.leafD };
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 5; x++) {
                ctx.fillStyle = m[rows[y][x]];
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }, 0.46);
    const tipMat = new THREE.MeshStandardMaterial({ color: APPLE_PALETTE.leafL, roughness: 0.45 });

    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.95), petioleMat);
    p1.position.set(0.55, 0.05, 0);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.44, 1.72), bladeMat);
    p2.position.set(2.0, 0.24, 0.04);
    const p3 = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.38, 1.02), tipMat);
    p3.position.set(3.55, 0.14, 0.06);
    p3.rotation.z = -0.16;
    leafGroup.add(p1, p2, p3);
    leafGroup.position.set(0.18, 4.12, 0);
    leafGroup.rotation.set(0.16, -0.18, 0.32);
    g.add(leafGroup);
}

function addTopCrownShoulders(THREE, g, skin) {
    g.add(makeAppleBox(THREE, 1.35, 0.65, 4.3,  -1.55, 3.025,  0,    skin));
    g.add(makeAppleBox(THREE, 1.35, 0.65, 4.3,   1.55, 3.025,  0,    skin));
    g.add(makeAppleBox(THREE, 1.75, 0.65, 1.35,  0,    3.025,  1.48, skin));
    g.add(makeAppleBox(THREE, 1.75, 0.65, 1.35,  0,    3.025, -1.48, skin));
}

function buildStageRaw(THREE, stage, skin) {
    const g = new THREE.Group();

    if (stage === 0) {
        // Estágio 0: Maçã inteira (Refino C2 · Textura 3 exata)
        g.add(makeAppleBox(THREE, 5.5,  3.3,  5.5,   0,     1.05,   0,    skin));
        g.add(makeAppleBox(THREE, 4.8,  2.2,  4.8,   0,    -1.70,   0,    skin));
        g.add(makeAppleBox(THREE, 4.3,  3.6,  0.52,  0,     0.75,   3.01, skin));
        g.add(makeAppleBox(THREE, 4.3,  3.6,  0.52,  0,     0.75,  -3.01, skin));
        g.add(makeAppleBox(THREE, 0.52, 3.6,  4.3,  -3.01,  0.75,   0,    skin));
        g.add(makeAppleBox(THREE, 0.52, 3.6,  4.3,   3.01,  0.75,   0,    skin));
        addTopCrownShoulders(THREE, g, skin);
        g.add(makeAppleBox(THREE, 3.5,  0.62, 3.5,   0,    -3.11,   0,    skin));
        makeStemAndLeaf(THREE, g);
        return g;
    }

    if (stage === 1) {
        // Estágio 1: 1ª mordida arqueada em degraus na bochecha frontal (+Z)
        // Parede traseira intacta (wz: -2.75 .. +1.05), expondo fundo cremoso em +Z
        g.add(makeAppleBox(THREE, 5.5,  3.3,  3.80,   0,     1.05,  -0.85, skin, new Set(['+Z']), { rindBorder: true }));
        // Colunas laterais intactas (esquerda preserva o brilho principal; direita fecha a borda)
        g.add(makeAppleBox(THREE, 1.55, 3.3,  1.70,  -1.975, 1.05,   1.90, skin, new Set(['+X']), { rindBorder: true }));
        g.add(makeAppleBox(THREE, 0.85, 3.3,  1.70,   2.325, 1.05,   1.90, skin, new Set(['-X']), { rindBorder: true }));
        // Teto e base da dentada + 4 cantos em degrau para silhueta arredondada de mordida (sem janela quadrada!)
        g.add(makeAppleBox(THREE, 3.10, 0.45, 1.70,   0.35,  2.475,  1.90, skin, new Set(['-Y']), { rindBorder: true }));
        g.add(makeAppleBox(THREE, 3.10, 0.55, 1.15,   0.35, -0.325,  1.625, skin, new Set(['+Y', '+Z']), { rindBorder: true }));
        // Degraus nos 4 cantos internos arredondando a abertura da mordida
        g.add(makeAppleBox(THREE, 0.55, 0.52, 1.55,  -0.925, 1.99,   1.825, skin, new Set(['+X', '-Y', '+Z']), { rindBorder: true }));
        g.add(makeAppleBox(THREE, 0.55, 0.52, 1.55,   1.625, 1.99,   1.825, skin, new Set(['-X', '-Y', '+Z']), { rindBorder: true }));
        g.add(makeAppleBox(THREE, 0.55, 0.52, 1.05,  -0.925, 0.21,   1.575, skin, new Set(['+X', '+Y', '+Z']), { rindBorder: true }));
        g.add(makeAppleBox(THREE, 0.55, 0.52, 1.05,   1.625, 0.21,   1.575, skin, new Set(['-X', '+Y', '+Z']), { rindBorder: true }));

        // Bochecha +Z contornando a mordida de forma orgânica (faixa esquerda + lábio inferior + cantinhos)
        g.add(makeAppleBox(THREE, 0.95, 3.6,  0.52,  -1.675, 0.75,   3.01, skin, new Set(['+X']), { rindBorder: true }));
        g.add(makeAppleBox(THREE, 3.35, 0.58, 0.52,   0.475, -0.76,  3.01, skin, new Set(['+Y']), { rindBorder: true }));

        // Demais bochechas, base inferior, coroa e cabinho intactos
        g.add(makeAppleBox(THREE, 4.8,  2.2,  4.8,    0,    -1.70,   0,    skin));
        g.add(makeAppleBox(THREE, 4.3,  3.6,  0.52,   0,     0.75,  -3.01, skin));
        g.add(makeAppleBox(THREE, 0.52, 3.6,  4.3,   -3.01,  0.75,   0,    skin));
        g.add(makeAppleBox(THREE, 0.52, 3.6,  4.3,    3.01,  0.75,   0,    skin));
        addTopCrownShoulders(THREE, g, skin);
        g.add(makeAppleBox(THREE, 3.5,  0.62, 3.5,    0,    -3.11,   0,    skin));
        makeStemAndLeaf(THREE, g);
        return g;
    }

    if (stage === 2) {
        // Estágio 2: 2ª mordida avança pela frente + bochecha esquerda (-X) sem nenhuma aba solta nem sobreposição!
        // Teto superior completo sob a coroa (wy: 2.25 .. 2.70)
        g.add(makeAppleBox(THREE, 5.20, 0.45, 5.00,   0.15,  2.475, -0.25, skin, new Set(['-Y', '+Z', '-X']), { rindBorder: true }));
        // Parede traseira intacta (wy: -0.60 .. 2.25, wz: -2.75 .. -0.35)
        g.add(makeAppleBox(THREE, 5.5,  2.85, 2.40,   0,     0.825, -1.55, skin, new Set(['+Z']), { rindBorder: true, showSeeds: true }));
        // Parede direita intacta (wy: -0.60 .. 2.25, wx: +0.65 .. +2.75, wz: -0.35 .. +2.15)
        g.add(makeAppleBox(THREE, 2.10, 2.85, 2.50,   1.70,  0.825,  0.90, skin, new Set(['-X', '+Z']), { rindBorder: true, showSeeds: true }));
        // Degrau interno central do miolo com semente escura visível + degraus curvos na transição
        g.add(makeAppleBox(THREE, 1.85, 2.85, 1.25,  -0.275, 0.825,  0.275, skin, 'all', { showSeeds: true }));
        g.add(makeAppleBox(THREE, 1.15, 0.55, 1.10,  -1.775, 1.975, -0.05,  skin, new Set(['-Y', '+Z', '-X']), { rindBorder: true }));

        // Base média com mordida curva em degrau na frente-esquerda
        g.add(makeAppleBox(THREE, 4.8,  1.45, 4.8,    0,    -2.075,  0,    skin, new Set(['+Y']), { rindBorder: true }));
        g.add(makeAppleBox(THREE, 4.8,  0.75, 2.35,   0,    -0.975, -1.225, skin, new Set(['+Z']), { rindBorder: true }));
        g.add(makeAppleBox(THREE, 2.10, 0.75, 2.45,   1.35, -0.975,  1.175, skin, new Set(['-X']), { rindBorder: true }));

        // Bochecha esquerda (-X) foi comida na 2ª dentada; bochechas -Z e +X permanecem intactas
        g.add(makeAppleBox(THREE, 4.3,  3.6,  0.52,   0,     0.75,  -3.01,  skin));
        g.add(makeAppleBox(THREE, 0.52, 3.6,  4.3,    3.01,  0.75,   0,     skin));
        addTopCrownShoulders(THREE, g, skin);
        g.add(makeAppleBox(THREE, 3.5,  0.62, 3.5,    0,    -3.11,   0,     skin));
        makeStemAndLeaf(THREE, g);
        return g;
    }

    // Estágio 3: Clássico Miolo de Maçã voxelizado (antes da 4ª mordida final consumir tudo!)
    // Teto da coroa com casca em cima e polpa por baixo
    g.add(makeAppleBox(THREE, 4.65, 0.42, 4.65,  0,     2.56, 0, skin, new Set(['-Y']), { rindBorder: true }));
    addTopCrownShoulders(THREE, g, skin);
    makeStemAndLeaf(THREE, g);

    // Pescoço superior + eixo central fino do miolo com sementes + pescoço inferior (tudo em polpa cremosa)
    g.add(makeAppleBox(THREE, 2.75, 0.62, 2.75,  0,     2.04, 0, skin, 'all', {}));
    g.add(makeAppleBox(THREE, 1.82, 2.78, 1.82,  0,     0.34, 0, skin, 'all', { showSeeds: true }));
    g.add(makeAppleBox(THREE, 2.65, 0.60, 2.65,  0,    -1.35, 0, skin, 'all', {}));

    // Base inferior vermelha segurada pelos dedos, com topo em polpa mordida + casquinha na borda
    g.add(makeAppleBox(THREE, 4.35, 1.15, 4.35,  0,    -2.225, 0, skin, new Set(['+Y']), { rindBorder: true }));
    g.add(makeAppleBox(THREE, 3.5,  0.62, 3.5,   0,    -3.11,  0, skin));
    return g;
}

export const DROP_APPLE_SCALE = 0.32;

const templateCache = new WeakMap();

function getStageTemplates(THREE, skin = APPLE_SKIN_T3) {
    let bySkin = templateCache.get(THREE);
    if (!bySkin) {
        bySkin = new Map();
        templateCache.set(THREE, bySkin);
    }
    let stages = bySkin.get(skin);
    if (!stages) {
        stages = [0, 1, 2, 3].map(s => wrapNormalized(THREE, buildStageRaw(THREE, s, skin)));
        bySkin.set(skin, stages);
    }
    return stages;
}

function wrapNormalized(THREE, rawGroup) {
    const wrapper = new THREE.Group();
    rawGroup.scale.setScalar(NORM_SCALE);
    rawGroup.position.set(
        -NORM_CENTER.x * NORM_SCALE,
        -NORM_CENTER.y * NORM_SCALE,
        -NORM_CENTER.z * NORM_SCALE
    );
    wrapper.add(rawGroup);
    wrapper.userData.isAppleModel = true;
    return wrapper;
}

export function createAppleModel(THREE, skin = APPLE_SKIN_T3, biteStage = 0) {
    const clamped = Math.max(0, Math.min(3, biteStage | 0));
    const clone = getStageTemplates(THREE, skin)[clamped].clone();
    clone.userData = { isAppleModel: true };
    return clone;
}

export function setAppleBiteStage(appleRoot, stage) {
    if (!appleRoot || !appleRoot.userData?.isProgressiveApple) return;
    if (stage >= 4) {
        for (let i = 0; i < appleRoot.children.length; i++) appleRoot.children[i].visible = false;
        return;
    }
    const idx = Math.max(0, Math.min(3, stage | 0));
    for (let i = 0; i < appleRoot.children.length; i++) appleRoot.children[i].visible = i === idx;
}

// Cria um único objeto 3D com os 4 estágios (0..3) pré-montados e seguros para .clone()
export function createProgressiveAppleModel(THREE, skin = APPLE_SKIN_T3) {
    const root = new THREE.Group();
    const templates = getStageTemplates(THREE, skin);
    const stages = [0, 1, 2, 3].map(s => {
        const m = templates[s].clone();
        m.visible = s === 0;
        root.add(m);
        return m;
    });
    root.userData = {
        isAppleModel: true,
        isProgressiveApple: true,
    };
    root.setBiteStage = stage => setAppleBiteStage(root, stage);
    return root;
}
