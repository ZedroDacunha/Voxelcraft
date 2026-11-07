// A CAMA — um bloco de dois voxels com forma própria.
//
// O modelo mora em `world-bed.js` em caixas puras, então quase tudo aqui pode
// ser testado sem navegador: as medidas, a direção, o par de células, a colisão
// de 9/16 e o encaixe do catálogo (blocos, item, receita e ícone). O que estes
// testes protegem é o que mais erra num bloco assim:
//
// 1. a cama **não** pode passar da borda do voxel em nenhuma direção;
// 2. a cabeceira precisa ficar do lado para onde a cama aponta;
// 3. quebrar uma metade tem de levar a outra junto — sem cama fantasma;
// 4. o jogador sobe na cama (9/16) e não a atravessa de pé.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ID, ITEMS, BLOCKS, RECIPES, TILE, ATLAS_COLUMNS, ATLAS_ROWS } from '../world-catalog.js';
import {
    BED_COLLISION_HEIGHT, BED_HEIGHTS, bedCells, bedCollisionBox, bedModelBoxes,
    bedOtherCell, bedPart, bedShapes, bedTypeForPart, isBedBlock,
} from '../world-bed.js';
import { collidesInWorld, hasGroundSupport } from '../player-physics.js';
import { blockMaterialFor } from '../world-block-materials.js';
import { createTextureTools } from '../world-textures.js';

const FACINGS = ['north', 'south', 'east', 'west'];

/** Os pixels de um sprite pela rota do atlas (o mesmo caminho do jogo). */
function spriteDaCama() {
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {}, getImageData() { return { data: new Uint8ClampedArray(4) }; } }) }) };
    const THREE = { CanvasTexture: class { constructor(image) { this.image = image; } }, NearestFilter: 1006, ClampToEdgeWrapping: 1001, SRGBColorSpace: 'srgb' };
    const tools = createTextureTools(THREE);
    const icone = tools.spritePixels('bed', 'red');
    delete globalThis.document;
    return icone;
}

/** Mundo de mentira: só o que a física pede. */
function mundoDe(blocos) {
    return {
        getBlock(x, y, z) { return blocos[`${x},${y},${z}`] ?? 0; },
        isSolidForPhysics(x, y, z, type) {
            const t = type ?? this.getBlock(x, y, z);
            return t !== 0 && (BLOCKS[t]?.solid ?? true);
        },
    };
}

test('a cama é feita de duas metades com tipos próprios', () => {
    assert.equal(bedPart(ID.BED_FOOT), 'foot');
    assert.equal(bedPart(ID.BED_HEAD), 'head');
    assert.equal(bedPart(ID.PLANKS), null);
    assert.equal(bedTypeForPart('head'), ID.BED_HEAD);
    assert.equal(bedTypeForPart('foot'), ID.BED_FOOT);
    assert.equal(isBedBlock(ID.BED_HEAD), true);
    assert.equal(isBedBlock(ID.WOOD_DOOR_BOTTOM), false);
});

test('o topo do colchão fica em 9/16, e a colisão usa essa altura', () => {
    assert.equal(BED_HEIGHTS.quilt, 9);
    assert.equal(BED_COLLISION_HEIGHT, 9 / 16);
    assert.deepEqual(bedCollisionBox(), { minX: 0, maxX: 1, minZ: 0, maxZ: 1, maxY: 9 / 16 });
});

test('nenhuma caixa escapa do voxel, em nenhuma direção', () => {
    for (const part of ['foot', 'head']) {
        for (const facing of FACINGS) {
            const caixas = bedShapes(part, facing);
            assert.ok(caixas.length >= 5, `${part}/${facing} tem caixas de menos`);
            for (const { min, max, tiles } of caixas) {
                for (let a = 0; a < 3; a++) {
                    assert.ok(min[a] >= 0 && min[a] <= 1, `${part}/${facing}: min ${a} fora de 0..1`);
                    assert.ok(max[a] >= 0 && max[a] <= 1, `${part}/${facing}: max ${a} fora de 0..1`);
                    assert.ok(max[a] > min[a], `${part}/${facing}: caixa achatada no eixo ${a}`);
                }
                // Toda caixa precisa de arte nos três tipos de face que o
                // mesher desenha — sem isso o buraco aparece na malha.
                for (const face of ['top', 'side', 'bottom']) {
                    assert.equal(typeof tiles[face], 'number', `${part}/${facing}: caixa sem tile de ${face}`);
                    assert.ok(Object.values(TILE).includes(tiles[face]), `tile ${tiles[face]} não existe`);
                }
            }
        }
    }
});

test('as duas metades se encontram sem degrau', () => {
    // A beirada de dentro de cada metade é o encaixe: o pé termina em 1 e a
    // cabeceira começa em 0 (no eixo do comprimento, o Z local).
    const pe = bedShapes('foot', 'south');
    const cabeca = bedShapes('head', 'south');
    const colchaoPe = pe.find(c => c.max[1] === BED_HEIGHTS.mattress / 16 && c.min[1] === BED_HEIGHTS.frame / 16);
    const colchaoCabeca = cabeca.find(c => c.max[1] === BED_HEIGHTS.mattress / 16 && c.min[1] === BED_HEIGHTS.frame / 16);
    assert.equal(colchaoPe.max[2], 1);
    assert.equal(colchaoCabeca.min[2], 0);
});

test('o travesseiro só existe na cabeceira', () => {
    const temTravesseiro = caixas => caixas.some(c => c.tiles.top === TILE.BED_PILLOW_TOP);
    assert.equal(temTravesseiro(bedShapes('foot', 'south')), false);
    for (const facing of FACINGS) {
        assert.equal(temTravesseiro(bedShapes('head', facing)), true, `sem travesseiro em ${facing}`);
    }
});

