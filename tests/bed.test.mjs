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

import {
    BED_VARIANTS, ID, ITEMS, BLOCKS, RECIPES, TILE, ATLAS_COLUMNS, ATLAS_ROWS, matchRecipe,
} from '../world-catalog.js';
import {
    BED_COLLISION_HEIGHT, BED_COLORS, BED_HEIGHTS, bedCells, bedCollisionBox, bedColor, bedFacingVector,
    bedModelBoxes, bedOtherCell, bedPart, bedShapes, bedTypeForPart, isBedBlock, isBedFoot,
} from '../world-bed.js';
import { Inventory } from '../inventory-model.js';
import { collidesInWorld, hasGroundSupport } from '../player-physics.js';
import { blockMaterialFor } from '../world-block-materials.js';
import { createTextureTools } from '../world-textures.js';

const FACINGS = ['north', 'south', 'east', 'west'];

/** Os pixels de um sprite pela rota do atlas (o mesmo caminho do jogo). */
function spriteDaCama(cor = 'white') {
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {}, getImageData() { return { data: new Uint8ClampedArray(4) }; } }) }) };
    const THREE = { CanvasTexture: class { constructor(image) { this.image = image; } }, NearestFilter: 1006, ClampToEdgeWrapping: 1001, SRGBColorSpace: 'srgb' };
    const tools = createTextureTools(THREE);
    const icone = tools.spritePixels('bed', cor);
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
                // Toda caixa precisa de arte na **lateral** — é a face que o
                // jogador sempre pode ver. Topo e fundo podem vir `null`: são as
                // faces que ficaram enterradas dentro de outra caixa (o mesher
                // pula) e não podem reaparecer como arte vazia.
                for (const face of ['top', 'side', 'bottom']) {
                    const tile = tiles[face];
                    if (tile === null) continue;
                    assert.equal(typeof tile, 'number', `${part}/${facing}: caixa sem tile de ${face}`);
                    assert.ok(Object.values(TILE).includes(tile), `tile ${tile} não existe`);
                }
                assert.equal(typeof tiles.side, 'number', `${part}/${facing}: caixa sem lateral`);
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

test('nenhuma caixa tem face no mesmo plano de outra (o pisca-pisca)', () => {
    // O passe de recorte desenha os dois lados da face (`DoubleSide`), então
    // duas faces coplanares que se cruzam brigam pelo mesmo pixel — foi assim
    // que a cama piscava ao girar a câmera. As peças se **embutem** (ENCAIXE)
    // em vez de encostar; este teste cobra isso de qualquer mudança futura.
    const EPS = 1e-6;
    const cruza = (aMin, aMax, bMin, bMax) => Math.min(aMax, bMax) - Math.max(aMin, bMin) > EPS;
    // A exceção é o plano da **emenda** entre as duas metades: as faces que dão
    // para a outra metade são descartadas pelo mesher (`solid()`), então elas
    // podem coincidir à vontade — é justamente o que mantém a cama contínua.
    // Onde a emenda cai no espaço local: ela fica do lado da outra metade — o
    // pé aponta para a cabeceira e a cabeceira para o pé.
    const emendaDe = (facing, part) => {
        const [dx, dz] = bedFacingVector(facing);
        const sinal = part === 'foot' ? 1 : -1;
        const eixo = dx !== 0 ? 0 : 2;
        return { eixo, valor: (eixo === 0 ? dx : dz) * sinal > 0 ? 1 : 0 };
    };
    for (const part of ['foot', 'head']) {
        for (const facing of FACINGS) {
            const emenda = emendaDe(facing, part);
            const caixas = bedShapes(part, facing);
            for (let i = 0; i < caixas.length; i++) {
                for (let j = i + 1; j < caixas.length; j++) {
                    const A = caixas[i], B = caixas[j];
                    for (let a = 0; a < 3; a++) {
                        const planos = [A.min[a], A.max[a]].some(va => [B.min[a], B.max[a]].some(vb => Math.abs(va - vb) < EPS));
                        if (!planos) continue;
                        const noPlanoDaEmenda = a === emenda.eixo
                            && [A.min[a], A.max[a], B.min[a], B.max[a]].some(v => Math.abs(v - emenda.valor) < EPS);
                        if (noPlanoDaEmenda) continue;
                        const outros = [0, 1, 2].filter(e => e !== a);
                        const [p, q] = outros;
                        if (cruza(A.min[p], A.max[p], B.min[p], B.max[p])
                            && cruza(A.min[q], A.max[q], B.min[q], B.max[q])) {
                            assert.fail(`${part}/${facing}: caixas ${i} e ${j} têm face coplanar no eixo ${a}`);
                        }
                    }
                }
            }
        }
    }
});

