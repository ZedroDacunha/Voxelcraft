// O ITEM de pá: a arte transcrita do desenho clássico.
//
// Mesma receita da picareta e do machado: um desenho só (16×16) para todos os
// materiais, e uma paleta por material. A pá tem **quatro** tons de lâmina
// (`1`…`4`), como a picareta — um a menos que o machado.
//
// A grade e as paletas foram conferidas contra os sprites originais: cada
// material sai **pixel a pixel** igual.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PA_GRADE,
    CABO_PALETA,
    PA_PALETAS,
    shovelGradeFor,
    shovelPaletteFor,
    createShovelSpritePixels,
    createPickaxeSpritePixels,
    createAxeSpritePixels,
} from '../world-tool-textures.js';

const dentro = (x, y) => (PA_GRADE[y]?.[x] ?? '.') !== '.';
const sprite = (mat) => createShovelSpritePixels(mat);
const cor = (mat, x, y) => sprite(mat)[y][x];
const chave = (c) => c.join(',');

const MATERIAIS = ['wood', 'stone', 'copper', 'iron', 'gold', 'diamond'];
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

const LAMINA = (c) => '1234'.includes(c);
const CABO = (c) => 'abcd'.includes(c);

test('a grade da pá é 16×16, só com os símbolos do desenho', () => {
    assert.equal(PA_GRADE.length, 16, '16 linhas');
    for (const linha of PA_GRADE) {
        assert.equal(linha.length, 16, `linha com 16 colunas: "${linha}"`);
        assert.match(linha, /^[.O1-4a-d]+$/, 'só ".", "O", "1"–"4" e "a"–"d"');
    }
});

test('a silhueta é a da pá clássica: 53 px, lâmina em cima à direita', () => {
    assert.deepEqual(PA_GRADE.map((l) => [...l].filter((c) => c !== '.').length),
        [0, 0, 3, 5, 6, 7, 5, 5, 4, 3, 3, 3, 4, 3, 2, 0],
        'lâmina redonda em cima à direita e cabo descendo à esquerda');

    const cheios = PA_GRADE.join('').split('').filter((c) => c !== '.').length;
    assert.equal(cheios, 53, 'a pá ocupa 53 px');

    // Uma peça só: parte do topo da lâmina e alcança a ponta do cabo.
    const vistos = new Set(['11,2']);
    const pilha = [[11, 2]];
    let tamanho = 0;
    while (pilha.length) {
        const [x, y] = pilha.pop();
        tamanho++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!dentro(nx, ny) || vistos.has(`${nx},${ny}`)) continue;
            vistos.add(`${nx},${ny}`);
            pilha.push([nx, ny]);
        }
    }
    assert.equal(tamanho, 53, 'a pá é uma peça só');
});

test('a arte é 1 px por célula, com fundo transparente', () => {
    for (const mat of MATERIAIS) {
        const px = sprite(mat);
        assert.equal(px.length, 16, `${mat}: 16 linhas`);
        for (let y = 0; y < 16; y++) {
            assert.equal(px[y].length, 16, `${mat}: linha ${y} com 16 px`);
            for (let x = 0; x < 16; x++) {
                if (dentro(x, y)) assert.ok(px[y][x], `${mat}: (${x},${y}) é ferramenta e ficou vazio`);
                else assert.equal(px[y][x], null, `${mat}: (${x},${y}) está fora da pá`);
            }
        }
    }
});

test('cada símbolo tem um tom, e os quatro tons de lâmina aparecem', () => {
    const simbolos = new Set(PA_GRADE.join('').split('').filter((c) => c !== '.'));
    assert.deepEqual([...simbolos].sort(), ['1', '2', '3', '4', 'O', 'a', 'b', 'c', 'd']);

    for (const mat of MATERIAIS) {
        const paleta = { ...CABO_PALETA, ...shovelPaletteFor(mat) };
        for (const s of simbolos) assert.ok(paleta[s], `${mat}: falta o tom de "${s}"`);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const s = PA_GRADE[y][x];
            if (s === '.') continue;
            assert.equal(chave(cor(mat, x, y)), chave(paleta[s]), `${mat}: (${x},${y}) deveria usar "${s}"`);
        }
    }
});

