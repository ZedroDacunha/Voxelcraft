// As REGRAS DA FAMÍLIA das ferramentas — o que faz a arte ser nossa.
//
// Ficam aqui os testes que valem para as três juntas: o cabo comum, as faixas de
// o acento da casa, o contorno tingido e o quanto cada silhueta se afasta da
// clássica (a picareta de propósito, bem pouco). As regras por ferramenta estão em
// `tool-art.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PICARETA_GRADE,
    MACHADO_GRADE,
    PA_GRADE,
    PICARETA_PALETAS,
    MACHADO_PALETAS,
    PA_PALETAS,
    CABO_PALETA,
    PUNHO_PALETA,
    ACENTO,
    createPickaxeSpritePixels,
    createAxeSpritePixels,
    createShovelSpritePixels,
} from '../world-tool-textures.js';
import { silhueta, cheios, simbolosDe, lum, hex, SILHUETA_CLASSICA, linhasDiferentes } from './tool-art.mjs';

const MATERIAIS = ['wood', 'stone', 'copper', 'iron', 'gold', 'diamond'];
const TRES = [
    { nome: 'picareta', grade: PICARETA_GRADE, criar: createPickaxeSpritePixels, classica: SILHUETA_CLASSICA.picareta },
    { nome: 'machado', grade: MACHADO_GRADE, criar: createAxeSpritePixels, classica: SILHUETA_CLASSICA.machado },
    { nome: 'pá', grade: PA_GRADE, criar: createShovelSpritePixels, classica: SILHUETA_CLASSICA.pa },
];

test('o cabo de madeira é o mesmo nas três ferramentas', () => {
    for (const f of TRES) {
        for (const mat of MATERIAIS) {
            const px = f.criar(mat);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const s = f.grade[y][x];
                if (!'abcd'.includes(s)) continue;
                assert.deepEqual(px[y][x], [...CABO_PALETA[s]], `${f.nome}/${mat}: cabo "${s}" em (${x},${y})`);
            }
        }
    }
});

test('machado e pá têm faixa de couro costurada, e a costura é sempre a mesma cor', () => {
    // A picareta ficou sem couro: a decisão foi "cor + forma".
    assert.ok(!simbolosDe(PICARETA_GRADE).includes('g'), 'a picareta não tem faixa de couro');
    for (const f of TRES.filter((t) => t.nome !== 'picareta')) {
        assert.ok(simbolosDe(f.grade).includes('g'), `${f.nome}: tem couro`);
        assert.ok(simbolosDe(f.grade).includes('s'), `${f.nome}: tem costura`);
        const px = f.criar('iron');
        let costuras = 0;
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const s = f.grade[y][x];
            if (s === 's') { costuras++; assert.deepEqual(px[y][x], [...PUNHO_PALETA.s], `${f.nome}: costura em (${x},${y})`); }
            if (s === 'g') assert.deepEqual(px[y][x], [...PUNHO_PALETA.g], `${f.nome}: couro em (${x},${y})`);
        }
        assert.ok(costuras >= 1, `${f.nome}: pelo menos um ponto de costura`);
        // O couro fica sempre na metade de baixo, onde a mão pega.
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            if ('gs'.includes(f.grade[y][x])) assert.ok(y >= 7, `${f.nome}: couro em (${x},${y}) está alto demais`);
        }
    }
});

test('o acento da casa aparece nas três e é o mesmo amarelo-cítrico', () => {
    for (const f of TRES) {
        const px = f.criar('stone');
        let acentos = 0;
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            if (f.grade[y][x] !== '5') continue;
            acentos++;
            assert.deepEqual(px[y][x], [...ACENTO], `${f.nome}: acento em (${x},${y})`);
        }
        assert.ok(acentos >= 1, `${f.nome}: tem acento`);
        assert.ok(acentos <= 2, `${f.nome}: acento é detalhe, não mancha (${acentos} px)`);
    }
    assert.deepEqual([...ACENTO], [234, 214, 158], 'o amarelo-palha da casa');
});

test('as cores da família são exatamente estas', () => {
    // Se alguém mexer nas constantes, o teste avisa: são a identidade das peças.
    assert.deepEqual(Object.fromEntries(Object.entries(CABO_PALETA).map(([k, v]) => [k, hex(v)])),
        { a: '3a2a12', b: '6b4c1e', c: '9a7130', d: 'c39148' }, 'tons do cabo');
    assert.deepEqual(Object.fromEntries(Object.entries(PUNHO_PALETA).map(([k, v]) => [k, hex(v)])),
        { g: '4a3524', s: 'be9660' }, 'couro e costura');
    assert.equal(hex(ACENTO), 'ead69e', 'acento');
});

test('o contorno é tingido — nunca preto puro, e muda com o material', () => {
    const vistos = new Set();
    for (const mat of MATERIAIS) {
        const o = PICARETA_PALETAS[mat].O;
        assert.ok(o[0] + o[1] + o[2] > 60, `${mat}: o contorno não é preto puro`);
        vistos.add(hex(o));
    }
    assert.equal(vistos.size, MATERIAIS.length, 'cada material tem o seu contorno');
    // O contorno é a cor mais escura da paleta.
    for (const mat of MATERIAIS) {
        const p = PICARETA_PALETAS[mat];
        for (const s of ['1', '2', '3', '4']) assert.ok(lum(p.O) < lum(p[s]), `${mat}: contorno abaixo do tom ${s}`);
    }
});

