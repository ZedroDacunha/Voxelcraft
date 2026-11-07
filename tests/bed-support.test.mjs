// A CAMA NÃO FICA NO AR — e o renascimento não sobrevive a ela.
//
// Duas regras, as duas do mundo (não do modelo):
//
// 1. **Apoio**: cama precisa de chão sólido embaixo. Cavar o chão derruba a
//    cama — as duas metades somem e cai uma cama no chão, como areia desce.
//    Antes disso ela ficava flutuando, e dava para dormir no ar.
// 2. **Renascimento**: se a cama era o ponto de renascimento, o ponto se perde
//    junto. O caso que passava batido era a **ordem**: a célula salva é sempre a
//    dos pés, então quebrar a cabeceira derrubava os pés (a célula salva) antes
//    da conferência — a cama desaparecia e o renascimento continuava apontando
//    para ela, calado.
//
// A regra do apoio é pura e mora em `world-bed.js`; a ordem da conferência mora
// no `game.js` e é cobrada aqui lendo o fonte, como o resto do projeto faz com o
// que só roda no navegador.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BLOCKS, ID } from '../world-catalog.js';
import { bedCellsFrom, bedHoldsCell, supportsBed } from '../world-bed.js';

const jogo = readFileSync(new URL('../game.js', import.meta.url), 'utf8');

test('supportsBed: chão sólido segura a cama', () => {
    for (const bloco of [ID.GRASS, ID.DIRT, ID.STONE, ID.COBBLE, ID.PLANKS, ID.LOG, ID.SAND]) {
        assert.equal(supportsBed(bloco), true, BLOCKS[bloco]?.name);
    }
});

test('supportsBed: ar, água e tocha não seguram nada', () => {
    assert.equal(supportsBed(0), false, 'ar');
    assert.equal(supportsBed(ID.WATER), false, 'água');
    assert.equal(supportsBed(ID.TORCH), false, 'tocha');
});

test('supportsBed: cama em cima de cama conta como apoio', () => {
    assert.equal(BLOCKS[ID.BED_FOOT]?.solid, true);
    assert.equal(supportsBed(ID.BED_FOOT), true);
    assert.equal(supportsBed(ID.BED_HEAD_BLACK), true);
});

test('bedCellsFrom: as duas metades, partindo dos pés ou da cabeceira', () => {
    // Cama virada para o sul: a cabeceira fica em z + 1.
    const dosPes = bedCellsFrom(10, 20, 'foot', 'south');
    const daCabeca = bedCellsFrom(10, 21, 'head', 'south');
    assert.deepEqual(dosPes.foot, { x: 10, z: 20 });
    assert.deepEqual(dosPes.head, { x: 10, z: 21 });
    assert.deepEqual(daCabeca.foot, { x: 10, z: 20 });
    assert.deepEqual(daCabeca.head, { x: 10, z: 21 });
    // As duas partidas têm de dar o **mesmo par**: é o que faz a conferência do
    // renascimento valer quebrando qualquer uma das metades.
    assert.deepEqual(dosPes, daCabeca);
});

test('bedCellsFrom: as quatro direções', () => {
    const esperado = {
        south: { foot: { x: 0, z: 0 }, head: { x: 0, z: 1 } },
        north: { foot: { x: 0, z: 0 }, head: { x: 0, z: -1 } },
        east: { foot: { x: 0, z: 0 }, head: { x: 1, z: 0 } },
        west: { foot: { x: 0, z: 0 }, head: { x: -1, z: 0 } },
    };
    for (const [facing, par] of Object.entries(esperado)) {
        assert.deepEqual(bedCellsFrom(0, 0, 'foot', facing), par, facing);
    }
});

test('bedHoldsCell: o renascimento é da cama inteira, não de uma metade', () => {
    const cells = [{ x: 4, y: 5, z: 6 }, { x: 4, y: 5, z: 7 }];
    assert.equal(bedHoldsCell(cells, { x: 4, y: 5, z: 6 }), true, 'pés');
    assert.equal(bedHoldsCell(cells, { x: 4, y: 5, z: 7 }), true, 'cabeceira');
    assert.equal(bedHoldsCell(cells, { x: 5, y: 5, z: 6 }), false, 'outra cama');
    assert.equal(bedHoldsCell(cells, { x: 4, y: 4, z: 6 }), false, 'outro andar');
    assert.equal(bedHoldsCell(cells, null), false, 'sem cama salva');
});

