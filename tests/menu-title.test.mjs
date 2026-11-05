import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// Recorta só o bloco do título para não confundir com o resto da página.
const logoStart = html.indexOf('<div class="title-screen-logo"');
const logoEnd = html.indexOf('</div>', logoStart);
const logo = html.slice(logoStart, logoEnd);

// ------------------------------------------------ o desenho do título

test('o título do menu é um SVG inline, sem imagem ou arquivo externo', () => {
    assert.ok(logoStart > -1, 'o bloco .title-screen-logo existe');
    assert.match(logo, /<svg class="title-logo-art" viewBox="0 0 [\d.]+ [\d.]+"/);
    assert.match(logo, /aria-hidden="true"/, 'o desenho é decorativo para o leitor de tela');
    assert.doesNotMatch(logo, /<image\b/, 'nada de bitmap embutido');
    assert.doesNotMatch(logo, /href=/, 'nada de recurso externo dentro do título');
    assert.doesNotMatch(logo, /https?:\/\//, 'nada de URL remota');
});

test('o nome continua acessível pelo container e rotula a tela inicial', () => {
    assert.match(html, /<main id="title-screen" aria-labelledby="title-screen-logo">/);
    assert.match(logo, /^<div class="title-screen-logo" id="title-screen-logo" role="img" aria-label="Voxel Sandbox">/);
});

test('as duas palavras são blocos de pedra com profundidade, contorno e face texturizada', () => {
    // Uma face de pedra por palavra (VOXEL e SANDBOX).
    assert.equal(logo.match(/fill="url\(#title-stone\)"/g)?.length, 2, 'duas faces texturizadas');
    // Um contorno escuro por palavra, desenhado antes da face para sobrar só a borda externa.
    assert.equal(logo.match(/stroke="#241f18"/g)?.length, 2, 'dois contornos');
    // Duas camadas de extrusão por palavra: a sombra funda e o degrau do meio.
    assert.equal(logo.match(/fill="#2f2b22"/g)?.length, 2, 'duas extrusões fundas');
    assert.equal(logo.match(/fill="#4a4130"/g)?.length, 2, 'dois degraus intermediários');
    assert.match(logo, /<pattern id="title-stone" width="14" height="14" patternUnits="userSpaceOnUse">/);
    // A inclinação é aplicada uma vez, no grupo das duas palavras.
    assert.equal(logo.match(/rotate\(-3(\.\d+)?\)/g)?.length, 1, 'uma inclinação só');
});

test('o splash e o texto em fonte do sistema saíram do título', () => {
    assert.doesNotMatch(html, /title-logo-splash/);
    assert.doesNotMatch(html, /um mundo de blocos!/);
    assert.doesNotMatch(styles, /\.title-logo-(main|sub|splash)\b/);
});

// ------------------------------------------------ o tamanho na tela

test('o título escala de 360 px a 4K sem encostar nos botões', () => {
    const regra = styles.match(/\.title-screen-logo \{[^}]*\}/)?.[0] ?? '';
    assert.match(regra, /width:\s*min\(86vw,\s*620px,\s*calc\(46vh \* 1\.909\)\)/,
        'largura presa à viewport, a um teto e à altura disponível');
    assert.match(styles, /\.title-logo-art \{[^}]*width:\s*100%[^}]*height:\s*auto/,
        'o SVG acompanha o container sem distorcer');
    const baixa = styles.match(/@media \(max-height: 540px\) \{[\s\S]*?\n    \}/)?.[0] ?? '';
    assert.match(baixa, /\.title-screen-logo \{[^}]*calc\(33vh \* 1\.909\)/,
        'em tela baixa o título encolhe junto com a altura');
});
