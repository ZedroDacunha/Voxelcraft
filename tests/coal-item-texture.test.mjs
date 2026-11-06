import test from 'node:test';
import assert from 'node:assert/strict';

// ---- canvas de mentira: só grava o que o atlas manda desenhar
const fillRects = [];

function createFakeContext() {
    return {
        imageSmoothingEnabled: true,
        fillStyle: '#000',
        fillRect(x, y, w, h) { fillRects.push({ x, y, w, h, fill: this.fillStyle }); },
        drawImage() {},
        getImageData() { return { data: new Uint8ClampedArray(4) }; },
    };
}

globalThis.document = {
    createElement() {
        return { width: 0, height: 0, getContext: () => createFakeContext() };
    },
};

const THREE = {
    CanvasTexture: class { constructor(image) { this.image = image; } },
    NearestFilter: 1006,
    ClampToEdgeWrapping: 1001,
    SRGBColorSpace: 'srgb',
};

const { ID, ITEMS, atlasTileRect } = await import('../world-catalog.js');
const {
    createCoalItemSpritePixels, coalItemMaskFor, createMineralSpritePixels,
} = await import('../world-mineral-textures.js');
const { createTextureTools } = await import('../world-textures.js');

// As cores que a arte usa. Estão escritas aqui de propósito: o teste é a
// especificação da arte, não um espelho do código.
// Todas as cores são múltiplas de 8: é assim que a arte dos tiles sai na folha,
// e a arte que o jogador aprovou no comparador foi mostrada nesse mesmo passo.
const PALETAS = {
    mineral: [[16, 16, 24], [40, 40, 48], [56, 56, 64], [96, 96, 112]],
    vegetal: [[24, 24, 16], [56, 48, 40], [72, 56, 48], [104, 88, 72]],
};

const chave = cor => cor.join(',');
const pintados = px => px.flat().filter(Boolean);
const cores = px => new Set(pintados(px).map(chave));
const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const toRgb = cor => `rgb(${cor[0]},${cor[1]},${cor[2]})`;

test('as máscaras do item são 16×16, só com "#" e ".", e diferentes entre si', () => {
    for (const camada of ['mineral', 'vegetal']) {
        const mascara = coalItemMaskFor(camada);
        assert.equal(mascara.length, 16, `${camada}: precisa de 16 linhas`);
        for (const linha of mascara) {
            assert.equal(linha.length, 16, `${camada}: linha com ${linha.length} colunas`);
            assert.match(linha, /^[#.]+$/, `${camada}: caractere fora de # e .`);
        }
        assert.ok(mascara.join('').includes('#'), `${camada}: máscara vazia`);
    }
    assert.notEqual(coalItemMaskFor('mineral').join(''), coalItemMaskFor('vegetal').join(''));
    assert.equal(coalItemMaskFor('outro'), null);
});

test('o sprite do item é 16×16 e só usa as quatro cores da paleta', () => {
    for (const camada of ['mineral', 'vegetal']) {
        const px = createCoalItemSpritePixels(camada);
        assert.equal(px.length, 16);
        for (const linha of px) assert.equal(linha.length, 16);
        for (const cor of cores(px)) {
            assert.ok(PALETAS[camada].map(chave).includes(cor), `${camada}: cor fora da paleta: ${cor}`);
        }
        assert.equal(cores(px).size, 4, `${camada}: a arte precisa das quatro cores (relevo + corpo)`);
    }
});

test('o pedaço é a máscara: nenhum pixel pintado fora dela', () => {
    for (const camada of ['mineral', 'vegetal']) {
        const mascara = coalItemMaskFor(camada);
        const px = createCoalItemSpritePixels(camada);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const dentro = mascara[y][x] === '#';
            assert.equal(Boolean(px[y][x]), dentro, `${camada}: (${x},${y}) fora da máscara`);
        }
    }
});

test('a arte ocupa o ícone mas deixa respiro nas bordas', () => {
    // Se encostar na borda o ícone cola no vizinho na barra; se sobrar demais
    // ele fica pequeno. A faixa aceita as duas formas (três pedaços / três gravetos).
    for (const camada of ['mineral', 'vegetal']) {
        const px = createCoalItemSpritePixels(camada);
        const total = pintados(px).length;
        const fracao = total / 256;
        assert.ok(fracao > 0.15 && fracao < 0.45, `${camada}: cobertura ${fracao.toFixed(2)} fora de 0,15–0,45`);
        for (let i = 0; i < 16; i++) {
            assert.ok(!px[0][i], `${camada}: pixel na primeira linha`);
            assert.ok(!px[15][i], `${camada}: pixel na última linha`);
            assert.ok(!px[i][0], `${camada}: pixel na primeira coluna`);
        }
    }
});

test('mineral e vegetal não se confundem: cor fria contra cor quente', () => {
    const media = (px, canal) => {
        const lista = pintados(px);
        return lista.reduce((soma, cor) => soma + cor[canal], 0) / lista.length;
    };
    const mineral = createCoalItemSpritePixels('mineral');
    const vegetal = createCoalItemSpritePixels('vegetal');

    // O mineral puxa para o azul (pedra), o vegetal para o vermelho (madeira queimada).
    assert.ok(media(mineral, 2) - media(mineral, 0) > 3, 'mineral devia ser frio (azul > vermelho)');
    assert.ok(media(vegetal, 0) - media(vegetal, 2) > 3, 'vegetal devia ser quente (vermelho > azul)');

    // E a forma também muda: um é punhado gordo de pedra, o outro são gravetos.
    assert.ok(pintados(mineral).length > pintados(vegetal).length + 15, 'o mineral devia ser mais gordo que os gravetos');
    assert.notEqual(mineral.join('|'), vegetal.join('|'));
});

test('o vegetal tem grão de madeira queimada e o mineral não', () => {
    // Grão = pixel escuro no **meio** do pedaço (não na beirada de baixo/direita,
    // que já é escura pelo relevo). É o que dá o risco de madeira no vegetal.
    const escuroNoMeio = (camada) => {
        const px = createCoalItemSpritePixels(camada);
        const escuro = chave(PALETAS[camada][0]);
        let total = 0;
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            if (!px[y][x] || chave(px[y][x]) !== escuro) continue;
            const direita = px[y][x + 1], baixo = px[y + 1]?.[x];
            if (direita && baixo) total++;
        }
        return total;
    };
    assert.ok(escuroNoMeio('vegetal') >= 3, 'o vegetal devia ter grão');
    assert.equal(escuroNoMeio('mineral'), 0, 'o mineral não tem grão');
});

