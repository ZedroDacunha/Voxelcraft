// Modelo 3D voxelizado da Carne de Ovelha (Crua e Assada — Opção B / Exemplo 3 refinado):
// costela rústica em gota de 11 fatias chanfradas em 3 camadas + costela curvada octogonal,
// orientada com o osso para baixo (empunhadura na mão) e a carne apontada para cima (+Y),
// com 4 estágios progressivos de mordida de cima para baixo (0..3) até sobrar o osso roído.

export const MUTTON_RAW_3D_PALETTE = Object.freeze({
    O: '#5c1920',
    s: '#88242c',
    '1': '#ae3438',
    '2': '#d04c4a',
    '3': '#e86e66',
    '4': '#f8a89c',
    f: '#e6b8a8',
    F: '#f8e2d4',
    Fhi: '#fef4eb',
    o: '#846e5c',
    b: '#cebfa8',
    B: '#f6f1e4',
    Bhi: '#fefbf4',
    marrow: '#9c4440',
    biteHi: '#f89e94',
    biteMid: '#e05a56',
    biteDark: '#b6383c',
    biteRim: '#7e1e24',
});

export const MUTTON_COOKED_3D_PALETTE = Object.freeze({
    O: '#3d1b0d',
    s: '#5e2d15',
    M: '#421d0c',
    Mhalo: '#763c1c',
    '1': '#824320',
    '2': '#a85e2e',
    '3': '#ce7e3e',
    '4': '#eca860',
    f: '#cc9254',
    F: '#eabe7a',
    Fhi: '#f7daa4',
    o: '#6b492b',
    b: '#b59062',
    B: '#e0c496',
    Bhi: '#f2e0be',
    baste: '#9e5e2e',
    marrow: '#4f2414',
    biteHi: '#e4a68a',
    biteMid: '#c67c62',
    biteDark: '#a25c44',
    biteRim: '#663016',
});

export const DROP_MUTTON_SCALE = 0.36;

const RES = 8;
const TEX = 0.36;
const NORM_SCALE = 1 / 6.29;
const BITE_TARGET_Y = [0.90, 0.70, 0.50, 0.28];

const snap = v => Math.floor(v / TEX) * TEX + TEX * 0.5;

function paintFaceMat(THREE, w, h, painter, roughness = 0.46) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    painter(ctx, w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, roughness, metalness: 0.03 });
}

function sampleBittenFlesh(wxRaw, wyRaw, wzRaw, pal) {
    const tx = Math.round(wxRaw / 0.28);
    const ty = Math.round(wyRaw / 0.28);
    const tz = Math.round(wzRaw / 0.28);
    if (Math.abs(wzRaw) > 0.72) return pal.biteRim;
    const g = ((tx * 17 + ty * 31 + tz * 13) & 7);
    if (Math.abs(wzRaw) < 0.30 && g < 3) return pal.biteHi;
    return g < 5 ? pal.biteMid : pal.biteDark;
}

