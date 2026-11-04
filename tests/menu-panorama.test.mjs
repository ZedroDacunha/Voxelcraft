// O panorama do menu agora é montado como o mundo monta os pedaços dele:
// face que ninguém vê fica de fora, canto encostado escurece e a sombra vai na
// cor de vértice. Estes testes seguram as três coisas que podem dar errado sem
// ninguém ver — face sobrando (custo e z-fighting), sombra achatada (perde o
// relevo) e índice fora da malha (o Three simplesmente não desenha).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MENU_LAKE,
    MENU_PANORAMA_RADIUS,
    MENU_SHADE_BASE,
    MENU_SHADE_STEP,
    buildMenuPanorama,
    panoramaGeometry,
} from '../menu-panorama.js';

/** Um monte de blocos no formato que o construtor de malha espera. */
const blocksOf = entries => new Map(entries.map(([x, y, z, kind = 'stone', variant = 0]) => [
    `${x},${y},${z}`, { kind, variant },
]));

const geometryOf = entries => panoramaGeometry({ blocks: blocksOf(entries) });

test('um bloco sozinho mostra as seis faces, todas com a luz do céu inteira', () => {
    const geo = geometryOf([[0, 0, 0, 'stone']]);
    assert.equal(geo.opaque.faces, 6);
    assert.equal(geo.opaque.vertices, 24);
    assert.equal(geo.opaque.indices.length, 36);
    assert.equal(geo.cutout.faces, 0);
    // Sem vizinho encostado, nenhum canto escurece: a soma dos três pesos é 3.
    const full = MENU_SHADE_BASE + 3 * MENU_SHADE_STEP;
    assert.ok(Math.abs(full - 1) < 1e-9, 'a luz do céu cheia tem que dar 1');
    for (const shade of geo.opaque.colors) assert.equal(shade, 1);
});

test('face entre dois blocos cheios não existe (nem para desenhar nem para gastar)', () => {
    const side = geometryOf([[0, 0, 0], [1, 0, 0]]);
    assert.equal(side.opaque.faces, 10, 'duas faces encostadas somem');
    const stacked = geometryOf([[0, 0, 0], [0, 1, 0]]);
    assert.equal(stacked.opaque.faces, 10);
    const solid = [];
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) solid.push([x, y, z]);
        }
    }
    const cube = geometryOf(solid);
    assert.equal(cube.stats.blocks, 27);
    assert.equal(cube.opaque.faces, 54, 'só a casca do cubo 3x3x3 aparece');
});

test('o bloco do meio de um piso de cinco por cinco não gasta nenhuma face', () => {
    // Piso 5x5 de uma camada: só as bordas aparecem para fora.
    const floor = [];
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) floor.push([x, 0, z]);
    const geo = geometryOf(floor);
    // 25 topos + 25 fundos + 20 laterais (só as colunas da borda).
    assert.equal(geo.opaque.faces, 25 + 25 + 20);
});

test('folha vai para a parte recortada e mantém as faces internas da copa', () => {
    const alone = geometryOf([[0, 0, 0, 'leaves']]);
    assert.equal(alone.cutout.faces, 6);
    assert.equal(alone.opaque.faces, 0);
    // Copas vizinhas continuam desenhando face contra face: é o que dá volume
    // à árvore quando os vãos da textura deixam ver o outro lado.
    const crown = geometryOf([[0, 0, 0, 'leaves'], [1, 0, 0, 'leaves']]);
    assert.equal(crown.cutout.faces, 12);
    // Folha é recortada: não tapa a face do que está atrás dela, então a pedra
    // mantém as seis. Do lado da folha, só a face colada na pedra some.
    const againstStone = geometryOf([[0, 0, 0, 'stone'], [1, 0, 0, 'leaves']]);
    assert.equal(againstStone.opaque.faces, 6);
    assert.equal(againstStone.cutout.faces, 5);
});

test('bloco encostado no canto escurece só o canto dele', () => {
    // O vizinho fica em cima e do lado: fecha a quina da face de cima do bloco
    // do chão, e não o resto da face.
    const geo = geometryOf([[0, 0, 0, 'grass'], [1, 1, 0, 'grass']]);
    const shades = [...new Set(geo.opaque.colors)].sort();
    assert.equal(shades.length, 2, 'a face do canto tem dois tons diferentes');
    assert.equal(Math.max(...shades), 1);
    const dim = Math.min(...shades);
    assert.ok(dim < 1 && dim >= MENU_SHADE_BASE, `sombra fora da escala: ${dim}`);
    // Duas colunas de oclusão fechadas (o vizinho de cima conta duas vezes):
    // um nível abaixo do canto livre.
    assert.ok(Math.abs(dim - (MENU_SHADE_BASE + 2 * MENU_SHADE_STEP)) < 1e-6);
});

