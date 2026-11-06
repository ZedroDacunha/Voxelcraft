import test from 'node:test';
import assert from 'node:assert/strict';

const { ID, ITEMS, BLOCKS, TILE, TILE_PX, atlasTileRect } = await import('../world-catalog.js');
const { createBlockIconPixels, BLOCK_ICON_PX } = await import('../world-block-icons.js');

// ---- fonte de pixels falsa: cada tile vira uma cor chapada
const corDoTile = (tile) => [tile * 10, tile * 10, tile * 10, 255];
const pixelFalso = (tile) => corDoTile(tile);
const tilesFalsos = { top: 10, side: 5, front: 8 };

const cubo = createBlockIconPixels(tilesFalsos, pixelFalso);
const brilho = ([r, g, b]) => (r + g + b) / 3;

test('o ícone de bloco é 32×32 e só pinta dentro do cubo', () => {
    assert.equal(BLOCK_ICON_PX, TILE_PX, 'o ícone de bloco tem de caber numa célula do atlas');
    assert.equal(cubo.length, BLOCK_ICON_PX);
    for (const linha of cubo) assert.equal(linha.length, BLOCK_ICON_PX);
    const pintados = cubo.flat().filter(Boolean);
    assert.ok(pintados.length > 500, `cubo pequeno demais: ${pintados.length} px`);
    for (const cor of pintados) {
        assert.equal(cor.length, 3);
        for (const canal of cor) {
            assert.ok(Number.isInteger(canal) && canal >= 0 && canal <= 255, `canal inválido: ${canal}`);
        }
    }
});

test('o cubo tem as três faces: topo claro, esquerda no meio, direita escura', () => {
    // Com a mesma cor em todas as faces, a diferença só pode vir da luz.
    const chapado = createBlockIconPixels({ top: 9, side: 9 }, () => [100, 100, 100, 255]);
    const topo = chapado[4][BLOCK_ICON_PX / 2];
    const esquerda = chapado[22][6];
    const direita = chapado[22][BLOCK_ICON_PX - 7];

    assert.ok(topo && esquerda && direita, 'as três faces precisam estar pintadas');
    assert.equal(brilho(topo), 100, 'o topo recebe luz cheia');
    assert.ok(brilho(esquerda) < brilho(topo), 'a lateral esquerda é mais escura que o topo');
    assert.ok(brilho(direita) < brilho(esquerda), 'a lateral direita é a mais escura');
    // Proporção estável: 1 : 0,68 : 0,42.
    assert.ok(Math.abs(brilho(esquerda) - 68) <= 1, `esquerda em ${brilho(esquerda)}`);
    assert.ok(Math.abs(brilho(direita) - 42) <= 1, `direita em ${brilho(direita)}`);
});

test('cada face amostra o tile certo (e a frente substitui a lateral direita)', () => {
    // Três tons bem distintos, já contando a luz de cada face:
    const comFrente = createBlockIconPixels({ top: 20, side: 10, front: 4 }, pixelFalso);
    assert.equal(brilho(comFrente[4][BLOCK_ICON_PX / 2]), 200, 'o topo vem de tiles.top');
    assert.equal(brilho(comFrente[22][6]), 68, 'a esquerda vem de tiles.side');
    assert.equal(brilho(comFrente[22][BLOCK_ICON_PX - 7]), 17, 'a direita vem de tiles.front');

    // Sem frente (pedra, tábuas...), a direita cai na lateral — mas com a luz da
    // direita, que é a mais escura: 100 × 0,42 = 42.
    const semFrente = createBlockIconPixels({ top: 20, side: 10 }, pixelFalso);
    assert.equal(brilho(semFrente[22][BLOCK_ICON_PX - 7]), 42);
});

test('a silhueta é de cubo: quinas de baixo vazias, base central pintada', () => {
    const N = BLOCK_ICON_PX;
    assert.ok(cubo[0][N / 2 - 1], 'o topo do losango tem de estar pintado');
    assert.ok(cubo[Math.round(N / 2) - 1][0], 'a quina esquerda tem de estar pintada');
    assert.ok(cubo[Math.round(N / 2) - 1][N - 1], 'a quina direita tem de estar pintada');
    assert.ok(cubo[N - 1][N / 2 - 1], 'a base (quina da frente) tem de estar pintada');
    // Fora do cubo (as quinas de baixo, à esquerda e à direita) é transparente:
    // é o que faz o bloco parecer um cubo e não um quadrado.
    assert.equal(cubo[N - 1][0], null);
    assert.equal(cubo[N - 1][N - 1], null);
    assert.equal(cubo[0][0], null);
    assert.equal(cubo[0][N - 1], null);
});