function sampleMeat(wxRaw, wyRaw, wzRaw, face, cooked, biteFaces) {
    const pal = cooked ? MUTTON_COOKED_3D_PALETTE : MUTTON_RAW_3D_PALETTE;
    if (biteFaces && biteFaces.has(face)) {
        return sampleBittenFlesh(wxRaw, wyRaw, wzRaw, pal);
    }
    const wx = snap(wxRaw), wy = snap(wyRaw), wz = snap(wzRaw);
    const diag = wy - 0.78 * wx;
    const tx = cooked ? Math.round((wxRaw - TEX * 0.5) / TEX) : Math.round(wx / TEX);
    const ty = cooked ? Math.round((wyRaw - TEX * 0.5) / TEX) : Math.round(wy / TEX);
    const tz = cooked ? Math.round((wzRaw - TEX * 0.5) / TEX) : Math.round(wz / TEX);
    const checker = ((tx * 7 + ty * 13 + tz * 5) & 3);
    const rTopLoin = Math.hypot((wx + 0.35) / 1.65, (wy + 1.10) / 1.55);

    const fatLine = wy > 0.7 ? 1.42 : 1.56;
    const inFatCap = wy > -1.35 && diag > fatLine;
    const inEdge = wy > -1.45 && !inFatCap && diag > (fatLine - 0.34);

    if (inFatCap) {
        if (face === '+Y' || face === '-X') {
            if (diag > fatLine + 0.32 && Math.abs(wz) < 0.52) return pal.Fhi;
            if (Math.abs(wz) > 0.66) return (cooked && checker === 0) ? pal['3'] : pal.f;
            return pal.F;
        }
        if (face === '-Y' || face === '+X') return pal.F;
        return diag > fatLine + 0.28 ? pal.Fhi : ((cooked && checker === 1) ? pal.f : pal.F);
    }
    if (inEdge) {
        if (face === '+Y' || face === '-X' || face === '+Z' || face === '-Z') {
            return (cooked && checker === 0) ? pal['3'] : pal.f;
        }
    }
    if (wy > 1.76 && wx > 0.45) {
        return face === '+Y' ? (cooked ? pal.f : pal.F) : (cooked ? pal.baste : pal.f);
    }

    if (face === '-Y') return Math.abs(wz) > 0.55 ? pal['2'] : pal['3'];
    if (face === '+X') {
        if (wy < -0.60) return checker === 0 ? pal['3'] : pal['2'];
        if (wy < 0.85) return checker === 0 ? pal['2'] : pal['1'];
        return pal.s;
    }
    if (face === '-X' || face === '+Y') {
        return wy > 0.9 ? pal.O : pal.s;
    }

    const isBack = face === '-Z';
    if (wy > 1.52 && wx < 0.45) return pal.O;
    if (wy > 1.08 && diag < 1.15) return checker === 0 ? pal['1'] : pal.s;

    if (cooked) {
        const barA = (tx + ty === -6) && tx >= -4 && tx <= -1;
        const barB = (tx + ty ===  0) && tx >= -1 && tx <=  2;
        if (barA || barB) return pal.M;
        const haloA = (tx + ty === -5) && tx >= -3 && tx <= -1;
        const haloB = (tx + ty ===  1) && tx >=  0 && tx <=  2;
        if (haloA || haloB) return pal.Mhalo;
        if (!isBack && ((tx === -1 && ty === -4) || (tx === 0 && ty === -4) || (tx === -2 && ty === -3))) return pal['4'];
    } else {
        if (!isBack && ((tx === -1 && ty === -4) || (tx === 0 && ty === -4) || (tx === -2 && ty === -3))) return pal['4'];
        const mFront = !isBack && ((tx === -1 && ty === -2) || (tx === 0 && ty === -1) || (tx === 1 && ty === 0) || (tx === -3 && ty === -2) || (tx === -2 && ty === -1));
        const mBack = isBack && ((tx === -1 && ty === -2) || (tx === 0 && ty === -1) || (tx === 1 && ty === 0));
        if (mFront || mBack) return pal.f;
    }

    if (rTopLoin < 0.82) return isBack ? pal['2'] : pal['3'];
    if (rTopLoin < 1.38 && wy < 0.85) return pal['2'];
    return wy > 0.65 ? pal.s : pal['1'];
}

