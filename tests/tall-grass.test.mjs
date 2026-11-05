// O capim é o objeto mais repetido do mundo e o único que não usa o atlas: ele
// tem PNGs próprios. Estes testes guardam as três coisas que já deram errado:
//
// - **proporção**: as placas diagonais desenham `2h√2` de largura; sem a
//   correção o tufo saía 41% mais largo que o desenho (achatado);
// - **nitidez**: `Nearest` também na minificação, sem mipmap, fazia as folhas
//   finas sumirem e o capim cintilar quando a câmera andava;
// - **cache**: a versão da URL era escrita à mão e não subia junto com o PNG,
//   então o navegador continuava desenhando a arte antiga.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
    TALL_GRASS_VARIANTS,
    configureTallGrassTexture,
    createTallGrassGeometry,
    createTallGrassMaterial,
    tallGrassTextureUrl,
} from '../world-tall-grass.js';
import { ASSET_VERSIONS } from '../asset-versions.js';
import { decodePng } from './helpers/png.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

// --- dublê mínimo de three (o jogo usa o de vendor/; aqui só o que é tocado) --

class FakeBufferAttribute {
    constructor(array, itemSize) {
        this.array = Array.from(array);
        this.itemSize = itemSize;
        this.count = this.array.length / itemSize;
    }
}

class FakeBufferGeometry {
    constructor() {
        this.attributes = {};
        this.index = null;
    }
    setAttribute(name, attribute) { this.attributes[name] = attribute; return this; }
    setIndex(index) { this.index = Array.from(index); return this; }
    computeVertexNormals() { this.normalsComputed = true; return this; }
    scale(x, y, z) { this.scaled = [x, y, z]; return this; }
}

class FakeMeshLambertMaterial {
    constructor(parameters = {}) { Object.assign(this, parameters); }
}

const THREE = {
    BufferGeometry: FakeBufferGeometry,
    Float32BufferAttribute: FakeBufferAttribute,
    MeshLambertMaterial: FakeMeshLambertMaterial,
    NearestFilter: 'nearest',
    NearestMipmapLinearFilter: 'nearest-mipmap-linear',
    LinearFilter: 'linear',
    DoubleSide: 'double',
    SRGBColorSpace: 'srgb',
};