test('a arte é determinística e fica na faixa 0–255', () => {
    for (const camada of ['mineral', 'vegetal']) {
        const primeira = createCoalItemSpritePixels(camada);
        assert.ok(iguais(primeira, createCoalItemSpritePixels(camada)), `${camada}: mudou entre chamadas`);
        for (const cor of pintados(primeira)) {
            assert.equal(cor.length, 3);
            for (const canal of cor) {
                assert.ok(Number.isInteger(canal), `${camada}: canal não inteiro: ${canal}`);
                assert.ok(canal >= 0 && canal <= 255, `${camada}: canal fora da faixa: ${canal}`);
            }
        }
    }
    assert.equal(createCoalItemSpritePixels('outro'), null);
});

test('o carvão mineral usa a arte nova sem sair do caminho dos minérios', () => {
    // Quem pinta o item de minério pede `createMineralSpritePixels('coal', 'coal')`;
    // a arte do carvão tem de ser a mesma que o comparador mostrou.
    assert.ok(iguais(createMineralSpritePixels('coal', 'coal'), createCoalItemSpritePixels('mineral')));
});

test('o atlas desenha os dois carvões, um quente e outro frio', () => {
    createTextureTools(THREE).createAtlasTexture();
    assert.ok(fillRects.length > 0, 'o atlas não desenhou nada');

    const cell = (id) => {
        const rect = atlasTileRect(ITEMS[id].iconTile);
        const dentro = fillRects.filter(d => d.x >= rect.x && d.x < rect.x + rect.size
            && d.y >= rect.y && d.y < rect.y + rect.size);
        return new Set(dentro.map(d => d.fill));
    };
    const carvaoMineral = cell(ID.COAL);
    const carvaoVegetal = cell(ID.CHARCOAL);

    const esperado = camada => new Set(PALETAS[camada].map(toRgb));
    assert.deepEqual([...carvaoMineral].sort(), [...esperado('mineral')].sort());
    assert.deepEqual([...carvaoVegetal].sort(), [...esperado('vegetal')].sort());

    const canais = (fill) => fill.match(/\d+/g).map(Number);
    for (const fill of carvaoVegetal) {
        const [r, , b] = canais(fill);
        assert.ok(r - b >= 8, `vegetal devia ser marrom: ${fill}`);
    }
    for (const fill of carvaoMineral) {
        const [r, , b] = canais(fill);
        assert.ok(b - r >= 3, `mineral devia ser cinza-azulado: ${fill}`);
    }
});