function sampleBone(lxRaw, lyFromBase, lzRaw, face, segRole, cooked) {
    const pal = cooked ? MUTTON_COOKED_3D_PALETTE : MUTTON_RAW_3D_PALETTE;
    const lx = Math.floor(lxRaw / 0.22) * 0.22 + 0.11;
    const lz = Math.floor(lzRaw / 0.22) * 0.22 + 0.11;
    if (segRole === 'tip' && face === '+Y') {
        if (Math.abs(lxRaw) < 0.17 && Math.abs(lzRaw) < 0.17) return pal.marrow;
        if (Math.abs(lxRaw) < 0.27 && Math.abs(lzRaw) < 0.27) return pal.b;
        return pal.Bhi;
    }
    if (segRole === 'innerTip' && face === '-Y') {
        return Math.abs(lzRaw) < 0.22 ? pal.Bhi : pal.B;
    }
    if (face === '-Y') return pal.b;
    if (segRole === 'base' && lyFromBase < 0.32) {
        return lxRaw < 0 ? (cooked ? pal.f : pal.F) : (cooked ? pal.baste : pal.f);
    }
    const tipToast = cooked && segRole === 'tip' && lyFromBase > 0.32;
    if (face === '+X') return lz > -0.12 ? pal.Bhi : pal.B;
    if (face === '-X') return lz < -0.05 ? pal.o : pal.b;
    if (lx > 0.08) return tipToast ? pal.B : pal.Bhi;
    if (lx > -0.14) return tipToast ? pal.b : pal.B;
    return (segRole === 'base' && lyFromBase < 0.50) ? pal.o : pal.b;
}