test('cada silhueta se afasta da clássica na medida combinada', () => {
    // A picareta é a base fiel com **2 px** de forma (decisão de 07/11/2026);
    // machado e pá são desenho livre e se afastam bastante.
    const esperado = { picareta: { linhas: 2, px: 70 }, machado: { min: 8 }, 'pá': { min: 8 } };
    for (const f of TRES) {
        const nossa = silhueta(f.grade);
        assert.notDeepEqual(nossa, f.classica, `${f.nome}: o perfil não pode ser igual ao clássico`);
        const linhas = linhasDiferentes(nossa, f.classica);
        const alvo = esperado[f.nome];
        if (alvo.linhas !== undefined) assert.equal(linhas, alvo.linhas, `${f.nome}: ${alvo.linhas} linha(s) diferente(s)`);
        else assert.ok(linhas >= alvo.min, `${f.nome}: pelo menos ${alvo.min} linhas diferentes (foram ${linhas})`);
        if (alvo.px !== undefined) assert.equal(cheios(f.grade), alvo.px, `${f.nome}: ${alvo.px} px`);
    }
});

test('nos metais o desvio de cor é o mais visível', () => {
    // A paleta é suave, mas nos metais o matiz sai do lugar de propósito:
    // ferro puxa azul, ouro puxa laranja, diamante puxa azul-esverdeado.
    const classico = {
        iron: [[68, 68, 68], [193, 193, 193], [216, 216, 216], [255, 255, 255]],
        gold: [[130, 93, 22], [233, 177, 21], [234, 238, 87], [253, 255, 118]],
        diamond: [[14, 63, 54], [39, 178, 154], [43, 199, 172], [51, 235, 203]],
        stone: [[73, 73, 73], [127, 127, 127], [137, 137, 137], [154, 154, 154]],
    };
    const media = (cores, f) => cores.reduce((s, c) => s + f(c), 0) / cores.length;
    const nossos = (mat) => ['1', '2', '3', '4'].map((k) => PICARETA_PALETAS[mat][k]);

    // ferro: azulado em **todos** os tons (o clássico é cinza puro)
    for (const c of nossos('iron')) assert.ok(c[2] - c[0] >= 8, `ferro azulado (${c.join(',')})`);
    assert.ok(media(nossos('iron'), (c) => c[2] - c[0]) - media(classico.iron, (c) => c[2] - c[0]) >= 8,
        'ferro mais azul que o clássico');
    // ouro: mais quente (r - b)
    assert.ok(media(nossos('gold'), (c) => c[0] - c[2]) - media(classico.gold, (c) => c[0] - c[2]) >= 8,
        'ouro mais quente');
    // diamante: mais azulado (b - r)
    assert.ok(media(nossos('diamond'), (c) => c[2] - c[0]) - media(classico.diamond, (c) => c[2] - c[0]) >= 8,
        'diamante mais azulado');
    // pedra: quase neutra nos dois, sem grande desvio
    assert.ok(Math.abs(media(nossos('stone'), (c) => c[0] - c[2]) - media(classico.stone, (c) => c[0] - c[2])) <= 8,
        'pedra continua neutra');
});

test('a picareta de madeira usa as cores da tábua do jogo', () => {
    // As tábuas (TILE.PLANKS, em world-textures.js) vão do veio escuro ao topo claro.
    const tabua = { veio: [123, 91, 51], sombra: [151, 116, 67], meio: [183, 147, 91], claro: [202, 166, 106] };
    const wood = PICARETA_PALETAS.wood;
    const perto = (a, b, tolerancia = 10) => a.every((v, i) => Math.abs(v - b[i]) <= tolerancia);
    assert.ok(perto(wood['1'], tabua.veio), 'tom 1 é o veio da tábua');
    assert.ok(perto(wood['2'], tabua.sombra), 'tom 2 é a sombra da tábua');
    assert.ok(perto(wood['4'], tabua.claro), 'tom 4 é o claro da tábua');
    assert.ok(lum(wood['3']) > lum(tabua.sombra) && lum(wood['3']) < lum(tabua.claro), 'tom 3 fica entre sombra e claro');
    assert.ok(lum(wood.O) < lum(tabua.veio), 'o contorno é mais escuro que o veio');
});

test('as três ferramentas são desenhos diferentes entre si', () => {
    const totais = new Set();
    for (const f of TRES) totais.add(cheios(f.grade));
    assert.equal(totais.size, 3, 'cada uma tem um tamanho de silhueta');
    assert.notDeepEqual(PICARETA_GRADE, MACHADO_GRADE, 'picareta ≠ machado');
    assert.notDeepEqual(MACHADO_GRADE, PA_GRADE, 'machado ≠ pá');
    assert.notDeepEqual(PICARETA_GRADE, PA_GRADE, 'picareta ≠ pá');
    for (const mat of MATERIAIS) {
        assert.notDeepEqual(createPickaxeSpritePixels(mat), createAxeSpritePixels(mat), `${mat}: picareta ≠ machado`);
        assert.notDeepEqual(createAxeSpritePixels(mat), createShovelSpritePixels(mat), `${mat}: machado ≠ pá`);
    }
});

test('a paleta de material é uma só para a família', () => {
    // Machado e pá reaproveitam a paleta da picareta: um material, uma cor.
    assert.equal(MACHADO_PALETAS, PICARETA_PALETAS, 'machado usa a paleta de material da família');
    assert.equal(PA_PALETAS, PICARETA_PALETAS, 'pá usa a paleta de material da família');
});