test('a lâmina é o bloco de cima à direita e o cabo é a diagonal até a quina', () => {
    // As quatro primeiras linhas com desenho são só lâmina e contorno.
    for (let y = 2; y <= 5; y++) {
        assert.ok([...PA_GRADE[y]].every((c) => c === '.' || LAMINA(c) || c === 'O'),
            `linha ${y} é só lâmina/contorno`);
    }
    // A lâmina fica toda à direita do desenho (colunas 10–13).
    const colunasLâmina = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (LAMINA(PA_GRADE[y][x])) colunasLâmina.push(x);
    }
    assert.equal(Math.min(...colunasLâmina), 8, 'a lâmina começa na coluna 8');
    assert.equal(Math.max(...colunasLâmina), 13, 'e termina na 13');

    // O cabo desce na diagonal até a quina de baixo à esquerda.
    for (const [x, y] of [[2, 13], [3, 12], [4, 11], [5, 10], [6, 9]]) {
        assert.ok(CABO(PA_GRADE[y][x]), `cabo em (${x},${y})`);
    }
    assert.ok(CABO(PA_GRADE[14][3]) && CABO(PA_GRADE[14][4]), 'a ponta do cabo é a última linha');

    // O reflexo (tom 4) é o arco iluminado da lâmina, no alto à direita.
    const reflexos = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (PA_GRADE[y][x] === '4') reflexos.push([x, y]);
    }
    assert.deepEqual(reflexos, [[11, 3], [12, 3], [10, 4], [13, 4], [9, 5], [13, 5], [12, 6], [11, 7]],
        'oito pixels de reflexo, no arco de cima da lâmina');
    for (const [x, y] of reflexos) assert.ok(x >= 9 && y <= 7, `reflexo (${x},${y}) fica no alto à direita`);
});

test('a ponta do cabo afina e usa o tom mais escuro de madeira', () => {
    // O desenho clássico termina o cabo em duas linhas curtas, com o tom escuro
    // na ponta e o claro encostado na quina.
    assert.equal(PA_GRADE[13], '..bda...........', 'penúltima linha do cabo');
    assert.equal(PA_GRADE[14], '...aa...........', 'a ponta é o tom mais escuro');
    assert.equal(PA_GRADE[15], '................', 'e nada abaixo dela');
});

test('as paletas são as do desenho clássico, ton por tom', () => {
    const hex = (c) => c.map((v) => v.toString(16).padStart(2, '0')).join('');
    const esperado = {
        wood: { O: '20180a', 1: '372910', 2: '6b511f', 3: '755821', 4: '866526' },
        stone: { O: '181818', 1: '494949', 2: '7f7f7f', 3: '898989', 4: '9a9a9a' },
        iron: { O: '181818', 1: '444444', 2: 'c1c1c1', 3: 'd8d8d8', 4: 'ffffff' },
        gold: { O: '3f2e0e', 1: '825d16', 2: 'e9b115', 3: 'eaee57', 4: 'fdff76' },
        diamond: { O: '082520', 1: '0e3f36', 2: '27b29a', 3: '2bc7ac', 4: '33ebcb' },
        // Nosso cobre: derivado do lingote, não existe no desenho clássico.
        copper: { O: '3a1c14', 1: '4e261a', 2: 'aa5a38', 3: 'c6764c', 4: 'e8a474' },
    };
    for (const mat of MATERIAIS) {
        const paleta = shovelPaletteFor(mat);
        assert.deepEqual(Object.keys(paleta).sort(), ['1', '2', '3', '4', 'O'], `${mat}: contorno + 4 tons`);
        for (const [s, valor] of Object.entries(esperado[mat])) {
            assert.equal(hex(paleta[s]), valor, `${mat}: tom "${s}"`);
        }
    }
});

test('cada material tem a sua paleta, com os tons crescendo do escuro ao claro', () => {
    const vistas = new Set();
    for (const mat of MATERIAIS) {
        const paleta = shovelPaletteFor(mat);
        assert.ok(paleta, `${mat} tem paleta`);
        for (let n = 1; n < 4; n++) {
            assert.ok(lum(paleta[String(n)]) < lum(paleta[String(n + 1)]),
                `${mat}: tom ${n} mais escuro que ${n + 1}`);
        }
        assert.ok(lum(paleta.O) < lum(paleta['1']), `${mat}: o contorno é o mais escuro`);
        vistas.add(chave(paleta['4']));
    }
    assert.equal(vistas.size, MATERIAIS.length, 'nenhum material repete a cor mais clara de outro');
});