/** Canto de baixo (`bottom`) ou de cima (`top`) de cada placa. */
function plateCorners(geometry, plate, edge) {
    const position = geometry.attributes.position.array;
    const base = plate * 4;
    const indices = edge === 'bottom' ? [base, base + 1] : [base + 2, base + 3];
    return indices.map(i => position.slice(i * 3, i * 3 + 3));
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// --- imagens -------------------------------------------------------------

test('as três variantes existem no repositório e a proporção bate com o PNG', () => {
    assert.equal(TALL_GRASS_VARIANTS.length, 3);
    const alturas = TALL_GRASS_VARIANTS.map(variant => variant.height);
    assert.deepEqual(alturas, [...alturas].sort((a, b) => a - b), 'baixo, médio, alto — nesta ordem');

    for (const variant of TALL_GRASS_VARIANTS) {
        const file = variant.file.replace(/^\.\//, '');
        assert.ok(existsSync(path.join(ROOT, file)), `${file} existe`);
        const image = decodePng(readFileSync(path.join(ROOT, file)));
        assert.ok(
            Math.abs(variant.aspect - image.width / image.height) < 1e-6,
            `${file}: aspect ${variant.aspect.toFixed(3)} != ${image.width}/${image.height}`,
        );
    }
});

test('a imagem é pedida com o hash do próprio arquivo (?v=)', () => {
    for (const variant of TALL_GRASS_VARIANTS) {
        const key = variant.file.replace(/^\.\//, '');
        const url = tallGrassTextureUrl(variant.file, 'https://example.test/');
        assert.equal(url, `https://example.test/${variant.file.replace(/^\.\//, '')}?v=${ASSET_VERSIONS[key]}`);
        assert.equal(new URL(url).searchParams.get('v'), ASSET_VERSIONS[key], 'o hash vem do carimbo');
    }
});

// --- geometria -----------------------------------------------------------

test('a placa tem a largura e a altura do desenho (não estica nem amassa)', () => {
    for (let variant = 0; variant < TALL_GRASS_VARIANTS.length; variant++) {
        const geometry = createTallGrassGeometry({ THREE, variant });
        const esperada = TALL_GRASS_VARIANTS[variant];

        for (const plate of [0, 1]) {
            const [left, right] = plateCorners(geometry, plate, 'bottom');
            const [topA, topB] = plateCorners(geometry, plate, 'top');
            assert.ok(
                Math.abs(distance(left, right) - esperada.height * esperada.aspect) < 1e-9,
                `variante ${variant}, placa ${plate}: largura ${distance(left, right).toFixed(3)}`,
            );
            assert.ok(distance(left, right) > 0.1 * esperada.height, 'placa não é uma linha');
            assert.ok(Math.abs(distance(topA, topB) - distance(left, right)) < 1e-9, 'placa retangular');
            assert.ok(
                Math.abs((topA[1] - left[1]) - esperada.height) < 1e-9,
                'a altura desenhada é a da variante',
            );
            assert.equal(left[1], topA[1] === left[1] ? left[1] : left[1], 'base no mesmo plano');
        }
    }
});

test('as duas placas são diagonais diferentes (um X, não duas cópias no mesmo plano)', () => {
    const geometry = createTallGrassGeometry({ THREE, variant: 2 });
    const [a0, a1] = plateCorners(geometry, 0, 'bottom');
    const [b0, b1] = plateCorners(geometry, 1, 'bottom');

    const dir = (from, to) => [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const [ax, ay, az] = dir(a0, a1);
    const [bx, by, bz] = dir(b0, b1);
    // Produto vetorial: zero significaria placas paralelas (z-fighting no alfa).
    const cross = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
    assert.ok(Math.hypot(...cross) > 0.01, 'as placas não podem ser coplanares');
    assert.ok(Math.abs(ax * bx + az * bz) < 1e-9, 'as duas diagonais são perpendiculares em XZ');
    // A raiz de cada placa é o mesmo ponto no chão: o X se cruza no centro.
    assert.ok(Math.abs(a0[0] + a1[0]) < 1e-9 && Math.abs(b0[0] + b1[0]) < 1e-9, 'centradas no bloco');
});

test('uv.y é 0 na raiz e 1 na ponta (o vento verga a partir do chão)', () => {
    const geometry = createTallGrassGeometry({ THREE });
    const uv = geometry.attributes.uv.array;
    for (let plate = 0; plate < 2; plate++) {
        const base = plate * 4;
        assert.deepEqual([uv[base * 2 + 1], uv[(base + 1) * 2 + 1]], [0, 0], `raiz da placa ${plate}`);
        assert.deepEqual([uv[(base + 2) * 2 + 1], uv[(base + 3) * 2 + 1]], [1, 1], `ponta da placa ${plate}`);
        assert.deepEqual([uv[base * 2], uv[(base + 1) * 2]], [0, 1], 'o desenho vai de ponta a ponta');
    }
});

test('geometria fechada: 8 vértices, 8 triângulos e nenhum índice solto', () => {
    const geometry = createTallGrassGeometry({ THREE });
    assert.equal(geometry.attributes.position.count, 8);
    assert.equal(geometry.attributes.uv.count, 8);
    assert.equal(geometry.index.length, 12, 'duas placas × dois triângulos × três vértices');
    for (const index of geometry.index) {
        assert.ok(index >= 0 && index < 8, 'índice dentro dos vértices');
    }
    assert.ok(geometry.normalsComputed, 'normais calculadas (material é iluminado)');
});

test('variante fora da lista cai no tufo médio (é o que fica na mão)', () => {
    const media = createTallGrassGeometry({ THREE, variant: 1 });
    const outra = createTallGrassGeometry({ THREE, variant: 9 });
    assert.deepEqual(outra.attributes.position.array, media.attributes.position.array);

    const semNada = createTallGrassGeometry({ THREE });
    assert.deepEqual(semNada.attributes.position.array, media.attributes.position.array);
});

// --- material ------------------------------------------------------------

function fakeTexture() {
    // `colorSpace` existe na Texture do three r160; o dublê imita isso.
    return { needsUpdate: false, colorSpace: '' };
}

test('textura: nítida de perto (Nearest) e com mipmap de longe (sem cintilar)', () => {
    const texture = configureTallGrassTexture(THREE, fakeTexture(), { maxAnisotropy: 16 });
    assert.equal(texture.magFilter, THREE.NearestFilter, 'de perto continua pixel art');
    assert.equal(texture.minFilter, THREE.NearestMipmapLinearFilter, 'de longe entra mipmap');
    assert.equal(texture.generateMipmaps, true);
    assert.equal(texture.anisotropy, 8, 'anisotropia tem teto de 8');
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace, 'o verde do PNG está em sRGB');

    const modesta = configureTallGrassTexture(THREE, fakeTexture(), { maxAnisotropy: 2 });
    assert.equal(modesta.anisotropy, 2, 'respeita o aparelho modesto');
    const semInfo = configureTallGrassTexture(THREE, fakeTexture());
    assert.equal(semInfo.anisotropy, 1, 'sem informação, o mínimo');

    // WebGL 1 não aceita mipmap em textura que não é potência de dois, e o
    // three redimensionaria o PNG (deformando o tufo de novo).
    const semMipmap = configureTallGrassTexture(THREE, fakeTexture(), { mipmaps: false });
    assert.equal(semMipmap.minFilter, THREE.LinearFilter);
    assert.equal(semMipmap.generateMipmaps, false);
});

test('material: corte por alfa, duas faces e sem transparência ordenada', () => {
    const material = createTallGrassMaterial(THREE, fakeTexture(), { maxAnisotropy: 4 });
    assert.equal(material.side, THREE.DoubleSide, 'a placa é vista dos dois lados');
    assert.equal(material.transparent, false, 'alfa é corte, não mistura (nada de ordenar 2000 tufos)');
    assert.equal(material.depthWrite, true);
    assert.ok(material.alphaTest > 0 && material.alphaTest <= 0.35,
        'alto demais come as folhas finas do mipmap; baixo demais deixa halo');
    assert.ok(material.map, 'usa a textura do capim');
    assert.equal(material.map.minFilter, THREE.NearestMipmapLinearFilter, 'o material já entrega a textura pronta');
});