test('a cabeceira fica do lado para onde a cama aponta', () => {
    // O travesseiro não encosta na borda (recua 1/16), então o que se compara é
    // o centro dele: ele tem de estar na metade do lado do +eixo da direção.
    const centro = (min, max) => (min + max) / 2;
    const noLado = {
        south: c => centro(c.min[2], c.max[2]) > 0.5,
        north: c => centro(c.min[2], c.max[2]) < 0.5,
        east: c => centro(c.min[0], c.max[0]) > 0.5,
        west: c => centro(c.min[0], c.max[0]) < 0.5,
    };
    for (const facing of FACINGS) {
        const travesseiro = bedShapes('head', facing).find(c => c.tiles.top === TILE.BED_PILLOW_TOP);
        assert.ok(noLado[facing](travesseiro), `travesseiro no lado errado em ${facing}`);
    }
});

test('as duas células da cama seguem a direção', () => {
    assert.deepEqual(bedCells(4, 4, 'south'), { foot: { x: 4, z: 4 }, head: { x: 4, z: 5 } });
    assert.deepEqual(bedCells(4, 4, 'north'), { foot: { x: 4, z: 4 }, head: { x: 4, z: 3 } });
    assert.deepEqual(bedCells(4, 4, 'east'), { foot: { x: 4, z: 4 }, head: { x: 5, z: 4 } });
    assert.deepEqual(bedCells(4, 4, 'west'), { foot: { x: 4, z: 4 }, head: { x: 3, z: 4 } });
});

test('a outra metade é sempre o caminho de volta', () => {
    for (const facing of FACINGS) {
        const { foot, head } = bedCells(2, -3, facing);
        assert.deepEqual(bedOtherCell(foot.x, foot.z, 'foot', facing), head);
        assert.deepEqual(bedOtherCell(head.x, head.z, 'head', facing), foot);
    }
});

test('o modelo do ícone tem as duas metades', () => {
    const caixas = bedModelBoxes();
    assert.equal(caixas.length, bedShapes('foot', 'south').length + bedShapes('head', 'south').length);
    // O comprimento vai de 0 a 2: duas células lado a lado.
    assert.ok(caixas.every(c => c.min[2] >= 0 && c.max[2] <= 2));
});

test('o catálogo liga as metades, o item e a receita', () => {
    for (const tipo of [ID.BED_HEAD, ID.BED_FOOT]) {
        const bloco = BLOCKS[tipo];
        assert.equal(bloco.render, 'bed', 'a cama precisa do modo de desenho próprio');
        assert.equal(bloco.collectible, false, 'a metade não vira item: o item é a cama inteira');
        assert.equal(bloco.drop, ID.BED);
        assert.equal(bloco.opaque, false, 'móvel não pode barrar a luz');
        assert.equal(bloco.solid, true, 'a cama é sólida (dá para subir nela)');
    }
    const item = ITEMS[ID.BED];
    assert.equal(item.name, 'Cama');
    assert.equal(item.maxStack, 1);
    assert.equal(item.block, ID.BED_FOOT);
    assert.equal(item.sprite.kind, 'bed');
    assert.ok(item.iconTile < ATLAS_COLUMNS * ATLAS_ROWS, 'ícone fora do atlas');

    const receita = RECIPES.find(r => r.result === ID.BED);
    assert.ok(receita, 'cama sem receita');
    assert.deepEqual(receita.shape, [
        [ID.WOOL_WHITE, ID.WOOL_WHITE, ID.WOOL_WHITE],
        [ID.PLANKS, ID.PLANKS, ID.PLANKS],
    ]);
    assert.equal(receita.count, 1);
});

test('a cama soa como lã (passo, quebra e colocação)', () => {
    assert.equal(blockMaterialFor(ID.BED_HEAD), 'wool');
    assert.equal(blockMaterialFor(ID.BED_FOOT), 'wool');
});

test('o ícone da cama é 32×32, com vermelho e branco', () => {
    const icone = spriteDaCama();
    assert.equal(icone.length, 32);
    assert.equal(icone[0].length, 32);
    const cores = icone.flat().filter(Boolean);
    assert.ok(cores.length > 200, 'ícone quase vazio');
    // Vermelho do cobertor e branco do travesseiro: as duas cores que fazem a
    // peça ser reconhecida na barra.
    assert.ok(cores.some(([r, g, b]) => r > 90 && r > g * 2 && r > b * 2), 'sem o vermelho do cobertor');
    assert.ok(cores.some(([r, g, b]) => r > 190 && g > 185 && b > 175), 'sem o branco do travesseiro');
});

test('o jogador sobe na cama e não a atravessa de pé', () => {
    const mundo = mundoDe({ '0,0,0': ID.BED_FOOT, '0,0,1': ID.BED_HEAD, '0,-1,0': ID.STONE, '0,-1,1': ID.STONE });
    // De pé no chão, ao lado: a cama barra.
    assert.equal(collidesInWorld(mundo, 0.5, 0, 0.5, 1.8), true);
    // Em cima do colchão (9/16) não há colisão: dá para ficar de pé nela.
    assert.equal(collidesInWorld(mundo, 0.5, 9 / 16, 0.5, 1.8), false);
    // Acima de tudo, idem.
    assert.equal(collidesInWorld(mundo, 0.5, 1, 0.5, 1.8), false);
    // E o pé encontra apoio no topo da cama.
    assert.equal(hasGroundSupport(mundo, { x: 0.5, y: 9 / 16, z: 0.5 }, 1.8), true);
});