function buildStageGroup(THREE, stage, cooked, anchor = 'bone') {
    const meatRough = cooked ? 0.42 : 0.50;
    const boneRough = cooked ? 0.42 : 0.38;

    function makeMeatBox(sx, sy, sz, cx, cy, cz, biteFacesArr = null) {
        const biteFaces = biteFacesArr ? new Set(biteFacesArr) : null;
        const rx = Math.max(3, Math.round(sx * RES));
        const ry = Math.max(3, Math.round(sy * RES));
        const rz = Math.max(3, Math.round(sz * RES));
        const specs = [
            { w: rz, h: ry, f: '+X', pt: (u, v) => [cx + sx / 2, cy + sy / 2 - (v + 0.5) * (sy / ry), cz + sz / 2 - (u + 0.5) * (sz / rz)] },
            { w: rz, h: ry, f: '-X', pt: (u, v) => [cx - sx / 2, cy + sy / 2 - (v + 0.5) * (sy / ry), cz - sz / 2 + (u + 0.5) * (sz / rz)] },
            { w: rx, h: rz, f: '+Y', pt: (u, v) => [cx - sx / 2 + (u + 0.5) * (sx / rx), cy + sy / 2, cz - sz / 2 + (v + 0.5) * (sz / rz)] },
            { w: rx, h: rz, f: '-Y', pt: (u, v) => [cx - sx / 2 + (u + 0.5) * (sx / rx), cy - sy / 2, cz + sz / 2 - (v + 0.5) * (sz / rz)] },
            { w: rx, h: ry, f: '+Z', pt: (u, v) => [cx - sx / 2 + (u + 0.5) * (sx / rx), cy + sy / 2 - (v + 0.5) * (sy / ry), cz + sz / 2] },
            { w: rx, h: ry, f: '-Z', pt: (u, v) => [cx + sx / 2 - (u + 0.5) * (sx / rx), cy + sy / 2 - (v + 0.5) * (sy / ry), cz - sz / 2] },
        ];
        const mats = specs.map(sp =>
            paintFaceMat(THREE, sp.w, sp.h, (ctx, w, h) => {
                for (let v = 0; v < h; v++) {
                    for (let u = 0; u < w; u++) {
                        const [wx, wy, wz] = sp.pt(u, v);
                        ctx.fillStyle = sampleMeat(wx, wy, wz, sp.f, cooked, biteFaces);
                        ctx.fillRect(u, v, 1, 1);
                    }
                }
            }, (biteFaces && biteFaces.has(sp.f)) ? 0.55 : meatRough)
        );
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mats);
        mesh.position.set(cx, cy, cz);
        return mesh;
    }

    function makeBoneBox(sx, sy, sz, cx, cy, cz, rotZ, role) {
        const rx = Math.max(3, Math.round(sx * RES));
        const ry = Math.max(3, Math.round(sy * RES));
        const rz = Math.max(3, Math.round(sz * RES));
        const specs = [
            { w: rz, h: ry, f: '+X', pt: (u, v) => [sx / 2, sy / 2 - (v + 0.5) * (sy / ry), sz / 2 - (u + 0.5) * (sz / rz)] },
            { w: rz, h: ry, f: '-X', pt: (u, v) => [-sx / 2, sy / 2 - (v + 0.5) * (sy / ry), -sz / 2 + (u + 0.5) * (sz / rz)] },
            { w: rx, h: rz, f: '+Y', pt: (u, v) => [-sx / 2 + (u + 0.5) * (sx / rx), sy / 2, -sz / 2 + (v + 0.5) * (sz / rz)] },
            { w: rx, h: rz, f: '-Y', pt: (u, v) => [-sx / 2 + (u + 0.5) * (sx / rx), -sy / 2, sz / 2 - (v + 0.5) * (sz / rz)] },
            { w: rx, h: ry, f: '+Z', pt: (u, v) => [-sx / 2 + (u + 0.5) * (sx / rx), sy / 2 - (v + 0.5) * (sy / ry), sz / 2] },
            { w: rx, h: ry, f: '-Z', pt: (u, v) => [sx / 2 - (u + 0.5) * (sx / rx), sy / 2 - (v + 0.5) * (sy / ry), -sz / 2] },
        ];
        const mats = specs.map(sp =>
            paintFaceMat(THREE, sp.w, sp.h, (ctx, w, h) => {
                for (let v = 0; v < h; v++) {
                    for (let u = 0; u < w; u++) {
                        const [lx, ly, lz] = sp.pt(u, v);
                        ctx.fillStyle = sampleBone(lx, ly + sy / 2, lz, sp.f, role, cooked);
                        ctx.fillRect(u, v, 1, 1);
                    }
                }
            }, boneRough)
        );
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mats);
        mesh.position.set(cx, cy, cz);
        mesh.rotation.z = rotZ;
        return mesh;
    }

    const g = new THREE.Group();
    const outerSlices = [
        [2.16, 0.42, 1.14, -0.30, -2.52],
        [3.24, 0.46, 1.28, -0.28, -2.14],
        [3.96, 0.50, 1.38, -0.24, -1.72],
        [4.38, 0.54, 1.44, -0.20, -1.26],
        [4.50, 0.56, 1.46, -0.16, -0.76],
        [4.36, 0.54, 1.44, -0.08, -0.26],
        [3.98, 0.52, 1.40,  0.06,  0.22],
        [3.44, 0.50, 1.36,  0.24,  0.68],
        [2.80, 0.48, 1.30,  0.46,  1.12],
        [2.14, 0.46, 1.22,  0.70,  1.52],
        [1.56, 0.46, 1.12,  0.94,  1.90],
    ];
    const midSlices = [
        [2.64, 0.46, 1.72, -0.26, -2.02],
        [3.46, 0.54, 1.82, -0.22, -1.56],
        [3.82, 0.62, 1.86, -0.18, -1.04],
        [3.74, 0.60, 1.86, -0.10, -0.48],
        [3.36, 0.54, 1.82,  0.04,  0.04],
        [2.82, 0.50, 1.76,  0.24,  0.52],
        [2.18, 0.46, 1.66,  0.48,  0.98],
        [1.56, 0.42, 1.48,  0.74,  1.40],
    ];
    const coreSlices = [
        [2.44, 0.50, 2.10, -0.22, -1.48],
        [2.96, 0.64, 2.18, -0.18, -0.96],
        [2.82, 0.58, 2.18, -0.12, -0.42],
        [2.26, 0.48, 2.10,  0.02,  0.08],
        [1.60, 0.40, 1.98,  0.22,  0.48],
    ];

    if (stage === 0) {
        for (const s of outerSlices) g.add(makeMeatBox(...s, 0));
        for (const s of midSlices) g.add(makeMeatBox(...s, 0));
        for (const s of coreSlices) g.add(makeMeatBox(...s, 0));
    } else if (stage === 1) {
        g.add(makeMeatBox(1.18, 0.54, 1.38, -1.80, -1.26, 0, ['-Y', '+X']));
        g.add(makeMeatBox(1.12, 0.54, 1.38,  1.42, -1.26, 0, ['-Y', '-X']));
        g.add(makeMeatBox(...outerSlices[4], 0, ['-Y']));
        for (let i = 5; i <= 10; i++) g.add(makeMeatBox(...outerSlices[i], 0));

        g.add(makeMeatBox(1.05, 0.56, 1.74, -1.55, -0.96, 0, ['-Y', '+X']));
        g.add(makeMeatBox(0.95, 0.56, 1.74,  1.22, -0.96, 0, ['-Y', '-X']));
        g.add(makeMeatBox(...midSlices[3], 0, ['-Y']));
        for (let i = 4; i <= 7; i++) g.add(makeMeatBox(...midSlices[i], 0));

        g.add(makeMeatBox(...coreSlices[2], 0, ['-Y']));
        for (let i = 3; i <= 4; i++) g.add(makeMeatBox(...coreSlices[i], 0));
    } else if (stage === 2) {
        g.add(makeMeatBox(0.96, 0.54, 1.32, -1.46,  0.05, 0, ['-Y', '+X']));
        g.add(makeMeatBox(0.92, 0.54, 1.32,  1.52,  0.05, 0, ['-Y', '-X']));
        g.add(makeMeatBox(1.08, 0.50, 1.34, -1.06,  0.48, 0, ['-Y', '+X']));
        g.add(makeMeatBox(1.04, 0.50, 1.34,  1.38,  0.48, 0, ['-Y', '-X']));
        g.add(makeMeatBox(...outerSlices[7], 0, ['-Y']));
        for (let i = 8; i <= 10; i++) g.add(makeMeatBox(...outerSlices[i], 0));

        g.add(makeMeatBox(0.88, 0.48, 1.68, -0.82,  0.48, 0, ['-Y', '+X']));
        g.add(makeMeatBox(0.84, 0.48, 1.68,  1.16,  0.48, 0, ['-Y', '-X']));
        g.add(makeMeatBox(...midSlices[6], 0, ['-Y']));
        g.add(makeMeatBox(...midSlices[7], 0));

        g.add(makeBoneBox(0.62, 0.72, 0.62,  0.42,  0.98, 0, -0.38, 'innerTip'));
        g.add(makeBoneBox(0.44, 0.68, 0.76,  0.42,  0.98, 0, -0.38, 'innerTip'));
    } else {
        g.add(makeMeatBox(0.82, 0.44, 1.18,  0.22,  1.56, 0, ['-Y', '+X']));
        g.add(makeMeatBox(0.76, 0.44, 1.18,  1.34,  1.56, 0, ['-Y', '-X']));
        g.add(makeMeatBox(...outerSlices[10], 0, ['-Y']));
        g.add(makeMeatBox(1.24, 0.38, 1.38,  0.88,  1.76, 0, ['-Y']));

        g.add(makeBoneBox(0.68, 1.02, 0.64,  0.76,  1.52, 0, -0.42, 'shaft'));
        g.add(makeBoneBox(0.48, 0.98, 0.78,  0.76,  1.52, 0, -0.42, 'shaft'));
        g.add(makeBoneBox(0.58, 0.78, 0.58,  0.42,  0.88, 0, -0.34, 'innerTip'));
        g.add(makeBoneBox(0.42, 0.74, 0.72,  0.42,  0.88, 0, -0.34, 'innerTip'));
    }

    g.add(makeBoneBox(0.76, 1.05, 0.72,  1.18,  2.14, 0, -0.50, 'base'));
    g.add(makeBoneBox(0.54, 1.00, 0.88,  1.18,  2.14, 0, -0.50, 'base'));
    g.add(makeBoneBox(0.66, 1.08, 0.66,  1.66,  2.72, 0, -0.62, 'shaft'));
    g.add(makeBoneBox(0.46, 1.04, 0.82,  1.66,  2.72, 0, -0.62, 'shaft'));
    g.add(makeBoneBox(0.76, 0.56, 0.74,  2.10,  3.18, 0, -0.70, 'tip'));
    g.add(makeBoneBox(0.54, 0.54, 0.88,  2.10,  3.18, 0, -0.70, 'tip'));

    g.scale.setScalar(NORM_SCALE);
    if (anchor === 'bone') {
        g.position.set(-2.02 * NORM_SCALE, -3.08 * NORM_SCALE, 0);
    } else {
        g.position.set(-0.07 * NORM_SCALE, -0.41 * NORM_SCALE, 0);
    }

    const upright = new THREE.Group();
    upright.name = `muttonStage${stage}`;
    upright.add(g);
    upright.rotation.z = -2.55;
    return upright;
}

