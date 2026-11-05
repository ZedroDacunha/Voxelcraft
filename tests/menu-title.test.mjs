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
    assert.match(logo, /^<div class="title-screen-logo" id="title-screen-logo" role="img" aria-label="Voxel Sandbox">/);
});

test('as duas palavras são lajes de pedra: face, contorno, massa e fundo claro', () => {
    // As duas palavras existem como <path> e são reusadas por <use> em cada camada.
    assert.match(logo, /<path id="title-word-0"/);
    assert.match(logo, /<path id="title-word-1"/);
    assert.equal(uses(/href="#title-word-0"/).length, uses(/href="#title-word-1"/).length,
        'as duas palavras têm o mesmo número de camadas');

    // Face de pedra + véu de sombra em cada palavra.
    assert.equal(uses(/fill="url\(#title-stone\)"/).length, 2, 'duas faces texturizadas');
    assert.equal(uses(/fill="url\(#title-shade\)"/).length, 2, 'dois véus de sombra');

    // Contorno da face (fino) e contorno da laje inteira (grosso, no fundo).
    assert.equal(uses(/stroke="#141310"/).length, 2, 'dois contornos de face');
    assert.equal(uses(/stroke="#12110f"/).length, 2, 'dois contornos de laje');

    // Fundo claro da laje, o degrau iluminado que aparece embaixo das letras.
    assert.equal(uses(/fill="#aeaca1"/).length, 2, 'dois fundos claros');
});

test('a profundidade é uma laje maciça, não uma sombra chapada', () => {
    const massa = uses(/fill="url\(#title-slab\)"/);
    assert.ok(massa.length >= 12, `a massa escura é empilhada em vários passos (achei ${massa.length})`);
    for (const tag of massa) {
        assert.match(tag, /transform="translate\([\d.]+ [\d.]+\)"/, 'cada passo anda na diagonal');
    }
    // Todas as camadas de uma palavra compartilham o mesmo path: é ele que garante a laje sólida.
    assert.match(logo, /<use href="#title-word-0" fill="url\(#title-slab\)" transform="translate\(12\.6 30\)"\/>/);
});

test('a pedra é textura de padrão, com manchas e uma trinca', () => {
    assert.match(logo, /<pattern id="title-stone" width="[\d.]+" height="[\d.]+" patternUnits="userSpaceOnUse">/);
    const pattern = logo.slice(logo.indexOf('<pattern id="title-stone"'), logo.indexOf('</pattern>'));
    assert.ok((pattern.match(/<rect\b/g) ?? []).length >= 10, 'manchas suficientes para não virar cor chapada');
    assert.match(pattern, /fill="#dbd8ce"/, 'base clara da pedra');
});

test('a sombra da face escurece de cima para baixo', () => {
    const grad = logo.slice(logo.indexOf('<linearGradient id="title-shade"'), logo.indexOf('</linearGradient>'));
    assert.match(grad, /x2="0" y2="1"/, 'gradiente vertical');
    assert.match(grad, /stop-opacity="\.38"/, 'topo iluminado');
    assert.match(grad, /stop-opacity="\.3"/, 'base na sombra');
});

test('o splash e o texto em fonte do sistema saíram do título', () => {
    assert.doesNotMatch(html, /title-logo-splash/);
    assert.doesNotMatch(html, /um mundo de blocos!/);
    assert.doesNotMatch(styles, /\.title-logo-(main|sub|splash)\b/);
});

// ------------------------------------------------ o tamanho na tela

test('o título escala de 360 px a 4K sem encostar nos botões', () => {
    const regra = styles.match(/\.title-screen-logo \{[^}]*\}/)?.[0] ?? '';
    assert.match(regra, /width:\s*min\(86vw,\s*620px,\s*calc\(46vh \* 2\.4505\)\)/,
        'largura presa à viewport, a um teto e à altura disponível');
    assert.match(styles, /\.title-logo-art \{[^}]*width:\s*100%[^}]*height:\s*auto/,
        'o SVG acompanha o container sem distorcer');
    const baixa = styles.match(/@media \(max-height: 540px\) \{[\s\S]*?\n    \}/)?.[0] ?? '';
    assert.match(baixa, /\.title-screen-logo \{[^}]*calc\(33vh \* 2\.4505\)/,
        'em tela baixa o título encolhe junto com a altura');
});