test('as faces enterradas saem do desenho (nada de buraco preto)', () => {
    // Uma face que mora dentro de outra caixa nunca é vista — e uma face vista
    // por dentro é preta. Se ela ficar no modelo, vira "buraco" na tela quando
    // alguma coisa dá errado com a ordem de desenho.
    for (const facing of FACINGS) {
        const cabeca = bedShapes('head', facing);
        const travesseiro = cabeca.find(c => c.tiles.top === TILE.BED_PILLOW_TOP && c.max[1] > BED_HEIGHTS.quilt / 16 + 0.05);
        assert.ok(travesseiro, 'travesseiro sem topo visível');
        // O corpo do travesseiro cobre a tela de cima, então o fundo dele (que
        // está dentro da aba do colchão) não precisa existir.
        const corpo = cabeca.find(c => c.tiles.top === TILE.BED_PILLOW_TOP && c.tiles.bottom === null);
        assert.ok(corpo, 'o fundo enterrado do travesseiro continua no desenho');
        // A lateral do colchão, ao contrário, nunca pode sumir.
        for (const caixa of bedShapes('foot', facing)) {
            assert.equal(typeof caixa.tiles.side, 'number');
        }
    }
});

test('o travesseiro é maior que meia largura do colchão', () => {
    // Tamanho pedido pelo usuário: 13/16 de largura por 6/16 de comprimento.
    const caixas = bedShapes('head', 'south');
    const corpo = caixas.find(c => c.tiles.top === TILE.BED_PILLOW_TOP && c.tiles.bottom === null);
    const largura = (corpo.max[0] - corpo.min[0]) * 16;
    const comprimento = (corpo.max[2] - corpo.min[2]) * 16;
    assert.ok(Math.abs(largura - 13) < 0.01, `largura ${largura}`);
    assert.ok(Math.abs(comprimento - 6) < 0.01, `comprimento ${comprimento}`);
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
    // Lã **em bloco**, não o fardo solto: é a receita clássica (3 de lã em cima,
    // 3 tábuas embaixo), e o fardo é só o que a ovelha derruba.
    assert.deepEqual(receita.shape, [
        [ID.WOOL_BLOCK_WHITE, ID.WOOL_BLOCK_WHITE, ID.WOOL_BLOCK_WHITE],
        [ID.PLANKS, ID.PLANKS, ID.PLANKS],
    ]);
    assert.equal(receita.count, 1);
});

test('são três camas: uma por cor de lã, cada uma com a sua receita', () => {
    assert.deepEqual(BED_COLORS, ['white', 'gray', 'black']);
    for (const bed of BED_VARIANTS) {
        // O bloco sabe a cor e a metade; o item aponta para os pés da sua cor.
        assert.equal(bedColor(bed.foot), bed.color);
        assert.equal(bedColor(bed.head), bed.color);
        assert.equal(bedPart(bed.head), 'head');
        assert.equal(isBedFoot(bed.foot), true);
        assert.equal(isBedFoot(bed.head), false);
        assert.equal(bedTypeForPart('head', bed.color), bed.head);

        const bloco = BLOCKS[bed.foot];
        assert.equal(bloco.drop, bed.item, 'quebrar tem de devolver a cama da cor certa');
        assert.equal(BLOCKS[bed.head].drop, bed.item, 'a cabeceira devolve a mesma cama');
        assert.equal(blockMaterialFor(bed.head), 'wool');
        assert.equal(blockMaterialFor(bed.foot), 'wool');

        const item = ITEMS[bed.item];
        assert.equal(item.block, bed.foot);
        assert.equal(item.sprite.mat, bed.color, 'o ícone segue a cor da cama');
        assert.ok(item.iconTile < ATLAS_COLUMNS * ATLAS_ROWS, `${item.name}: ícone fora do atlas`);

        // A receita é a de sempre, com o **bloco** de lã daquela cor.
        const receita = RECIPES.find(r => r.result === bed.item);
        assert.ok(receita, `${item.name} sem receita`);
        assert.deepEqual(receita.shape, [
            [bed.woolBlock, bed.woolBlock, bed.woolBlock],
            [ID.PLANKS, ID.PLANKS, ID.PLANKS],
        ]);
    }
    // Cada cama tem o seu par de blocos, o seu item e o seu ícone no atlas.
    const tipos = BED_VARIANTS.flatMap(bed => [bed.head, bed.foot, bed.item]);
    assert.equal(new Set(tipos).size, tipos.length, 'duas camas dividiram o mesmo ID');
    const icones = BED_VARIANTS.map(bed => ITEMS[bed.item].iconTile);
    assert.equal(new Set(icones).size, 3, 'duas camas dividiram a célula do atlas');
    // E o colchão de cada uma usa tiles próprios: a cor não é um filtro em cima
    // do mesmo desenho, é o desenho certo.
    const telhas = BED_VARIANTS.map(bed => bedShapes('foot', 'south', bed.color)[3].tiles.top);
    assert.equal(new Set(telhas).size, 3, 'duas camas desenharam o mesmo colchão');
});