const templateCache = new WeakMap();

function getStageTemplates(THREE, cooked = false, anchor = 'bone') {
    let byKey = templateCache.get(THREE);
    if (!byKey) {
        byKey = new Map();
        templateCache.set(THREE, byKey);
    }
    const key = `${cooked ? 'cooked' : 'raw'}:${anchor}`;
    let stages = byKey.get(key);
    if (!stages) {
        stages = [0, 1, 2, 3].map(s => buildStageGroup(THREE, s, Boolean(cooked), anchor));
        byKey.set(key, stages);
    }
    return stages;
}

// Modelo centralizado para item dropado no mundo
export function createMuttonModel(THREE, cooked = false, biteStage = 0) {
    const clamped = Math.max(0, Math.min(3, biteStage | 0));
    const root = new THREE.Group();
    root.add(getStageTemplates(THREE, cooked, 'center')[clamped].clone());
    root.userData = {
        isMuttonModel: true,
        isCookedMutton: Boolean(cooked),
    };
    return root;
}

export function setMuttonBiteStage(muttonRoot, stage) {
    if (!muttonRoot || !muttonRoot.userData?.isProgressiveMutton) return;
    const face = muttonRoot.getObjectByName('muttonFace');
    if (!face) return;
    const target = face.getObjectByName('biteTarget');
    if (stage >= 4) {
        for (let i = 0; i < 4; i++) {
            if (face.children[i]) face.children[i].visible = false;
        }
        if (target) target.position.y = BITE_TARGET_Y[3];
        return;
    }
    const idx = Math.max(0, Math.min(3, stage | 0));
    for (let i = 0; i < 4; i++) {
        if (face.children[i]) face.children[i].visible = i === idx;
    }
    if (target) target.position.y = BITE_TARGET_Y[idx];
}

// Modelo segurado pelo osso com os 4 estágios (0..3) pré-montados e seguros para .clone()
export function createProgressiveMuttonModel(THREE, cooked = false) {
    const root = new THREE.Group();
    const face = new THREE.Group();
    face.name = 'muttonFace';
    const templates = getStageTemplates(THREE, cooked, 'bone');
    for (let s = 0; s < 4; s++) {
        const m = templates[s].clone();
        m.visible = s === 0;
        face.add(m);
    }
    const biteTarget = new THREE.Object3D();
    biteTarget.name = 'biteTarget';
    biteTarget.position.set(0, BITE_TARGET_Y[0], 0);
    face.add(biteTarget);

    root.add(face);
    root.userData = {
        isMuttonModel: true,
        isProgressiveMutton: true,
        isCookedMutton: Boolean(cooked),
    };
    return root;
}
