// Revisão dos ícones do PWA: não basta existir um PNG com o tamanho certo.
//
// Cada tela recorta e pinta de um jeito diferente, e errar isso só aparece no
// aparelho do jogador — ícone cortado no Android, quadrado preto no iPhone,
// borrão na aba do navegador. Os testes abaixo olham os pixels de verdade:
//
// - **maskable**: o Android recorta o ícone num círculo de 80%; fora dele não
//   pode haver nada além do fundo (senão o bloco aparece fatiado);
// - **iOS**: `apple-touch-icon` com transparência vira **preto** na tela de
//   início — o arquivo tem que ser opaco;
// - **favicon**: em 16 px textura fina vira sujeira, então ele é chapado;
// - e todos precisam mostrar um bloco de grama (verde em cima, terra embaixo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { ICON_TARGETS, renderIcon } from '../tools/make-icons.mjs';
import { decodePng, distinctColors } from './helpers/png.mjs';

const ROOT = new URL('..', import.meta.url);
const read = (file) => readFileSync(new URL(file, ROOT));
const manifest = JSON.parse(read('manifest.webmanifest').toString('utf8'));
const html = read('index.html').toString('utf8');
const iconFiles = readdirSync(new URL('icons/', ROOT)).sort();
const decode = (file) => decodePng(read(file.startsWith('icons/') ? file : `icons/${file}`));

// Raios relativos ao lado do ícone.
const SAFE_CIRCLE = 0.4;      // maskable: 80% de diâmetro
const IOS_ROUNDED = 0.48;     // canto arredondado do iOS: ~90% do quadro

const isSky = ([r, , b]) => b > r + 20;
const isGreen = ([r, g, b]) => g > r + 15 && g > b + 15;
const isBrown = ([r, g, b]) => r > g && g > b && r > 60;

function share(image, test) {
    let count = 0;
    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            if (test(image.pixel(x, y))) count++;
        }
    }
    return count / (image.width * image.height);
}

test('a pasta icons/ tem exatamente os ícones que o gerador escreve', () => {
    assert.deepEqual(iconFiles, ICON_TARGETS.map(target => target.file).sort(),
        'rode `node tools/make-icons.mjs` (e não edite PNG à mão)');
});

test('cada ícone do manifest existe, é PNG e tem o tamanho anunciado', () => {
    for (const icon of manifest.icons) {
        const file = icon.src.replace(/^\.\//, '');
        const image = decode(file);
        const [width, height] = icon.sizes.split('x').map(Number);
        assert.equal(image.width, width, `${file}: largura`);
        assert.equal(image.height, height, `${file}: altura`);
        assert.equal(icon.type, 'image/png');
    }
    const purposes = manifest.icons.map(icon => icon.purpose);
    assert.ok(purposes.includes('any') && purposes.includes('maskable'), 'tem os dois tipos');
});

test('o ícone maskable não tem nada fora do círculo seguro do Android', () => {
    const image = decode('icon-maskable-512.png');
    const center = image.width / 2;
    const limit = image.width * SAFE_CIRCLE;
    const intrusos = [];
    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            const dx = x + 0.5 - center;
            const dy = y + 0.5 - center;
            if (Math.hypot(dx, dy) <= limit) continue;
            const pixel = image.pixel(x, y);
            if (!isSky(pixel)) intrusos.push([x, y, pixel]);
        }
    }
    assert.deepEqual(intrusos.slice(0, 3), [], `${intrusos.length} pixels do bloco fora do círculo seguro`);
});

test('o ícone maskable tem fundo cheio (nada de transparência no recorte)', () => {
    const image = decode('icon-maskable-512.png');
    for (let i = 3; i < image.pixels.length; i += 4) {
        assert.equal(image.pixels[i], 255, 'maskable transparente fica com buraco no launcher');
    }
});

test('o ícone do iOS é opaco, 180 e ligado no index.html', () => {
    const file = 'apple-touch-icon-180.png';
    assert.match(html, new RegExp(`<link rel="apple-touch-icon" href="icons/${file}">`),
        'o iPhone não lê o manifest: precisa deste link');

    const image = decode(file);
    assert.equal(image.width, 180);
    assert.equal(image.height, 180);
    for (let i = 3; i < image.pixels.length; i += 4) {
        assert.equal(image.pixels[i], 255,
            'o iOS pinta transparência de preto: este ícone não pode ter alpha 0');
    }

    // A maçã recorta os cantos: o bloco tem que caber no miolo arredondado.
    const center = image.width / 2;
    const limit = image.width * IOS_ROUNDED;
    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            if (Math.hypot(x + 0.5 - center, y + 0.5 - center) <= limit) continue;
            assert.ok(isSky(image.pixel(x, y)), `bloco saindo do canto arredondado em ${x},${y}`);
        }
    }
});

test('todo ícone mostra o bloco: grama em cima e terra embaixo', () => {
    for (const file of iconFiles) {
        const image = decode(file);
        const green = share(image, isGreen);
        const brown = share(image, isBrown);
        assert.ok(green > 0.12, `${file}: só ${(green * 100).toFixed(1)}% de grama`);
        assert.ok(brown > 0.06, `${file}: só ${(brown * 100).toFixed(1)}% de terra`);
    }
});

test('o favicon é chapado e cabe no quadro (16 px não perdoa textura)', () => {
    const image = decode('favicon-32.png');
    assert.equal(image.width, 32);
    assert.ok(distinctColors(image) <= 6,
        `${distinctColors(image)} cores: o ruído do bloco vira sujeira em 16 px`);

    // O bloco ocupa o quadro sem vazar dele.
    const center = image.width / 2;
    for (const [x, y] of [[0, 0], [31, 0], [0, 31], [31, 31]]) {
        assert.equal(image.pixel(x, y)[3], 0, `canto ${x},${y} devia ser transparente`);
    }
    assert.ok(Math.abs(center - 15.5) < 1, 'bloco centralizado');
});

test('o gerador é determinístico (ícone igual toda vez)', () => {
    const first = renderIcon(48, { background: '#87ceeb', blockRatio: 0.8 });
    const second = renderIcon(48, { background: '#87ceeb', blockRatio: 0.8 });
    assert.deepEqual(first, second);
    assert.notDeepEqual(renderIcon(48, { blockRatio: 0.8 }), second, 'fundo muda o desenho');
});