test('o mesher avisa quando a cama perde o chão', () => {
    // Aviso sai do `setBlock`, que é por onde passam todas as remoções: quebra do
    // jogador, areia caindo e água levando o bloco.
    assert.match(jogo, /this\.unsupportedBeds = \[\];/);
    assert.match(jogo, /if \(isBedBlock\(acima\)\) this\.unsupportedBeds\.push\(\{ x, y: y \+ 1, z, type: acima \}\);/);
    assert.match(jogo, /takeUnsupportedBeds\(\) \{/);
});

test('o laço do jogo drena as camas sem apoio', () => {
    assert.match(jogo, /const camasSemApoio = world\.takeUnsupportedBeds\(\);/);
    assert.match(jogo, /if \(camasSemApoio\) for \(const perdida of camasSemApoio\) dropBedWhenUnsupported\(perdida\);/);
    assert.match(jogo, /function dropBedWhenUnsupported\(cell\)/);
});

test('a cama que desaba some inteira, cai o item e perde o renascimento', () => {
    const inicio = jogo.indexOf('function dropBedWhenUnsupported(cell)');
    assert.notEqual(inicio, -1);
    const corpo = jogo.slice(inicio, jogo.indexOf('\nfunction ', inicio + 10));
    assert.match(corpo, /if \(supportsBed\(world\.getBlock\(cell\.x, cell\.y - 1, cell\.z\)\)\) return;/,
        'com chão de novo, a cama fica: quem manda é o mundo, não o evento');
    assert.match(corpo, /const halves = bedPair\(/, 'tem de pegar as duas metades');
    assert.match(corpo, /for \(const metade of halves\) \{/, 'tem de limpar as duas células');
    assert.match(corpo, /world\.setBlock\(metade\.x, metade\.y, metade\.z, 0\);/);
    assert.match(corpo, /spawnItemEntity\(drop, 1,/, 'tem de soltar uma cama');
    assert.match(corpo, /if \(eraSpawn\) \{/, 'tem de conferir o renascimento');
    assert.match(corpo, /clearBedSpawn\(\);/);
    assert.match(corpo, /showToast\('Sua cama desabou/, 'o jogador tem de ser avisado');
});

test('a quebra confere o renascimento ANTES de derrubar a outra metade', () => {
    const inicio = jogo.indexOf('function breakBlock(x, y, z)');
    const corpo = jogo.slice(inicio, jogo.indexOf('\nfunction ', inicio + 10));
    const confere = corpo.indexOf('const eraSpawn = bedHoldsSpawn(bedHalves);');
    const derruba = corpo.indexOf('for (const metade of bedHalves) {');
    assert.notEqual(confere, -1, 'breakBlock tem de conferir se a cama guardava o renascimento');
    assert.notEqual(derruba, -1);
    assert.ok(confere < derruba,
        'conferir depois de derrubar a outra metade é o bug: a célula salva (os pés) já não é mais cama');
    // A regra antiga, que olhava o mundo depois de mexer nele, não pode voltar.
    assert.equal(/bedSpawnStanding\(\) && \(x === bedSpawn\.x/m.test(jogo), false);
});

test('a colocação da cama usa a mesma regra de apoio', () => {
    const inicio = jogo.indexOf('function bedCellFree(x, y, z)');
    const corpo = jogo.slice(inicio, jogo.indexOf('\n}', inicio));
    assert.match(corpo, /return supportsBed\(world\.getBlock\(x, y - 1, z\)\);/);
});

test('o `bedSpawnStanding` continua guardando o carregamento e o respawn', () => {
    // A conferência da quebra não olha mais o mundo, mas a cama salva ainda tem
    // de ser validada ao carregar e na hora de renascer.
    assert.match(jogo, /function bedSpawnStanding\(\) \{\n    return bedSpawn\.valid && isBedBlock\(world\.getBlock\(bedSpawn\.x, bedSpawn\.y, bedSpawn\.z\)\);/);
    assert.match(jogo, /if \(bedSpawnStanding\(\)\) \{/);
    assert.match(jogo, /if \(save\?\.bedSpawn && isBedBlock\(world\.getBlock\(save\.bedSpawn\.x, save\.bedSpawn\.y, save\.bedSpawn\.z\)\)\) \{/);
});