test('a luz de canto nunca passa do limite do jogo', () => {
    // Céu aberto não pode ficar mais claro que 1 nem mais escuro que a base.
    const geo = panoramaGeometry(buildMenuPanorama());
    let min = Infinity;
    let max = -Infinity;
    for (const shade of geo.opaque.colors) {
        if (shade < min) min = shade;
        if (shade > max) max = shade;
    }
    for (const shade of geo.cutout.colors) {
        if (shade < min) min = shade;
        if (shade > max) max = shade;
    }
    assert.equal(max, 1);
    // A malha guarda cor em float32, então a base pode chegar um fio abaixo.
    assert.ok(min >= MENU_SHADE_BASE - 1e-6, `sombra abaixo da base: ${min}`);
});

test('todos os índices apontam para vértices que existem', () => {
    const geo = panoramaGeometry(buildMenuPanorama());
    for (const part of [geo.opaque, geo.cutout]) {
        const vertices = part.vertices;
        assert.ok(vertices > 0);
        assert.equal(part.positions.length, vertices * 3);
        assert.equal(part.normals.length, vertices * 3);
        assert.equal(part.uvs.length, vertices * 2);
        assert.equal(part.colors.length, vertices * 3);
        assert.equal(part.indices.length % 6, 0);
        for (const index of part.indices) {
            assert.ok(index >= 0 && index < vertices, `índice ${index} de ${vertices}`);
        }
        for (const value of [...part.positions, ...part.normals, ...part.uvs, ...part.colors]) {
            assert.ok(Number.isFinite(value));
        }
        for (const uv of part.uvs) assert.ok(uv >= 0 && uv <= 1, `UV fora do atlas: ${uv}`);
    }
});

test('a malha da ilha fica bem menor que um cubo por bloco', () => {
    const geo = panoramaGeometry(buildMenuPanorama());
    const cubes = geo.stats.blocks * 6;
    assert.ok(geo.stats.faces > 0);
    assert.ok(geo.stats.faces < cubes * 0.5, `faces ${geo.stats.faces} de ${cubes} possíveis`);
});

test('a ilha mantém a paisagem de antes: lago de areia, chão de grama e árvores', () => {
    const panorama = buildMenuPanorama();
    const { blocks, radius } = panorama;
    assert.equal(radius, MENU_PANORAMA_RADIUS);
    assert.ok(blocks.size > 1000);

    for (const key of blocks.keys()) {
        const [x, y, z] = key.split(',').map(Number);
        // A copa da árvore pode pendurar um pouco para fora da borda.
        assert.ok(Math.abs(x) <= radius + 3 && Math.abs(z) <= radius + 3, `bloco longe da ilha: ${key}`);
        assert.ok(y >= 0, `bloco abaixo do mundo: ${key}`);
    }

    // Centro do lago: areia no fundo, água por cima (a lâmina é desenhada à parte).
    const lakeCenter = blocks.get(`${MENU_LAKE.centerX},0,${MENU_LAKE.centerZ}`);
    assert.equal(lakeCenter?.kind, 'sand');
    assert.equal(blocks.get(`${MENU_LAKE.centerX},1,${MENU_LAKE.centerZ}`), undefined);

    // Longe do lago o chão é grama (o relevo varia, então achamos o topo da
    // coluna em vez de adivinhar a altura).
    const corner = [...blocks.entries()]
        .filter(([key]) => key.startsWith(`${-radius},`) && key.endsWith(`,${-radius}`))
        .map(([key, entry]) => ({ y: Number(key.split(',')[1]), kind: entry.kind }))
        .sort((a, b) => b.y - a.y);
    assert.equal(corner[0].kind, 'grass', 'o topo da quina da ilha é grama');
    assert.equal(corner[1].kind, 'dirt', 'debaixo da grama vem terra');
    const kinds = new Set([...blocks.values()].map(entry => entry.kind));
    for (const kind of ['grass', 'dirt', 'stone', 'sand', 'wood', 'leaves']) {
        assert.ok(kinds.has(kind), `a ilha perdeu o tipo ${kind}`);
    }
});

test('a malha é a mesma toda vez (nada de sorteio solto)', () => {
    const first = panoramaGeometry(buildMenuPanorama());
    const second = panoramaGeometry(buildMenuPanorama());
    assert.equal(first.stats.faces, second.stats.faces);
    assert.deepEqual(Array.from(first.opaque.indices), Array.from(second.opaque.indices));
    assert.deepEqual(Array.from(first.opaque.colors), Array.from(second.opaque.colors));
});

test('cada face usa o tile certo do atlas (topo e lado da grama não são iguais)', () => {
    const geo = geometryOf([[0, 0, 0, 'grass']]);
    // Seis faces, quatro vértices cada. O canto de menor U e menor V de cada
    // face é o começo do tile dela, independente de como os cantos estão
    // ordenados. Grama tem três tiles: topo, lado e fundo.
    const origins = [];
    for (let face = 0; face < 6; face++) {
        const uvs = geo.opaque.uvs.subarray(face * 8, face * 8 + 8);
        let u = Infinity;
        let v = Infinity;
        for (let i = 0; i < 8; i += 2) {
            u = Math.min(u, uvs[i]);
            v = Math.min(v, uvs[i + 1]);
        }
        origins.push(`${u.toFixed(6)},${v.toFixed(6)}`);
    }
    assert.equal(new Set(origins).size, 3, 'grama tem três tiles: topo, lado e fundo');
});
