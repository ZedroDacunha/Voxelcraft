/**
 * Capim alto (`TALL_GRASS`): a arte, o endereço das imagens e o material.
 *
 * O capim é o objeto mais repetido do mundo (um tufo por bloco de grama alta,
 * até 2000 instâncias) e o único que não vem do atlas: ele usa três PNGs de
 * verdade, desenhados à parte. Isso deixou três coisas soltas aqui, e cada uma
 * virava um defeito visível:
 *
 * - **proporção**: as placas do tufo são duas diagonais cruzadas. Uma diagonal
 *   de meia-largura `h` desenha `2h√2` de largura no mundo — o sprite saía 41%
 *   mais largo que o desenho, e o capim parecia amassado. A meia-largura da
 *   diagonal é corrigida por `√2` para a arte caber na proporção do PNG;
 * - **nitidez**: o sprite tem ~300×200 pixels e é desenhado com 20–60 px de
 *   altura na tela. Sem mipmap e com filtro `Nearest` também na minificação, o
 *   navegador lê um texel de cada vez num desenho 6× maior: as folhas finas
 *   desaparecem e o tufo cintila quando a câmera anda. Perto continua `Nearest`
 *   (pixel art nítida), longe entra mipmap;
 * - **cache**: a versão das URLs era escrita à mão (`20261029-5`) e não subia
 *   junto com o PNG. Trocada a arte, a URL continuava a mesma e o navegador
 *   servia a imagem velha — de novo, e de novo. Agora a versão é o hash do
 *   arquivo, carimbado em `asset-versions.js`.
 *
 * O balanço do vento (`world-wind.js`) depende de `uv.y = 0` na raiz e `1` na
 * ponta; é por isso que a geometria monta a base primeiro, em todas as placas.
 */

import { ASSET_VERSIONS } from './asset-versions.js';

/**
 * As três alturas de tufo, com a proporção do arquivo (`largura / altura`).
 *
 * A altura é em blocos: 0,28 fica rasteiro, 0,78 chega perto do topo do bloco.
 * O `aspect` tem que bater com o PNG — se o desenho for recortado de novo, os
 * dois números sobem juntos.
 */
export const TALL_GRASS_VARIANTS = [
    { file: './assets/tall-grass-short-v2.png', height: 0.28, aspect: 299 / 198 },
    { file: './assets/tall-grass-medium-v2.png', height: 0.52, aspect: 386 / 368 },
    { file: './assets/tall-grass-tall-v2.png', height: 0.78, aspect: 315 / 454 },
];

/** A raiz do tufo afunda um pouco no chão: sem isso a base parece flutuar. */
const ROOT_OFFSET = -0.025;

/** Uma diagonal da placa tem `1/√2` da meia-largura do desenho. */
const DIAGONAL = 1 / Math.SQRT2;

const DEFAULT_VARIANT = 1;

/** URL da imagem com a versão do conteúdo (`?v=<hash>`), para o cache. */
export function tallGrassTextureUrl(file, base = import.meta.url) {
    const path = String(file).replace(/^\.\//, '');
    const version = ASSET_VERSIONS?.[path];
    return new URL(version ? `${file}?v=${version}` : file, base).href;
}

/**
 * Geometria do tufo: duas placas iguais cruzadas em X, base no chão.
 *
 * `variant` escolhe a altura e a proporção em `TALL_GRASS_VARIANTS`; um índice
 * fora da lista cai no tufo médio (é o que está na mão do jogador).
 */
export function createTallGrassGeometry({ THREE, variant = DEFAULT_VARIANT } = {}) {
    const selected = TALL_GRASS_VARIANTS[variant] ?? TALL_GRASS_VARIANTS[DEFAULT_VARIANT];
    const height = selected.height;
    // Largura que a ARTE pede, e a meia-largura da diagonal que a produz.
    const halfWidth = height * selected.aspect / 2;
    const reach = halfWidth * DIAGONAL;
    const bottom = ROOT_OFFSET;
    const top = height + ROOT_OFFSET;
    const positions = [
        // placa 1: diagonal (-1,-1) → (+1,+1)
        -reach, bottom, -reach, reach, bottom, reach, reach, top, reach, -reach, top, -reach,
        // placa 2: diagonal (+1,-1) → (-1,+1)
        reach, bottom, -reach, -reach, bottom, reach, -reach, top, reach, reach, top, -reach,
    ];
    // Em cada placa: base com uv.y = 0 (raiz presa) e topo com uv.y = 1.
    const uvs = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    geometry.computeVertexNormals();
    return geometry;
}

/** Quantos níveis de anisotropia usar (capim é visto de rasante, quase sempre). */
function anisotropyFor(maxAnisotropy) {
    const max = Number(maxAnisotropy);
    if (!Number.isFinite(max) || max < 1) return 1;
    return Math.min(8, Math.floor(max));
}

/**
 * Filtros da textura do capim: `Nearest` para ampliar (pixel art), mipmap para
 * reduzir (para de cintilar). O alfa do mipmap é a média dos texels, então um
 * `alphaTest` alto demais come as folhas finas no fundo do tufo.
 */
export function configureTallGrassTexture(THREE, texture, { maxAnisotropy, mipmaps = true } = {}) {
    if (!texture) return texture;
    texture.magFilter = THREE.NearestFilter;
    // No WebGL 1, mipmap exige textura potência de dois: como os PNGs do capim
    // não são (299×198, 386×368, 315×454), o three os redimensionaria e o tufo
    // voltaria a sair deformado. Ali fica o filtro linear, sem mipmap.
    texture.minFilter = mipmaps ? THREE.NearestMipmapLinearFilter : THREE.LinearFilter;
    texture.generateMipmaps = mipmaps;
    texture.anisotropy = anisotropyFor(maxAnisotropy);
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

/** Material do capim: corte por alfa, duas faces (placa vista dos dois lados). */
export function createTallGrassMaterial(THREE, texture, { maxAnisotropy, mipmaps } = {}) {
    configureTallGrassTexture(THREE, texture, { maxAnisotropy, mipmaps });
    return new THREE.MeshLambertMaterial({
        map: texture, alphaTest: 0.3, transparent: false, depthWrite: true, side: THREE.DoubleSide,
    });
}