test('o ícone é determinístico', () => {
    const outro = createBlockIconPixels(tilesFalsos, pixelFalso);
    assert.equal(JSON.stringify(outro), JSON.stringify(cubo));
});

// A tocha não é cubo: ela tem arte própria de item (o graveto com a chama).
const SEM_CUBO = new Set([ID.TORCH]);

test('todo bloco coletável tem ícone em 3D com célula própria no atlas', () => {
    const celulas = new Map();
    for (const [id, bloco] of Object.entries(BLOCKS)) {
        if (!bloco.collectible || SEM_CUBO.has(Number(id))) continue;
        const item = ITEMS[id];
        assert.ok(item, `bloco ${bloco.name} sem item`);
        if (item.block !== Number(id)) {
            // O diamante reaproveita o ID do minério (save antigo): ali o item é a
            // gema, não o bloco. É a única exceção.
            assert.equal(Number(id), ID.DIAMOND_ORE, `${bloco.name}: ID de item roubado`);
            continue;
        }
        assert.equal(item.sprite?.kind, 'block', `${bloco.name}: sprite não é de bloco`);
        assert.equal(item.sprite.mat, String(Number(id)));
        assert.ok(item.iconTile >= Object.keys(TILE).length, `${bloco.name}: reaproveitou célula de tile`);
        assert.ok(!celulas.has(item.iconTile), `${bloco.name} divide célula com ${celulas.get(item.iconTile)}`);
        celulas.set(item.iconTile, bloco.name);
    }
    assert.ok(celulas.size >= 15, `poucos blocos com ícone: ${celulas.size}`);
});

// ---- atlas de mentira: só grava os fillRect
const fillRects = [];
const contexto = () => ({
    imageSmoothingEnabled: true,
    fillStyle: '#000',
    fillRect(x, y, w, h) { fillRects.push({ x, y, w, h, fill: this.fillStyle }); },
    drawImage() {},
    getImageData() { return { data: new Uint8ClampedArray(4) }; },
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: contexto }) };
const THREE = {
    CanvasTexture: class { constructor(image) { this.image = image; } },
    NearestFilter: 1006,
    ClampToEdgeWrapping: 1001,
    SRGBColorSpace: 'srgb',
};
const { createTextureTools } = await import('../world-textures.js');
const tools = createTextureTools(THREE);

test('o atlas desenha o cubo 1:1 na célula do bloco', () => {
    tools.createAtlasTexture();
    const rect = atlasTileRect(ITEMS[ID.GRASS].iconTile);
    const dentro = fillRects.filter(d => d.x >= rect.x && d.x < rect.x + rect.size
        && d.y >= rect.y && d.y < rect.y + rect.size);

    assert.ok(dentro.length > 500, `poucos pixels do cubo no atlas: ${dentro.length}`);
    assert.equal(dentro[0].w, 1, 'o ícone de 32 px não é dobrado: entra 1:1');
    const maxX = Math.max(...dentro.map(d => d.x - rect.x));
    const maxY = Math.max(...dentro.map(d => d.y - rect.y));
    assert.ok(maxX >= rect.size - 2 && maxY >= rect.size - 2, 'o cubo não usa a célula inteira');
});

test('a arte do bloco de verdade tem detalhe (não é uma cor chapada)', () => {
    const grama = tools.spritePixels('block', String(ID.GRASS));
    assert.equal(grama.length, BLOCK_ICON_PX);
    const cores = new Set(grama.flat().filter(Boolean).map(c => c.join(',')));
    assert.ok(cores.size > 20, `só ${cores.size} cores na grama: o ícone ficou chapado`);
    // O verde do topo e o marrom da terra dos lados convivem no mesmo ícone.
    const topo = grama[4][BLOCK_ICON_PX / 2];
    const lado = grama[22][6];
    assert.ok(topo[1] > topo[0] + 20, `topo devia ser verde: ${topo}`);
    assert.ok(lado[0] > lado[2] + 10, `lateral devia ser terrosa: ${lado}`);
});
