// As REGRAS DA FAMÍLIA das ferramentas — o que faz a arte ser nossa.
//
// Ficam aqui os testes que valem para as três juntas: o cabo comum, o couro da
// pá, o acento da casa, o contorno tingido e o quanto cada silhueta se afasta da
// clássica (a pá de propósito, bem pouco; tesoura, picareta e machado já
// receberam a passada autoral). As regras por ferramenta estão em
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

test('nenhuma ferramenta tem faixa de couro', () => {
    // As três voltaram à base fiel com o cabo liso: o couro do #122 saiu do
    // machado, depois da picareta, e por último da pá.
    for (const f of TRES) {
        assert.ok(!simbolosDe(f.grade).includes('g'), `${f.nome}: sem couro`);
        assert.ok(!simbolosDe(f.grade).includes('s'), `${f.nome}: sem costura`);
    }
});

test('as ferramentas não têm acento', () => {
    // O pixel de acento (amarelo-cítrico, depois palha) saiu de todas em
    // 07/11/2026: a leitura ficou mais limpa sem ele.
    for (const f of TRES) {
        assert.ok(!f.grade.join('').includes('5'), `${f.nome}: sem acento`);
        const px = f.criar('stone');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            if (!px[y][x]) continue;
            assert.notDeepEqual(px[y][x], [234, 214, 158], `${f.nome}: (${x},${y}) não é o amarelo-palha`);
            assert.notDeepEqual(px[y][x], [253, 240, 168], `${f.nome}: (${x},${y}) não é o cítrico`);
        }
    }
});

test('as cores da família são exatamente estas', () => {
    // Se alguém mexer nas constantes, o teste avisa: são a identidade das peças.
    assert.deepEqual(Object.fromEntries(Object.entries(CABO_PALETA).map(([k, v]) => [k, hex(v)])),
        { a: '563e22', b: '7b5b33', c: '977443', d: 'caa66a' }, 'tons do cabo');
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
    // Picareta e machado já passaram pela passada autoral (07/11/2026): a
    // picareta perdeu a fileira de fundo da cabeça e ganhou bico na ponta; o
    // machado ficou com o fio reto, o contra-fio curto e a barba descendo na
    // direção do cabo. Só a pá ainda é a base fiel com **2 px** de forma.
    const esperado = { picareta: { linhas: 3, px: 66 }, machado: { linhas: 4, px: 64 }, 'pá': { linhas: 2, px: 55 } };
    for (const f of TRES) {
        const nossa = silhueta(f.grade);
        assert.notDeepEqual(nossa, f.classica, `${f.nome}: o perfil não pode ser igual ao clássico`);
        const linhas = linhasDiferentes(nossa, f.classica);
        const alvo = esperado[f.nome];
        assert.equal(linhas, alvo.linhas, `${f.nome}: ${alvo.linhas} linha(s) diferente(s)`);
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

test('o cabo é feito das tábuas do jogo', () => {
    // Decisão de 07/11/2026: o cabo deixa de ter madeira própria e passa a usar
    // os tons do tile PLANKS — a ferramenta na mão é do mesmo material do chão.
    const veio = [123, 91, 51], sombra = [151, 116, 67], claro = [202, 166, 106];
    assert.deepEqual([...CABO_PALETA.b], veio, 'tom b é o veio da tábua');
    assert.deepEqual([...CABO_PALETA.c], sombra, 'tom c é a sombra da tábua');
    assert.deepEqual([...CABO_PALETA.d], claro, 'tom d é o claro da tábua');
    assert.ok(lum(CABO_PALETA.a) < lum(veio), 'o tom a é a sombra do cabo, abaixo do veio');
    assert.ok(CABO_PALETA.a[0] + CABO_PALETA.a[1] + CABO_PALETA.a[2] > 120, 'e o cabo não tem preto puro');
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
