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

test('o letreiro tem contornos frontal e traseiro e faces de profundidade', () => {
    const fundo = uses(/href="#title-word"/).find(tag => tag.includes('scale('));
    assert.ok(fundo?.includes('translate('), 'a extrusão recua e desce');
    assert.match(fundo, /stroke=/);
    const paredes = logo.match(/<g stroke="#25272a"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? '';
    const tons = [...paredes.matchAll(/<path fill="(#[\da-f]{6})"/g)].map(m => m[1]);
    assert.ok(new Set(tons).size >= 3, 'base e laterais recebem luz diferente');
    assert.equal(uses(/fill="url\(#title-stone\)"/).length, 1);
});

test('textura e fissuras ficam dentro das letras', () => {
    assert.match(logo, /<clipPath id="title-inside"><use href="#title-word" clip-rule="evenodd"/);
    const detalhes = logo.slice(logo.indexOf('<g clip-path="url(#title-inside)">'));
    assert.match(logo, /<pattern id="title-grain"[^>]*patternUnits="userSpaceOnUse"/);
    assert.match(detalhes, /fill="url\(#title-grain\)"/);
    assert.match(detalhes, /stroke="#666867"/);
});

test('a iluminação da pedra escurece de cima para baixo', () => {
    const grad = logo.match(/<linearGradient id="title-stone"[^>]*>([\s\S]*?)<\/linearGradient>/)?.[0] ?? '';
    assert.match(grad, /x2="0" y2="1"/);
    const tons = [...grad.matchAll(/stop-color="#([\da-f]{6})"/g)].map(m =>
        m[1].match(/../g).reduce((soma, canal) => soma + parseInt(canal, 16), 0));
    assert.ok(tons.length >= 2 && tons.every((tom, i) => i === 0 || tom < tons[i - 1]));
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

test('o nome do jogo é o mesmo no rodapé, no README e no título desenhado', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    assert.match(readme, /^# Voxelcraft$/m, 'o README abre com o nome novo');
    assert.match(html, /<footer class="title-screen-footer">\s*<span>Voxelcraft · Edição de sobrevivência<\/span>/,
        'o rodapé do menu usa o nome novo');
    assert.match(logo, /aria-label="Voxelcraft"/, 'e o título desenhado também');
    assert.doesNotMatch(readme, /^# SiteCraft$/m, 'o nome antigo não ficou no topo do README');
});
