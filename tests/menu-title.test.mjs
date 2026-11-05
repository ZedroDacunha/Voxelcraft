import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// Recorta só o bloco do título para não confundir com o resto da página.
const logoStart = html.indexOf('<div class="title-screen-logo"');
const logoEnd = html.indexOf('</svg>', logoStart);
const logo = html.slice(logoStart, logoEnd);

const uses = (filtro) => (logo.match(/<use\b[^>]*>/g) ?? []).filter((tag) => filtro.test(tag));

// ------------------------------------------------ o desenho do título

test('o título do menu é um SVG inline, sem imagem ou arquivo externo', () => {
    assert.ok(logoStart > -1, 'o bloco .title-screen-logo existe');
    assert.match(logo, /<svg class="title-logo-art"[^>]*viewBox="0 0 [\d.]+ [\d.]+"/);
    assert.match(logo, /aria-hidden="true"/, 'o desenho é decorativo para o leitor de tela');
    assert.doesNotMatch(logo, /<image\b/, 'nada de bitmap embutido');
    assert.doesNotMatch(logo, /https?:\/\//, 'nada de URL remota');
    assert.doesNotMatch(logo, /\.svg|\.png/, 'nada de arquivo de fora');
});

test('o nome continua acessível pelo container e rotula a tela inicial', () => {
    assert.match(html, /<main id="title-screen" aria-labelledby="title-screen-logo">/);
    assert.match(logo, /^<div class="title-screen-logo" id="title-screen-logo" role="img" aria-label="Voxelcraft">/);
    assert.doesNotMatch(html, /Voxel Sandbox<\/div>/, 'o nome desenhado é VOXELCRAFT, sem o SANDBOX');
});

test('a palavra é uma só, como no logo clássico', () => {
    assert.equal((logo.match(/<path id="title-word"/g) ?? []).length, 1, 'um único contorno de palavra');
    assert.doesNotMatch(logo, /title-word-\d/, 'não há segunda palavra (SANDBOX saiu)');
});

test('a palavra é uma laje: contorno, fundo claro, massa escura e face', () => {
    // Contorno grosso da laje inteira e contorno fino da face.
    assert.equal(uses(/stroke="#151413"/).length, 2, 'dois contornos');
    // Faixa clara da face inferior da laje.
    assert.equal(uses(/fill="#bcbab4"/).length, 1, 'um fundo claro');
    // Massa escura empilhada até virar sólida.
    const massa = uses(/fill="#333230"/);
    assert.ok(massa.length >= 8, `a massa escura é empilhada em vários passos (achei ${massa.length})`);
    for (const tag of massa) {
        assert.match(tag, /transform="translate\([\d.]+ [\d.]+\)"/, 'cada passo anda na diagonal');
    }
    // Face em três tons de pedra, mais o véu de luz/sombra por cima.
    assert.equal(uses(/href="#title-word-t1"/).length, 1);
    assert.equal(uses(/href="#title-word-t2"/).length, 1);
    assert.equal(uses(/href="#title-word-t3"/).length, 1);
    assert.equal(uses(/fill="url\(#title-shade\)"/).length, 1);
});

test('a pedra é um mosaico de blocos, não uma cor chapada', () => {
    for (const [id, cor] of [['t1', '#dcdad5'], ['t2', '#cbc9c4'], ['t3', '#a3a19c']]) {
        const m = logo.match(new RegExp(`<path id="title-word-${id}"[^>]*>`));
        assert.ok(m, `a camada ${id} existe`);
        assert.match(m[0], new RegExp(`fill="${cor}"`), `a camada ${id} tem o tom ${cor}`);
        // Cada tom é feito de muitos retângulos de 7 unidades (o tamanho da célula),
        // fundidos na vertical — daí a altura variável.
        const blocos = (m[0].match(/h7v\d+h-7z/g) ?? []).length;
        assert.ok(blocos > 20, `a camada ${id} tem blocos suficientes (achei ${blocos})`);
    }
});

test('a sombra da face escurece de cima para baixo', () => {
    const grad = logo.slice(logo.indexOf('<linearGradient id="title-shade"'), logo.indexOf('</linearGradient>'));
    assert.match(grad, /x2="0" y2="1"/, 'gradiente vertical');
    assert.match(grad, /stop-opacity="\.30"/, 'topo iluminado');
    assert.match(grad, /stop-opacity="\.26"/, 'base na sombra');
});

test('o splash e o texto em fonte do sistema saíram do título', () => {
    assert.doesNotMatch(html, /title-logo-splash/);
    assert.doesNotMatch(html, /um mundo de blocos!/);
    assert.doesNotMatch(html, /SANDBOX/);
    assert.doesNotMatch(styles, /\.title-logo-(main|sub|splash)\b/);
});

// ------------------------------------------------ o tamanho na tela

test('o título escala de 360 px a 4K sem encostar nos botões', () => {
    const regra = styles.match(/\.title-screen-logo \{[^}]*\}/)?.[0] ?? '';
    assert.match(regra, /width:\s*min\(90vw,\s*860px,\s*calc\(46vh \* 5\.3658\)\)/,
        'largura presa à viewport, a um teto e à altura disponível');
    assert.match(styles, /\.title-logo-art \{[^}]*width:\s*100%[^}]*height:\s*auto/,
        'o SVG acompanha o container sem distorcer');
    const baixa = styles.match(/@media \(max-height: 540px\) \{[\s\S]*?\n    \}/)?.[0] ?? '';
    assert.match(baixa, /\.title-screen-logo \{[^}]*calc\(28vh \* 5\.3658\)/,
        'em tela baixa o título encolhe junto com a altura');
});