test('os materiais se distinguem pela cor da lâmina', () => {
    const lamina = (mat) => {
        const px = sprite(mat);
        const caixa = [[], [], []];
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            if (!('O1234'.includes(PA_GRADE[y][x]))) continue;
            for (let i = 0; i < 3; i++) caixa[i].push(px[y][x][i]);
        }
        return caixa.map((a) => a.reduce((s, v) => s + v, 0) / a.length);
    };
    const m = Object.fromEntries(MATERIAIS.map((mat) => [mat, lamina(mat)]));
    assert.ok(m.wood[0] - m.wood[2] > 30, 'madeira é marrom');
    assert.ok(Math.abs(m.stone[0] - m.stone[2]) < 4, 'pedra é cinza');
    assert.ok(m.copper[0] - m.copper[2] > 50, 'cobre é quente');
    assert.ok(Math.abs(m.iron[0] - m.iron[2]) < 4 && m.iron[0] > 90, 'ferro é claro e neutro');
    assert.ok(m.gold[1] - m.gold[2] > 70, 'ouro é amarelo');
    assert.ok(m.diamond[2] - m.diamond[0] > 60, 'diamante é ciano');

    for (let i = 0; i < MATERIAIS.length; i++) for (let j = i + 1; j < MATERIAIS.length; j++) {
        assert.notDeepEqual(sprite(MATERIAIS[i]), sprite(MATERIAIS[j]),
            `${MATERIAIS[i]} e ${MATERIAIS[j]} não podem ser iguais`);
    }
});

test('o cabo de madeira é o mesmo das outras ferramentas', () => {
    for (const mat of MATERIAIS) {
        const px = sprite(mat);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const s = PA_GRADE[y][x];
            if (!CABO(s)) continue;
            assert.equal(chave(px[y][x]), chave(CABO_PALETA[s]), `${mat}: cabo "${s}" em (${x},${y})`);
        }
    }
});

test('pá, picareta e machado são desenhos diferentes, do mesmo material', () => {
    const cheios = (px) => px.flat().filter(Boolean).length;
    for (const mat of MATERIAIS) {
        assert.notDeepEqual(shovelGradeFor(mat), null, `${mat} tem pá`);
        assert.equal(shovelGradeFor(mat), PA_GRADE, 'a grade é a mesma para todos os materiais');
        const picareta = createPickaxeSpritePixels(mat);
        const machado = createAxeSpritePixels(mat);
        assert.notDeepEqual(sprite(mat), picareta, `${mat}: pá ≠ picareta`);
        assert.notDeepEqual(sprite(mat), machado, `${mat}: pá ≠ machado`);
        assert.equal(cheios(sprite(mat)), 53, 'a pá é a mais enxuta');
        assert.equal(cheios(picareta), 68, 'a picareta continua com 68 px');
        assert.equal(cheios(machado), 60, 'e o machado com 60 px');
    }
    // A pá tem quatro tons de lâmina (o machado tem cinco; a picareta, quatro).
    const tons = (paleta) => Object.keys(paleta).filter((k) => /^[1-9]$/.test(k)).length;
    assert.deepEqual(Object.keys(PA_PALETAS.iron).sort(), ['1', '2', '3', '4', 'O']);
    assert.equal(tons(PA_PALETAS.iron), 4);
});

test('material fora da arte devolve null, para quem chama cair no desenho antigo', () => {
    assert.equal(createShovelSpritePixels('tin'), null);
    assert.equal(shovelGradeFor('tin'), null);
    assert.equal(shovelPaletteFor('tin'), null);
    for (const mat of MATERIAIS) assert.ok(shovelGradeFor(mat), `${mat} tem arte`);
});

test('a arte é determinística e não sai da faixa 0–255', () => {
    for (const mat of MATERIAIS) {
        assert.deepEqual(createShovelSpritePixels(mat), sprite(mat), `${mat}: duas chamadas dão a mesma arte`);
        for (const linha of sprite(mat)) for (const c of linha) {
            if (!c) continue;
            assert.equal(c.length, 3, 'cor é [r,g,b]');
            for (const canal of c) assert.ok(canal >= 0 && canal <= 255, `canal ${canal}`);
        }
    }
    const a = sprite('iron');
    a[1][11] = [1, 2, 3];
    assert.notDeepEqual(sprite('iron')[1][11], [1, 2, 3], 'a arte não é compartilhada entre chamadas');
});