test('a bancada reconhece as três receitas e não mistura as lãs', () => {
    const grade = (acima) => {
        const inv = new Inventory(9);
        for (const index of [0, 1, 2]) inv.slots[index] = { id: acima, count: 1 };
        for (const index of [3, 4, 5]) inv.slots[index] = { id: ID.PLANKS, count: 1 };
        return inv;
    };
    for (const bed of BED_VARIANTS) {
        assert.deepEqual(matchRecipe(grade(bed.woolBlock), 3), { id: bed.item, count: 1 },
            `3 blocos de lã ${bed.label} + 3 tábuas não viraram ${ITEMS[bed.item].name}`);
    }
    // Bloco trocado no meio: não é receita de nada.
    const misturada = new Inventory(9);
    for (const index of [0, 2]) misturada.slots[index] = { id: ID.WOOL_BLOCK_GRAY, count: 1 };
    misturada.slots[1] = { id: ID.WOOL_BLOCK_WHITE, count: 1 };
    for (const index of [3, 4, 5]) misturada.slots[index] = { id: ID.PLANKS, count: 1 };
    assert.equal(matchRecipe(misturada, 3), null, 'mistura de lã não pode dar cama');
    // O fardo solto não costura cama nenhuma: quem entra na bancada é o bloco.
    const fardos = grade(ID.WOOL_WHITE);
    assert.equal(matchRecipe(fardos, 3), null, '3 fardos de lã soltos não podem dar cama');
    const fardosCinza = grade(ID.WOOL_GRAY);
    assert.equal(matchRecipe(fardosCinza, 3), null, '3 fardos cinza também não');
    const fardosPretos = grade(ID.WOOL_BLACK);
    assert.equal(matchRecipe(fardosPretos, 3), null, '3 fardos pretos também não');
});

test('o bloco de lã da receita é um item de verdade e sai do fardo na bancada', () => {
    for (const bed of BED_VARIANTS) {
        const bloco = ITEMS[bed.woolBlock];
        assert.ok(bloco, `falta o item do bloco de lã ${bed.label}`);
        assert.equal(BLOCKS[bed.woolBlock]?.drop, bed.woolBlock, 'quebrar o bloco tem de devolver o bloco');
        assert.match(bloco.name, /lã/i, 'o nome do bloco tem de dizer que é lã');
        // Quem colhe o bloco? O fardo, na bancada 2×2 — o caminho até a cama não
        // pode ficar fechado.
        const fardos = new Inventory(9);
        for (const index of [0, 1, 3, 4]) fardos.slots[index] = { id: ID['WOOL_' + bed.color.toUpperCase()], count: 1 };
        assert.deepEqual(matchRecipe(fardos, 3), { id: bed.woolBlock, count: 1 },
            `4 fardos ${bed.label} não viraram bloco`);
    }
});

test('a cama soa como lã (passo, quebra e colocação)', () => {
    assert.equal(blockMaterialFor(ID.BED_HEAD), 'wool');
    assert.equal(blockMaterialFor(ID.BED_FOOT), 'wool');
});

test('o ícone da cama é 32×32, com colchão e travesseiro', () => {
    const icone = spriteDaCama();
    assert.equal(icone.length, 32);
    assert.equal(icone[0].length, 32);
    const cores = icone.flat().filter(Boolean);
    assert.ok(cores.length > 200, 'ícone quase vazio');
    // Branco do travesseiro: a cor que faz a peça ser reconhecida na barra.
    assert.ok(cores.some(([r, g, b]) => r > 190 && g > 185 && b > 175), 'sem o branco do travesseiro');
});

test('cada cama tem o ícone do seu colchão, sem mudar a silhueta', () => {
    const media = cor => {
        const px = spriteDaCama(cor).flat().filter(Boolean);
        const soma = px.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
        return soma.map(v => v / px.length);
    };
    const branca = media('white'), cinza = media('gray'), preta = media('black');
    // Da mais clara para a mais escura, com folga de sobra para a trama.
    assert.ok(branca[0] > cinza[0] + 20, `branca ${branca[0]} x cinza ${cinza[0]}`);
    assert.ok(cinza[0] > preta[0] + 20, `cinza ${cinza[0]} x preta ${preta[0]}`);
    // A cor é só tinta: a forma (quantos pixels existem) é a mesma nas três.
    const pintados = cor => spriteDaCama(cor).flat().filter(Boolean).length;
    assert.equal(pintados('white'), pintados('gray'));
    assert.equal(pintados('white'), pintados('black'));
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
